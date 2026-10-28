import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSigningSecret } from './src/runtimeConfig.js';

test('production refuses missing, short and known example signing secrets', () => {
  for (const JWT_SECRET of ['', 'short', 'replace_with_a_long_random_unique_secret', 'royal_wellness_crm_jwt_secret_key_2026_super_secure']) {
    assert.throws(() => resolveSigningSecret({ NODE_ENV: 'production', JWT_SECRET }), /Production JWT_SECRET/);
  }
});
test('production accepts a configured long secret without changing it', () => {
  const JWT_SECRET = '6fc1ee973ac90d447bc2e509df8a367154ce91b6a2d083f7';
  assert.equal(resolveSigningSecret({ NODE_ENV: 'production', JWT_SECRET }), JWT_SECRET);
});
test('test fallback is isolated and both callers import the shared secret', async () => {
  assert.equal(resolveSigningSecret({ NODE_ENV: 'test' }), 'test-only-jwt-secret-do-not-use');
  const { readFile } = await import('node:fs/promises');
  for (const file of ['legacyServer.js', 'examRoutes.js']) {
    const source = await readFile(new URL('./src/' + file, import.meta.url), 'utf8');
    assert.match(source, /import \{ JWT_SECRET \} from '\.\/runtimeConfig\.js'/);
  }
});
