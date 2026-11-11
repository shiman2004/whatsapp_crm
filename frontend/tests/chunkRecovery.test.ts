import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptStaleChunkReload,
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_STORAGE_KEY,
  isDynamicChunkError,
} from '../src/utils/chunkRecovery.ts';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

test('isDynamicChunkError detects hashed chunk failures across browsers and ignores app errors', () => {
  assert.equal(
    isDynamicChunkError(new TypeError('Failed to fetch dynamically imported module: https://app/assets/X.js')),
    true
  );
  assert.equal(
    isDynamicChunkError(new Error('Importing a module script failed.')),
    true
  );
  assert.equal(
    isDynamicChunkError({ name: 'ChunkLoadError', message: 'Loading chunk 12 failed' }),
    true
  );
  assert.equal(
    isDynamicChunkError(new ReferenceError('foo is not defined')),
    false
  );
});

test('attemptStaleChunkReload reloads once and prevents infinite loops within cooldown', () => {
  const storage = createMemoryStorage();
  let reloadCount = 0;
  const reload = () => {
    reloadCount += 1;
  };

  const t0 = 1_700_000_000_000;
  assert.equal(attemptStaleChunkReload({ storage, reload, now: t0 }), true);
  assert.equal(reloadCount, 1);
  assert.equal(storage.getItem(CHUNK_RELOAD_STORAGE_KEY), String(t0));

  // Immediate retry within 15s cooldown must abort to avoid infinite reload loop
  assert.equal(attemptStaleChunkReload({ storage, reload, now: t0 + 3_000 }), false);
  assert.equal(reloadCount, 1);

  // After cooldown elapses (e.g. a later deployment), auto-recovery works again
  assert.equal(
    attemptStaleChunkReload({ storage, reload, now: t0 + CHUNK_RELOAD_COOLDOWN_MS + 1 }),
    true
  );
  assert.equal(reloadCount, 2);
});
