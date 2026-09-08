# Keystone

A quiet vault for gate, port, and door codes. Sign in on any phone — your keys stay with you.

Until you connect a project, everything is saved on the device you are using.

## Use it

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Connect Supabase (cloud sync)

Do this once. After that, the same email and password work on every phone.

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard). Wait until it is ready.
2. **Authentication → Sign In / Providers → Email:** turn **Confirm email** off. Otherwise new accounts wait on a confirmation mail.
3. **SQL Editor → New query:** paste [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
4. Open the project **Connect** dialog, or **Settings → API Keys**. Copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_…`)  
     The older **anon** key (`eyJ…`) also works. Never use a secret or `service_role` key.
5. In Keystone, tap **Connect Supabase** (sign-in screen or Settings), paste both values, then **Test and connect**.
6. Create a new vault with your email. That account lives in Supabase, so you can sign in on another phone.

You can also put the values in `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`VITE_SUPABASE_ANON_KEY` is accepted as the same public key.

## GitHub Pages

A workflow in `.github/workflows/pages.yml` builds and deploys the app.

1. Settings → Pages → Source: **GitHub Actions**
2. Optional repo secrets so the live site is cloud-backed:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable or anon key)

The live URL stays `https://simsonpeter.github.io/Password-manager/`.

If you use password reset, add that URL under **Authentication → URL Configuration** as the Site URL (and a Redirect URL).
