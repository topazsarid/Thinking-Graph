# Current handoff

Last updated: 2026-10-18. Replace this checkpoint; do not append a diary.
(The day-by-day history of earlier work is in Git history and docs/README.he.md.)

## Git
- main, HEAD 0fd5378 "Document E2E tests" = origin/main (pushed).
- Uncommitted (user will commit and push): README.md (English, CI badge), LICENSE (MIT,
  "topazsarid"), docs/README.he.md (old Hebrew README with the development log),
  docs/images/{overview,mobile-chat}.png (demo data only), docs/MVP-PLAN.md, .github/workflows/ci.yml
  (added by the user; agents cannot write .github through the device bridge),
  docs NOW/HANDOFF/PARKED/ARCHITECTURE/AGENTS updates.
- Note: commit 4caa8d8 "Update agent docs" actually contains most of the 2026-10-12/13 code
  (a pager interrupted the planned separate commit). Pushed; intentionally not rewritten.

## What exists (all on main unless listed above)
- Chat with three reply modes (self / map search / external advisor), Explanation screen
  (concept list), answer preference, visible cancellable Ollama queue, note tasks,
  map centering after extraction, top-bar menus, conversation side menu, effect studio
  (pattern/images), focus mode, drawing zoom, hideable/resizable composer.
- Docker: Dockerfile (2 stages), .dockerignore, compose.yaml (volume thinking-graph-data).
- Tests: 29 API (pytest), 7 Node unit, 10 browser E2E (tests/e2e, Playwright, fake model).

## Checks
- Last full run by the agent (Linux): 39/39 pytest incl. E2E, 3 runs in a row; Node tests and
  TypeScript build pass. `alembic check`: no new operations.
- CI has NOT run yet on GitHub (first run happens on the user's next push).
- E2E has not yet been run on the user's Windows machine.

## Blockers / exact next step
1. User pushes; check the Actions tab. If CI is red, fix it before making the repo public.
2. User answers the four decisions in docs/MVP-PLAN.md; then start Phase 0 (server-side map
   positions and drawings, export/import, i18n infrastructure, demo seed).
- Known limits: drawings and map positions are browser-only (localStorage); AI only works
  where Ollama is reachable; Docker AI needs THINKING_GRAPH_OLLAMA_URL set.
