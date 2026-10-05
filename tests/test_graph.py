"""Real HTTP handlers + SQLAlchemy + Alembic + file-backed SQLite (no D1 mocks)."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import json
import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter
from sqlalchemy import select, event
from backend.main import create_app
from backend import models as m
from backend.schemas import GraphCommand
from backend.service import apply

@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / 'graph.sqlite'), base_url='http://127.0.0.1:8000') as client:
        yield client

def post(client, action, expected_status=200, **fields):
    response = client.post('/api/graph', json={'commandId': str(uuid4()), 'action': action, **fields})
    assert response.status_code == expected_status, response.text
    return response.json()

def containers(client):
    return (post(client, 'workspace', title='מרחב')['id'],
            post(client, 'conversation', title='שיחה')['id'])

def graph(client):
    response = client.get('/api/graph')
    assert response.status_code == 200
    return response.json()

def test_vertical_flow_and_restart(tmp_path):
    path = tmp_path / 'persistent.sqlite'
    with TestClient(create_app(path), base_url='http://127.0.0.1:8000') as client:
        ws, conv = containers(client)
        msg = post(client, 'message', workspaceId=ws, conversationId=conv,
                   content='יש קשר בין [[שדה]] ל[[כוח]]')['id']
        data = graph(client)
        assert len(data['ideas']) == 2
        idea = data['ideas'][0]
        post(client, 'idea', id=idea['id'], title=idea['title'], summary='תיאור מעודכן', status='accepted')
        ws2, conv2 = containers(client)
        post(client, 'message', workspaceId=ws2, conversationId=conv2, content='[[שדה]]')
        connection = post(client, 'connection', label='קשר', ideaIds=[i['id'] for i in data['ideas']])['id']
        data = graph(client)
        assert len(data['ideas']) == 2
        assert len([l for l in data['message_ideas'] if l['idea_id'] == idea['id']]) == 2
        assert len([l for l in data['workspace_ideas'] if l['idea_id'] == idea['id']]) == 2
        assert any(l['message_id'] == msg and l['idea_id'] == idea['id'] for l in data['message_ideas'])
        assert len([p for p in data['connection_participants'] if p['connection_id'] == connection]) == 2
        change = next(e for e in data['events'] if e['action'] == 'revise')
        assert json.loads(change['before'])['summary'] == idea['title']
        assert json.loads(change['after'])['summary'] == 'תיאור מעודכן'
        assert next(i for i in data['ideas'] if i['id'] == idea['id'])['created_by'] == 'system:rules'
        assert change['created_by'] == 'local:user'
    assert path.exists()
    # A new app/engine reopens the same file; startup migrations do not reset data.
    with TestClient(create_app(path), base_url='http://127.0.0.1:8000') as restarted:
        assert graph(restarted) == data

def test_validation_and_atomic_failure(client):
    ws, conv = containers(client)
    baseline = graph(client)
    post(client, 'message', expected_status=404, workspaceId=ws, conversationId=str(uuid4()), content='[[חדש]]')
    post(client, 'message', expected_status=422, workspaceId=ws, conversationId=conv, content=' ')
    post(client, 'workspace', expected_status=422, title='x' * 181)
    assert graph(client) == baseline
    # Fail during the final receipt INSERT, after graph and audit INSERTs ran.
    engine = client.app.state.engine
    def fail_receipt(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith('INSERT INTO command_receipts'):
            raise RuntimeError('Injected transaction failure')
    event.listen(engine, 'before_cursor_execute', fail_receipt)
    try:
        with pytest.raises(RuntimeError):
            post(client, 'message', workspaceId=ws, conversationId=conv, content='[[rollback]]')
    finally:
        event.remove(engine, 'before_cursor_execute', fail_receipt)
    assert graph(client) == baseline

def test_external_link_can_open_home_but_not_access_data(client):
    navigation = {'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate',
                  'sec-fetch-dest': 'document'}
    # Without a frontend build the home handler returns 503, not the origin guard.
    assert client.get('/', headers=navigation).status_code in (200, 503)
    assert client.get('/api/graph', headers=navigation).status_code == 403
    assert client.get('/', headers={**navigation, 'sec-fetch-dest': 'iframe'}).status_code == 403
    assert client.get('/', headers={**navigation, 'sec-fetch-mode': 'cors'}).status_code == 403
    assert client.get('/', headers={**navigation, 'origin': 'https://evil.example'}).status_code == 403
    body = {'commandId': str(uuid4()), 'action': 'workspace', 'title': 'blocked'}
    assert client.post('/api/graph', json=body, headers=navigation).status_code == 403
    assert client.get('/api/graph', headers={'origin': 'http://127.0.0.1:8000',
                                          'sec-fetch-site': 'same-origin'}).status_code == 200
    assert graph(client)['workspaces'] == []

def test_retry_receipt_and_conflict(client):
    ws, conv = containers(client)
    body = {'commandId': str(uuid4()), 'action': 'message', 'content': '[[Field]]',
            'workspaceId': ws, 'conversationId': conv}
    first = client.post('/api/graph', json=body)
    assert first.status_code == 200
    before = graph(client)
    assert client.post('/api/graph', json=body).json() == first.json()
    assert graph(client) == before
    assert client.post('/api/graph', json={**body, 'content': 'different'}).status_code == 409

def test_parallel_creation_reuses_idea(client):
    ws, conv = containers(client)
    def send(_):
        command = TypeAdapter(GraphCommand).validate_python(dict(commandId=str(uuid4()), action='message',
                    content='[[same idea]]', workspaceId=ws, conversationId=conv))
        return apply(client.app.state.engine, command)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(send, range(8)))
    data = graph(client)
    assert len(data['ideas']) == 1
    assert len(data['messages']) == len(data['message_ideas']) == 8

def test_manual_links_multiple_actors_and_hyperedge(client):
    ws, conv = containers(client)
    msg = post(client, 'message', workspaceId=ws, conversationId=conv, content='[[A]] [[B]] [[C]]')['id']
    data = graph(client)
    ids = [i['id'] for i in data['ideas']]
    ws2, _ = containers(client)
    command = TypeAdapter(GraphCommand).validate_python(dict(commandId=str(uuid4()), action='link',
        ideaId=ids[0], messageId=msg, workspaceId=ws2))
    apply(client.app.state.engine, command, 'second-actor', 'Second actor')
    post(client, 'connection', label='three participants', ideaIds=ids)
    post(client, 'connection', expected_status=400, label='invalid', ideaIds=[ids[0], ids[0]])
    post(client, 'idea', id=ids[1], title='B', summary='B', status='rejected')
    post(client, 'connection', expected_status=400, label='rejected participant', ideaIds=ids[:2])
    after = graph(client)
    assert len(after['connections']) == 1
    assert len(after['connection_participants']) == 3
    assert any(e['created_by'] == 'second-actor' for e in after['events'])
    assert len(after['message_ideas']) == 3  # Idempotent join preserves original provenance.

def test_local_request_boundaries(client):
    body = dict(action='workspace', commandId=str(uuid4()), title='test')
    assert client.post('/api/graph', json=body, headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.post('/api/graph', json=body, headers={'Host': 'evil.example'}).status_code == 400
    assert client.post('/api/graph', content=json.dumps(body), headers={'Content-Type': 'text/plain'}).status_code == 415
    assert not graph(client)['workspaces']
    assert client.post('/api/graph', json=body, headers={'Origin': 'http://127.0.0.1:8000'}).status_code == 200
    assert client.get('/api/health').json()['storage'] == 'sqlite'
    assert client.get('/openapi.json').status_code == 200

def test_relation_taxonomy_and_connection_details(client):
    ws, conv = containers(client)
    post(client, 'message', workspaceId=ws, conversationId=conv, content='[[A]] [[B]]')
    root = post(client, 'relation-type', title='Causality')['id']
    child = post(client, 'relation-type', title='Influences', parentId=root)['id']
    before = graph(client)
    post(client, 'relation-type', id=root, title='Causality', parentId=child, expected_status=400)
    assert graph(client) == before
    post(client, 'relation-type', title=' influences ', parentId=root, expected_status=409)
    post(client, 'connection', label='A influences B', ideaIds=[i['id'] for i in before['ideas']],
         typeId=child, description='Evidence and qualifications', suggestion='Original template')
    data = graph(client)
    connection = data['connections'][0]
    assert connection['type_id'] == child
    assert connection['description'] == 'Evidence and qualifications'
    assert connection['suggestion'] == 'Original template'
    assert connection['created_by'] == 'local:user'
    post(client, 'relation-type', id=child, title='Affects', parentId=root)
    assert graph(client)['connections'][0]['type_id'] == child

def test_migration_preserves_existing_connections(tmp_path):
    from alembic.config import Config
    from alembic import command
    from backend.database import ROOT, make_engine, migrate
    engine = make_engine(tmp_path / 'old.sqlite')
    config = Config(str(ROOT / 'alembic.ini'))
    config.set_main_option('script_location', str(ROOT / 'migrations'))
    with engine.begin() as db:
        config.attributes['connection'] = db
        command.upgrade(config, '01831181783e')
        db.exec_driver_sql("INSERT INTO users VALUES ('old-user','Original author')")
        db.exec_driver_sql("INSERT INTO connections (id,label,created_by,created_at) VALUES ('old-edge','Original edge','old-user','2026-01-01')")
    migrate(engine)
    with engine.connect() as db:
        row = db.execute(select(m.connections)).mappings().one()
        assert row['label'] == 'Original edge' and row['created_by'] == 'old-user'
        assert row['type_id'] is None and row['description'] == ''
        assert db.exec_driver_sql('PRAGMA foreign_key_check').all() == []
    engine.dispose()


def test_question_connection_can_be_refined_without_losing_provenance(client):
    ws, conv = containers(client)
    post(client, 'message', workspaceId=ws, conversationId=conv, content='[[A]] [[B]]')
    ids = [idea['id'] for idea in graph(client)['ideas']]
    cid = post(client, 'connection', label='?', ideaIds=ids)['id']
    before = graph(client)
    original = next(c for c in before['connections'] if c['id'] == cid)
    body = dict(commandId=str(uuid4()), action='revise-connection', id=cid,
                label='supports', description='A supports B')
    assert client.post('/api/graph', json=body).status_code == 200
    assert client.post('/api/graph', json=body).status_code == 200
    after = graph(client)
    current = next(c for c in after['connections'] if c['id'] == cid)
    assert len(after['connections']) == 1
    assert current['label'] == 'supports'
    assert current['created_at'] == original['created_at']
    assert current['created_by'] == original['created_by']
    assert current['type_id'] == original['type_id']
    assert after['connection_participants'] == before['connection_participants']
    revisions = [e for e in after['events'] if e['entity_id'] == cid and e['action'] == 'revise']
    assert len(revisions) == 1
    assert json.loads(revisions[0]['before'])['label'] == '?'
    post(client, 'revise-connection', expected_status=404, id=str(uuid4()), label='x')
    post(client, 'revise-connection', expected_status=422, id=cid, label=' ')
    assert graph(client) == after
