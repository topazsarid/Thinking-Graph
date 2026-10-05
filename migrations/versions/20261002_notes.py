"""Persistent notes, immutable extraction sources, and recoverable connection removal."""
from alembic import op
import sqlalchemy as sa
revision = '20261002_notes'
down_revision = '20260927_extraction'
branch_labels = None
depends_on = None

def provenance():
    return [sa.Column('created_by', sa.String(100), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('created_at', sa.String(40), nullable=False)]

def upgrade():
    op.add_column('connections', sa.Column('deleted_at', sa.String(40)))
    op.create_table('notes', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.Text(), nullable=False), sa.Column('content', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.String(40), nullable=False), *provenance())
    op.create_table('note_message_sources',
        sa.Column('note_id', sa.String(36), sa.ForeignKey('notes.id'), primary_key=True),
        sa.Column('message_id', sa.String(36), sa.ForeignKey('messages.id'), primary_key=True),
        sa.Column('title', sa.Text(), nullable=False), sa.Column('content', sa.Text(), nullable=False),
        sa.Column('note_updated_at', sa.String(40), nullable=False), *provenance())

def downgrade():
    op.drop_table('note_message_sources')
    op.drop_table('notes')
    op.drop_column('connections', 'deleted_at')
