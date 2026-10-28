import os, json, time
from pathlib import Path
from sqlalchemy import create_engine, text
from .keyring import OWNER

DATA = Path(os.getenv("SENTINEL_DATA_DIR", "data"))
DATA.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    os.getenv("DATABASE_URL", f"sqlite:///{DATA}/sentinel.db"),
    connect_args={"check_same_thread": False}
    if os.getenv("DATABASE_URL", "sqlite:").startswith("sqlite:")
    else {},
)


def init_db():
    with engine.begin() as c:
        c.execute(
            text(
                "CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL, PRIMARY KEY (kind,id))"
            )
        )
        c.execute(
            text(
                "CREATE TABLE IF NOT EXISTS events (run_id TEXT NOT NULL, seq INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run_id, seq))"
            )
        )
        c.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)"
            )
        )
        c.execute(
            text(
                "INSERT INTO schema_version (version) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE version=1)"
            )
        )


# Public demo: each visitor writes to "<kind>@<session>"; reads also see the shared seeded "<kind>".
# Kinds keyed by unguessable UUIDs stay readable by id from any session, so shared links and event streams work.
CAPABILITY = ("run", "campaign", "recording", "run_context", "review", "attack")


def _own(kind):
    owner = OWNER.get()
    return f"{kind}@{owner}" if owner else kind


def _insert(c, kind, id, body):
    c.execute(
        text("INSERT INTO documents VALUES (:k,:i,:b,:t)"),
        {"k": kind, "i": id, "b": json.dumps(body, ensure_ascii=False), "t": time.time()},
    )


def put(kind, id, body):
    stored = _own(kind)
    with engine.begin() as c:
        c.execute(text("DELETE FROM documents WHERE kind=:k AND id=:i"), {"k": stored, "i": id})
        _insert(c, stored, id, body)
    return body


def put_stored(stored_kind, id, body):
    """Rewrite a document where it already lives (startup recovery across visitors)."""
    with engine.begin() as c:
        c.execute(text("DELETE FROM documents WHERE kind=:k AND id=:i"), {"k": stored_kind, "i": id})
        _insert(c, stored_kind, id, body)


def insert(kind, id, body):
    with engine.begin() as c:
        _insert(c, _own(kind), id, body)
    return body


def get(kind, id):
    own = _own(kind)
    with engine.connect() as c:
        row = c.execute(
            text("SELECT body FROM documents WHERE kind IN (:a,:b) AND id=:i ORDER BY kind=:a DESC"),
            {"a": own, "b": kind, "i": id},
        ).first()
        if not row and kind in CAPABILITY:
            row = c.execute(
                text("SELECT body FROM documents WHERE kind LIKE :p AND id=:i"),
                {"p": f"{kind}@%", "i": id},
            ).first()
    return json.loads(row[0]) if row else None


def all_docs(kind):
    with engine.connect() as c:
        rows = c.execute(
            text("SELECT body FROM documents WHERE kind IN (:a,:b) ORDER BY created DESC"),
            {"a": _own(kind), "b": kind},
        ).all()
    return [json.loads(r[0]) for r in rows]


def every(kind):
    """(stored_kind, document) for every visitor's copy, for startup recovery."""
    with engine.connect() as c:
        rows = c.execute(
            text("SELECT kind, body FROM documents WHERE kind=:k OR kind LIKE :p"),
            {"k": kind, "p": f"{kind}@%"},
        ).all()
    return [(r[0], json.loads(r[1])) for r in rows]


def delete(kind, id):
    with engine.begin() as c:
        c.execute(text("DELETE FROM documents WHERE kind=:k AND id=:i"), {"k": _own(kind), "i": id})


def event(run_id, body):
    with engine.begin() as c:
        seq = c.execute(
            text("SELECT COALESCE(MAX(seq),0)+1 FROM events WHERE run_id=:r"),
            {"r": run_id},
        ).scalar()
        record = {**body, "seq": seq, "timestamp": time.time(), "run_id": run_id}
        c.execute(
            text("INSERT INTO events VALUES (:r,:s,:b)"),
            {"r": run_id, "s": seq, "b": json.dumps(record)},
        )
    return record


def events(run_id, after=0):
    with engine.connect() as c:
        rows = c.execute(
            text("SELECT body FROM events WHERE run_id=:r AND seq>:s ORDER BY seq"),
            {"r": run_id, "s": after},
        ).all()
    return [json.loads(r[0]) for r in rows]
