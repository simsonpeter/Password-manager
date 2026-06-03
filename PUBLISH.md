# Fix: “Page cannot publish” (GitHub Pages)

Follow these steps **on your phone** in the GitHub app or browser.

## Step 1 — Use the simple method (recommended)

Do **NOT** use “GitHub Actions” unless you know how. Use the **docs folder** instead.

1. Open: **https://github.com/simsonpeter/Password-manager**
2. Tap **Settings** (gear icon)
3. Tap **Pages** (left menu; scroll down on phone)
4. Under **Build and deployment** → **Source**, choose:
   - **Deploy from a branch**
5. Under **Branch**:
   - Branch: **main**
   - Folder: **/docs**
6. Tap **Save**

Wait **1–3 minutes**. Refresh the Pages screen. You should see:

> Your site is live at **https://simsonpeter.github.io/Password-manager/**

## Step 2 — Repo must be public

GitHub Pages (free) needs a **public** repo.

1. **Settings** → **General** → scroll to **Danger Zone** or find **Repository visibility**
2. If it says **Private**, change to **Public** (or upgrade GitHub plan for private Pages)

## Step 3 — Turn OFF conflicting settings

If you tried Actions before:

1. **Settings** → **Pages**
2. If **Source** was **GitHub Actions**, change it to **Deploy from a branch** (Step 1)
3. **Actions** tab → cancel any failed “Deploy web app” runs (optional)

## Step 4 — Open the app

**https://simsonpeter.github.io/Password-manager/**

If you see 404, wait 5 more minutes and try again.

## Still not working?

1. **Settings** → **Pages** → note the exact error message (screenshot helps)
2. Confirm folder **docs** exists on **main** branch (it has `index.html` inside)
3. Make sure branch is **main**, not another name

## After it works

1. Open the link on your phone
2. Create your app password
3. **Add to Home Screen** (optional)
4. Use **Download backup** regularly
