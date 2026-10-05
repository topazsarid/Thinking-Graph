from alembic import context
from backend.models import metadata
from backend.database import database_path, make_engine

def run(connection):
    context.configure(connection=connection, target_metadata=metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()

provided = context.config.attributes.get('connection')
if provided is not None:
    run(provided)
else:
    engine = make_engine(database_path())
    with engine.connect() as connection:
        run(connection)
    engine.dispose()
