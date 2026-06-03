# Gate & Port Code Manager

A password-protected web app to store and manage access codes for client gates and ports.

## Features

- **App password** — The entire app is locked behind a password you set on first launch.
- **Multiple names** — Add as many entries as you need (client, gate, port, etc.).
- **Multiple codes per name** — Each entry supports a 1st code, 2nd code, 3rd code, and more with “Add another code”.
- **Search** — Quickly filter entries by name.
- **Copy to clipboard** — One-click copy for any code.
- **Notes** — Optional notes per entry (location, directions, etc.).

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Open **http://localhost:5000** in your browser.

On first visit you will create your app password. After that, log in to manage entries.

## Configuration

| Variable     | Description                                      |
|-------------|--------------------------------------------------|
| `SECRET_KEY` | Flask session signing key (auto-generated if unset) |
| `PORT`       | Server port (default: `5000`)                    |

Data is stored in `data/codes.db` (SQLite). Back up this file to keep your entries safe.

## Production

```bash
gunicorn -w 2 -b 0.0.0.0:5000 "app:create_app()"
```

Use HTTPS in production and set a strong `SECRET_KEY`.
