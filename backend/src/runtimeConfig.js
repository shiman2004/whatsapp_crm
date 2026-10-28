import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Resolve from the module, never the shell's working directory. Do not log values.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function resolveSigningSecret(env = process.env) {
  const configured = String(env.JWT_SECRET || '').trim();
  if (env.NODE_ENV === 'production') {
    if (configured.length < 32 || /replace_with|placeholder|test-only|royal_wellness_crm_jwt_secret/i.test(configured)) {
      throw new Error('Production JWT_SECRET must be a unique random secret of at least 32 characters.');
    }
  }
  return configured || (env.NODE_ENV === 'test'
    ? 'test-only-jwt-secret-do-not-use'
    : 'royal_wellness_crm_jwt_secret_key_2026_super_secure');
}

export const JWT_SECRET = resolveSigningSecret();
