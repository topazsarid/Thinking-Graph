"""Chat replies, the visible model queue, and the per-conversation answer preference."""
import json
import threading
import time
from uuid import uuid4
import pytest
from backend import ai_queue, ollama, replies
from test_graph import client, containers, post, graph


def message(client, text='אני חושבת שהליכה עוזרת לריכוז.'):
    ws, conv = containers(client)
    return ws, conv, post(client, 'message', content=text, workspaceId=ws, conversationId=conv, extractRules=False)['id']


def test_reply_is_stored_apart_from_ideas_and_retry_safe(client, monkeypatch):
    seen = {}
    def fake(mode, text, earlier, preference, candidates):
        seen.update(mode=mode, preference=preference)
        return dict(content='תשובה', concept={'title': 'קשב', 'detail': 'יכולת להתמקד'}, idea_ids=None, model='test')
    monkeypatch.setattr(replies, 'generate', fake)
    ws, conv, msg = message(client)
    post(client, 'conversation-preference', id=conv, preference='  תשובות קצרות  ')
    body = dict(requestId=str(uuid4()), messageId=msg, workspaceId=ws, mode='external')
    first = client.post('/api/replies', json=body)
    assert first.status_code == 200, first.text
    assert seen == {'mode': 'external', 'preference': 'תשובות קצרות'}
    assert client.post('/api/replies', json=body).json() == first.json()  # no second generation
    data = graph(client)
    assert len(data['chat_replies']) == 1 and data['chat_replies'][0]['created_by'] == 'assistant:local'
    assert json.loads(data['chat_replies'][0]['concept'])['title'] == 'קשב'
    assert not data['ideas'] and not data['extraction_runs']  # replies never reach My Map
    assert data['conversations'][0]['answer_preference'] == 'תשובות קצרות'
    assert client.post('/api/replies', json={**body, 'mode': 'self'}).status_code == 409


def test_search_reply_only_returns_existing_ideas(client, monkeypatch):
    ws, conv, msg = message(client, 'איפה הרעיון על קשב?')
    idea = post(client, 'create-idea', workspaceId=ws, title='ריכוז ותשומת לב')['id']
    def fake_chat(body):
        candidates = json.loads(body['messages'][1]['content'])['candidates']
        assert list(candidates.values()) == ['ריכוז ותשומת לב']
        return json.dumps({'matches': ['k1'], 'note': 'קרוב במשמעות'})
    monkeypatch.setattr(ollama, 'chat', fake_chat)
    r = client.post('/api/replies', json=dict(requestId=str(uuid4()), messageId=msg, workspaceId=ws, mode='search'))
    assert r.status_code == 200, r.text
    assert json.loads(r.json()['idea_ids']) == [idea]
    monkeypatch.setattr(ollama, 'chat', lambda body: json.dumps({'matches': ['k9'], 'note': ''}))
    bad = client.post('/api/replies', json=dict(requestId=str(uuid4()), messageId=msg, workspaceId=ws, mode='search'))
    assert bad.status_code == 422


def test_queue_runs_in_order_and_cancels_waiting_and_running():
    order, started, release = [], threading.Event(), threading.Event()
    def slow():
        started.set()
        while not release.is_set():
            ai_queue.check_cancelled()
            time.sleep(0.01)
        order.append('first')
    results = {}
    def call(name, work):
        try:
            results[name] = ai_queue.run('reply', name, work)
        except ai_queue.Cancelled:
            results[name] = 'cancelled'
    threads = [threading.Thread(target=call, args=('a', slow))]
    threads[0].start(); started.wait(2)
    threads.append(threading.Thread(target=call, args=('b', lambda: order.append('second'))))
    threads.append(threading.Thread(target=call, args=('c', lambda: order.append('third'))))
    threads[1].start(); time.sleep(0.05); threads[2].start(); time.sleep(0.05)
    items = ai_queue.snapshot()
    assert [i['label'] for i in items] == ['a', 'b', 'c']
    assert [i['status'] for i in items] == ['running', 'waiting', 'waiting']
    assert ai_queue.cancel(items[1]['id'])  # cancel a waiting request
    time.sleep(0.05)
    assert [i['label'] for i in ai_queue.snapshot()] == ['a', 'c']
    release.set()
    for t in threads: t.join(2)
    assert order == ['first', 'third'] and results['b'] == 'cancelled'
    # Cancelling the running request stops it at its next check.
    release.clear(); started.clear()
    t = threading.Thread(target=call, args=('d', slow)); t.start(); started.wait(2)
    assert ai_queue.cancel(ai_queue.snapshot()[0]['id'])
    t.join(2)
    assert results['d'] == 'cancelled' and ai_queue.snapshot() == []


def test_queue_endpoints_and_cancelled_reply(client, monkeypatch):
    ws, conv, msg = message(client)
    def cancelled(*args):
        raise ai_queue.Cancelled()
    monkeypatch.setattr(replies, 'generate', cancelled)
    r = client.post('/api/replies', json=dict(requestId=str(uuid4()), messageId=msg, mode='self'))
    assert r.status_code == 410
    assert not graph(client)['chat_replies']
    assert client.get('/api/queue').json() == {'items': []}
    assert client.post('/api/queue/unknown/cancel', json={}).json() == {'cancelled': False}


def test_streamed_answer_stops_when_cancelled(monkeypatch):
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def __iter__(self):
            for n in range(1000):
                yield (json.dumps({'done': False, 'message': {'content': 'x'}}) + '\n').encode()
    class Opener:
        def open(self, request, timeout): return Response()
    monkeypatch.setattr(ollama, 'build_opener', lambda *args: Opener())
    def work():
        ai_queue.cancel(ai_queue.snapshot()[0]['id'])
        return ollama.chat({'model': 'qwen3.5:4b', 'messages': []})
    with pytest.raises(ai_queue.Cancelled):
        ai_queue.run('reply', 'stream', work)
