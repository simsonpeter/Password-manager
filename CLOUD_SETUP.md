# Cloud setup (one-time, from your phone)

Your codes are stored in the **cloud**. You need to turn on the cloud server once (free).

## Step 1 — Deploy cloud server on Render

1. Open **https://render.com** and sign up (free) with GitHub.
2. Tap **New +** → **Blueprint**.
3. Connect repo **simsonpeter/Password-manager**.
4. Render reads `render.yaml` automatically.
5. Tap **Apply** and wait until status is **Live** (~3–5 min).
6. Copy your URL, e.g. `https://gate-port-codes.onrender.com`

## Step 2 — Link GitHub Pages to cloud

1. Open **docs/js/config.js** in your repo on GitHub (edit in browser).
2. Set your Render URL:

```javascript
apiUrl: isGitHubPages ? "https://YOUR-APP.onrender.com" : "",
```

3. Save to **main**.

Or use the Render URL directly in your browser — app + API work on the same link.

## Step 3 — Use the app

**GitHub Pages:** https://simsonpeter.github.io/Password-manager/

**Or Render (recommended):** https://gate-port-codes.onrender.com

1. Tap **Create account** — email + password
2. Sign in on any phone with same email
3. All codes sync in the cloud

## Notes

- Free Render sleeps after 15 min idle — first open may take ~30 seconds. Wait and try again.
- Same email/password works on every device.
- Change password in ⚙️ settings inside the app.
- **Use Sign in** after you already registered (not Create account again).
- After updating the app, sync your Render Blueprint once to add the free database (keeps accounts safe).
