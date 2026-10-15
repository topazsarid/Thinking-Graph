# Current handoff

Last updated: 2026-10-13. Replace this checkpoint; do not append a diary.

## Completed
- 2026-10-13 f: browser E2E suite in the repo: tests/e2e (conftest: fake streaming Ollama on a free
  port, one uvicorn server + throwaway DB under work/ per test, fresh Chromium context per test;
  10 tests across map/chat/layout). requirements-e2e.txt (playwright). Skipped when Playwright is not
  installed; fails early if dist/ is older than src. backend/main.py: Origin check now also accepts
  the request's own Host (same-origin on any port; Host is still loopback-only). EffectStudio:
  painting fills every square along the pointer path (fast drags skipped squares). Agent ran the
  full suite 3x: 39/39 each time (29 API + 10 E2E). Not yet run on the user's Windows machine.
- Commits so far (user ran them): 0fbc74b Docker + .gitattributes, then code, then docs (4caa8d8).
  Everything listed below this line up to 2026-10-13 e is committed; f is uncommitted.
- 2026-10-13 e: Docker step 2 DONE by the user (named volume `thinking-graph-data` at /app/data;
  data survived container removal). Step 3 file written: compose.yaml (service `app`, build ., image
  thinking-graph, 127.0.0.1:8000:8000, volume `thinking-graph-data` with fixed name so the step-2
  volume is reused). Not yet run by the user. User's real data is still only in data/ (native app).
- 2026-10-13 d: Docker step 1 DONE by the user (image built, container ran, empty DB as expected).
  Docker Desktop is a per-user install: %LOCALAPPDATA%\Programs\DockerDesktop. Bug fixed: with no
  workspaces the "בחרי מרחב" Select opened an empty list and locked page scrolling; Picker is now
  disabled with an `emptyLabel` hint. Playwright 3/3. dist/ rebuilt (the Docker image must be rebuilt
  to include it). Next: Docker step 2 (named volume for /app/data).
- 2026-10-13 c (user request): drawing zoom (DrawingBoard viewBox: −/%/+ buttons, wheel at pointer,
  "✋ הזזה" pan mode, % button resets); focus mode button in the top bar (Maximize2): hides top bar,
  workspace bar and panel toolbar, ResizablePanels `fill` tiles the visible windows over the full
  screen without changing the saved layout; Esc (when no dialog is open) or the floating
  "יציאה ממסך מלא" button leaves it. Conversation menu: no edge hover any more; opens only from
  "שיחות" (`data-drawer-toggle`), closes on outside pointerdown or Escape. Writing box can be hidden
  (chevron next to the grip; localStorage `thinking-graph:composer-hidden`), "כתיבת הודעה" shows it.
  Window size itself was already adjustable (+/− in each window bar, corner grip).
  Checks: TypeScript build; Playwright 17/17 on a throwaway DB. dist/ rebuilt by agent.
- 2026-10-13 later (user request), top bar: sticky header; text "שמירה מקומית במחשב" removed
  (status shows only "שומרת…"/"מתחברים…"); buttons reduced to "שיחות", "אפקטים ▾", "פתקים ▾"
  plus a chevron that hides/shows the second (workspace) bar (localStorage
  `thinking-graph:workspace-bar-hidden`). Effects menu: built-in toggles, saved effects,
  turn off, "יצירת אפקט…", "שינוי צבע…" (ThemePicker now optionally controlled, stays mounted).
  Notes menu: create note / extract from notes / all notes.
- Conversation side menu (src/ConversationDrawer.tsx): opens on hover at the right screen edge
  (left if the document is LTR) or via "שיחות"; lists chat conversations (notes-snapshot
  conversations excluded) by latest activity, labeled by first message; "שיחה חדשה".
- Effect studio rewritten (src/EffectStudio.tsx): kinds "pattern" (grid 3..24 squares per row,
  drag-paint, eraser, random fill, tile size, drifting tiled layer) and "images" (up to 8 uploads,
  downscaled to 180px PNG data URLs, floating and bouncing). Old saved garden/birds/fire effects
  still play. Saved effects can be deleted; quota errors are reported. Text-prompt parsing removed.
