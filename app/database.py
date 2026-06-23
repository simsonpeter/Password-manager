import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "codes.db"


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                codes TEXT NOT NULL DEFAULT '[]',
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_entries_name ON entries(name);
            """
        )


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_setting(key: str) -> str | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else None


def set_setting(key: str, value: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )


def delete_setting(key: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = ?", (key,))


def has_app_password() -> bool:
    return get_setting("app_password_hash") is not None


def list_entries() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM entries ORDER BY name COLLATE NOCASE ASC"
        ).fetchall()
    return [_row_to_entry(row) for row in rows]


def get_entry(entry_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM entries WHERE id = ?", (entry_id,)
        ).fetchone()
    return _row_to_entry(row) if row else None


def create_entry(name: str, codes: list[str], notes: str = "") -> dict:
    codes_json = json.dumps([c for c in codes if c.strip()])
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO entries (name, codes, notes)
            VALUES (?, ?, ?)
            """,
            (name.strip(), codes_json, notes.strip()),
        )
        entry_id = cur.lastrowid
    return get_entry(entry_id)


def update_entry(
    entry_id: int, name: str, codes: list[str], notes: str = ""
) -> dict | None:
    codes_json = json.dumps([c for c in codes if c.strip()])
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE entries
            SET name = ?, codes = ?, notes = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (name.strip(), codes_json, notes.strip(), entry_id),
        )
    return get_entry(entry_id)


def delete_entry(entry_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
        return cur.rowcount > 0


def _row_to_entry(row: sqlite3.Row) -> dict:
    codes = json.loads(row["codes"] or "[]")
    return {
        "id": row["id"],
        "name": row["name"],
        "codes": codes,
        "notes": row["notes"] or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
