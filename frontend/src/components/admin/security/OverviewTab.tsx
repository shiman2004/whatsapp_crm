import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Building2, ShieldCheck, ShieldAlert, UserCog, Users } from 'lucide-react';
import { securityApi } from './api';
import { Badge, EmptyState, ErrorState, Panel, SectionTitle, SkeletonBlock, formatDate } from './bits';
import type { Overview } from './types';

const CARD_STYLES = [
  { icon: Users, label: 'Active staff', hint: 'Enabled accounts', tone: 'border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-300' },
  { icon: ShieldCheck, label: 'Protected modules', hint: 'Server-enforced areas', tone: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' },
  { icon: Building2, label: 'Roles', hint: 'Capability registry', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  { icon: UserCog, label: 'Custom user profiles', hint: 'Per-user overrides', tone: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300' },
];

export const OverviewTab: React.FC<{ onNavigate: (tab: 'roles' | 'users' | 'modules' | 'audit') => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await securityApi.overview();
      setData(result);
      setError(null);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Unable to load the security overview.';
      setError(msg === '[object Object]' ? 'Unable to load the security overview.' : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />)}
        </div>
        <SkeletonBlock rows={4} />
      </div>
    );
  }

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const maxRoles = Math.max(1, ...data.distribution.map(item => item.roles));

  return (
    <div className="space-y-4">
      {error && !data && <ErrorState message={error} onRetry={load} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARD_STYLES.map(card => {
          const Icon = card.icon;
          const value = card.label === 'Active staff' ? data.counters.activeUsers
            : card.label === 'Protected modules' ? data.counters.protectedModules
              : card.label === 'Roles' ? data.counters.roles
                : data.counters.customUsers;
          return (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
                <span className={`rounded-xl border p-1.5 ${card.tone}`}><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{card.hint}</p>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel>
          <SectionTitle
            title="Module coverage"
            description="How many roles hold at least one capability in each protected module."
            action={<button type="button" onClick={() => onNavigate('modules')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300">Module access<ArrowRight className="h-3.5 w-3.5" /></button>}
          />
          <div className="mt-4 space-y-3">
            {data.distribution.map(item => (
              <div key={item.module}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                  <span className="text-slate-500 dark:text-slate-400">{item.roles} role{item.roles === 1 ? '' : 's'} · {item.capabilities} capabilities</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500 motion-safe:transition-all motion-safe:duration-500" style={{ width: `${Math.round((item.roles / maxRoles) * 100)}%` }} />
                </div>
                {item.customized > 0 && <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">{item.customized} role profile{item.customized === 1 ? '' : 's'} customized</p>}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle
              title="High-privilege accounts"
              description="Active accounts holding the widest authority."
              action={<button type="button" onClick={() => onNavigate('users')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300">Directory<ArrowRight className="h-3.5 w-3.5" /></button>}
            />
            <ul className="mt-3 space-y-2">
              {data.highPrivilegeUsers.length === 0 && <li className="text-xs text-slate-500 dark:text-slate-400">No high-privilege accounts.</li>}
              {data.highPrivilegeUsers.map(user => (
                <li key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{user.fullName}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{user.roleLabel}</span>
                  </span>
                  <Badge tone={user.role === 'super_admin' ? 'rose' : 'amber'}>{user.role === 'super_admin' ? 'Protected' : 'Department lead'}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <SectionTitle
              title="Recent security activity"
              description="Latest permission and access events."
              action={<button type="button" onClick={() => onNavigate('audit')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300">Audit logs<ArrowRight className="h-3.5 w-3.5" /></button>}
            />
            {data.recentActivity.length === 0 ? (
              <div className="mt-3"><EmptyState title="No security events yet" description="Permission changes will appear here." /></div>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.recentActivity.map(event => (
                  <li key={event.id} className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${event.outcome === 'denied' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <code className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{event.action}</code>
                        <Badge tone={event.outcome === 'denied' ? 'rose' : 'emerald'}>{event.outcome}</Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{event.actorName} · {event.resource}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{formatDate(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-800 dark:text-indigo-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This page reports the policy the API actually enforces. Role defaults, protected capabilities and record scopes
            come from the central registry, and every capability decision is resolved on the server.
          </p>
        </div>
      </div>
    </div>
  );
};
