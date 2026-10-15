# Backup and recovery

## What can be recovered

| You still have | Result |
| --- | --- |
| Vault passphrase | Unlock on any signed-in device. The wrapped key is stored with the account. |
| Recovery key, passphrase forgotten | Unlock with the recovery key, then set a new passphrase in Settings. The recovery key wraps the same data key. |
| Encrypted backup and passphrase or recovery key | Restore the ciphertext into the same vault, or into an empty account. |
| Neither passphrase nor recovery key | Codes cannot be decrypted. There is no master key to ask for. |

Password reset changes only the Supabase account password. It does not unwrap the vault.

## Encrypted backup

Settings → Download encrypted backup.

The file format is `accessvault-encrypted-backup` version 1. It contains client metadata, ciphertext, nonces, categories, and the wrapped vault key. It does not contain plaintext codes or the passphrase.

The download is built in the browser. The server does not write a temporary export file.

Restore compares `updated_at` and record ids:

- Missing records are added after you confirm.
- Incoming rows that are newer are updated.
- Rows that changed on both sides are listed as conflicts.
- Choose "Keep current cloud data" or "Replace conflicts with the backup".
- A newer local row is not replaced unless you choose the backup.
- A backup from a different vault is refused, because those codes were encrypted with a different data key.

The app reports the restore as synced only after the database writes return.

## Plaintext export

Plaintext export is a separate action. It requires:

1. The checkbox that the file is not encrypted.
2. The account password.
3. The vault passphrase.

The JSON file includes a warning and the readable codes. It is created with a temporary object URL and that URL is revoked after the download starts. Delete the file when you are finished. Do not email it or leave it in Downloads on a shared computer.

## Recovery key rotation

Settings → Rotate recovery key asks for the account password and the current vault passphrase. The previous recovery key stops working after the new wrapped key is saved. Store the new key before leaving the page. It is not shown again.

If you close the setup screen before saving the first recovery key, the database only records that it was not acknowledged. Rotate the key while you still know the passphrase.

## Retention

Active and archived records remain until you delete them. Archive does not destroy ciphertext. Delete removes the selected rows after confirmation.

Audit events can be deleted when they are older than 12 months. They never contain codes or notes.

Deleting vault data removes clients, locations, codes, categories, audit events, and the wrapped key for the signed-in user. Deleting the account also attempts to remove the Supabase auth user. If that step is blocked by the project, remove the user in the Supabase Authentication dashboard after the vault data is gone.

## Operating habit

Download an encrypted backup after a large import, and keep the recovery key somewhere that is not the same phone you use for deliveries.
