"""User-confirmed synonyms for relation types."""
from alembic import op
import sqlalchemy as sa
revision = '20260926_aliases'
down_revision = '20260926_types'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('relation_aliases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('type_id', sa.String(36), sa.ForeignKey('relation_types.id'), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('created_by', sa.String(100), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.String(40), nullable=False))

def downgrade():
    op.drop_table('relation_aliases')
