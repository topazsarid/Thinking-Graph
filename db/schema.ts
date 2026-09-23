// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
const provenance = () => ({ createdBy: text('created_by').notNull().references(() => users.id), createdAt: text('created_at').notNull() });
export const users = sqliteTable('users', { id: text('id').primaryKey(), name: text('name').notNull() });
export const conversations = sqliteTable('conversations', { id: text('id').primaryKey(), title: text('title').notNull(), ...provenance() });
export const messages = sqliteTable('messages', { id: text('id').primaryKey(), conversationId: text('conversation_id').notNull().references(() => conversations.id), content: text('content').notNull(), ...provenance() }, t => [index('idx_messages_conversation').on(t.conversationId)]);
export const ideas = sqliteTable('ideas', { id: text('id').primaryKey(), title: text('title').notNull(), summary: text('summary').notNull(), status: text('status', {enum:['proposed','accepted','rejected']}).notNull(), ...provenance() });
export const workspaces = sqliteTable('workspaces', { id: text('id').primaryKey(), title: text('title').notNull(), ...provenance() });
export const workspaceIdeas = sqliteTable('workspace_ideas', { workspaceId: text('workspace_id').notNull().references(() => workspaces.id), ideaId: text('idea_id').notNull().references(() => ideas.id), ...provenance() }, t => [primaryKey({columns:[t.workspaceId,t.ideaId]})]);
export const messageIdeas = sqliteTable('message_ideas', { messageId: text('message_id').notNull().references(() => messages.id), ideaId: text('idea_id').notNull().references(() => ideas.id), method: text('method').notNull(), ...provenance() }, t => [primaryKey({columns:[t.messageId,t.ideaId]}), index('idx_message_ideas_idea').on(t.ideaId)]);
export const connections = sqliteTable('connections', { id: text('id').primaryKey(), label: text('label').notNull(), ...provenance() });
export const connectionParticipants = sqliteTable('connection_participants', { connectionId: text('connection_id').notNull().references(() => connections.id), ideaId: text('idea_id').notNull().references(() => ideas.id), role: text('role').notNull(), ...provenance() }, t => [primaryKey({columns:[t.connectionId,t.ideaId]}), index('idx_participants_idea').on(t.ideaId)]);
export const events = sqliteTable('events', { id: text('id').primaryKey(), entityId: text('entity_id').notNull(), entityType: text('entity_type').notNull(), action: text('action').notNull(), before: text('before'), after: text('after').notNull(), ...provenance() }, t => [index('idx_events_entity').on(t.entityId)]);
