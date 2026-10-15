# AccessVault

AccessVault is a cloud-synced manager for client and business access codes. It is built for delivery teams who need port gates, garages, key safes, warehouse doors, alarms, and similar codes on a phone or computer.

Codes and sensitive notes are encrypted in the browser with AES-256-GCM before they are saved. The vault passphrase and the encryption key are never sent to the database.

## What you can do

- Create an account and sign in from any device.
- Confirm your email and reset the account password.
- Create a separate vault passphrase and a one-time recovery key.
- Save clients, several locations per client, and any number of access codes.
- Search names, addresses, tags, titles, and categories.
- Reveal, hide, copy, edit, archive, restore, and delete records.
- Lock the vault immediately or after inactivity.
- Download an encrypted backup, or a plaintext export after an explicit warning.
- Install the app on supported phones and computers.

## Important limitation

If you lose the vault passphrase **and** the recovery key, the codes cannot be recovered. AccessVault does not keep a server-side master key. Supabase can see account metadata (names, addresses, phone numbers, code titles, categories) because that metadata is what search and sync use. Supabase cannot read the code values from the ciphertext alone.

The previous Flask prototype is preserved in `legacy/`. It is not the supported application and it did not encrypt codes.

## Documentation

- [Local development](docs/LOCAL_DEVELOPMENT.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)
- [Vercel deployment](docs/VERCEL_DEPLOYMENT.md)
- [Security architecture](docs/SECURITY.md)
- [Backup and recovery](docs/BACKUP_AND_RECOVERY.md)

## Environment variables

Copy `.env.example` to `.env.local`. Only placeholders belong in the example file.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `NEXT_PUBLIC_APP_URL` | Public URL used in email links |

Do not add `SUPABASE_SERVICE_ROLE_KEY`. The app refuses to start if the public key is a service-role key.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Daily use

1. Create an account and confirm the email.
2. Sign in, then create a vault passphrase and store the recovery key offline.
3. Add a client, a location, and an access code.
4. Search the client, open the profile, reveal the code, and copy it.
5. Use Lock now when you hand the phone to someone else.
