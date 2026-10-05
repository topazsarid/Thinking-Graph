# Shared agent instructions

This repository and its current files are the source of truth, not previous agent chats.

Before work (Codex, ChatGPT Work, Claude Code, or another agent):
- Read [NOW](docs/NOW.md) and [HANDOFF](docs/HANDOFF.md) first.
- Inspect `git status --short`, `git diff` and `git diff --cached`; preserve existing work.
- Read [PRODUCT](docs/PRODUCT.md) / [ARCHITECTURE](docs/ARCHITECTURE.md) only when relevant, then inspect the relevant code.

During work:
- Make the smallest scoped change; reuse existing architecture. No unrelated refactors.
- Do not implement [PARKED](docs/PARKED.md) work unless explicitly moved into NOW.
- No reset/discard, commit, push, deployment or external data transfer without authorization.
- Use one writing agent at a time in this shared checkout; recheck changes when switching agents.
- Browser QA: isolated built-in browser, never personal Chrome. Use a separate test DB, not private `data/`.

Before stopping:
- Run feasible relevant checks; leave code understandable.
- Replace HANDOFF with the exact checkpoint, tests, blockers and next step; keep NOW aligned.
- If context/tokens are low, prioritize a clean handoff over starting more work.

Run/setup commands remain in [README](README.md). No chat history is required.
