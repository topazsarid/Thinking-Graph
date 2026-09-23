# Thinking Graph · MVP 0.1

A Hebrew, RTL Chat + Map working surface. React/Vinext, Cloudflare Worker, D1/SQLite, Drizzle migrations.

## First use

Sign in with ChatGPT, then choose “פתיחת מרחב ושיחה”. Send a message such as `יש קשר בין [[שדה]] לבין [[כוח]]`. Inspect a proposed idea, edit/accept/reject it, select “קשר חדש” to connect two or more ideas, and open source cards to return to their original conversations. Create another workspace or conversation to reuse the same ideas.

## Domain model

- Conversation → Message is 1:N because a message records a specific utterance in a specific conversation.
- Idea ↔ Message is M:N through MessageIdea; source messages remain immutable.
- Idea ↔ Workspace is M:N through WorkspaceIdea. Workspaces reference canonical ideas; they do not copy or own them.
- Connection ↔ Idea uses ConnectionParticipant and supports 2–12 participants. The initial relations are undirected, with `participant` roles. No source/target direction is implied.
- `created_by` records the actor, never ownership. Users and the rule-based system are distinct actors. Multiple users may contribute to the same graph; the Site access policy controls who can enter. All admitted users see and can edit the same graph. There are no per-workspace access boundaries in this MVP.
- Events append before/after snapshots and actor/time for creation, proposals, source links, and edits. Mutations and events are committed in a single D1 batch. Source and workspace join records retain their own provenance.

## Explicit MVP limits

Idea suggestions use `[[marked concepts]]`, or sentences when no concepts are marked. This is deterministic extraction, not an LLM conversation or semantic reasoning service. Exact normalized titles are reused across conversations; paraphrases require manual linking. Reuse is not a semantic-equivalence claim. Concurrent first creation of identical titles is not serialized; production multi-user deduplication remains future work. The graph uses an automatic grid layout, supports scrolling, and has no drag/pan layout persistence. Context, embeddings, automatic connection proposals, learned feedback, and fine-grained permissions are intentionally deferred.

## Develop

Use Node >=22.13 and the package-lock.json. `npm ci`, `npm run db:generate`, `npm run build`. Apply pending SQL migrations to the local D1 database using the generated `dist/server/wrangler.json` and Wrangler before running `npm run dev`. The starter's local sign-in is at `/signin-with-chatgpt?return_to=/`.

Validation: `npx tsc --noEmit` and `node tests/api.mjs` (Node 24 for node:sqlite). The API tests execute the real route handlers over an in-memory SQLite D1 adapter and generated migrations, with mocked authenticated users. They cover cross-conversation reuse, shared workspaces, multi-actor provenance, edit history, connections, invalid operations and auth/origin checks. They are not deployed D1 or browser end-to-end tests.

Production schema lives in `db/schema.ts`; generated migrations and metadata live in `drizzle/`. Never rewrite an already applied migration. `.openai/hosting.json` contains only Site identity and logical storage bindings. No API key is needed for this version.
