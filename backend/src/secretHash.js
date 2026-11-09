import crypto from 'crypto';

function getCipherKey() {
  const raw = process.env.JWT_SECRET || 'royal_wellness_credentials_aes_cipher_key_2026';
  return crypto.createHash('sha256').update(raw).digest();
}

/** Reversible AES-256-GCM encryption for credentials viewable exclusively by Super Admin. */
export function encryptReversible(secret) {
  if (!secret) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
  let enc = cipher.update(String(secret), 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc:v1:${iv.toString('hex')}:${tag}:${enc}`;
}

/** Decrypts reversible AES-256-GCM credential. Returns plain string or original if not encrypted. */
export function decryptReversible(stored) {
  if (!stored || typeof stored !== 'string') return '';
  if (!stored.startsWith('enc:v1:')) return stored;
  try {
    const parts = stored.split(':');
    if (parts.length !== 5) return null;
    const [_, version, ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(), iv);
    decipher.setAuthTag(tag);
    let dec = decipher.update(dataHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (err) {
    return null;
  }
}

/** scrypt password/PIN hashing shared by login and user administration. */
export function hashSecret(secret) {
  if (!secret) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Validates whether a stored credential string is a recognized, valid cryptographic hash format.
 * Returns true for scrypt hashes (`scrypt:<salt>:<hash>`) and legacy reversible (`enc:v1:`) hashes.
 * Returns false for empty, null, plaintext, or malformed strings.
 */
export function isValidCredentialHash(storedCredential) {
  if (!storedCredential || typeof storedCredential !== 'string') return false;
  const trimmed = storedCredential.trim();
  if (trimmed.startsWith('scrypt:')) {
    const parts = trimmed.split(':');
    return parts.length === 3 && parts[1].length >= 16 && parts[2].length >= 32;
  }
  if (trimmed.startsWith('enc:v1:')) {
    const parts = trimmed.split(':');
    return parts.length === 5;
  }
  return false;
}

/** Timing-safe verification with transparent support for reversible encryption, scrypt, and plaintext. */
export function verifySecret(providedSecret, storedCredential) {
  if (!providedSecret || !storedCredential) {
    return { match: false, needsRehash: false };
  }
  const providedStr = String(providedSecret);
  const storedStr = String(storedCredential);

  if (storedStr.startsWith('enc:v1:')) {
    try {
      const decrypted = decryptReversible(storedStr);
      if (decrypted !== null) {
        const pBuf = Buffer.from(providedStr);
        const sBuf = Buffer.from(decrypted);
        if (pBuf.length === sBuf.length && crypto.timingSafeEqual(pBuf, sBuf)) {
          return { match: true, needsRehash: true };
        }
      }
    } catch {
      return { match: false, needsRehash: false };
    }
  }

  if (storedStr.startsWith('scrypt:')) {
    const parts = storedStr.split(':');
    if (parts.length !== 3) return { match: false, needsRehash: false };
    const salt = parts[1];
    const expectedHash = parts[2];
    try {
      const computedHash = crypto.scryptSync(providedStr, salt, 64).toString('hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      const computedBuf = Buffer.from(computedHash, 'hex');
      if (expectedBuf.length !== computedBuf.length) {
        return { match: false, needsRehash: false };
      }
      const match = crypto.timingSafeEqual(computedBuf, expectedBuf);
      return { match, needsRehash: false };
    } catch {
      return { match: false, needsRehash: false };
    }
  }

  try {
    const pBuf = Buffer.from(providedStr);
    const sBuf = Buffer.from(storedStr);
    if (pBuf.length === sBuf.length && crypto.timingSafeEqual(pBuf, sBuf)) {
      return { match: true, needsRehash: true };
    }
  } catch {}
  return { match: false, needsRehash: false };
}

