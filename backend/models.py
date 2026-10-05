"""Relational graph schema. created_by is provenance, never ownership."""
from sqlalchemy import (MetaData, Table, Column, String, Text, ForeignKey, Boolean,
                        Index, CheckConstraint)

metadata = MetaData()

def identity():
    return Column('id', String(36), primary_key=True)

def provenance():
    return [Column('created_by', String(100), ForeignKey('users.id'), nullable=False),
            Column('created_at', String(40), nullable=False)]

users = Table('users', metadata, Column('id', String(100), primary_key=True),
              Column('name', Text, nullable=False))
conversations = Table('conversations', metadata, identity(),
                      Column('title', Text, nullable=False), *provenance())
workspaces = Table('workspaces', metadata, identity(),
                   Column('title', Text, nullable=False), *provenance())
messages = Table('messages', metadata, identity(),
                 Column('conversation_id', String(36), ForeignKey('conversations.id'), nullable=False),
                 Column('content', Text, nullable=False), *provenance())
ideas = Table('ideas', metadata, identity(), Column('title', Text, nullable=False),
              Column('summary', Text, nullable=False), Column('status', String(20), nullable=False),
              *provenance(), CheckConstraint("status IN ('proposed','accepted','rejected')", name='idea_status'))
relation_types = Table('relation_types', metadata, identity(),
    Column('title', Text, nullable=False), Column('description', Text, nullable=False),
    Column('parent_id', String(36), ForeignKey('relation_types.id')),
    *provenance())
relation_aliases = Table('relation_aliases', metadata, identity(),
    Column('type_id', String(36), ForeignKey('relation_types.id'), nullable=False),
    Column('title', Text, nullable=False), *provenance())
connections = Table('connections', metadata, identity(), Column('deleted_at', String(40)), Column('label', Text, nullable=False),
    Column('type_id', String(36), ForeignKey('relation_types.id')),
    Column('description', Text, nullable=False, server_default=''),
    Column('suggestion', Text, nullable=False, server_default=''),
    Column('missed', Boolean, nullable=False, server_default='0'), *provenance())
workspace_ideas = Table('workspace_ideas', metadata,
    Column('workspace_id', String(36), ForeignKey('workspaces.id'), primary_key=True),
    Column('idea_id', String(36), ForeignKey('ideas.id'), primary_key=True), *provenance())
message_ideas = Table('message_ideas', metadata,
    Column('message_id', String(36), ForeignKey('messages.id'), primary_key=True),
    Column('idea_id', String(36), ForeignKey('ideas.id'), primary_key=True),
    Column('method', String(40), nullable=False), *provenance())
connection_participants = Table('connection_participants', metadata,
    Column('connection_id', String(36), ForeignKey('connections.id'), primary_key=True),
    Column('idea_id', String(36), ForeignKey('ideas.id'), primary_key=True),
    Column('role', String(40), nullable=False), *provenance())
events = Table('events', metadata, identity(), Column('entity_id', String(36), nullable=False),
    Column('entity_type', String(40), nullable=False), Column('action', String(40), nullable=False),
    Column('before', Text), Column('after', Text, nullable=False), *provenance())
command_receipts = Table('command_receipts', metadata, identity(),
    Column('payload_hash', String(64), nullable=False), Column('result_id', String(36), nullable=False),
    *provenance())
Index('idx_messages_conversation', messages.c.conversation_id)
Index('idx_message_ideas_idea', message_ideas.c.idea_id)
Index('idx_workspace_ideas_idea', workspace_ideas.c.idea_id)
Index('idx_participants_idea', connection_participants.c.idea_id)
Index('idx_events_entity', events.c.entity_id)
extraction_runs = Table('extraction_runs', metadata, identity(),
    Column('message_id', String(36), ForeignKey('messages.id'), nullable=False),
    Column('workspace_id', String(36), ForeignKey('workspaces.id'), nullable=False),
    Column('model', Text, nullable=False), Column('proposal', Text, nullable=False),
    Column('review', Text), Column('status', String(20), nullable=False), *provenance())
notes = Table('notes', metadata, identity(), Column('title', Text, nullable=False),
    Column('content', Text, nullable=False), Column('updated_at', String(40), nullable=False), *provenance())
note_message_sources = Table('note_message_sources', metadata,
    Column('note_id', String(36), ForeignKey('notes.id'), primary_key=True),
    Column('message_id', String(36), ForeignKey('messages.id'), primary_key=True),
    Column('title', Text, nullable=False), Column('content', Text, nullable=False),
    Column('note_updated_at', String(40), nullable=False), *provenance())
GRAPH_TABLES = [users, conversations, messages, ideas, workspaces, workspace_ideas,
                message_ideas, connections, connection_participants, events, relation_types, relation_aliases, extraction_runs, notes, note_message_sources]
