import React from 'react';
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  X,
  Bell,
  Layers,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import {
  NAV_SECTIONS,
  isNavItemVisible,
  navigateToPath,
  dispatchIntent,
  resolveRoute,
  type NavItem,
  type NavSection,
  type NavTab,
} from '../../config/navigation';
import { useHashPath } from '../../hooks/useHashRoute';
import { cn } from '../ui';

export type { NavTab } from '../../config/navigation';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  leads_officer: 'Leads Officer',
  coordinator: 'Patient Coordinator',
  sales_coordinator: 'Sales Coordinator',
  exam_department_manager: 'Exam Dept. Manager',
  exam_coordinator: 'Exam Coordinator',
  exam_providing_officer: 'Exam Providing Officer',
  marketing_officer: 'Marketing Officer',
  marketing_admin: 'Marketing Admin',
  clinical_nurse: 'Clinical Nurse',
  clinical_doctor: 'Clinical Doctor',
  report_analyst: 'Report Analyst',
};

const COLLAPSE_KEY = 'ahc_sidebar_collapsed';

const Badge: React.FC<{ value?: number | string; tone?: 'teal' | 'amber' | 'rose'; collapsed?: boolean }> = ({
  value,
  tone = 'teal',
  collapsed,
}) => {
  if (value === undefined || value === 0 || value === '') return null;
  const tones = {
    teal: 'bg-[#DDF5EC] text-[#075E54] dark:bg-[#005C4B]/70 dark:text-[#25D366] ring-[#128C7E]/30 dark:ring-[#25D366]/30',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 ring-amber-400/30',
    rose: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300 ring-rose-400/30',
  } as const;
  if (collapsed) {
    return (
      <span className={cn('absolute right-1 top-1 h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-[#111B21]', tone === 'amber' ? 'bg-amber-500' : tone === 'rose' ? 'bg-rose-500' : 'bg-[#25D366]')} aria-hidden />
    );
  }
  return (
    <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ring-1 ring-inset', tones[tone])}>
      {typeof value === 'number' && value > 99 ? '99+' : value}
    </span>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isMobileOpen = false, onCloseMobile }) => {
  const {
    currentUser,
    logout,
    isSuperAdmin,
    leads,
    followups,
    unreadBroadcastsCount,
    markAllBroadcastsAsRead,
    totalUnreadCountForUser,
    setNotificationSettingsOpen,
    canAssignLeads,
  } = useCrm();

  const path = useHashPath();
  const route = resolveRoute(path);

  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (route?.item?.children?.length) {
      initial[route.item.id] = true;
    }
    return initial;
  });

  const [query, setQuery] = React.useState('');
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, isCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [isCollapsed]);

  React.useEffect(() => {
    if (route?.item?.children?.length) {
      setExpanded((prev) => ({ ...prev, [route.item.id]: true }));
    }
  }, [route?.item?.id]);

  const isCrasUser = !isSuperAdmin && currentUser?.role !== 'leads_officer' && currentUser?.company === 'CRAS';
  const isRwcUser =
    !isSuperAdmin &&
    currentUser?.role !== 'leads_officer' &&
    (currentUser?.company === 'RWC' || !currentUser?.company);

  const scopedLeads = isCrasUser
    ? leads.filter((l) => (l.company || l.source) === 'CRAS')
    : isRwcUser
    ? leads.filter((l) => (l.company || l.source || 'RWC') === 'RWC')
    : leads;

  const unassignedCount = scopedLeads.filter((l) => l.stage === 'new').length;
  const myAssignedCount = scopedLeads.filter((l) => l.assignedTo === currentUser?.id).length;
  const pendingFollowupsCount = followups.filter((f) => f.status === 'pending').length;
  const inboxUnread = totalUnreadCountForUser || 0;

  const badgeFor = (id: NavTab): { value?: number; tone?: 'teal' | 'amber' | 'rose' } => {
    if (id === 'chat') return { value: inboxUnread, tone: 'teal' };
    if (id === 'leads-kanban') return { value: canAssignLeads ? unassignedCount : myAssignedCount, tone: 'teal' };
    if (id === 'broadcast') return { value: unreadBroadcastsCount, tone: 'amber' };
    if (id === 'templates') return { value: pendingFollowupsCount, tone: 'rose' };
    return {};
  };

  const visibleSections = React.useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => isNavItemVisible(item, currentUser)),
      })).filter((section) => section.items.length > 0),
    [currentUser],
  );

  const filteredSections: NavSection[] = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return visibleSections;
    return visibleSections
      .map((section) => {
        const items = section.items
          .map((item) => {
            const childMatches = item.children?.filter((c) => c.label.toLowerCase().includes(term)) || [];
            if (item.label.toLowerCase().includes(term)) return item;
            if (childMatches.length > 0) return { ...item, children: childMatches };
            return null;
          })
          .filter((item): item is NavItem => item !== null);
        return { ...section, items };
      })
      .filter((section) => section.items.length > 0);
  }, [visibleSections, query]);

  const handleItemClick = (item: NavItem) => {
    const alreadyActive = route?.item.id === item.id;
    setActiveTab(item.id);
    if (item.children?.length && alreadyActive && !isCollapsed) {
      setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
      onCloseMobile?.();
      return;
    }
    const target = item.children?.[0]?.path || item.path;
    navigateToPath(target);
    const childRoute = resolveRoute(target);
    if (childRoute) dispatchIntent(childRoute);
    if (item.id === 'broadcast') markAllBroadcastsAsRead();
    if (isCollapsed && item.children?.length) {
      setIsCollapsed(false);
      setExpanded((prev) => ({ ...prev, [item.id]: true }));
    } else if (item.children?.length) {
      setExpanded((prev) => ({ ...prev, [item.id]: true }));
    }
    onCloseMobile?.();
  };

  const handleChildClick = (item: NavItem, childPath: string) => {
    setActiveTab(item.id);
    navigateToPath(childPath);
    const childRoute = resolveRoute(childPath);
    if (childRoute) dispatchIntent(childRoute);
    setExpanded((prev) => ({ ...prev, [item.id]: true }));
    onCloseMobile?.();
  };

  const goTo = (tab: NavTab, targetPath: string) => {
    setActiveTab(tab);
    navigateToPath(targetPath);
    const target = resolveRoute(targetPath);
    if (target) dispatchIntent(target);
  };

  const isChildActive = (item: NavItem, childPath: string) => activeTab === item.id && path === childPath;

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={cn(
          'relative z-50 flex h-full max-h-screen shrink-0 select-none flex-col border-r border-[#E0E5E7] bg-white text-[#111B21] transition-[width,transform] duration-200 ease-out dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]',
          'fixed inset-y-0 left-0 md:static',
          isCollapsed ? 'w-[272px] md:w-[74px]' : 'w-[272px]',
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full invisible md:visible md:translate-x-0',
        )}
      >
        {/* Branding — sticky */}
        <div className={cn('flex shrink-0 items-center gap-2.5 border-b border-[#E0E5E7] px-3 py-3 dark:border-[#222D34]', isCollapsed && 'md:justify-center md:px-2')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-[#E0E5E7] dark:ring-[#222D34]">
            <img src="/logo.png" alt="Alpha Health Group" className="h-full w-full object-contain" />
          </div>
          <div className={cn('min-w-0 flex-1', isCollapsed && 'md:hidden')}>
            <p className="truncate text-[13px] font-bold leading-tight text-[#111B21] dark:text-[#E9EDEF]">Alpha Health Group</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#075E54] dark:text-[#25D366]">CRM Console</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className={cn(
              'hidden shrink-0 rounded-lg p-1.5 text-[#667781] transition-colors hover:bg-[#F0F2F5] hover:text-[#111B21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] md:flex dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]',
              isCollapsed && 'md:hidden',
            )}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-1.5 text-[#667781] transition-colors hover:bg-[#F0F2F5] hover:text-[#111B21] md:hidden dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="mx-auto mt-2 hidden rounded-lg p-1.5 text-[#667781] transition-colors hover:bg-[#F0F2F5] hover:text-[#111B21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] md:flex dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Navigation search */}
        <div className={cn('shrink-0 px-3 pb-2 pt-3', isCollapsed && 'md:hidden')}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667781] dark:text-[#8696A0]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
              }}
              placeholder="Search navigation"
              aria-label="Search navigation"
              className="h-8 w-full rounded-lg border border-[#E0E5E7] bg-[#F0F2F5] pl-8 pr-7 text-[11px] text-[#111B21] placeholder-[#667781] focus:border-[#128C7E] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF] dark:placeholder-[#8696A0] dark:focus:border-[#25D366]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]"
                aria-label="Clear navigation search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable nav */}
        <nav aria-label="Modules" className="custom-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
          {filteredSections.length === 0 && (
            <div className={cn('px-3 py-6 text-center', isCollapsed && 'md:hidden')}>
              <p className="text-[11px] font-medium text-[#667781] dark:text-[#8696A0]">No matching module</p>
              <p className="mt-1 text-[10px] text-[#667781]/70 dark:text-[#8696A0]/70">Try “leads”, “marketing” or “audit”.</p>
            </div>
          )}

          {filteredSections.map((section, sIdx) => {
            const sectionCollapsed = !!collapsedSections[section.id] && !query;
            return (
              <div key={section.id} className={cn(sIdx > 0 && 'mt-3 border-t border-[#E0E5E7] pt-3 dark:border-[#222D34]')}>
                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={() => setCollapsedSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                    aria-expanded={!sectionCollapsed}
                    className="flex w-full items-center justify-between rounded px-2.5 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#667781] transition-colors hover:text-[#111B21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]"
                  >
                    <span>{section.title}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', sectionCollapsed && '-rotate-90')} />
                  </button>
                )}

                {(!sectionCollapsed || isCollapsed) && (
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const hasChildren = !!item.children?.length;
                      const isExpanded = !!expanded[item.id];
                      const badge = badgeFor(item.id);

                      return (
                        <li key={item.id}>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => handleItemClick(item)}
                              aria-current={isActive && !hasChildren ? 'page' : undefined}
                              aria-expanded={hasChildren ? isExpanded : undefined}
                              title={isCollapsed ? item.label : undefined}
                              className={cn(
                                'group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]',
                                isCollapsed && 'md:justify-center md:px-2',
                                isActive
                                  ? 'bg-[#DDF5EC] text-[#075E54] font-semibold dark:bg-[#005C4B]/50 dark:text-[#E9EDEF]'
                                  : 'text-[#111B21] hover:bg-[#F0F2F5] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]',
                              )}
                            >
                              {isActive && (
                                <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-[#25D366]" aria-hidden />
                              )}
                              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0] group-hover:text-[#111B21] dark:group-hover:text-[#E9EDEF]')} />
                              <span className={cn('truncate text-left', isCollapsed && 'md:hidden')}>{item.label}</span>
                              <Badge value={badge.value} tone={badge.tone} collapsed={isCollapsed} />
                              {hasChildren && !isCollapsed && (
                                <ChevronDown
                                  className={cn('ml-1 h-3.5 w-3.5 shrink-0 text-[#667781] transition-transform duration-200 dark:text-[#8696A0]', isExpanded && 'rotate-180')}
                                  aria-hidden
                                />
                              )}
                            </button>
                          </div>

                          {hasChildren && isExpanded && !isCollapsed && (
                            <ul className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l border-[#E0E5E7] pl-2 dark:border-[#222D34]" aria-label={item.label}>
                              {item.children!.map((child) => {
                                const childActive = isChildActive(item, child.path);
                                const ChildIcon = child.icon;
                                return (
                                  <li key={child.id}>
                                    <button
                                      type="button"
                                      onClick={() => handleChildClick(item, child.path)}
                                      aria-current={childActive ? 'page' : undefined}
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]',
                                        childActive
                                          ? 'bg-[#DDF5EC] font-semibold text-[#075E54] dark:bg-[#005C4B]/40 dark:text-[#25D366]'
                                          : 'text-[#667781] hover:bg-[#F0F2F5] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]',
                                      )}
                                    >
                                      <ChildIcon className={cn('h-3 w-3 shrink-0', childActive ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781] dark:text-[#8696A0]')} />
                                      <span className="truncate">{child.label}</span>
                                      {childActive && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#25D366]" aria-hidden />}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Account footer */}
        <div className="relative shrink-0 border-t border-[#E0E5E7] bg-[#F0F2F5] p-2 dark:border-[#222D34] dark:bg-[#202C33]">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white dark:hover:bg-[#2A3942] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]',
              isCollapsed && 'md:justify-center',
            )}
            title={isCollapsed ? currentUser?.fullName : undefined}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DDF5EC] text-xs font-bold text-[#075E54] ring-1 ring-[#128C7E]/30 dark:bg-[#005C4B] dark:text-[#25D366] dark:ring-[#25D366]/30">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </span>
            <span className={cn('min-w-0 flex-1', isCollapsed && 'md:hidden')}>
              <span className="block truncate text-[11.5px] font-semibold text-[#111B21] dark:text-[#E9EDEF]">{currentUser?.fullName || 'User'}</span>
              <span className="block truncate text-[10px] text-[#667781] dark:text-[#8696A0]">
                {ROLE_LABEL[currentUser?.role || ''] || currentUser?.roleTitle || 'Team Member'}
              </span>
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-[#667781] transition-transform dark:text-[#8696A0]', userMenuOpen && 'rotate-180', isCollapsed && 'md:hidden')} />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-[calc(100%-2px)] left-2 right-2 z-50 overflow-hidden rounded-xl border border-[#E0E5E7] bg-white p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100 dark:border-[#222D34] dark:bg-[#202C33]"
            >
              <div className="border-b border-[#E0E5E7] px-2.5 py-2 dark:border-[#222D34]">
                <p className="truncate text-[11px] font-semibold text-[#111B21] dark:text-[#E9EDEF]">{currentUser?.fullName}</p>
                <p className="truncate text-[10px] text-[#667781] dark:text-[#8696A0]">{currentUser?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  setNotificationSettingsOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] text-[#111B21] hover:bg-[#F0F2F5] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
              >
                <Bell className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" /> Notification settings
              </button>
              {isSuperAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    goTo('settings', '/settings/courses');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] text-[#111B21] hover:bg-[#F0F2F5] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
                >
                  <Settings className="h-3.5 w-3.5 text-[#667781] dark:text-[#8696A0]" /> System settings
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <LogOut className="h-3.5 w-3.5" /> Lock & log out
              </button>
              <div className="mt-1 flex items-center gap-1.5 border-t border-[#E0E5E7] px-2.5 py-1.5 text-[9.5px] text-[#667781] dark:border-[#222D34] dark:text-[#8696A0]">
                <ShieldCheck className="h-3 w-3 text-[#128C7E] dark:text-[#25D366]" />
                Server-verified session
                <Layers className="ml-auto h-3 w-3" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
