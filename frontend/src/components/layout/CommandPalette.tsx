import React from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import {
  NAV_SECTIONS,
  dispatchIntent,
  isNavItemVisible,
  navigateToPath,
  resolveRoute,
  type NavTab,
} from '../../config/navigation';
import { cn } from '../ui';

interface Command {
  id: string;
  label: string;
  group: string;
  tab: NavTab;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { currentUser, setActiveNavTab } = useCrm();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commands = React.useMemo<Command[]>(() => {
    return NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter((item) => isNavItemVisible(item, currentUser))
        .flatMap<Command>((item) => [
          { id: item.id, label: item.label, group: section.title, tab: item.id, path: item.path, icon: item.icon },
          ...(item.children || []).map((child) => ({
            id: `${item.id}:${child.id}`,
            label: child.label,
            group: `${section.title} · ${item.label}`,
            tab: item.id,
            path: child.path,
            icon: child.icon,
          })),
        ]),
    );
  }, [currentUser]);

  const results = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands.slice(0, 12);
    return commands
      .filter((command) => `${command.group} ${command.label}`.toLowerCase().includes(term))
      .slice(0, 20);
  }, [commands, query]);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const go = (command: Command) => {
    setActiveNavTab(command.tab);
    navigateToPath(command.path);
    const route = resolveRoute(command.path);
    if (route) dispatchIntent(route);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-slate-950/60 p-4 pt-[12vh] backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f1b26]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-white/10">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault();
                go(results[activeIndex]);
              }
            }}
            placeholder="Search modules, pages and actions…"
            aria-label="Search modules and pages"
            className="h-12 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Close search">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul role="listbox" aria-label="Search results" className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No module matches “{query}”. Try another term.
            </li>
          )}
          {results.map((command, index) => {
            const Icon = command.icon;
            return (
              <li key={command.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(command)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    index === activeIndex ? 'bg-teal-50 dark:bg-teal-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5',
                  )}
                >
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', index === activeIndex ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400')}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{command.label}</span>
                    <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{command.group}</span>
                  </span>
                  {index === activeIndex && <CornerDownLeft className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-[10px] text-slate-400 dark:border-white/10">
          <span>Navigate with ↑ ↓ · open with Enter</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
};
