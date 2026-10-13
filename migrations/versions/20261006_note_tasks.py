"""Note types and persistent task completion; existing notes remain general."""
from alembic import op
import sqlalchemy as sa
revision = '20261006_note_tasks'
down_revision = '20261002_notes'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('notes', sa.Column('kind', sa.String(20), nullable=False, server_default='general'))
    op.add_column('notes', sa.Column('completed', sa.Boolean(), nullable=False, server_default='0'))

def downgrade():
    op.drop_column('notes', 'completed')
    op.drop_column('notes', 'kind')
