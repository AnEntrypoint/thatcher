import crypto from 'crypto';

// AES-256-GCM: authenticated encryption, so a tampered ciphertext fails
// decryption loudly instead of silently returning corrupted plaintext. A
// fresh random IV per value (never reused) is required for GCM's security
// guarantee -- reusing an IV with the same key breaks confidentiality.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = 'enc:v1:';

let _key = null;
function getKey() {
  if (_key) return _key;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    // Fail loud, never silently store plaintext under an encrypted:true field
    // just because the operator forgot to configure a key.
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is not set; cannot encrypt/decrypt a field marked encrypted:true');
  }
  // Accept either a 64-char hex string or any string, hashed to a stable
  // 32-byte key -- never echoed, never logged, this function's return value
  // is the only place the raw key material appears in memory.
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : crypto.createHash('sha256').update(raw).digest();
  _key = key;
  return _key;
}

export function encryptValue(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const serialized = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const ciphertext = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENCRYPTED_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function decryptValue(stored) {
  if (!isEncrypted(stored)) return stored;
  const key = getKey();
  const raw = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  // setAuthTag + final() throws on any tampering (wrong key, flipped bytes,
  // truncated ciphertext) -- this is the loud-failure guarantee; there is no
  // catch here, a decrypt failure must propagate to the caller as an error.
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

// Field-def-driven encrypt of every field marked encrypted:true. Fields not
// present in `record` or not marked are passed through unchanged.
export function encryptFields(record, specFields) {
  if (!specFields) return record;
  const result = { ...record };
  for (const [key, fieldDef] of Object.entries(specFields)) {
    if (!fieldDef.encrypted) continue;
    if (result[key] === undefined || result[key] === null || result[key] === '') continue;
    if (isEncrypted(result[key])) continue; // already encrypted, don't double-wrap
    result[key] = encryptValue(result[key]);
  }
  return result;
}

export function decryptFields(record, specFields) {
  if (!record || !specFields) return record;
  const result = { ...record };
  for (const [key, fieldDef] of Object.entries(specFields)) {
    if (!fieldDef.encrypted) continue;
    if (result[key] === undefined || result[key] === null) continue;
    result[key] = decryptValue(result[key]);
  }
  return result;
}
