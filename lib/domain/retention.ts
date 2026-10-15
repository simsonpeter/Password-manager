export const DATA_RETENTION_POLICY = [
  "Active and archived clients, locations, and access records stay in your account until you delete them.",
  "Archive hides a record from the default directory. Restore brings it back. Archive does not destroy the encrypted secret.",
  "Delete permanently removes that record, including its ciphertext, after you confirm. AccessVault does not keep a second server copy.",
  "Security audit events record the action and the record id. They never store codes, passphrases, keys, or notes. You can delete audit events older than 12 months from Settings.",
  "Encrypted backups contain ciphertext and wrapped vault keys. They are not readable without the vault passphrase or recovery key.",
  "Plaintext export is off unless you turn it on for that download, re-enter your account password, and confirm the warning. That file is not encrypted. It is created in your browser and is not stored on the server.",
  "Losing both the vault passphrase and the recovery key makes the encrypted codes unrecoverable. There is no server-side master key.",
].join("\n");
