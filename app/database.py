import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from werkzeug.security import check_password_hash, generate_password_hash

DB_PATH = Path(os.environ.get("DATABASE_PATH", Path(__file__).resolve().parent.parent / "data" / "codes.db"))
JWT_SECRET = os.environ.get("SECRET_KEY", "dev-secret-change-me-in-production-32chars")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
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
        )


@contextmanager
def get_connection():
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
            cur = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, password_hash),
            )
        except sqlite3.IntegrityError:
            raise ValueError("Email already registered.")
        user_id = cur.lastrowid
    return get_user_by_id(user_id)


def authenticate_user(email: str, password: str) -> dict | None:
    email = normalize_email(email)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return None
    return _row_to_user(row)


def get_user_by_id(user_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_user(row) if row else None


def change_user_password(user_id: int, current: str, new_password: str) -> None:
    if len(new_password) < 6:
        raise ValueError("New password must be at least 6 characters.")
    with get_connection() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row or not check_password_hash(row["password_hash"], current):
            raise ValueError("Current password is incorrect.")
        conn.execute(
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
        rows = conn.execute(
            "SELECT * FROM entries WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC",
            (user_id,),
        ).fetchall()
    return [_row_to_entry(row) for row in rows]


def get_entry(user_id: int, entry_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM entries WHERE id = ? AND user_id = ?",
            (entry_id, user_id),
        ).fetchone()
    return _row_to_entry(row) if row else None


def create_entry(user_id: int, name: str, codes: list[str], notes: str = "") -> dict:
    codes_json = json.dumps([c for c in codes if str(c).strip()])
    with get_connection() as conn:
        cur = conn.execute(
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
        cur = conn.execute(
            """
            UPDATE entries
            SET name = ?, codes = ?, notes = ?, updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
            """,
            (name.strip(), codes_json, notes.strip(), entry_id, user_id),
        )
        if cur.rowcount == 0:
            return None
    return get_entry(user_id, entry_id)


def delete_entry(user_id: int, entry_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM entries WHERE id = ? AND user_id = ?",
            (entry_id, user_id),
        )
        return cur.rowcount > 0


def _row_to_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


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
