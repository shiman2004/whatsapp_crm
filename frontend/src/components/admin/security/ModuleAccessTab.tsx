import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock,
  MousePointerClick,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  GraduationCap,
  Activity,
  Megaphone,
  BarChart3,
  Users,
  Sliders,
  KanbanSquare,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Boxes,
  Info,
  Check,
  ShieldAlert
} from 'lucide-react';
import { securityApi } from './api';
import { Badge, EmptyState, ErrorState, Notice, SCOPE_LABEL, SkeletonBlock, cx } from './bits';
import { ModuleAccessDrawer } from './ModuleAccessDrawer';
import type { ModuleInfo, RoleDirectory, RoleSummary } from './types';

// Module Icons Map
const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  crm: KanbanSquare,
  exam: GraduationCap,
  clinical: Activity,
  marketing: Megaphone,
  reports: BarChart3,
  staff: Users,
  system: Sliders,
};

// Module Theme Accents
const MODULE_THEMES: Record<
  string,
  {
    iconBg: string;
    iconColor: string;
    border: string;
    activeBorder: string;
    activeBg: string;
    categoryBadge: 'indigo' | 'teal' | 'amber' | 'rose' | 'neutral';
  }
> = {
  crm: {
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    border: 'border-blue-500/20',
    activeBorder: 'border-blue-500',
    activeBg: 'bg-blue-500/10',
    categoryBadge: 'indigo',
  },
  exam: {
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    border: 'border-teal-500/20',
    activeBorder: 'border-teal-500',
    activeBg: 'bg-teal-500/10',
    categoryBadge: 'teal',
  },
  clinical: {
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    border: 'border-rose-500/20',
    activeBorder: 'border-rose-500',
    activeBg: 'bg-rose-500/10',
    categoryBadge: 'rose',
  },
  marketing: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    border: 'border-amber-500/20',
    activeBorder: 'border-amber-500',
    activeBg: 'bg-amber-500/10',
    categoryBadge: 'amber',
  },
  reports: {
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    border: 'border-purple-500/20',
    activeBorder: 'border-purple-500',
    activeBg: 'bg-purple-500/10',
    categoryBadge: 'neutral',
  },
  staff: {
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    border: 'border-indigo-500/20',
    activeBorder: 'border-indigo-500',
    activeBg: 'bg-indigo-500/10',
    categoryBadge: 'neutral',
  },
  system: {
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    border: 'border-emerald-500/20',
    activeBorder: 'border-emerald-500',
    activeBg: 'bg-emerald-500/10',
    categoryBadge: 'neutral',
  },
};

