import json
from uuid import uuid4
import pytest
from backend import extraction
from test_graph import client, containers, post, graph

TEXT = 'אני משערת שמאמץ שרירי מועיל. ישיבה על הרצפה דורשת מאמץ שרירי. יפן חיזקה את המחשבה.'

def item(key, kind, text, quote, **kwargs):
    return dict(key=key, kind=kind, text=text, detail=text, quote=quote,
                epistemic='hypothesis', relation='', source=None, target=None, uncertainty='', **kwargs)

def proposal():
    a = item('a', 'idea', 'ייתכן שמאמץ שרירי מועיל', 'אני משערת שמאמץ שרירי מועיל')
    b = item('b', 'idea', 'ישיבה על הרצפה', 'ישיבה על הרצפה')
    c = item('c', 'connection', 'דורשת', 'ישיבה על הרצפה דורשת מאמץ שרירי')
    c.update(source='b', target='a', relation='דורשת')
    d = item('d', 'metadata', 'יפן חיזקה את המחשבה', 'יפן חיזקה את המחשבה')
    d.update(relation='חיזקה', uncertainty='לא ברור לאיזו מחשבה הכוונה')
    return extraction.Proposal(items=[a,b,c,d])

def setup_run(client, monkeypatch):
    monkeypatch.setattr(extraction, 'generate', lambda content: (proposal(), 'test:model'))
    ws, conv = containers(client)
    msg = post(client, 'message', content=TEXT, workspaceId=ws, conversationId=conv, extractRules=False)['id']
    body = dict(requestId=str(uuid4()), messageId=msg, workspaceId=ws)
    r = client.post('/api/extractions', json=body)
    assert r.status_code == 200, r.text
    assert client.post('/api/extractions', json=body).json() == r.json()
    return r.json(), msg, ws

def test_review_preserves_sources_metadata_and_retry(client, monkeypatch):
    run, msg, ws = setup_run(client, monkeypatch)
    assert not graph(client)['ideas']
    body = dict(action='review-extraction', commandId=str(uuid4()), runId=run['id'], proposal=proposal().model_dump())
    r = client.post('/api/graph', json=body)
    assert r.status_code == 200, r.text
    data = graph(client)
    assert len(data['ideas']) == 2
    assert all(i['title'].startswith('השערה: ') for i in data['ideas'])
    assert len(data['connections']) == 1
    assert {p['role'] for p in data['connection_participants']} == {'source', 'target'}
    assert all(l['message_id'] == msg for l in data['message_ideas'])
    assert all(l['workspace_id'] == ws for l in data['workspace_ideas'])
    reviewed = data['extraction_runs'][0]
    assert json.loads(reviewed['proposal']) == proposal().model_dump()
    review = json.loads(reviewed['review'])
    assert review['items'][3]['kind'] == 'metadata'
    assert 'd' not in review['entities']
    assert review['reviewedBy'] == 'local:user'
    assert client.post('/api/graph', json=body).status_code == 200
    assert graph(client) == data
    assert client.post('/api/graph', json={**body,'commandId':str(uuid4())}).status_code == 409

def test_invalid_sources_and_dangling_edges_are_atomic(client, monkeypatch):
    run, _, _ = setup_run(client, monkeypatch)
    before = graph(client)
    p = proposal().model_dump()
    p['items'][0]['quote'] = 'not in text'
    post(client, 'review-extraction', expected_status=422, runId=run['id'], proposal=p)
    p = proposal().model_dump()
    p['items'] = p['items'][1:]
    post(client, 'review-extraction', expected_status=422, runId=run['id'], proposal=p)
    assert graph(client) == before

def test_reclassify_and_reject(client, monkeypatch):
    run, _, _ = setup_run(client, monkeypatch)
    p = proposal().model_dump()
    p['items'] = [p['items'][0]]
    p['items'][0].update(kind='metadata', relation='הקשר')
    post(client, 'review-extraction', runId=run['id'], proposal=p)
    assert not graph(client)['ideas']
    assert not graph(client)['connections']
    run, _, _ = setup_run(client, monkeypatch)
    post(client, 'review-extraction', runId=run['id'], proposal={'items':[]})
    assert all(r['status']=='reviewed' for r in graph(client)['extraction_runs'])

def test_existing_idea_not_overwritten(client, monkeypatch):
    run, msg, ws = setup_run(client, monkeypatch)
    conv = graph(client)['conversations'][0]['id']
    post(client, 'message', content='[[קיים]]', workspaceId=ws, conversationId=conv)
    existing = graph(client)['ideas'][0]
    p = proposal().model_dump()
    p['items'] = p['items'][:1]
    post(client, 'review-extraction', runId=run['id'], proposal=p, bindings={'a':existing['id']})
    data = graph(client)
    assert data['ideas'] == [existing]
    assert any(l['message_id']==msg and l['idea_id']==existing['id'] for l in data['message_ideas'])

def test_model_quote_check():
    extraction.check_quotes(proposal(), TEXT)
    with pytest.raises(ValueError):
        extraction.check_quotes(proposal(), 'טקסט אחר')

def test_model_can_only_choose_original_passages():
    text = 'אולי רעיון ראשון.\nיפן חיזקה אותו.'
    schema = extraction.output_schema(text)
    for variant in schema['properties']['items']['items']['anyOf']:
        quotes = variant['properties']['quote']['enum']
        assert quotes == ['s1', 's2']
        assert all(extraction.source_passages(text)[key] in text for key in quotes)

def test_provider_resolves_passage_id_and_rejects_unknown_source(monkeypatch):
    from backend.service import DomainError
    generated = proposal().model_dump()
    generated['items'] = generated['items'][:1]
    generated['items'][0]['quote'] = 's1'
    captured = {}
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, limit):
            return json.dumps({'done':True, 'message':{'content':json.dumps(generated)}}).encode()
    class Opener:
        def open(self, request, timeout):
            captured.update(url=request.full_url, body=json.loads(request.data), timeout=timeout)
            return Response()
    monkeypatch.setattr(extraction, 'build_opener', lambda *args: Opener())
    monkeypatch.setenv('THINKING_GRAPH_MODEL', 'qwen3.5:4b')
    result, model = extraction.generate(TEXT)
    assert result.items[0].quote == 'אני משערת שמאמץ שרירי מועיל.'
    assert captured['url'] == 'http://127.0.0.1:11434/api/chat'
    assert captured['body']['think'] is False
    assert captured['body']['keep_alive'] == 0
    generated['items'][0]['quote'] = 'invented'
    with pytest.raises(DomainError):
        extraction.generate(TEXT)
    # Invalid output releases the single-inference lock, so another request can succeed.
    generated['items'][0]['quote'] = 's1'
    assert extraction.generate(TEXT)[0].items[0].quote in TEXT
