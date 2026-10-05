"""Graph operations with atomic provenance and retry-safe commands."""
import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import select
from . import models as m

SYSTEM = 'system:rules'

class DomainError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status

def normalize(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split()).casefold()

def extraction_title(item):
    qualifier = {'belief': 'אמונה', 'hypothesis': 'השערה', 'question': 'שאלה',
                 'preference': 'העדפה', 'unclear': 'לא ברור'}.get(item['epistemic'])
    return f"{qualifier}: {item['text']}" if qualifier else item['text']

def candidates(content):
    marked = re.findall(r'\[\[([^\]\n]{1,180})\]\]', content)
    pieces = marked or re.split(r'[\n.!?。]+', content)
    result, seen = [], set()
    for piece in pieces:
        title = piece.strip()[:180]
        key = normalize(title)
        if key and key not in seen:
            result.append(title)
            seen.add(key)
    return result[:8]

def snapshot(engine):
    with engine.connect() as db:
        # Explicit read transaction keeps all graph tables in one consistent snapshot.
        db.exec_driver_sql('BEGIN')
        try:
            return {t.name: [dict(r) for r in db.execute(select(t).order_by(t.c.created_at)
                    if 'created_at' in t.c else select(t).order_by(t.c.id)).mappings()]
                    for t in m.GRAPH_TABLES}
        finally:
            db.rollback()

