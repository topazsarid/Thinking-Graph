"""Browser end-to-end tests: the real server and a real (throwaway) SQLite database, a real
Chromium, and a fake, slow, streaming Ollama. Nothing here touches data/ or the real Ollama.

Run from the repo root (Windows):
  .venv\\Scripts\\python.exe -m pip install -r requirements-e2e.txt
  .venv\\Scripts\\python.exe -m playwright install chromium
  npm run build
  .venv\\Scripts\\python.exe -m pytest tests/e2e -q
Without Playwright installed these tests are skipped, so `pytest -q` still runs everywhere.
"""
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
import uuid
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import urllib.request
import pytest

pytest.importorskip('playwright.sync_api', reason='E2E needs: pip install -r requirements-e2e.txt, then python -m playwright install chromium')
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # local only, never via a proxy


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class FakeOllama:
    """Answers like Ollama's streaming /api/chat. The kind of request is recognised from the
    system prompt. `delay` is the pause between streamed chunks (6 chunks per answer)."""

    def __init__(self):
        self.log, self.delay = [], 0.3
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                system = body['messages'][0]['content']
                entry = {'system': system, 'stream': body.get('stream')}
                if 'Extract ONLY' in system:
                    entry['kind'] = 'extraction'
                    tag = uuid.uuid4().hex[:5]
                    idea = lambda key, text: dict(key=key, kind='idea', text=text, detail='', quote='s1', epistemic='statement',
                                                 relation='', source=None, target=None, uncertainty='')
                    out = {'items': [idea('i1', f'הליכה {tag}'), idea('i2', f'ריכוז {tag}'),
                                     dict(key='c1', kind='connection', text='תורמת', detail='', quote='s1', epistemic='hypothesis',
                                          relation='תורמת', source='i1', target='i2', uncertainty='')]}
                elif 'mirror' in system:
                    entry['kind'], out = 'self', {'reply': 'כתבת שקשב חשוב לך. מה גורם לך לחשוב כך?'}
                elif 'external advisor' in system:
                    entry['kind'], out = 'external', {'answer': 'קשב הוא היכולת להתמקד בגירוי אחד.',
                                                      'concept': {'title': 'קשב סלקטיבי', 'detail': 'מיקוד בגירוי אחד והתעלמות מאחרים.'}}
                else:
                    entry['kind'] = 'search'
                    candidates = json.loads(body['messages'][1]['content'])['candidates']
                    out = {'matches': [k for k, t in candidates.items() if 'ריכוז' in t][:1], 'note': 'ריכוז קרוב לקשב.'}
                fake.log.append(entry)
                text = json.dumps(out, ensure_ascii=False)
                step = max(1, len(text) // 6)
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-ndjson')
                self.end_headers()
                try:
                    for i in range(0, len(text), step):
                        time.sleep(fake.delay)
                        self.wfile.write((json.dumps({'done': False, 'message': {'content': text[i:i + step]}}, ensure_ascii=False) + '\n').encode())
                        self.wfile.flush()
                    self.wfile.write((json.dumps({'done': True, 'done_reason': 'stop', 'message': {'content': ''}}) + '\n').encode())
                    entry['finished'] = True
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    entry['aborted'] = True  # the app closed the stream: the request was stopped

        self.server = ThreadingHTTPServer(('127.0.0.1', free_port()), Handler)
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def kinds(self):
        return [e['kind'] for e in self.log]


class App:
    """One server process with its own empty database, plus small API helpers for seeding."""

    def __init__(self, url):
        self.url = url

    def post(self, action, **fields):
        request = urllib.request.Request(self.url + '/api/graph', method='POST',
            data=json.dumps({'action': action, 'commandId': str(uuid.uuid4()), **fields}).encode(),
            headers={'Content-Type': 'application/json'})
        return json.loads(OPENER.open(request).read())

    def graph(self):
        return json.loads(OPENER.open(self.url + '/api/graph').read())


@pytest.fixture(scope='session', autouse=True)
def built_ui():
    """The server serves dist/. Testing an old build would test old code, so stop early."""
    index = ROOT / 'dist' / 'index.html'
    if not index.exists():
        pytest.fail('dist/ is missing. Run `npm run build` before the E2E tests.')
    sources = [p for d in ('src', 'components', 'lib', 'hooks') for p in (ROOT / d).rglob('*') if p.is_file()]
    newest = max(p.stat().st_mtime for p in sources)
    if newest > index.stat().st_mtime + 1:
        pytest.fail('dist/ is older than the source code. Run `npm run build` before the E2E tests.')


@pytest.fixture(scope='session')
def fake_ollama():
    fake = FakeOllama()
    yield fake
    fake.server.shutdown()


@pytest.fixture
def app(fake_ollama):
    work = ROOT / 'work' / f'e2e-{uuid.uuid4().hex[:8]}'  # work/ is git-ignored
    work.mkdir(parents=True)
    port = free_port()
    env = {**os.environ, 'THINKING_GRAPH_DB': str(work / 'test.sqlite'),
           'THINKING_GRAPH_OLLAMA_URL': fake_ollama.url, 'NO_PROXY': '*'}
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.main:create_app', '--factory',
                                '--host', '127.0.0.1', '--port', str(port)], cwd=ROOT, env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f'http://127.0.0.1:{port}'
    for _ in range(100):
        try:
            OPENER.open(url + '/api/graph', timeout=2)
            break
        except OSError:
            if process.poll() is not None:
                pytest.fail('The test server did not start.')
            time.sleep(0.2)
    else:
        process.terminate()
        pytest.fail('The test server did not answer in time.')
    fake_ollama.log.clear()
    fake_ollama.delay = 0.3
    yield App(url)
    process.terminate()
    try:
        process.wait(10)
    except subprocess.TimeoutExpired:
        process.kill()
    shutil.rmtree(work, ignore_errors=True)


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch()
        yield chromium
        chromium.close()


@pytest.fixture
def page(browser, app):
    """A fresh browser profile per test (empty localStorage), desktop size, already on the app."""
    context = browser.new_context(viewport={'width': 1400, 'height': 800})
    tab = context.new_page()
    tab.goto(app.url + '/')
    tab.wait_for_selector('#draft')
    yield tab
    context.close()


@pytest.fixture
def phone(browser, app):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    tab = context.new_page()
    yield tab
    context.close()

