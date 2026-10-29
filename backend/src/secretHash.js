import crypto from 'crypto';

/** scrypt password/PIN hashing shared by login and user administration. */
export function hashSecret(secret) {
  if (!secret) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/** Timing-safe verification with transparent support for legacy plaintext. */
export function verifySecret(providedSecret, storedCredential) {
  if (!providedSecret || !storedCredential) {
    return { match: false, needsRehash: false };
  }
  const providedStr = String(providedSecret);
  const storedStr = String(storedCredential);

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
