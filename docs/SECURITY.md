# Security architecture

## Threat model

AccessVault protects access codes from the database operator and from other signed-in users. It does not protect codes from malware that is already running in the user's browser, and it does not hide client names or addresses from the database.

Someone with access to the Supabase project can read metadata and ciphertext. They cannot derive the vault key from the stored data without the passphrase or the recovery key.

## Account authentication

Supabase Auth handles email and password registration, email verification, password reset, and session cookies. The app uses `@supabase/ssr` so the session is refreshed in middleware and stored in cookies, not in `localStorage`.

Sessions expire. When the access token is expired, the vault locks and the user is sent to sign in. Sign out clears the in-memory vault key.

Sensitive account actions ask for the account password again: changing the password, rotating the recovery key, plaintext export, deleting vault data, and deleting the account. That reauthentication calls `signInWithPassword` again. It is not a second independent factor.

The browser also rate-limits sign-in attempts. Supabase rate limits remain the server-side control.

## Vault encryption

The vault passphrase is not the account password. The account password is sent to Supabase Auth. The vault passphrase is used only in the browser.

On setup, the browser:

1. Benchmarks Argon2id from `@noble/hashes` (memory 19 MiB, iterations 2, parallelism 1). If that derivation throws or takes longer than 3 seconds, it uses PBKDF2-SHA-256 with 600,000 iterations through the Web Crypto API.
2. Generates a random 16-byte salt and derives a key-encryption key.
3. Generates a random 256-bit data key.
4. Wraps that data key with AES-256-GCM and a fresh 12-byte nonce. The associated data is `av-dek-passphrase-v1`.
5. Generates a random 32-byte recovery key, shown once as eight hexadecimal groups, and wraps the same data key with it.
6. Encrypts a fixed verifier string with the data key so a wrong passphrase fails authentication instead of returning garbage.

The stored vault row contains the KDF name, parameters, salt, wrapped keys, and verifier. It does not contain the passphrase, the recovery key, or the raw data key.

The unlocked data key is imported as a non-extractable `CryptoKey` and kept in a module object in memory. Reload, sign-out, Lock now, and the inactivity timer drop that reference. JavaScript cannot reliably wipe immutable strings, so locking is best effort. The app does not write the key, passphrase, or revealed codes to `localStorage`, `sessionStorage`, analytics, or error pages.

Each secret, note, and instruction is encrypted with AES-256-GCM and its own random nonce. Code values stay strings, so leading zeros are preserved. The app does not implement its own cipher.

## Search

Default search uses metadata only: client names, trading names, contacts, phones, emails, addresses, tags, location names, code titles, and categories. The browser does not upload plaintext codes to build that index.

Optional secret search is off until the user turns it on. It decrypts codes in memory on that device and still omits the code from result text. The trade-off is that decrypted values exist in JavaScript memory while the vault is unlocked and a search is active. They are not written back to the server for indexing. Turn this off on shared devices.

## Authorization

Every user-owned table has RLS enabled. Policies compare `auth.uid()` with `user_id` (or `profiles.id`) for select, insert, update, and delete. Updates also include `with check`, so a statement cannot change `user_id` to another account. Triggers reject `user_id` changes and reject locations or codes whose parent belongs to someone else.

Writes send the current `version`. The update matches that version and increments it. If another device saved first, the write matches zero rows and the app reports a conflict instead of overwriting the newer row. A save is marked synced only after the server returns the row.

Creates include a `client_request_id`. Retrying the same request returns the existing row instead of inserting a duplicate.

## Browser protections

Responses include a Content Security Policy, `X-Frame-Options: DENY`, `nosniff`, a referrer policy, and a permissions policy. The policy allows connections to this origin and `https://*.supabase.co`.

The service worker precaches the offline page, manifest, and icons. It may cache hashed `/_next/static` assets. It does not cache Supabase responses, `/api` routes, or HTML documents other than the static offline page. Navigation falls back to that offline page. There is no offline vault.

Revealed codes can be copied. The app tries to clear the clipboard after 30 seconds only if the clipboard still contains that same value. Some operating systems block clipboard reads or clears. The confirmation text does not claim that clearing always works.

Audit rows record the action and record id. They do not record codes, notes, passphrases, or keys.

## What this does not claim

- Supabase, Vercel, and anyone who can debug the unlocked browser can see metadata.
- A successful XSS bug could read revealed codes and the in-memory key. CSP reduces that risk. It does not remove it.
- There is no recovery if both the passphrase and the recovery key are lost.
- The recovery key is a bearer secret. Store it offline. Anyone who has it can decrypt the vault.
