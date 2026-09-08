# Keystone

A quiet vault for gate, port, and door codes. Sign in on any phone — your keys stay with you.

The old Flask app is gone. This is a new design: warm atelier lighting, brass key-tags, and **Supabase** for cloud login and sync. Until you connect a project, everything is saved on the device you are using.

## Use it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Create a vault, add a gate, tap a brass plate to reveal the code.

## Connect Supabase (cloud sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy **Project URL** and **anon public key** from Project Settings → API.
4. Either:
   - paste them in the app under **Settings → Supabase**, or
   - put them in `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then create an account in Keystone. Row Level Security keeps each user to their own codes.

## GitHub Pages

A workflow in `.github/workflows/pages.yml` builds and deploys the app. In the repo:

1. Settings → Pages → Source: **GitHub Actions**
2. Optional: add secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so the live site is cloud-backed by default.

The live URL stays `https://simsonpeter.github.io/Password-manager/`.
