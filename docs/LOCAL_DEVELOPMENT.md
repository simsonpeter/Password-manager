# Local development

## Requirements

- Node.js 22
- A Supabase project, or the SQL in `supabase/migrations` applied to a local Supabase stack

The app builds and the automated tests run without Supabase credentials. Signing in, saving clients, and syncing require the environment variables below. The interface shows a setup screen instead of pretending a cloud project is connected.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Apply the database migration using the steps in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

```bash
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests use synthetic fixtures only. They do not contain real access codes.

## Email links

Supabase email confirmation and password reset must redirect to this app.

- Site URL: `http://localhost:3000`
- Redirect allow list: `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password`

Set the same values to the production URL before deploying.

## Legacy prototype

`legacy/` contains the earlier Flask and static prototype. Run it only if you need to inspect that history:

```bash
cd legacy
pip install -r requirements.txt
python run.py
```

Do not use it for production access codes.
