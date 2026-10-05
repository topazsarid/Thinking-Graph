"""Connection descriptions, feedback and hierarchical relation types."""
from alembic import op
import sqlalchemy as sa
revision = '20260926_types'
down_revision = '01831181783e'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('relation_types',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('parent_id', sa.String(36), sa.ForeignKey('relation_types.id')),
        sa.Column('created_by', sa.String(100), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.String(40), nullable=False))
    # SQLite supports adding a nullable inline FK without recreating the referenced table.
    op.execute('ALTER TABLE connections ADD COLUMN type_id VARCHAR(36) REFERENCES relation_types(id)')
    op.add_column('connections', sa.Column('description', sa.Text(), nullable=False, server_default=''))
    op.add_column('connections', sa.Column('suggestion', sa.Text(), nullable=False, server_default=''))
    op.add_column('connections', sa.Column('missed', sa.Boolean(), nullable=False, server_default='0'))

def downgrade():
    for column in ('missed', 'suggestion', 'description', 'type_id'):
        op.drop_column('connections', column)
    op.drop_table('relation_types')
