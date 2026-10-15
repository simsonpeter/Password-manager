# Supabase setup

AccessVault uses Supabase Auth and Postgres. The browser uses the anon key. Row Level Security restricts every table to the signed-in user. Do not create a `SUPABASE_SERVICE_ROLE_KEY` in this app.

## 1. Create a project

1. Create a project at https://supabase.com.
2. In Project Settings → API, copy the project URL and the **anon public** key.
3. Put them in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2. Run the migration

In the Supabase SQL editor, paste and run:

`supabase/migrations/20261015000000_init.sql`

That file creates:

- `profiles`
- `vaults`
- `clients`
- `locations`
- `categories`
- `access_records`
- `audit_events`

It enables RLS, adds select/insert/update/delete policies, and blocks anonymous access. Audit events can be inserted, read, and deleted by the owner. They cannot be updated. Triggers stop a user from moving a row to another `user_id` or attaching a location to someone else's client.

The migration also adds:

- `handle_new_user`, which creates a profile when someone registers
- `delete_own_vault`, which deletes the signed-in user's vault data
- `delete_own_account`, which deletes that data and the auth user

`delete_own_account` is `security definer` and is granted only to `authenticated`. If a hosted project blocks deleting `auth.users`, delete the vault data from Settings and remove the user from Authentication → Users.

## 3. Auth settings

In Authentication → Providers, keep email enabled.

In Authentication → Settings:

- Enable email confirmations.
- Minimum password length: 12.
- Site URL: your app URL.
- Additional redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://YOUR_DOMAIN/auth/callback`
  - `https://YOUR_DOMAIN/reset-password`

Supabase applies its own rate limits to sign-up, sign-in, and password reset. The app also slows repeated sign-in attempts in the browser. The browser limit resets on a full reload, so the Supabase limits are the control that matters.

## 4. What is stored

| Data | Stored as |
| --- | --- |
| Account password | Supabase Auth hash. The app never stores it. |
| Vault passphrase | Not stored. |
| Encryption key | Not stored. Only a wrapped key is stored. |
| Access code | AES-256-GCM ciphertext plus a random nonce |
| Client notes, code notes, instructions | Ciphertext plus a nonce, when present |
| Names, phones, addresses, titles, categories, tags | Plain metadata, so the directory can be searched without decrypting every secret |

## 5. Confirm RLS

In the SQL editor, as a signed-in user, `select * from clients` returns only that user's rows. The Table Editor uses a privileged role and can see ciphertext. That is not the same as the browser key. Do not paste the service-role key into Vercel or `.env.local`.
