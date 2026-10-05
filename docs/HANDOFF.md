# Current handoff

Last updated: 2026-10-05. Replace this checkpoint; do not append a diary.

## Completed
- Shared AGENTS / Claude pointer and concise current-state docs added; ignore rules hardened.
- Existing implementation includes mobile Chat/Notes/Map, shared server notes/messages,
  movable idea/connection dialogs, double-click editing, connected-group movement,
  per-idea scale and wrapped titles. See README's 2026-10-04 entry for prior QA details.
- Only docs and .gitignore were changed for this handoff task; application files preserved.

## In progress / unfinished
- No code task in progress. Actual phone connectivity is NOT configured: server is loopback-only.
- No decision yet between same-Wi-Fi access and remote access. Mobile viewport support alone
  does not make this server reachable from an iPhone.

## Relevant files
- Start at NOW, PRODUCT and ARCHITECTURE as needed; README owns setup commands.
- UI: App, ResizablePanels, MobileNotes, IdeaMap, mapGroups, MovableDialogContent, globals.css.
- API/storage: backend/main.py, service.py, models.py, database.py and migrations/versions/.
- Historical proposals: design-delta-2026-10-01.md and its mapping, referenced from PARKED.

## Git / tests / status
- Repo is `outputs/thinking-graph` within the outer work folder. Open THIS folder in both tools.
- Branch `main`; HEAD `cf1c671` (previous `7d1ec58`). Substantial existing unstaged changes
  and untracked source implement the migration away from the old starter. Existing tracked
  deletions are intentional prior work, not deletions to restore automatically. Nothing staged
  at inspection; no commit or push made. Git history alone is not the current implementation.
- This task: checked documentation links, ignore coverage, and unchanged application hashes.
  No runtime tests rerun for documentation-only edits.
- Prior recorded validation (not rerun today): 22 API tests; production build/TypeScript;
  2 extraction-client tests; 2 map tests. Browser QA included 390x844 and desktop, persisted
  note/message, dialog drag/resize, double-click, group movement, scale reload and long title.

## Blockers / next step
No blocker for switching agents. Use one active writer in the SAME checkout; do not create
another clone/worktree for this workflow. Private DB/localStorage are not Git backups.
Next agent: inspect status/diff, ask for the next scoped task, and update NOW before coding.
If phone access is chosen, first settle access scope and authentication approach; do not
merely change the bind address. Do not implement PARKED items automatically.