- Note: the user's editor reformatted App.tsx with Prettier (1273+ lines) and the user removed the
  composer footnote; both preserved.
- Checks: TypeScript build passed; Playwright 25/25 on a throwaway DB (menus, sticky header in a
  short window, bar toggle persistence, pattern paint + play + save, 2 uploaded images floating,
  color dialog, notes menu, edge-hover drawer, new chat, switching chats). dist/ rebuilt by agent.
- 2026-10-13 (user request): chat window has no conversation picker / "שיחה" heading / new-
  conversation button; it shows the first conversation that is not a notes-extraction snapshot
  (snapshots keep their hidden "חילוץ מפתקים" conversations). Answer-preference and Explanation
  buttons moved into the composer footer. Drag grip (or arrow keys) above the composer resizes
  the writing box 40px..60% of the window (localStorage `thinking-graph:composer-height`); the
  message list takes the rest. Playwright 8/8 on a throwaway DB.
- 2026-10-13: user had not rebuilt the UI (dist was from 10-06), so the new buttons were invisible.
  The agent built dist on Linux and copied it into dist/ (old asset files remain, harmless).
  The user's server had already been restarted: data/ already has chat_replies (migration applied).
  Verified backup: backups/thinking-graph-2026-10-13.sqlite (integrity ok). A failed SQLite-API
  backup attempt over the device mount left thinking-graph-2026-10-13-before-replies.sqlite
  (overwritten with the verified copy) and an empty -journal file; both safe to delete.
- Auto-frame after extraction approval (App `revealRun`/`reveal`, IdeaMap `frame()`; mobile
  switches to Map). Same mechanism now also reveals map-search results, switching workspace.
- Chat replies (see NOW and ARCHITECTURE): 3 buttons per message (self / search / external),
  plain-text search first then optional AI search, Explanation screen for external concepts,
  per-conversation answer preference, visible cancellable model queue for ALL Ollama work.
- Extraction no longer blocks the composer/app; several extractions can wait in the queue.
  The old "another extraction is running" 409 is gone (queue replaces `_lock`).
- New: backend/ai_queue.py, ollama.py, replies.py; migration 20261012_chat_replies
  (chat_replies table, conversations.answer_preference); src/MessageReplies.tsx,
  ModelQueue.tsx, ExplanationPanel.tsx, AnswerPreference.tsx, mapSearch.ts, requestReply.ts;
  tests/test_replies.py, tests/map_search.test.ts. Changed: main.py, models.py, schemas.py,
  service.py, extraction.py, App.tsx, IdeaMap.tsx, ExtractionReview.tsx, requestExtraction.ts,
  globals.css, tests/test_extraction.py (streaming fake), docs NOW/PARKED/ARCHITECTURE.
- Docker step 1 files (Dockerfile, .dockerignore) from 2026-10-07 unchanged; user has not run them.
- Earlier note-tasks work (other agent) preserved.

## Checks run (agent, Linux scratch copies; nothing written to data/)
- pytest: 29 passed. `alembic check` on a fresh migrated DB: no new operations.
- npm run build (TypeScript) passed. node tests: extraction_request 2/2, map_groups 2/2, map_search 3/3.
- Playwright on a throwaway DB with a fake slow streaming Ollama: 16/16 checks: text search
  in current map + reveal; found-in-other-workspace switch; AI smart search reveal; preference
  saved and sent to the model; queue shows running + 2 waiting; composer usable while waiting;
  cancel waiting (never runs, no error); stop running (connection closed, nothing saved);
  explanation screen opens with concept; replies never become ideas; mobile 390x844 screenshot.
- NOT tested with the real Ollama/qwen3.5:4b: real answer quality and speed are unknown.

## Blockers / exact next step
- User: restart start-local.cmd and refresh the browser (dist already rebuilt), try the three
  reply buttons with real Ollama, report quality/speed and what still does not feel like a chat.
- Known limits: cancel of a running request takes effect at the next streamed token (not during
  prompt evaluation); queue is in memory (cleared on server restart); keep_alive=0 reloads the
  model per request (slower on CPU; tunable later).
- Then resume Docker step 1. Docker step 4 can use THINKING_GRAPH_OLLAMA_URL (already added).