def apply(engine, command, actor_id='local:user', actor_name='משתמשת מקומית'):
    payload = command.model_dump(mode='json')
    command_id = payload.pop('commandId')
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    now, result_id = datetime.now(timezone.utc).isoformat(), str(uuid4())
    with engine.connect() as db:
        # Serialize SQLite writers BEFORE looking up matching ideas/receipts.
        # A PostgreSQL port must replace this with suitable constraints/locking.
        db.exec_driver_sql('BEGIN IMMEDIATE')
        try:
            receipt = db.execute(select(m.command_receipts).where(m.command_receipts.c.id == command_id)).mappings().first()
            if receipt:
                if receipt['payload_hash'] != digest or receipt['created_by'] != actor_id:
                    raise DomainError('מזהה הפעולה כבר שימש לבקשה אחרת', 409)
                return {'id': receipt['result_id']}

            for uid, name in [(actor_id, actor_name), (SYSTEM, 'הצעה אוטומטית · כללים פשוטים')]:
                if not db.execute(select(m.users.c.id).where(m.users.c.id == uid)).first():
                    db.execute(m.users.insert().values(id=uid, name=name))

            def provenance(actor=actor_id):
                return dict(created_by=actor, created_at=now)

            def require(table, identifier):
                row = db.execute(select(table).where(table.c.id == identifier)).mappings().first()
                if not row:
                    raise DomainError('הפריט המבוקש אינו קיים', 404)
                return dict(row)

            def audit(identifier, kind, action, after, before=None, actor=actor_id):
                db.execute(m.events.insert().values(id=str(uuid4()), entity_id=identifier,
                    entity_type=kind, action=action,
                    before=json.dumps(before, ensure_ascii=False) if before is not None else None,
                    after=json.dumps(after, ensure_ascii=False), **provenance(actor)))

            def link(table, keys, actor=actor_id, **extra):
                conditions = [table.c[k] == v for k, v in keys.items()]
                if not db.execute(select(table).where(*conditions)).first():
                    db.execute(table.insert().values(**keys, **extra, **provenance(actor)))

            action = payload['action']
            if action in ('workspace', 'conversation'):
                table = m.workspaces if action == 'workspace' else m.conversations
                db.execute(table.insert().values(id=result_id, title=payload['title'], **provenance()))
                audit(result_id, action, 'create', {'title': payload['title']})
            elif action == 'note':
                result_id = payload['id'] or result_id
                before = require(m.notes, result_id) if payload['id'] else None
                values = dict(title=payload['title'], content=payload['content'], updated_at=now)
                if before:
                    db.execute(m.notes.update().where(m.notes.c.id == result_id).values(**values))
                else:
                    db.execute(m.notes.insert().values(id=result_id, **values, **provenance()))
                audit(result_id, 'note', 'revise' if before else 'create', values, before)
            elif action == 'snapshot-notes':
                require(m.workspaces, payload['workspaceId'])
                note_ids = list(dict.fromkeys(payload['noteIds']))
                rows = [require(m.notes, nid) for nid in note_ids]
                content = '\n\n'.join(f"פתק {n + 1}: {row['title']}\n{row['content']}" for n, row in enumerate(rows))
                if len(content) > 4000:
                    raise DomainError('אפשר לחלץ עד 4,000 תווים יחד, כולל כותרות. בחרי פחות פתקים או קטע קצר יותר.', 422)
                conversation_id = str(uuid4())
                db.execute(m.conversations.insert().values(id=conversation_id, title='חילוץ מפתקים', **provenance()))
                db.execute(m.messages.insert().values(id=result_id, conversation_id=conversation_id, content=content, **provenance()))
                for row in rows:
                    db.execute(m.note_message_sources.insert().values(note_id=row['id'], message_id=result_id,
                        title=row['title'], content=row['content'], note_updated_at=row['updated_at'], **provenance()))
                audit(result_id, 'message', 'snapshot-notes', {'noteIds': note_ids, 'workspaceId': payload['workspaceId']})
            elif action == 'connection-visibility':
                result_id = payload['id']
                before = require(m.connections, result_id)
                deleted_at = now if payload['deleted'] else None
                db.execute(m.connections.update().where(m.connections.c.id == result_id).values(deleted_at=deleted_at))
                audit(result_id, 'connection', 'delete' if payload['deleted'] else 'restore', {'deleted_at': deleted_at}, before)
            elif action == 'create-idea':
                require(m.workspaces, payload['workspaceId'])
                values = dict(title=payload['title'], summary=payload['summary'].strip() or payload['title'], status='accepted')
                db.execute(m.ideas.insert().values(id=result_id, **values, **provenance()))
                link(m.workspace_ideas, {'workspace_id': payload['workspaceId'], 'idea_id': result_id})
                audit(result_id, 'idea', 'create-on-map', {**values, 'workspaceId': payload['workspaceId'],
                    'kind': payload['kind'], 'origin': 'user-map'})
            elif action == 'message':
                require(m.conversations, payload['conversationId'])
                require(m.workspaces, payload['workspaceId'])
                db.execute(m.messages.insert().values(id=result_id, conversation_id=payload['conversationId'],
                    content=payload['content'], **provenance()))
                audit(result_id, 'message', 'create', {'content': payload['content']})
                existing = list(db.execute(select(m.ideas).where(m.ideas.c.status != 'rejected')).mappings())
                for title in (candidates(payload['content']) if payload['extractRules'] else []):
                    match = next((i for i in existing if normalize(i['title']) == normalize(title)), None)
                    idea_id = match['id'] if match else str(uuid4())
                    if not match:
                        db.execute(m.ideas.insert().values(id=idea_id, title=title, summary=title,
                            status='proposed', **provenance(SYSTEM)))
                        existing.append({'id': idea_id, 'title': title})
                    method = 'exact-title' if match else 'rule-extraction'
                    link(m.message_ideas, {'message_id': result_id, 'idea_id': idea_id}, actor=SYSTEM, method=method)
                    link(m.workspace_ideas, {'workspace_id': payload['workspaceId'], 'idea_id': idea_id})
                    audit(idea_id, 'idea', 'link-source' if match else 'propose',
                          {'messageId': result_id, 'title': title, 'method': method}, actor=SYSTEM)
            elif action == 'review-extraction':
                from .extraction import check_quotes
                run = require(m.extraction_runs, payload['runId'])
                if run['status'] != 'pending':
                    raise DomainError('הטיוטה כבר נבדקה. רענני את התצוגה.', 409)
                message = require(m.messages, run['message_id'])
                try:
                    check_quotes(command.proposal, message['content'])
                except ValueError:
                    raise DomainError('ציטוט המקור חייב להופיע במדויק בהודעה', 422)
                original = {i['key']: i for i in json.loads(run['proposal'])['items']}
                items = payload['proposal']['items']
                if any(i['key'] not in original or i['quote'] != original[i['key']]['quote'] for i in items):
                    raise DomainError('פריטי הטיוטה או ציטוטי המקור השתנו באופן לא תקין', 422)
                idea_keys = {i['key'] for i in items if i['kind'] == 'idea'}
                if set(payload['bindings']) - idea_keys:
                    raise DomainError('קישור לרעיון קיים אפשרי רק עבור רעיון שאושר', 422)
                mapping = {}
                for item in items:
                    if item['kind'] != 'idea':
                        continue
                    identifier = payload['bindings'].get(item['key'])
                    if identifier:
                        if require(m.ideas, identifier)['status'] == 'rejected':
                            raise DomainError('לא ניתן לקשר לרעיון שנדחה')
                    else:
                        identifier = str(uuid4())
                        db.execute(m.ideas.insert().values(id=identifier, title=extraction_title(item),
                            summary=item['detail'] or item['text'], status='accepted', **provenance()))
                    mapping[item['key']] = identifier
                    link(m.message_ideas, {'message_id': run['message_id'], 'idea_id': identifier}, method='reviewed-model')
                    link(m.workspace_ideas, {'workspace_id': run['workspace_id'], 'idea_id': identifier})
                    audit(identifier, 'idea', 'approve-extraction', {'runId': run['id'], 'model': run['model'],
                        'messageId': run['message_id'], 'evidence': item, 'linkedExisting': item['key'] in payload['bindings']})
                for item in items:
                    if item['kind'] != 'connection':
                        continue
                    source, target = mapping[item['source']], mapping[item['target']]
                    if source == target:
                        raise DomainError('שני קצות הקשר קושרו לאותו רעיון. הסירי את הקשר או בחרי רעיונות שונים.')
                    identifier = str(uuid4())
                    type_name = item['relation'] or item['text']
                    type_row = next((t for t in db.execute(select(m.relation_types)).mappings()
                        if t['parent_id'] is None and normalize(t['title']) == normalize(type_name)), None)
                    type_id = type_row['id'] if type_row else str(uuid4())
                    if not type_row:
                        db.execute(m.relation_types.insert().values(id=type_id, title=type_name,
                            description='', parent_id=None, **provenance()))
                        audit(type_id, 'relation-type', 'create', {'title': type_name, 'runId': run['id']})
                    db.execute(m.connections.insert().values(id=identifier, label=extraction_title(item),
                        description=item['detail'], type_id=type_id, **provenance()))
                    for iid, role in [(source, 'source'), (target, 'target')]:
                        db.execute(m.connection_participants.insert().values(connection_id=identifier,
                            idea_id=iid, role=role, **provenance()))
                    mapping[item['key']] = identifier
                    audit(identifier, 'connection', 'approve-extraction', {'runId': run['id'],
                        'messageId': run['message_id'], 'model': run['model'], 'evidence': item})
                # Metadata belongs to this source and optionally an idea; it never creates a graph node.
                review = {'items': items, 'entities': mapping, 'bindings': payload['bindings'],
                          'reviewedBy': actor_id, 'reviewedAt': now}
                result_id = run['id']
                db.execute(m.extraction_runs.update().where(m.extraction_runs.c.id == result_id).values(
                    review=json.dumps(review, ensure_ascii=False), status='reviewed'))
                audit(result_id, 'extraction', 'review', review, json.loads(run['proposal']))
            elif action == 'idea':
                before = require(m.ideas, payload['id'])
                values = {k: payload[k] for k in ('title', 'summary', 'status')}
                db.execute(m.ideas.update().where(m.ideas.c.id == payload['id']).values(**values))
                result_id = payload['id']
                audit(result_id, 'idea', 'revise', values, before)
            elif action == 'link':
                require(m.ideas, payload['ideaId'])
                require(m.workspaces, payload['workspaceId'])
                if payload['messageId']:
                    require(m.messages, payload['messageId'])
                    link(m.message_ideas, {'message_id': payload['messageId'], 'idea_id': payload['ideaId']}, method='manual')
                link(m.workspace_ideas, {'workspace_id': payload['workspaceId'], 'idea_id': payload['ideaId']})
                result_id = payload['ideaId']
                audit(result_id, 'idea', 'manual-link', {'messageId': payload['messageId'], 'workspaceId': payload['workspaceId']})
            elif action == 'relation-type':
                before = require(m.relation_types, payload['id']) if payload['id'] else None
                result_id = payload['id'] or result_id
                parent = payload['parentId']
                seen = {result_id}
                while parent:
                    if parent in seen:
                        raise DomainError('סוג קשר לא יכול להיות צאצא של עצמו')
                    seen.add(parent)
                    parent = require(m.relation_types, parent)['parent_id']
                siblings = db.execute(select(m.relation_types)).mappings()
                if any(r['id'] != result_id and r['parent_id'] == payload['parentId'] and
                       normalize(r['title']) == normalize(payload['title']) for r in siblings):
                    raise DomainError('סוג קשר בשם הזה כבר קיים בקטגוריה', 409)
                values = dict(title=payload['title'], description=payload['description'], parent_id=payload['parentId'])
                if before:
                    db.execute(m.relation_types.update().where(m.relation_types.c.id == result_id).values(**values))
                else:
                    db.execute(m.relation_types.insert().values(id=result_id, **values, **provenance()))
                audit(result_id, 'relation-type', 'revise' if before else 'create', values, before)
            elif action == 'revise-connection':
                result_id = payload['id']
                before = require(m.connections, result_id)
                if before['deleted_at']:
                    raise DomainError('יש לשחזר את הקשר לפני עריכה', 409)
                values = dict(label=payload['label'], description=payload['description'])
                db.execute(m.connections.update().where(m.connections.c.id == result_id).values(**values))
                audit(result_id, 'connection', 'revise', values, before)
            elif action == 'connection':
                ids = list(dict.fromkeys(payload['ideaIds']))
                if len(ids) < 2:
                    raise DomainError('יש לבחור לפחות שני רעיונות שונים')
                for idea_id in ids:
                    if require(m.ideas, idea_id)['status'] == 'rejected':
                        raise DomainError('לא ניתן ליצור קשר לרעיון שנדחה')
                type_id = payload['typeId']
                type_name = payload['typeName']
                parent_id = payload['parentId']
                if parent_id:
                    require(m.relation_types, parent_id)
                types = list(db.execute(select(m.relation_types)).mappings())
                aliases = list(db.execute(select(m.relation_aliases)).mappings())
                def matches(name, parent):
                    found = {t['id'] for t in types if t['parent_id'] == parent and normalize(t['title']) == normalize(name)}
                    scoped = {t['id'] for t in types if t['parent_id'] == parent}
                    found.update(a['type_id'] for a in aliases if a['type_id'] in scoped and normalize(a['title']) == normalize(name))
                    return found
                if type_id:
                    chosen = require(m.relation_types, type_id)
                    if payload['addAlias'] and type_name:
                        found = matches(type_name, chosen['parent_id'])
                        if found - {type_id}:
                            raise DomainError('השם כבר משויך לסוג אחר באותה קטגוריה', 409)
                        if type_id not in found:
                            alias_id = str(uuid4())
                            db.execute(m.relation_aliases.insert().values(id=alias_id, type_id=type_id, title=type_name, **provenance()))
                            audit(type_id, 'relation-type', 'add-alias', {'aliasId': alias_id, 'title': type_name, 'confirmedByUser': True})
                elif type_name:
                    found = matches(type_name, parent_id)
                    if len(found) > 1:
                        raise DomainError('יש כמה סוגים בשם הזה; בחרי סוג קיים במפורש', 409)
                    if found:
                        type_id = next(iter(found))
                    else:
                        type_id = str(uuid4())
                        db.execute(m.relation_types.insert().values(id=type_id, title=type_name, description='', parent_id=parent_id, **provenance()))
                        audit(type_id, 'relation-type', 'create', {'title': type_name, 'parentId': parent_id})
                values = dict(label=payload['label'], type_id=type_id,
                    description=payload['description'], suggestion=payload['suggestion'], missed=payload['missed'])
                db.execute(m.connections.insert().values(id=result_id, **values, **provenance()))
                for idea_id in ids:
                    db.execute(m.connection_participants.insert().values(connection_id=result_id,
                        idea_id=idea_id, role='participant', **provenance()))
                audit(result_id, 'connection', 'create', {**values, 'participants': ids,
                    'suggestionMethod': 'ui-template' if payload['suggestion'] else None})
            db.execute(m.command_receipts.insert().values(id=command_id, payload_hash=digest,
                        result_id=result_id, **provenance()))
            db.commit()
            return {'id': result_id}
        except Exception:
            db.rollback()
            raise
