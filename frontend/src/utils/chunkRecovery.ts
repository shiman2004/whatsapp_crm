import { lazy, type ComponentType } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'rw_crm_chunk_reload_at';
export const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isDynamicChunkError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : String((err as { message?: unknown } | null)?.message ?? err ?? '');
  const name = err instanceof Error ? err.name : '';
  const combined = `${name} ${message}`.toLowerCase();

  return (
    combined.includes('failed to fetch dynamically imported module') ||
    combined.includes('importing a module script failed') ||
    combined.includes('error loading dynamically imported module') ||
    combined.includes('loading chunk') ||
    combined.includes('chunkloaderror') ||
    combined.includes('unable to preload css')
  );
}

export function attemptStaleChunkReload(options?: {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload?: () => void;
  now?: number;
}): boolean {
  const storage =
    options?.storage !== undefined
      ? options.storage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;
  const reload =
    options?.reload ??
    (typeof window !== 'undefined' ? () => window.location.reload() : undefined);
  const now = options?.now ?? Date.now();

  try {
    const rawLast = storage?.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const lastReloadAt = rawLast ? Number(rawLast) : 0;
    if (lastReloadAt && Number.isFinite(lastReloadAt) && now - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    storage?.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // Ignore storage access restrictions (e.g. private browsing) and avoid looping blindly
    return false;
  }

  if (reload) {
    reload();
    return true;
  }
  return false;
}

export function clearStaleChunkReloadFlag(): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors
  }
}

/**
 * Wraps `React.lazy` with automatic single-shot browser reload when a newly
 * deployed build invalidates cached hashed JS/CSS chunk URLs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithChunkRecovery<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (isDynamicChunkError(error) && attemptStaleChunkReload()) {
        // Keep Suspense fallback mounted while the page reloads cleanly
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
