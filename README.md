# Gate & Port Code Manager

Password-protected web app for managing client gate and port access codes. **Works on your phone — no PC needed.**

## Use the app (phone or any browser)

After GitHub Pages is enabled, open:

**https://simsonpeter.github.io/Password-manager/**

1. **First visit** — Create your app password (min 6 characters).
2. **Every visit** — Enter your password to unlock.
3. **Add entries** — Name + 1st code, 2nd code, add more codes as needed.
4. **Add to home screen** (optional) — On iPhone/Android, use “Add to Home Screen” for an app-like icon.

Your data is **encrypted on your device** (browser storage). Nobody can read it without your password.

### Backup (important)

Use **Download backup** in the app and save the file (e.g. Google Drive, email to yourself). If you clear browser data or change phones, use **Restore backup** with the same password.

## Enable the live website (one-time)

GitHub should deploy automatically when you push to `main`. If the link does not work yet:

1. Open your repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment**, **Source** should be **GitHub Actions**
3. After the workflow runs, the site URL appears on the Pages settings page

## Features

- App password protection
- Multiple names (clients, gates, ports)
- Multiple codes per name (1st, 2nd, 3rd…)
- Search, copy, edit, delete
- Optional notes per entry
- Change password
- Export / import encrypted backup
- Works offline after first load (PWA)

## Optional: run server version locally

A Flask version is included in `app/` for local use on a computer:

```bash
pip install -r requirements.txt
python run.py
```

The **recommended** setup for phone-only use is the **web app in `docs/`** deployed to GitHub Pages.
