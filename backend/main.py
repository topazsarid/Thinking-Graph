import logging
import json
from datetime import datetime, timezone
from uuid import UUID, uuid4
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .database import ROOT, database_path, make_engine, migrate
from .schemas import GraphCommand
from .service import apply, snapshot, DomainError
from typing import Literal
from . import models as m, extraction, replies, ai_queue

class ExtractionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    requestId: UUID
    messageId: UUID
    workspaceId: UUID

class ReplyRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    requestId: UUID
    messageId: UUID
    workspaceId: UUID | None = None
    mode: Literal['self', 'external', 'search']

ASSISTANT = ('assistant:local', 'עוזר מקומי · מודל')
MODE_LABELS = {'self': 'התייעצות עם עצמך', 'external': 'יועץ חיצוני', 'search': 'חיפוש חכם במפה'}
CANCELLED = 'הבקשה בוטלה.'

def create_app(path: Path | None = None):
    engine = make_engine(path or database_path())
    @asynccontextmanager
    async def lifespan(app):
        migrate(engine)
        yield
        engine.dispose()

    app = FastAPI(title='Thinking Graph — Local API', lifespan=lifespan)
    app.state.engine = engine
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]'])

    @app.middleware('http')
    async def local_only(request: Request, call_next):
        origin = request.headers.get('origin')
        allowed = {f'http://{host}:{port}' for host in ('127.0.0.1', 'localhost') for port in (8000, 5173)}
        if origin and origin not in allowed:
            return JSONResponse({'error': 'מקור הבקשה אינו מורשה'}, status_code=403)
        # A link from another site may open the local home page. This exception
        # never applies to API requests, writes, or embedded frames.
        home_navigation = (
            request.method == 'GET' and request.url.path == '/'
            and request.headers.get('sec-fetch-mode') == 'navigate'
            and request.headers.get('sec-fetch-dest') == 'document'
        )
        if request.headers.get('sec-fetch-site') == 'cross-site' and not home_navigation:
            return JSONResponse({'error': 'מקור הבקשה אינו מורשה'}, status_code=403)
        if request.method == 'POST' and request.headers.get('content-type', '').split(';')[0] != 'application/json':
            return JSONResponse({'error': 'נדרשת בקשת JSON'}, status_code=415)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.exception_handler(DomainError)
    async def domain_error(request, exc):
        return JSONResponse({'error': exc.message}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse({'error': 'הבקשה אינה תקינה. בדקי שהשדות מלאים ובאורך המותר.'}, status_code=422)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        # Never log SQL parameters: they can contain private thoughts.
        logging.getLogger(__name__).error('Database operation failed: %s', type(exc).__name__)
        return JSONResponse({'error': 'השמירה נכשלה. אפשר לנסות שוב.'}, status_code=503)

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'mode': 'local', 'storage': 'sqlite'}

    @app.get('/api/graph')
    def get_graph():
        return snapshot(engine)

    @app.post('/api/graph')
    def mutate_graph(command: GraphCommand):
        # Explicit local actor, not authentication and not an ownership boundary.
        return apply(engine, command)

    @app.post('/api/extractions')
    def extract_message(body: ExtractionRequest):
        run_id, message_id, workspace_id = str(body.requestId), str(body.messageId), str(body.workspaceId)
        def previous(db):
            row = db.execute(select(m.extraction_runs).where(m.extraction_runs.c.id == run_id)).mappings().first()
            if row and (row['message_id'] != message_id or row['workspace_id'] != workspace_id):
                raise DomainError('מזהה הבקשה כבר משמש לטיוטה אחרת', 409)
            return dict(row) if row else None
        with engine.connect() as db:
            existing = previous(db)
            if existing:
                return existing
            message = db.execute(select(m.messages).where(m.messages.c.id == message_id)).mappings().first()
            workspace = db.execute(select(m.workspaces.c.id).where(m.workspaces.c.id == workspace_id)).first()
            if not message or not workspace:
                raise DomainError('ההודעה או המרחב אינם קיימים', 404)
            content = message['content']
        extraction.precheck(content)
        try:
            proposal, model = ai_queue.run('extraction', 'חילוץ: ' + content[:60],
                                           lambda: extraction.generate(content), ref=message_id)
        except ai_queue.Cancelled:
            raise DomainError(CANCELLED, 410)
        values = dict(id=run_id, message_id=message_id, workspace_id=workspace_id, model=model,
            proposal=proposal.model_dump_json(), review=None, status='pending',
            created_by='local:user', created_at=datetime.now(timezone.utc).isoformat())
        with engine.connect() as db:
            db.exec_driver_sql('BEGIN IMMEDIATE')
            existing = previous(db)
            if existing:
                db.rollback()
                return existing
            db.execute(m.extraction_runs.insert().values(**values))
            db.commit()
        return values

    @app.post('/api/replies')
    def reply_to_message(body: ReplyRequest):
        # Same retry rule as extraction: the request ID is the reply ID, so a lost response
        # never starts a second generation. Other app actions keep working meanwhile.
        reply_id, message_id = str(body.requestId), str(body.messageId)
        workspace_id = str(body.workspaceId) if body.workspaceId else None
        def previous(db):
            row = db.execute(select(m.chat_replies).where(m.chat_replies.c.id == reply_id)).mappings().first()
            if row and (row['message_id'] != message_id or row['mode'] != body.mode):
                raise DomainError('מזהה הבקשה כבר משמש לתשובה אחרת', 409)
            return dict(row) if row else None
        with engine.connect() as db:
            existing = previous(db)
            if existing:
                return existing
            message = db.execute(select(m.messages).where(m.messages.c.id == message_id)).mappings().first()
            if not message:
                raise DomainError('ההודעה אינה קיימת', 404)
            if workspace_id and not db.execute(select(m.workspaces.c.id).where(m.workspaces.c.id == workspace_id)).first():
                raise DomainError('המרחב אינו קיים', 404)
            conversation = db.execute(select(m.conversations).where(
                m.conversations.c.id == message['conversation_id'])).mappings().first()
            earlier = [r['content'] for r in db.execute(select(m.messages.c.content).where(
                m.messages.c.conversation_id == message['conversation_id'],
                m.messages.c.created_at < message['created_at']).order_by(m.messages.c.created_at)).mappings()]
            candidates = [(r['id'], r['title']) for r in db.execute(select(m.ideas.c.id, m.ideas.c.title).where(
                m.ideas.c.status != 'rejected').order_by(m.ideas.c.created_at.desc())).mappings()] if body.mode == 'search' else None
        from .ollama import local_model
        local_model()
        try:
            result = ai_queue.run('reply', f"{MODE_LABELS[body.mode]}: {message['content'][:60]}",
                lambda: replies.generate(body.mode, message['content'], earlier,
                                         conversation['answer_preference'], candidates), ref=message_id)
        except ai_queue.Cancelled:
            raise DomainError(CANCELLED, 410)
        except (ValueError, KeyError, TypeError):
            raise DomainError('המודל החזיר תשובה לא תקינה. אפשר לנסות שוב.', 422)
        except (OSError, TimeoutError):
            raise DomainError('לא התקבלה תשובה מהמודל המקומי בזמן. ודאי ש־Ollama פועל ושהמודל מותקן, ונסי שוב.', 503)
        now = datetime.now(timezone.utc).isoformat()
        values = dict(id=reply_id, message_id=message_id, conversation_id=message['conversation_id'],
            workspace_id=workspace_id, mode=body.mode, content=result['content'],
            concept=json.dumps(result['concept'], ensure_ascii=False) if result['concept'] else None,
            idea_ids=json.dumps(result['idea_ids']) if result['idea_ids'] is not None else None,
            model=result['model'], created_by=ASSISTANT[0], created_at=now)
        with engine.connect() as db:
            db.exec_driver_sql('BEGIN IMMEDIATE')
            existing = previous(db)
            if existing:
                db.rollback()
                return existing
            if not db.execute(select(m.users.c.id).where(m.users.c.id == ASSISTANT[0])).first():
                db.execute(m.users.insert().values(id=ASSISTANT[0], name=ASSISTANT[1]))
            db.execute(m.chat_replies.insert().values(**values))
            db.execute(m.events.insert().values(id=str(uuid4()), entity_id=reply_id, entity_type='reply',
                action='create', before=None, after=json.dumps({'mode': body.mode, 'messageId': message_id,
                'model': result['model']}, ensure_ascii=False), created_by=ASSISTANT[0], created_at=now))
            db.commit()
        return values

    @app.get('/api/queue')
    def model_queue():
        return {'items': ai_queue.snapshot()}

    @app.post('/api/queue/{ticket_id}/cancel')
    def cancel_queued(ticket_id: str):
        return {'cancelled': ai_queue.cancel(ticket_id)}

    dist = ROOT / 'dist'
    if (dist / 'assets').is_dir():
        app.mount('/assets', StaticFiles(directory=dist / 'assets'), name='assets')

    @app.get('/favicon.svg', include_in_schema=False)
    def favicon():
        return FileResponse(ROOT / 'public' / 'favicon.svg')

    @app.get('/', include_in_schema=False)
    def home():
        if not (dist / 'index.html').exists():
            return JSONResponse({'error': 'יש להריץ npm run build לפני פתיחת האפליקציה'}, status_code=503)
        return FileResponse(dist / 'index.html')
    return app