const getRoleInitials = (label: string): string => {
  return label
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const grantedIn = (role: RoleSummary, module: ModuleInfo) =>
  module.capabilities.filter(meta => {
    const override = role.overrides?.[meta.key]?.effect;
    if (meta.immutable) return role.capabilities.includes(meta.key);
    return override ? override === 'allow' : role.capabilities.includes(meta.key);
  }).length;

export const ModuleAccessTab: React.FC = () => {
  const [directory, setDirectory] = useState<RoleDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<{ role: RoleSummary; module: ModuleInfo } | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    securityApi
      .roles()
      .then(setDirectory)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load module access.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const modules = useMemo(() => directory?.modules || [], [directory]);

  // Unique Categories
  const categories = useMemo(() => {
    const cats = new Set(modules.map(m => m.category));
    return ['all', ...Array.from(cats)];
  }, [modules]);

  // Filtered Modules for Cards
  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      return true;
    });
  }, [modules, selectedCategory]);

  // Shown Modules in Matrix
  const shownMatrixModules = useMemo(() => {
    if (selectedModule === 'all') {
      if (selectedCategory === 'all') return modules;
      return modules.filter(m => m.category === selectedCategory);
    }
    return modules.filter(m => m.id === selectedModule);
  }, [modules, selectedModule, selectedCategory]);

  // Filtered Roles for Matrix
  const filteredRoles = useMemo(() => {
    if (!directory) return [];
    return directory.roles.filter(role => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return role.label.toLowerCase().includes(q) || role.role.toLowerCase().includes(q);
    });
  }, [directory, searchQuery]);

  // System KPI Metrics
  const stats = useMemo(() => {
    if (!directory) return { totalModules: 0, totalCaps: 0, protectedCaps: 0, totalRoles: 0, totalOverrides: 0 };
    const totalModules = directory.modules.length;
    const totalCaps = directory.modules.reduce((sum, m) => sum + m.capabilities.length, 0);
    const protectedCaps = directory.modules.reduce(
      (sum, m) => sum + m.capabilities.filter(c => c.immutable).length,
      0
    );
    const totalRoles = directory.roles.length;
    const totalOverrides = directory.roles.reduce((sum, r) => sum + Object.keys(r.overrides || {}).length, 0);
    return { totalModules, totalCaps, protectedCaps, totalRoles, totalOverrides };
  }, [directory]);

  if (loading && !directory) return <SkeletonBlock rows={8} />;
  if (error && !directory) return <ErrorState message={error} onRetry={load} />;
  if (!directory) return null;

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} onRetry={load} />}

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP METRIC OVERVIEW CARDS                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111b21] p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Active Modules
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {stats.totalModules}
              </span>
              <span className="text-xs text-teal-600 dark:text-teal-400 font-bold">Configured</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
              Operations &amp; Departmental
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111b21] p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Capabilities
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {stats.totalCaps}
              </span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Permissions</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
              Granular access checks
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111b21] p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Protected Core
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-500 dark:text-rose-400 font-mono">
                {stats.protectedCaps}
              </span>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">Immutable</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
              Strict super-admin bounds
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111b21] p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Configured Roles
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {stats.totalRoles}
              </span>
              {stats.totalOverrides > 0 ? (
                <span className="text-xs text-amber-500 font-bold">{stats.totalOverrides} Custom</span>
              ) : (
                <span className="text-xs text-emerald-500 font-bold">Defaults</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
              Scoped system personas
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. COLLAPSIBLE CONTEXT & ARCHITECTURE NOTICE                  */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20 p-4 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-indigo-200 flex items-center gap-2">
                <span>Server-Enforced Access Coverage Matrix</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  LIVE API
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Each matrix cell aggregates permissions granted to that role. Click any cell to configure granular overrides.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400 text-xs font-semibold self-start sm:self-auto cursor-pointer transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{isGuideOpen ? 'Hide Policy Details' : 'How Enforcement Works'}</span>
            {isGuideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isGuideOpen && (
          <div className="mt-3 pt-3 border-t border-indigo-500/20 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in duration-200">
            <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-3">
              <span className="font-bold text-teal-400 block mb-1">1. Departmental Modules</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                CRM, Clinical, Marketing, Reports, Staff and System checks enforce baseline policies within their services and are reflected read-only.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-3">
              <span className="font-bold text-indigo-400 block mb-1">2. Dynamic Exam Governance</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Exam Department capabilities dynamically resolve through this registry. The four draft creation capabilities can also be granted to individual users.
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/40 border border-slate-800 p-3">
              <span className="font-bold text-rose-400 block mb-1">3. Immutable Safeguards</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Protected capabilities (like publishing or deleting published materials) are strictly locked to managers and cannot be elevated through overrides.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTER CONTROLS & STATUS LEGEND                            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-100 dark:bg-[#111b21] p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80">
        {/* Left: Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
          <span className="text-slate-400 font-semibold px-1 text-[11px] flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </span>
          {categories.map(cat => {
            const isCatActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  if (cat !== 'all' && selectedModule !== 'all') {
                    const match = modules.find(m => m.id === selectedModule);
                    if (match && match.category !== cat) setSelectedModule('all');
                  }
                }}
                className={cx(
                  'px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer text-xs',
                  isCatActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-white hover:bg-slate-800/60'
                )}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            );
          })}
        </div>

        {/* Right: Legend & Matrix Filter */}
        <div className="flex flex-wrap items-center gap-3 text-xs border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-800">
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
              <span>Full Access</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-teal-400 ring-2 ring-teal-400/20" />
              <span>Partial</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Lock className="h-3 w-3 text-rose-400" />
              <span>Protected</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Custom</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedModule('all');
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className={cx(
              'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
              selectedModule === 'all' && selectedCategory === 'all' && !searchQuery
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
            )}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. REDESIGNED MODULE CARDS GRID                               */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-teal-400" />
            <span>Modules Overview &amp; Scopes</span>
            <span className="text-[10px] font-mono text-slate-500 font-normal">
              ({filteredModules.length} displayed · Click card to isolate in matrix below)
            </span>
          </h2>

          {selectedModule !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedModule('all')}
              className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Show All Modules in Matrix</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredModules.map(module => {
            const isSelected = selectedModule === module.id;
            const theme = MODULE_THEMES[module.id] || {
              iconBg: 'bg-slate-800',
              iconColor: 'text-slate-300',
              border: 'border-slate-800',
              activeBorder: 'border-teal-500',
              activeBg: 'bg-teal-500/10',
              categoryBadge: 'neutral',
            };
            const Icon = MODULE_ICONS[module.id] || Boxes;
            const roleCount = directory.roles.filter(role => grantedIn(role, module) > 0).length;
            const protectedCount = module.capabilities.filter(meta => meta.immutable).length;
            const coveragePct = Math.round((roleCount / (directory.roles.length || 1)) * 100);

            return (
              <button
                key={module.id}
                type="button"
                onClick={() => setSelectedModule(isSelected ? 'all' : module.id)}
                aria-pressed={isSelected}
                className={cx(
                  'relative rounded-2xl border p-5 text-left shadow-md transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col justify-between',
                  isSelected
                    ? `border-teal-500 bg-slate-900/90 ring-2 ring-teal-500/40 shadow-teal-500/10`
                    : `border-slate-800/80 bg-[#111b21] hover:border-slate-700 hover:bg-[#13222a]`
                )}
              >
                <div>
                  {/* Top Bar: Icon, Title & Category Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
                          theme.iconBg,
                          theme.border,
                          theme.iconColor
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors">
                          {module.label}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          ID: {module.id}
                        </span>
                      </div>
                    </div>

                    <Badge tone={theme.categoryBadge}>{module.category}</Badge>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {module.description}
                  </p>

                  {/* Capability Coverage Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                      <span className="text-slate-400">Role Coverage</span>
                      <span className="text-teal-400 font-mono font-bold">{coveragePct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${coveragePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges Count Strip */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                      <Layers className="w-3 h-3 text-teal-400" />
                      <span>{module.capabilities.length} Caps</span>
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                      <Users className="w-3 h-3 text-indigo-400" />
                      <span>{roleCount} Roles</span>
                    </span>

                    {protectedCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        <Lock className="w-3 h-3 text-rose-400" />
                        <span>{protectedCount} Protected</span>
                      </span>
                    )}
                  </div>

                  {/* Role Chips */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {directory.roles
                      .filter(role => grantedIn(role, module) > 0)
                      .slice(0, 4)
                      .map(role => (
                        <span
                          key={role.role}
                          className="rounded-md bg-slate-800/90 border border-slate-700/40 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
                        >
                          {role.label}
                        </span>
                      ))}
                    {roleCount > 4 && (
                      <span className="rounded-md bg-slate-800/50 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                        +{roleCount - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Cue */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <MousePointerClick className="w-3 h-3 text-slate-400" />
                    <span>{isSelected ? 'Filtering matrix below' : 'Click to filter matrix'}</span>
                  </span>

                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 font-bold text-[10px]">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. INTERACTIVE ROLE × MODULE ACCESS MATRIX                    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111b21] shadow-xl overflow-hidden">
        {/* Table Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/50">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Role × Module Access Matrix</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Click any capability cell to view permissions, evaluate risk, and configure server-enforced overrides.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search roles by name or key..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-950 px-4 py-3.5 font-black min-w-[220px] shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  Role Identity
                </th>
                <th className="px-4 py-3.5 font-black min-w-[130px]">Max Scope</th>
                {shownMatrixModules.map(module => {
                  const Icon = MODULE_ICONS[module.id] || Boxes;
                  const isFiltered = selectedModule === module.id;
                  return (
                    <th
                      key={module.id}
                      className={cx(
                        'px-3 py-3.5 text-center font-black min-w-[140px] transition-colors',
                        isFiltered
                          ? 'bg-teal-500/10 text-teal-300 border-x border-teal-500/30'
                          : 'text-slate-400'
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-teal-400" />
                        <span className="truncate">{module.label}</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 lowercase block mt-0.5">
                        {module.capabilities.length} total
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredRoles.map(role => {
                const overrideCount = Object.keys(role.overrides || {}).length;
                const initials = getRoleInitials(role.label);

                return (
                  <tr
                    key={role.role}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Sticky Role Column */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-[#111b21] group-hover:bg-slate-50 dark:group-hover:bg-[#15242d] px-4 py-3 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-teal-300 shrink-0 shadow-xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <span className="block font-bold text-slate-900 dark:text-white truncate">
                            {role.label}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-400 truncate">
                              {role.role}
                            </span>
                            {overrideCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold">
                                {overrideCount} custom
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Max Scope Column */}
                    <td className="px-4 py-3 text-[11px]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg font-bold text-[10px] uppercase bg-slate-800/80 border border-slate-700/60 text-slate-300">
                        {SCOPE_LABEL[role.maxScope]}
                      </span>
                    </td>

                    {/* Module Interactive Cells */}
                    {shownMatrixModules.map(module => {
                      const total = module.capabilities.length;
                      const granted = grantedIn(role, module);
                      const protectedCount = module.capabilities.filter(meta => meta.immutable).length;
                      const moduleOverrideCount = module.capabilities.filter(
                        meta => role.overrides?.[meta.key]
                      ).length;
                      const isFull = granted === total && total > 0;
                      const isPartial = granted > 0 && granted < total;
                      const isNone = granted === 0;

                      return (
                        <td
                          key={module.id}
                          className={cx(
                            'px-3 py-3 text-center transition-colors',
                            selectedModule === module.id && 'bg-teal-500/5'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setEditing({ role, module })}
                            aria-label={`Manage ${role.label} access to ${module.label}`}
                            title={`Manage ${module.label} access · ${granted} of ${total} capabilities granted${
                              moduleOverrideCount ? ` · ${moduleOverrideCount} active overrides` : ''
                            }`}
                            className="group/cell inline-flex flex-col items-center gap-1 rounded-xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-all cursor-pointer"
                          >
                            <span
                              className={cx(
                                'inline-flex min-w-[58px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-mono font-bold transition-all shadow-xs',
                                isFull
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 group-hover/cell:border-emerald-400 group-hover/cell:scale-105'
                                  : isPartial
                                  ? 'border-teal-500/40 bg-teal-500/15 text-teal-300 group-hover/cell:border-teal-400 group-hover/cell:scale-105'
                                  : 'border-slate-800 bg-slate-900/60 text-slate-500 group-hover/cell:border-slate-700 group-hover/cell:text-slate-300'
                              )}
                            >
                              {isFull && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                              <span>
                                {isNone ? '—' : `${granted}/${total}`}
                              </span>
                              {granted > 0 && protectedCount > 0 && (
                                <Lock className="w-3 h-3 text-rose-400" />
                              )}
                            </span>

                            {moduleOverrideCount > 0 && (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded-md">
                                {moduleOverrideCount} custom
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredRoles.length === 0 && (
          <div className="p-8 text-center">
            <EmptyState
              title="No matching roles found"
              description={`No roles match your search "${searchQuery}".`}
              action={
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
                >
                  Clear Search
                </button>
              }
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. DRAWER MODAL                                               */}
      {/* ------------------------------------------------------------- */}
      {editing && (
        <ModuleAccessDrawer
          role={editing.role}
          module={editing.module}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
};
