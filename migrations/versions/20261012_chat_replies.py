"""Chat replies from the local model (kept apart from messages) and per-conversation answer preference."""
from alembic import op
import sqlalchemy as sa
revision = '20261012_chat_replies'
down_revision = '20261006_note_tasks'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('conversations', sa.Column('answer_preference', sa.Text(), nullable=False, server_default=''))
    op.create_table('chat_replies',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('message_id', sa.String(36), sa.ForeignKey('messages.id'), nullable=False),
        sa.Column('conversation_id', sa.String(36), sa.ForeignKey('conversations.id'), nullable=False),
        sa.Column('workspace_id', sa.String(36), sa.ForeignKey('workspaces.id')),
        sa.Column('mode', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('concept', sa.Text()),
        sa.Column('idea_ids', sa.Text()),
        sa.Column('model', sa.Text(), nullable=False),
        sa.Column('created_by', sa.String(100), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.String(40), nullable=False),
        sa.CheckConstraint("mode IN ('self','external','search')", name='reply_mode'))
    op.create_index('idx_chat_replies_message', 'chat_replies', ['message_id'])

def downgrade():
    op.drop_index('idx_chat_replies_message', table_name='chat_replies')
    op.drop_table('chat_replies')
    with op.batch_alter_table('conversations') as batch:
        batch.drop_column('answer_preference')
