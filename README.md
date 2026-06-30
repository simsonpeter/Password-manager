# Gate & Port Code Manager (Cloud)

Password-protected gate and port codes with **cloud login**. Use on any phone — codes sync online.

## Live links

| Link | What it is |
|------|------------|
| https://simsonpeter.github.io/Password-manager/ | Phone app (GitHub Pages) |
| https://gate-port-codes.onrender.com | App + cloud API together (after Render setup) |

**First time?** Deploy the cloud server: **[CLOUD_SETUP.md](CLOUD_SETUP.md)** (~5 min on your phone).

## How it works

1. **Create account** with email + password
2. **Sign in** on any device
3. **Codes tab** — list, search, edit, share, copy
4. **Add tab** — add new names and codes (saved to cloud)

## Features

- Cloud account login (email + password)
- All codes stored in cloud database
- Multiple names, multiple codes per name
- Works on phone, tablet, any browser
- Edit, share, copy, delete
- Change account password in settings

## For developers

```bash
pip install -r requirements.txt
python run.py
```

Open http://localhost:5000 — serves app + API.

Deploy to Render with the included `render.yaml`.
