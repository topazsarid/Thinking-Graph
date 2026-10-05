"""Source-grounded extraction drafts and user review history."""
from alembic import op
import sqlalchemy as sa
revision = '20260927_extraction'
down_revision = '20260926_aliases'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('extraction_runs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('message_id', sa.String(36), sa.ForeignKey('messages.id'), nullable=False),
        sa.Column('workspace_id', sa.String(36), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('model', sa.Text(), nullable=False),
        sa.Column('proposal', sa.Text(), nullable=False),
        sa.Column('review', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_by', sa.String(100), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.String(40), nullable=False))

def downgrade():
    op.drop_table('extraction_runs')
