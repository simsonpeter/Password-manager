import os
import secrets

from flask import Flask
from werkzeug.security import check_password_hash, generate_password_hash

from app import database as db


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["PERMANENT_SESSION_LIFETIME"] = 60 * 60 * 8  # 8 hours

    db.init_db()

    from app.routes import bp

    app.register_blueprint(bp)
    return app


def verify_app_password(password: str) -> bool:
    stored = db.get_setting("app_password_hash")
    if not stored:
        return False
    return check_password_hash(stored, password)


def set_app_password(password: str) -> None:
    db.set_setting("app_password_hash", generate_password_hash(password))


def clear_app_password() -> None:
    db.delete_setting("app_password_hash")
