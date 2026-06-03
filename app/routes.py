from functools import wraps

from flask import (
    Blueprint,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from app import database as db
from app.factory import set_app_password, verify_app_password

bp = Blueprint("main", __name__)


def login_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized"}), 401
            return redirect(url_for("main.login"))
        return f(*args, **kwargs)

    return wrapped


@bp.route("/")
def index():
    if not db.has_app_password():
        return redirect(url_for("main.setup"))
    if not session.get("authenticated"):
        return redirect(url_for("main.login"))
    return redirect(url_for("main.dashboard"))


@bp.route("/setup", methods=["GET", "POST"])
def setup():
    if db.has_app_password():
        return redirect(url_for("main.login"))

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm = request.form.get("confirm", "")
        if len(password) < 6:
            flash("Password must be at least 6 characters.", "error")
        elif password != confirm:
            flash("Passwords do not match.", "error")
        else:
            set_app_password(password)
            session["authenticated"] = True
            session.permanent = True
            flash("App password created. You are now logged in.", "success")
            return redirect(url_for("main.dashboard"))

    return render_template("setup.html")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if not db.has_app_password():
        return redirect(url_for("main.setup"))

    if session.get("authenticated"):
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        password = request.form.get("password", "")
        if verify_app_password(password):
            session["authenticated"] = True
            session.permanent = True
            return redirect(url_for("main.dashboard"))
        flash("Incorrect password.", "error")

    return render_template("login.html")


@bp.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("main.login"))


@bp.route("/dashboard")
@login_required
def dashboard():
    entries = db.list_entries()
    return render_template("dashboard.html", entries=entries)


@bp.route("/api/entries", methods=["GET"])
@login_required
def api_list_entries():
    return jsonify(db.list_entries())


@bp.route("/api/entries", methods=["POST"])
@login_required
def api_create_entry():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    codes = data.get("codes") or []
    notes = (data.get("notes") or "").strip()

    if not name:
        return jsonify({"error": "Name is required."}), 400
    if not isinstance(codes, list):
        return jsonify({"error": "Codes must be a list."}), 400

    entry = db.create_entry(name, [str(c) for c in codes], notes)
    return jsonify(entry), 201


@bp.route("/api/entries/<int:entry_id>", methods=["PUT"])
@login_required
def api_update_entry(entry_id: int):
    existing = db.get_entry(entry_id)
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

    entry = db.update_entry(entry_id, name, [str(c) for c in codes], notes)
    return jsonify(entry)


@bp.route("/api/entries/<int:entry_id>", methods=["DELETE"])
@login_required
def api_delete_entry(entry_id: int):
    if not db.delete_entry(entry_id):
        return jsonify({"error": "Not found."}), 404
    return jsonify({"ok": True})


@bp.route("/api/change-password", methods=["POST"])
@login_required
def api_change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password", "")
    new_password = data.get("new_password", "")
    confirm = data.get("confirm_password", "")

    if not verify_app_password(current):
        return jsonify({"error": "Current password is incorrect."}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400
    if new_password != confirm:
        return jsonify({"error": "New passwords do not match."}), 400

    set_app_password(new_password)
    return jsonify({"ok": True})
