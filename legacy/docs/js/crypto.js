const CryptoUtil = (() => {
  const PBKDF2_ITERATIONS = 120000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;

  function bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function deriveKey(password, saltBuf) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBuf,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(password, plaintextObj) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(JSON.stringify(plaintextObj))
    );
    return {
      salt: bufToB64(salt),
      iv: bufToB64(iv),
      data: bufToB64(ciphertext),
    };
  }

  async function decrypt(password, bundle) {
    const salt = b64ToBuf(bundle.salt);
    const iv = b64ToBuf(bundle.iv);
    const data = b64ToBuf(bundle.data);
    const key = await deriveKey(password, salt);
    const dec = new TextDecoder();
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        key,
        data
      );
      return JSON.parse(dec.decode(plain));
    } catch {
      return null;
    }
  }

  return { encrypt, decrypt, bufToB64, b64ToBuf };
})();
