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
- `backend/extraction.py`: local Ollama at loopback:11434; default `qwen3.5:4b`,
  configurable via `THINKING_GRAPH_MODEL`. `ExtractionReview.tsx` approves proposals;
  `requestExtraction.ts` recovers a lost response by looking up the request ID.

## Persistence and invariants

Authoritative schema: `backend/models.py`; migrations: `migrations/versions/`
(current head `20261002_notes`). Add migrations; never rewrite applied migrations.

- `users`, `conversations`, `messages`; messages belong to conversations.
- `ideas`, `workspaces`, `workspace_ideas`, `message_ideas`: many-to-many reuse and sources.
  Ideas have proposed/accepted/rejected status. Direct map creation needs no fake message.
- `connections`, `connection_participants`: multi-participant relations. Manual links
  use participant roles; approved extraction may use source/target roles. Soft deletion
  uses `deleted_at` and is reversible without losing identity or participants.
- `relation_types` (parent hierarchy), `relation_aliases`: explicit type/alias records.
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

Use README's setup/run instructions (Python 3.12 / Node 24 previously tested).
`start-local.cmd` serves loopback:8000; no authentication or remote-phone access exists.
Do not weaken Host/Origin protections or expose this instance as a layout fix.

Relevant checks, from repo root:
- UI: `npm run build` (includes TypeScript).
- API/schema: `.venv\Scripts\python.exe -m pytest -q`; `python -m alembic check`
  through the same venv against an appropriate test DB.
- Map logic: `node --test --experimental-test-isolation=none tests/map_groups.test.ts`.
- Extraction client: same Node command with `tests/extraction_request.test.ts`.

Windows has previously blocked pytest temporary/cache directories; report that as an
environment issue rather than a passing test. Do not depend on scripts outside this repo.
