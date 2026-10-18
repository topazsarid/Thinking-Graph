# Final MVP plan — gap analysis, decisions, Definition of Done

Status: PROPOSED 2026-10-15, awaiting user approval. Nothing here is implemented yet unless marked.
Source request: "Thinking Graph — Final MVP Completion" (user brief, 2026-10-15).

## 1. Gap analysis (state of main @ 0fd5378)

| Requirement | State today | What exists today → what is missing (the target is in sections 2–4) |
|---|---|---|
| AI Explanation Map | **Partial (~15%)** | Today: the "external advisor" adds ONE concept to a list (`ExplanationPanel`, `chat_replies.concept`). **Target: an interactive graph of concepts and explained, typed relationships that looks and works like My Map (same map component, distinct style), grows during the conversation, and is compared with My Map.** Missing: nodes/edges, relation types, evolution, the visual map, the comparison. |
| Cross-board copy | **Missing** | Only "link existing idea" (same idea shared across workspaces — the opposite of an independent copy). Map has group selection (marquee) to reuse. Drawing has strokes only, no selection, no elements, stored in localStorage. |
| Language switching | **Missing** | ~490 Hebrew UI strings in src, ~60 Hebrew messages in backend, `dir="rtl"` hard-coded in many components, AI prompts force Hebrew answers. |
| Private cloud deployment | **Partial (~20%)** | Docker image + compose + volume work locally (user ran steps 0–3). No auth, no HTTPS, no hosting, no backups, no "AI offline" handling. |
| Quality & docs | **Partial** | 29 API + 7 unit + 10 browser E2E tests; Host/Origin checks. Done 2026-10-18: English GitHub README with screenshots and an architecture diagram, MIT license, Hebrew README kept as docs/README.he.md. CI workflow added (first run pending). Missing: a one-command demo-data seed (the screenshots used a throwaway script), a demo video, and README updates as features land. |

Hidden blockers found during review (must be fixed first):
- **Drawings and map positions live only in browser localStorage** (`thinking-graph:drawing:*`, `thinking-graph:layout:*`). They do not reach the phone, the cloud, or a second browser, and cannot be copied reliably. "Saved and restored correctly" is impossible until they are stored on the server.
- **Copy vs. link**: ideas are deliberately shared across workspaces (one row, many `workspace_ideas`). Copy must create NEW rows; the UI must make the difference clear.
- **AI on CPU** (qwen3.5:4b, Intel UHD): graph-shaped answers must stay small (≤7 nodes) or they will be slow.

## 2. Architectural decisions (proposed)

1. **Server-side layout and drawings.** New tables `idea_positions(workspace_id, idea_id, x, y, scale)` and `drawing_elements(id, workspace_id, kind: stroke|text|shape|image, data JSON, z, copied_from…)`. One-time migration from localStorage on first load (client sends its local data once; server keeps it).
2. **Explanation Map = separate tables, not ideas.** `explanation_nodes(id, conversation_id, title, detail, kind, source_reply_id, removed_at…)`, `explanation_edges(id, conversation_id, source_id, target_id, relation, explanation, removed_at…)`. Per conversation, evolves with each explanation reply via a validated *delta* (add / update / remove, max 7 nodes, 8 edges per reply). Never written to `ideas`/`connections` automatically. History via `events`.
3. **Copy = new rows + provenance.** One server command `copy` (transactional, retry-safe like other commands) creates new UUIDs, remaps internal edges inside the copied group, and stores `copied_from = {board, id, at}` (informational only: no foreign key, no propagation in either direction).
4. **Representation matrix for copy** (MVP):

   | from \ to | Chat | My Map | Explanation Map | Drawing |
   |---|---|---|---|---|
   | Message / selected text | — | node (title = first line, detail = text) | node | text element |
   | Node(s) / subgraph | outline text into the composer (not auto-sent) | nodes + edges | nodes + edges | boxes + lines + labels |
   | Whole map | outline text | — (use subgraph) | — | diagram elements |
   | Drawing element(s) | not supported in MVP (stated in UI) | image node (SVG snapshot) | image node | elements |
5. **i18n:** `i18next` + `react-i18next`, `src/locales/{he,en}.json`; language selector in the top bar; `<html lang dir>` switches RTL/LTR; user content rendered with `dir="auto"` so it never changes. Backend returns error **codes** (+ Hebrew fallback text); the client translates. AI answers in the **language of the user's message**, not the UI language. Adding a third language = adding one JSON file.
6. **Cloud (recommended): small VPS + Tailscale.** Same `compose.yaml` on a ~€5/month VPS, **no public ports**; access only from the user's devices through Tailscale (`tailscale serve` gives HTTPS), plus an app login (password hash + httpOnly session cookie) as a second layer. The cloud app reaches the home PC's Ollama over Tailscale when the PC is on; when it is off, AI features show "AI unavailable — your computer is off" and everything else keeps working. SQLite on a volume + nightly encrypted backup to object storage, with a tested restore. Secrets only in a server-side `.env`. PostgreSQL is NOT required for a single user (optional later).
7. **One source of truth:** after moving to the cloud, the PC uses the cloud URL too; the local instance is retired (or kept read-only), to avoid two diverging databases.

