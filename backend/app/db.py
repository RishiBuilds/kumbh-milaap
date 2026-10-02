from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Iterator

if TYPE_CHECKING:
    from .models import CaseResponse

DB_PATH = Path(__file__).resolve().parent.parent / "runtime" / "cases.db"
BUSY_TIMEOUT_MS = 5000

_init_lock = threading.Lock()
_initialized_path: Path | None = None


def _configure(conn: sqlite3.Connection) -> None:
    conn.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")


def _ensure_schema(conn: sqlite3.Connection) -> None:
    global _initialized_path
    if _initialized_path == DB_PATH:
        return
    with _init_lock:
        if _initialized_path == DB_PATH:
            return
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS cases (
                case_id TEXT PRIMARY KEY,
                status  TEXT NOT NULL,
                data    TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status);
            """
        )
        _initialized_path = DB_PATH


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=BUSY_TIMEOUT_MS / 1000, isolation_level=None)
    try:
        _configure(conn)
        _ensure_schema(conn)
        yield conn
    finally:
        conn.close()


@contextmanager
def _write() -> Iterator[sqlite3.Connection]:
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            yield conn
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        else:
            conn.execute("COMMIT")


def _case_model() -> type[CaseResponse]:
    from .models import CaseResponse

    return CaseResponse


def _status_value(status: object) -> str:
    return str(getattr(status, "value", status))


def save(case: CaseResponse) -> None:
    with _write() as conn:
        conn.execute(
            """
            INSERT INTO cases (case_id, status, data) VALUES (?, ?, ?)
            ON CONFLICT(case_id) DO UPDATE SET
                status = excluded.status,
                data = excluded.data
            """,
            (case.case_id, _status_value(case.status), case.model_dump_json()),
        )


def get(case_id: str) -> CaseResponse | None:
    with _connect() as conn:
        row = conn.execute("SELECT data FROM cases WHERE case_id = ?", (case_id,)).fetchone()
    return _case_model().model_validate_json(row[0]) if row else None


def exists(case_id: str) -> bool:
    with _connect() as conn:
        row = conn.execute("SELECT 1 FROM cases WHERE case_id = ? LIMIT 1", (case_id,)).fetchone()
    return row is not None


def list_all(status: str | None = None) -> list[CaseResponse]:
    query = "SELECT data FROM cases"
    params: tuple[str, ...] = ()
    if status:
        query += " WHERE status = ?"
        params = (status,)
    query += " ORDER BY rowid"
    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()
    model = _case_model()
    return [model.model_validate_json(row[0]) for row in rows]


def update_status(case_id: str, new_status: str) -> CaseResponse | None:
    from .models import CaseStatus

    status = CaseStatus(new_status)
    model = _case_model()
    with _write() as conn:
        row = conn.execute("SELECT data FROM cases WHERE case_id = ?", (case_id,)).fetchone()
        if row is None:
            return None
        updated = model.model_validate_json(row[0]).model_copy(update={"status": status})
        conn.execute(
            "UPDATE cases SET status = ?, data = ? WHERE case_id = ?",
            (status.value, updated.model_dump_json(), case_id),
        )
    return updated


def count_by_status() -> dict[str, int]:
    with _connect() as conn:
        rows = conn.execute("SELECT status, COUNT(*) FROM cases GROUP BY status").fetchall()
    return {status: total for status, total in rows}