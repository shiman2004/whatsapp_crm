import { useCallback, useEffect, useState } from 'react';
import { currentPathname, resolveRoute, type ResolvedRoute } from '../config/navigation';

/** Tracks the hash path and keeps module-level tab changes in sync. */
export function useHashPath(): string {
  const [path, setPath] = useState<string>(() => currentPathname());

  useEffect(() => {
    const sync = () => setPath(currentPathname());
    const syncSubpage = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (!value) return;
      const base = window.location.hash.replace(/^#/, '').split('/')[1];
      if (!base) return;
      setPath(`/${base}/${value}`);
    };

    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    // These modules switch tabs internally without touching the hash.
    window.addEventListener('marketing-page-change', syncSubpage);
    window.addEventListener('exam-subtab-change', syncSubpage);
    window.addEventListener('settings-subtab-change', syncSubpage);

    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      window.removeEventListener('marketing-page-change', syncSubpage);
      window.removeEventListener('exam-subtab-change', syncSubpage);
      window.removeEventListener('settings-subtab-change', syncSubpage);
    };
  }, []);

  return path;
}

export function useRoute(): ResolvedRoute | null {
  const path = useHashPath();
  return resolveRoute(path);
}

export function useNavigate(): (path: string) => void {
  return useCallback((path: string) => {
    if (currentPathname() === path) return;
    window.location.hash = path;
  }, []);
}
