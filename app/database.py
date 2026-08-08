import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from werkzeug.security import check_password_hash, generate_password_hash

DB_PATH = Path(
    os.environ.get("DATABASE_PATH", Path(__file__).resolve().parent.parent / "data" / "codes.db")
)
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

JWT_SECRET = os.environ.get("SECRET_KEY", "dev-secret-change-me-in-production-32chars")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    codes TEXT NOT NULL DEFAULT '[]',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_name ON entries(name);
"""

POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    codes TEXT NOT NULL DEFAULT '[]',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_name ON entries(name);
"""


def using_postgres() -> bool:
    return bool(DATABASE_URL)


def init_db() -> None:
    if using_postgres():
        import psycopg2

        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(POSTGRES_SCHEMA)
            conn.commit()
        return

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(SQLITE_SCHEMA)


@contextmanager
def get_connection():
    if using_postgres():
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _placeholder() -> str:
    return "%s" if using_postgres() else "?"


def _execute(conn, sql: str, params=()):
    p = _placeholder()
    sql = sql.replace("?", p)
    if using_postgres():
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur
    return conn.execute(sql, params)


def _fetchone(conn, sql: str, params=()):
    cur = _execute(conn, sql, params)
    row = cur.fetchone()
    return dict(row) if row else None


def _fetchall(conn, sql: str, params=()):
    cur = _execute(conn, sql, params)
    return [dict(row) for row in cur.fetchall()]


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> bool:
    return bool(EMAIL_RE.match(email))


def create_user(email: str, password: str) -> dict:
    email = normalize_email(email)
    if not validate_email(email):
        raise ValueError("Invalid email address.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    password_hash = generate_password_hash(password)
    with get_connection() as conn:
        try:
            if using_postgres():
                cur = _execute(
                    conn,
                    "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
                    (email, password_hash),
                )
                user_id = cur.fetchone()["id"]
            else:
                cur = _execute(
                    conn,
                    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                    (email, password_hash),
                )
                user_id = cur.lastrowid
        except Exception as exc:
            if "unique" in str(exc).lower() or "UNIQUE" in str(exc):
                raise ValueError("Email already registered.") from exc
            raise
    return get_user_by_id(user_id)


def authenticate_user(email: str, password: str) -> dict | None:
    email = normalize_email(email)
    with get_connection() as conn:
        row = _fetchone(conn, "SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    if not row or not check_password_hash(row["password_hash"], password):
        return None
    return _row_to_user(row)


def get_user_by_id(user_id: int) -> dict | None:
    with get_connection() as conn:
        row = _fetchone(conn, "SELECT * FROM users WHERE id = ?", (user_id,))
    return _row_to_user(row) if row else None


def change_user_password(user_id: int, current: str, new_password: str) -> None:
    if len(new_password) < 6:
        raise ValueError("New password must be at least 6 characters.")
    with get_connection() as conn:
        row = _fetchone(conn, "SELECT password_hash FROM users WHERE id = ?", (user_id,))
        if not row or not check_password_hash(row["password_hash"], current):
            raise ValueError("Current password is incorrect.")
        _execute(
            conn,
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (generate_password_hash(new_password), user_id),
        )


def create_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": int((now + timedelta(days=JWT_EXPIRE_DAYS)).timestamp()),
        "iat": int(now.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def list_entries(user_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = _fetchall(
            conn,
            "SELECT * FROM entries WHERE user_id = ? ORDER BY name ASC",
            (user_id,),
        )
    return [_row_to_entry(row) for row in rows]


def get_entry(user_id: int, entry_id: int) -> dict | None:
    with get_connection() as conn:
        row = _fetchone(
            conn,
            "SELECT * FROM entries WHERE id = ? AND user_id = ?",
            (entry_id, user_id),
        )
    return _row_to_entry(row) if row else None


def create_entry(user_id: int, name: str, codes: list[str], notes: str = "") -> dict:
    codes_json = json.dumps([c for c in codes if str(c).strip()])
    with get_connection() as conn:
        if using_postgres():
            cur = _execute(
                conn,
                """
                INSERT INTO entries (user_id, name, codes, notes)
                VALUES (?, ?, ?, ?) RETURNING id
                """,
                (user_id, name.strip(), codes_json, notes.strip()),
            )
            entry_id = cur.fetchone()["id"]
        else:
            cur = _execute(
                conn,
                """
                INSERT INTO entries (user_id, name, codes, notes)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, name.strip(), codes_json, notes.strip()),
            )
            entry_id = cur.lastrowid
    return get_entry(user_id, entry_id)


def update_entry(
    user_id: int, entry_id: int, name: str, codes: list[str], notes: str = ""
) -> dict | None:
    codes_json = json.dumps([c for c in codes if str(c).strip()])
    with get_connection() as conn:
        if using_postgres():
            cur = _execute(
                conn,
                """
                UPDATE entries
                SET name = ?, codes = ?, notes = ?, updated_at = NOW()
                WHERE id = ? AND user_id = ?
                """,
                (name.strip(), codes_json, notes.strip(), entry_id, user_id),
            )
            updated = cur.rowcount > 0
        else:
            cur = _execute(
                conn,
                """
                UPDATE entries
                SET name = ?, codes = ?, notes = ?, updated_at = datetime('now')
                WHERE id = ? AND user_id = ?
                """,
                (name.strip(), codes_json, notes.strip(), entry_id, user_id),
            )
            updated = cur.rowcount > 0
        if not updated:
            return None
    return get_entry(user_id, entry_id)


def delete_entry(user_id: int, entry_id: int) -> bool:
    with get_connection() as conn:
        cur = _execute(
            conn,
            "DELETE FROM entries WHERE id = ? AND user_id = ?",
            (entry_id, user_id),
        )
        return cur.rowcount > 0


def delete_all_entries(user_id: int) -> int:
    with get_connection() as conn:
        cur = _execute(conn, "DELETE FROM entries WHERE user_id = ?", (user_id,))
        return cur.rowcount


def import_entries(user_id: int, items: list[dict], replace: bool = False) -> list[dict]:
    with get_connection() as conn:
        if replace:
            _execute(conn, "DELETE FROM entries WHERE user_id = ?", (user_id,))

        for item in items:
            name = (item.get("name") or "").strip()
            if not name:
                continue
            codes = item.get("codes") or []
            if not isinstance(codes, list):
                codes = []
            notes = (item.get("notes") or "").strip()
            codes_json = json.dumps([str(c) for c in codes if str(c).strip()])
            _execute(
                conn,
                "INSERT INTO entries (user_id, name, codes, notes) VALUES (?, ?, ?, ?)",
                (user_id, name, codes_json, notes),
            )

    return list_entries(user_id)


def _row_to_user(row) -> dict:
    created = row["created_at"]
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    return {
        "id": row["id"],
        "email": row["email"],
        "created_at": str(created),
    }


def _row_to_entry(row) -> dict:
    codes = json.loads(row["codes"] or "[]")
    created = row["created_at"]
    updated = row["updated_at"]
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat()
    return {
        "id": row["id"],
        "name": row["name"],
        "codes": codes,
        "notes": row["notes"] or "",
        "created_at": str(created),
        "updated_at": str(updated),
    }
