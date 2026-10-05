import json
from uuid import uuid4
from fastapi.testclient import TestClient
from backend.main import create_app
from backend import extraction
from test_graph import client, post, graph

def test_notes_group_extraction_preserves_original_versions(client, monkeypatch):
    ws = post(client, 'workspace', title='notes')['id']
    a = post(client, 'note', title='A', content='Curiosity motivates learning.')['id']
    b = post(client, 'note', title='B', content='Learning takes practice.')['id']
    command = dict(commandId=str(uuid4()), action='snapshot-notes', noteIds=[a,b,a], workspaceId=ws)
    first = client.post('/api/graph', json=command)
    assert first.status_code == 200
    mid = first.json()['id']
    before = graph(client)
    assert client.post('/api/graph', json=command).json() == first.json()
    assert graph(client) == before
    assert len(before['note_message_sources']) == 2
    assert not before['ideas']
    original = before['messages'][0]['content']
    post(client, 'note', id=a, title='changed', content='Updated note, without original wording.')
    assert graph(client)['messages'][0]['content'] == original
    assert graph(client)['note_message_sources'] == before['note_message_sources']
    proposal = extraction.Proposal(items=[dict(key='a',kind='idea',text='Curiosity',detail='Curiosity motivates learning.',
        quote='Curiosity motivates learning.',epistemic='statement',relation='',source=None,target=None,uncertainty='')])
    seen = []
    def generate(content):
        seen.append(content)
        return proposal, 'test:notes'
    monkeypatch.setattr(extraction, 'generate', generate)
    response = client.post('/api/extractions', json=dict(requestId=str(uuid4()),messageId=mid,workspaceId=ws))
    assert response.status_code == 200
    assert seen == [original]
    post(client, 'review-extraction', runId=response.json()['id'], proposal=proposal.model_dump())
    after = graph(client)
    assert len(after['ideas']) == 1
    assert after['message_ideas'][0]['message_id'] == mid
    assert {s['note_id'] for s in after['note_message_sources'] if s['message_id'] == mid} == {a,b}
    events = [e for e in after['events'] if e['entity_type']=='note' and e['action']=='revise']
    assert json.loads(events[0]['before'])['title'] == 'A'

def test_note_selection_validation_is_atomic_and_persists(tmp_path):
    path=tmp_path/'notes.sqlite'
    with TestClient(create_app(path), base_url='http://127.0.0.1:8000') as c:
        ws=post(c,'workspace',title='w')['id']
        nid=post(c,'note',title='long',content='x'*4000)['id']
        baseline=graph(c)
        post(c,'snapshot-notes',expected_status=422,noteIds=[nid],workspaceId=ws)
        post(c,'snapshot-notes',expected_status=404,noteIds=[str(uuid4())],workspaceId=ws)
        post(c,'snapshot-notes',expected_status=422,noteIds=[],workspaceId=ws)
        post(c,'note',expected_status=422,title='blank',content=' ')
        assert graph(c)==baseline
    with TestClient(create_app(path), base_url='http://127.0.0.1:8000') as c:
        assert graph(c)==baseline

def test_connection_removal_is_recoverable_and_retry_safe(client):
    ws=post(client,'workspace',title='w')['id']
    ids=[post(client,'create-idea',workspaceId=ws,title=t)['id'] for t in ('A','B')]
    cid=post(client,'connection',label='?',ideaIds=ids)['id']
    before=graph(client)
    command=dict(commandId=str(uuid4()),action='connection-visibility',id=cid,deleted=True)
    assert client.post('/api/graph',json=command).status_code==200
    removed=graph(client)
    assert removed['connections'][0]['deleted_at']
    assert removed['connection_participants']==before['connection_participants']
    assert client.post('/api/graph',json=command).status_code==200
    assert graph(client)==removed
    post(client,'revise-connection',expected_status=409,id=cid,label='cannot edit deleted')
    post(client,'connection-visibility',id=cid,deleted=False)
    restored=graph(client)
    assert restored['connections']==before['connections']
    assert restored['connection_participants']==before['connection_participants']
    assert len([e for e in restored['events'] if e['action']=='delete'])==1
