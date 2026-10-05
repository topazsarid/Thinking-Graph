import json
from uuid import uuid4
from fastapi.testclient import TestClient
from backend.main import create_app
from test_graph import client, post, graph

def test_map_first_flow_survives_restart(tmp_path):
    path=tmp_path/'map.sqlite'
    with TestClient(create_app(path), base_url='http://127.0.0.1:8000') as c:
        ws=post(c,'workspace',title='המפה שלי')['id']
        body=dict(action='create-idea',commandId=str(uuid4()),workspaceId=ws,title='רעיון פתוח')
        response=c.post('/api/graph',json=body)
        assert response.status_code==200
        idea=response.json()['id']
        assert c.post('/api/graph',json=body).json()==response.json()
        question=post(c,'create-idea',workspaceId=ws,title='שאלה: למה?',kind='question')['id']
        post(c,'connection',label='מעורר שאלה',ideaIds=[idea,question])
        data=graph(c)
        assert len(data['ideas'])==2
        assert len(data['connections'])==1
        assert len(data['workspace_ideas'])==2
        assert not data['messages'] and not data['conversations'] and not data['message_ideas']
        event=next(e for e in data['events'] if e['entity_id']==question)
        assert event['created_by']=='local:user'
        assert json.loads(event['after'])['kind']=='question'
        ws2=post(c,'workspace',title='עוד מרחב')['id']
        post(c,'link',ideaId=idea,workspaceId=ws2)
        assert len(graph(c)['ideas'])==2
        data=graph(c)
    with TestClient(create_app(path), base_url='http://127.0.0.1:8000') as c:
        assert graph(c)==data

def test_create_validation_and_identity(client):
    ws=post(client,'workspace',title='מרחב')['id']
    before=graph(client)
    post(client,'create-idea',workspaceId=str(uuid4()),title='לא נשמר',expected_status=404)
    post(client,'create-idea',workspaceId=ws,title='   ',expected_status=422)
    assert graph(client)==before
    a=post(client,'create-idea',workspaceId=ws,title='רעיון פתוח')['id']
    b=post(client,'create-idea',workspaceId=ws,title='רעיון פתוח')['id']
    assert a!=b  # Same display label is not semantic identity.
