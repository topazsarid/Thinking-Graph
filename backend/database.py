"""File-backed SQLite and explicit Alembic migrations; no hosted services."""
import os
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[1]

def database_path():
    value = Path(os.environ.get('THINKING_GRAPH_DB', 'data/thinking-graph.sqlite'))
    return value if value.is_absolute() else ROOT / value

def make_engine(path: Path):
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(URL.create('sqlite', database=str(path)),
                           connect_args={'check_same_thread': False, 'timeout': 15})
    @event.listens_for(engine, 'connect')
    def configure(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA busy_timeout=15000')
    return engine

def migrate(engine):
    config = Config(str(ROOT / 'alembic.ini'))
    config.set_main_option('script_location', str(ROOT / 'migrations'))
    with engine.begin() as connection:
        config.attributes['connection'] = connection
        command.upgrade(config, 'head')
