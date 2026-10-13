"""The single client for the local Ollama server.

Fixed local destination (configurable for Docker); never routed through an environment
proxy, because requests contain personal thoughts. Answers are streamed so that a
cancelled request stops reading, which also makes Ollama stop generating.
"""
import json
import os
from urllib.request import Request, build_opener, ProxyHandler
from . import ai_queue

MAX_RESPONSE = 1_000_000


def base_url():
    return os.environ.get('THINKING_GRAPH_OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')


def local_model():
    from .service import DomainError
    model = os.environ.get('THINKING_GRAPH_MODEL', 'qwen3.5:4b')
    if 'cloud' in model.casefold():
        raise DomainError('המערכת מוגדרת למודל מקומי בלבד. בחרי מודל שהורד למחשב.', 400)
    return model


def chat(body, timeout=300):
    """Return the full text of one chat completion. Raises ValueError on an incomplete
    or oversize answer, OSError if Ollama is unreachable, ai_queue.Cancelled if cancelled."""
    body = {**body, 'stream': True}
    if body['model'].startswith(('qwen3', 'deepseek-r1')):
        body['think'] = False
    request = Request(base_url() + '/api/chat', data=json.dumps(body).encode(),
                      headers={'Content-Type': 'application/json'})
    parts, size, last = [], 0, None
    with build_opener(ProxyHandler({})).open(request, timeout=timeout) as response:
        for line in response:
            ai_queue.check_cancelled()
            size += len(line)
            if size > MAX_RESPONSE:
                raise ValueError('Oversize response')
            if not line.strip():
                continue
            last = json.loads(line)
            parts.append((last.get('message') or {}).get('content', ''))
            if last.get('done'):
                break
    if not last or not last.get('done') or last.get('done_reason') == 'length':
        raise ValueError('Incomplete model response')
    return ''.join(parts)
