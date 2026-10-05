import logging
import json
from datetime import datetime, timezone
from uuid import UUID
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
from . import models as m, extraction

class ExtractionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    requestId: UUID
    messageId: UUID
    workspaceId: UUID

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
        proposal, model = extraction.generate(content)
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
