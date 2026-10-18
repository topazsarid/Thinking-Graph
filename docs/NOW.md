# Now

Current state (2026-10-18): portfolio preparation done; the final MVP plan awaits approval.

- Final MVP plan: [MVP-PLAN](MVP-PLAN.md) (gap analysis, decisions, phases, Definition of Done).
  STATUS: PROPOSED, awaiting the user's approval and four decisions (cloud hosting option, AI
  behaviour when the PC is off, drawing-to-chat copy scope, phase order). Do not start any
  MVP-PLAN phase before that.
- Portfolio preparation (2026-10-18): English README with screenshots, MIT license, CI workflow
  (.github/workflows/ci.yml). The user is about to push and make the GitHub repo public after
  the first CI run is green.
- Docker: steps 0–3 done by the user (image, volume `thinking-graph-data`, compose). Real data
  was copied into the volume once; `data/` (native app) and the volume are now two separate
  copies — the user works in Docker; do not let them diverge silently.

Decisions already made (keep unless the user changes them):
- AI stays local (Ollama, `qwen3.5:4b`, CPU-only machine); no cloud AI models.
- My Map is user-controlled; AI output never enters it without explicit user action.
- SQLite stays for a single user; PostgreSQL only if multi-user ever matters.

Out of scope until approved: everything in MVP-PLAN phases, authentication, cloud hosting,
CD (automatic deployment), PWA, unrelated refactors. Commits/pushes only when the user asks.
PARKED is not a queue.
