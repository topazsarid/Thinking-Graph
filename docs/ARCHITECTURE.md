# Implemented architecture

- `src/App.tsx`: React/TypeScript composition, shared graph fetch/commands and dialogs.
  `IdeaMap.tsx` + `mapGroups.ts`: SVG map, linking, selection, geometry.
  `ResizablePanels.tsx`: desktop windows and responsive panel visibility.
  `MobileNotes.tsx` / `NotesPanel.tsx`: same note commands, different capture/review UI.
  `DrawingBoard.tsx`: browser-local strokes. `MovableDialogContent.tsx`: movable dialogs.
  `globals.css`: RTL styling, responsive layout, page-level effects.
- Vite builds `dist/`; FastAPI serves it. Vite development server proxies `/api` to
  FastAPI. `components/ui/` wraps Radix; no active Cloudflare/D1/Vinext dependency.
- `backend/main.py`: HTTP routes, validation/error handling, local-origin/host checks.
  `schemas.py`: Pydantic command contracts. `service.py`: transactional graph commands,
  audit events and retry receipts. `database.py`: SQLAlchemy SQLite + startup Alembic.
- `backend/ollama.py`: the only Ollama client. Streams answers; URL from
  `THINKING_GRAPH_OLLAMA_URL` (default http://127.0.0.1:11434), never via env proxies.
  `backend/ai_queue.py`: in-memory FIFO for ALL model work (extraction, replies, smart
  search); `GET /api/queue`, `POST /api/queue/{id}/cancel` (waiting: removed; running: the
  stream is closed so Ollama stops). Cancelled requests return HTTP 410.
- `backend/replies.py` + `POST /api/replies` (requestId = reply id, retry-safe): modes
  `self` (mirror only), `external` (general knowledge + one concept for the Explanation
  screen), `search` (model picks existing idea ids). Stored in `chat_replies`, created_by
  `assistant:local`; never extracted, never added to My Map. Prompts use the
  conversation's `answer_preference`.
- UI: `MessageReplies.tsx` (3 buttons per message; plain-text search in `mapSearch.ts`
  first, AI search only on request), `ModelQueue.tsx`, `ExplanationPanel.tsx`,
  `AnswerPreference.tsx`. Replies and extraction do not use the app's busy lock.
- `backend/extraction.py`: default model `qwen3.5:4b`, configurable via `THINKING_GRAPH_MODEL`. `ExtractionReview.tsx` approves proposals;
  `requestExtraction.ts` recovers a lost response by looking up the request ID.

## Persistence and invariants

Authoritative schema: `backend/models.py`; migrations: `migrations/versions/`
(current head `20261012_chat_replies`). Add migrations; never rewrite applied migrations.

- `users`, `conversations`, `messages`; messages belong to conversations.
- `ideas`, `workspaces`, `workspace_ideas`, `message_ideas`: many-to-many reuse and sources.
  Ideas have proposed/accepted/rejected status. Direct map creation needs no fake message.
- `connections`, `connection_participants`: multi-participant relations. Manual links
  use participant roles; approved extraction may use source/target roles. Soft deletion
  uses `deleted_at` and is reversible without losing identity or participants.
- `relation_types` (parent hierarchy), `relation_aliases`: explicit type/alias records.
- `notes`: general/task kind and persistent completion (complete-note command); old notes default to general.
- `notes`, `note_message_sources`: timestamps and immutable copies of notes used in a
  source message. Later note edits do not rewrite extraction evidence.
- `extraction_runs`: proposal/review/status. `events`: before/after audit.
  `command_receipts`: command ID + payload hash, preventing duplicate mutation retries.
- `created_by` is provenance, never an ownership/access rule. Graph changes and audit
  occur together under SQLite `BEGIN IMMEDIATE`; foreign keys are enabled.

Server DB defaults to `data/thinking-graph.sqlite`; `THINKING_GRAPH_DB` overrides it.
Relative paths resolve from repo root. Browser localStorage holds window layout,
map positions/scales, shortcuts, theme/pen and drawings; these do NOT sync across devices.

## Runtime and checks

Use README's setup/run instructions (Python 3.12 / Node 24 tested).
Two ways to run: `start-local.cmd` (native, `data/`) or Docker (`docker compose up --build`,
port 127.0.0.1:8000, database in the `thinking-graph-data` volume at /app/data). They use separate
databases. No authentication or remote-phone access exists.
Host check: loopback names only. Origin check: ports 8000/5173 plus same-origin on any port.
Do not weaken these protections or expose this instance as a layout fix.

Relevant checks, from repo root:
- UI: `npm run build` (includes TypeScript).
- API/schema: `.venv\Scripts\python.exe -m pytest -q`; `python -m alembic check`
  through the same venv against an appropriate test DB.
- Map logic: `node --test --experimental-test-isolation=none tests/map_groups.test.ts`.
- Extraction client: same Node command with `tests/extraction_request.test.ts`
  (all unit tests at once: `node --test --experimental-test-isolation=none tests/*.test.ts`).
- Browser E2E: `pytest tests/e2e -q` after `npm run build` (needs `requirements-e2e.txt` and
  `python -m playwright install chromium`; skipped if Playwright is missing). Each test gets its own
  server, throwaway DB under `work/`, and a fake streaming Ollama on a random port.
- CI: `.github/workflows/ci.yml` runs build, unit tests, `alembic check` and all pytest incl. E2E on
  every push (GitHub Actions, Ubuntu, Python 3.12, Node 24).

Windows has previously blocked pytest temporary/cache directories; report that as an
environment issue rather than a passing test. Do not depend on scripts outside this repo.
