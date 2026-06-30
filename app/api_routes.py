from functools import wraps

from flask import Blueprint, jsonify, request

from app import database as db

api_bp = Blueprint("api", __name__, url_prefix="/api")


def get_bearer_token() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


def auth_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        token = get_bearer_token()
        if not token:
            return jsonify({"error": "Login required."}), 401
        payload = db.decode_token(token)
        if not payload:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        user = db.get_user_by_id(int(payload["sub"]))
        if not user:
            return jsonify({"error": "User not found."}), 401
        request.current_user = user
        return f(*args, **kwargs)

    return wrapped


@api_bp.post("/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    try:
        user = db.create_user(email, password)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    token = db.create_token(user["id"], user["email"])
    return jsonify({"token": token, "email": user["email"]}), 201


@api_bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    user = db.authenticate_user(email, password)
    if not user:
        return jsonify({"error": "Wrong email or password."}), 401

    token = db.create_token(user["id"], user["email"])
    return jsonify({"token": token, "email": user["email"]})


@api_bp.get("/auth/me")
@auth_required
def me():
    return jsonify(request.current_user)


@api_bp.post("/auth/change-password")
@auth_required
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    confirm = data.get("confirm_password") or ""

    if new_password != confirm:
        return jsonify({"error": "New passwords do not match."}), 400

    try:
        db.change_user_password(request.current_user["id"], current, new_password)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"ok": True})


@api_bp.get("/entries")
@auth_required
def list_entries():
    return jsonify(db.list_entries(request.current_user["id"]))


@api_bp.post("/entries")
@auth_required
def create_entry():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    codes = data.get("codes") or []
    notes = (data.get("notes") or "").strip()

    if not name:
        return jsonify({"error": "Name is required."}), 400
    if not isinstance(codes, list):
        return jsonify({"error": "Codes must be a list."}), 400

    entry = db.create_entry(
        request.current_user["id"], name, [str(c) for c in codes], notes
    )
    return jsonify(entry), 201


@api_bp.put("/entries/<int:entry_id>")
@auth_required
def update_entry(entry_id: int):
    user_id = request.current_user["id"]
    existing = db.get_entry(user_id, entry_id)
    if not existing:
        return jsonify({"error": "Not found."}), 404

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or existing["name"]).strip()
    codes = data.get("codes", existing["codes"])
    notes = data.get("notes", existing["notes"])

    if not name:
        return jsonify({"error": "Name is required."}), 400
    if not isinstance(codes, list):
        return jsonify({"error": "Codes must be a list."}), 400

    entry = db.update_entry(user_id, entry_id, name, [str(c) for c in codes], notes)
    return jsonify(entry)


@api_bp.delete("/entries/<int:entry_id>")
@auth_required
def delete_entry(entry_id: int):
    if not db.delete_entry(request.current_user["id"], entry_id):
        return jsonify({"error": "Not found."}), 404
    return jsonify({"ok": True})