## 3. Prioritized plan

| Phase | Content | Size | Why this order |
|---|---|---|---|
| 0. Foundations | Server-side positions + drawing elements (+ localStorage migration); JSON export/import of a workspace; i18n infrastructure + language switch (new strings are written translatable from now on); demo seed workspace | M | Unblocks copy, phone, cloud; avoids translating twice |
| 1. Explanation Map | Tables + delta generation + 4th board rendering (reuse IdeaMap, distinct style) + relation explanations + "in my map / not in my map" comparison | L | The core value of the product |
| 2. Cross-board copy | Selection in all boards, internal clipboard, `copy` command, representation matrix, drawing selection + elements | L | Depends on 0 and 1 |
| 3. Full translation | Move all ~550 strings to locales; backend error codes; AI reply language; both languages through E2E | M | After features stabilise |
| 4. Cloud | VPS + Tailscale + login + backups + AI-offline mode + deploy guide | M | Needs export/import and server-side layout |
| 5. Quality & docs | Bug/edge-case pass, cleanup, GitHub README (English + Hebrew), architecture diagram, screenshots/GIF, CI | M | Final polish; partly continuous |

Each phase ends with: all tests green, HANDOFF updated, a commit the user can push.

## 4. Definition of Done (testable)

**Explanation Map**
- [ ] An "explain" reply produces ≥2 nodes and ≥1 typed, explained edge in the conversation's Explanation Map (E2E with fake model).
- [ ] A later reply in the same conversation adds/updates/removes items; earlier items keep their identity (delta test).
- [ ] Clicking a node/edge shows its explanation and the reply it came from.
- [ ] Nodes whose title matches an idea in My Map are marked "also in your map"; others "new to you".
- [ ] No row is ever added to `ideas`/`connections` by the Explanation Map (API test asserts counts).
- [ ] Invalid model output (unknown node, oversize delta) changes nothing and shows a message.

**Cross-board copy**
- [ ] Every cell marked supported in the matrix works from UI (E2E per row).
- [ ] Copies get new IDs; editing/deleting the copy leaves the original unchanged and vice versa (API tests both directions).
- [ ] Copying a group keeps internal edges between copied nodes only.
- [ ] Each copy shows "copied from …" (source board + title + time).
- [ ] Copies survive reload and server restart; a retried copy request does not duplicate.

**Language**
- [ ] Selector in the top bar; switching keeps workspace, conversation, open boards and drafts.
- [ ] `dir`/`lang` switch; layout correct in both directions (E2E screenshot check of main screens).
- [ ] Zero Hebrew literals in `src` outside `src/locales` (automated check); both locale files have the same keys (test).
- [ ] User content unchanged by switching (E2E: messages/ideas/drawings identical).
- [ ] Choice remembered between sessions.

**Cloud**
- [ ] Reachable from the phone with the PC off; unreachable from devices outside the user's tailnet; login required.
- [ ] Data survives container restart and redeploy; backup runs nightly; restore drill documented and performed once.
- [ ] No secret in Git or in the image (checked).
- [ ] With the PC off: AI buttons show "unavailable", nothing else breaks (E2E with Ollama URL pointing nowhere).
- [ ] Mobile layout unchanged.

**Quality & docs**
- [x] CI runs API, unit, build and E2E on every push (workflow added 2026-10-18; confirm the first run is green).
- [x] README (EN) + README.he: purpose, screenshots, features, architecture diagram, local setup, Ollama, Docker, tests (2026-10-18).
- [ ] README updated with deployment instructions and new features as they land.
- [ ] Demo workspace loads with one command; a 3-minute demo script exists.

## 5. Proposed additions (beyond the brief) — why each matters for "successful"
1. **A defined core journey + demo script**: "understand concept X" → explanation map grows → compare with My Map → copy what you agree with → refine. Without it the features are a toolbox, not a product story.
2. **Server-side layout & drawings** (above): otherwise phone/cloud silently lose work.
3. **Export/import (JSON)**: data ownership, backups you can read, and the safe way to move local → cloud.
4. **AI quality evaluation set** (15–20 Hebrew + English examples) and speed measurement on the real CPU, re-run after prompt/model changes.
5. **AI availability indicator** in the top bar (Ollama reachable or not).
6. **CI on GitHub**: a portfolio project that shows green tests is far more convincing.
7. **Explicit scope guard**: out of MVP — multi-user, real-time collaboration, PWA/offline, PostgreSQL, public sign-up.
