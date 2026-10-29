import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { breadcrumbsForRoute, navigateToPath } from '../../config/navigation';
import { useRoute } from '../../hooks/useHashRoute';

export const Breadcrumbs: React.FC<{ className?: string }> = ({ className }) => {
  const route = useRoute();
  const crumbs = breadcrumbsForRoute(route);

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex min-w-0 items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => navigateToPath('/dashboard')}
            className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:text-teal-300"
            aria-label="Go to dashboard"
          >
            <Home className="h-3 w-3" />
          </button>
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
              {crumb.path && !isLast ? (
                <button
                  type="button"
                  onClick={() => crumb.path && navigateToPath(crumb.path)}
                  className="truncate rounded px-0.5 transition-colors hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:text-teal-300"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'truncate font-semibold text-slate-700 dark:text-slate-200' : 'truncate'}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
