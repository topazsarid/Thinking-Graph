# Now

Active milestone: learn Docker through this project, step by step (user-guided).
Goal: `docker compose up` runs Thinking Graph locally; later, secure phone access.

RESUMED 2026-10-13 (chat/UI work done). Steps 0-2 done by the user. Current step: 3 - compose.yaml written; user runs `docker compose up --build`. `Dockerfile` + `.dockerignore` only; the user builds and runs it.
Plan: 0 install/hello-world; 1 image; 2 volume for SQLite; 3 compose.yaml;
4 Ollama as a second container (CPU-only machine; compare speed with native Ollama);
5 PostgreSQL (separate task, backup first); 6 Tailscale for the phone.

Decisions: SQLite stays until step 5. Ollama stays local (no cloud models).
Phone access via Tailscale, not a public server. No LAN exposure before step 6.
Container ports are published on 127.0.0.1 only.

Done 2026-10-12 (user request): after approving an extraction, the map frames the new ideas
(mobile switches to the Map screen).

DONE 2026-10-12, awaiting user's real-Ollama trial (Docker steps paused until then):
- Under every user message, three reply buttons; nothing runs until clicked:
  1 "consult yourself" (mirror only, no outside knowledge; labeled as such),
  2 "search my map" (plain text search first, instant; centers the idea, or offers another
    workspace; if nothing found, offers an AI "smart/similar" search),
  3 "external advisor" (general knowledge, labeled as not verified) + opens the Explanation
    screen with one auto-added concept. Explanation content NEVER goes to My Map.
- Replies are stored separately from messages and are never extracted.
- All Ollama work (extraction, replies, smart search) goes through one visible FIFO queue;
  the user can cancel waiting or running requests. The rest of the app stays usable.
- Per-conversation "answer preference" text used by AI replies.
Previous scope (note tasks, drawing clear) is complete but uncommitted; preserve it.
Out of scope: auth changes, cloud deployment, CI/CD, PWA, unrelated refactors,
commits/pushes. PARKED is not a queue.
