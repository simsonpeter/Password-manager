import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from app import database as db

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    origins = os.environ.get(
        "CORS_ORIGINS",
        "https://simsonpeter.github.io,http://localhost:5000,http://127.0.0.1:5000",
    ).split(",")

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [o.strip() for o in origins if o.strip()],
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            }
        },
        supports_credentials=False,
    )

    from app.api_routes import api_bp

    app.register_blueprint(api_bp)

    @app.get("/api/health")
    def health():
        try:
            db.check_connection()
            db_status = "postgres" if db.using_postgres() else "sqlite"
        except Exception as exc:
            logger = __import__("logging").getLogger(__name__)
            logger.warning("Health check database error: %s", exc)
            db_status = "unavailable"
        return jsonify(
            {
                "ok": True,
                "service": "gate-port-codes",
                "database": db_status,
            }
        )

    @app.route("/", defaults={"path": "index.html"})
    @app.route("/<path:path>")
    def serve_docs(path):
        if path.startswith("api/"):
            return jsonify({"error": "Not found."}), 404
        target = DOCS_DIR / path
        if target.is_file():
            return send_from_directory(DOCS_DIR, path)
        index = DOCS_DIR / "index.html"
        if index.is_file():
            return send_from_directory(DOCS_DIR, "index.html")
        return jsonify({"error": "Frontend not found."}), 404

    return app
