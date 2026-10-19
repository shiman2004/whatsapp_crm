import React from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  MessageSquare,
  Sparkles,
  Users,
  FileText,
  BarChart3,
  ScrollText,
  Code2,
  Megaphone,
  Sliders,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export type NavTab = 
  | 'dashboard' 
  | 'leads-kanban' 
  | 'chat' 
  | 'broadcast'
  | 'settings'
  | 'treatments' 
  | 'coordinators' 
  | 'templates' 
  | 'reports' 
  | 'audit'
  | 'webhook-sandbox'
  | 'architecture';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isMobileOpen = false, 
  onCloseMobile 
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { isSuperAdmin, isLeadsOfficer, canAssignLeads, currentUser, leads, followups, unreadBroadcastsCount, markAllBroadcastsAsRead } = useCrm();

  const isCrasUser = !isSuperAdmin && !isLeadsOfficer && currentUser?.company === 'CRAS';
  const isRwcUser = !isSuperAdmin && !isLeadsOfficer && (currentUser?.company === 'RWC' || !currentUser?.company);

  const scopedLeads = isCrasUser 
    ? leads.filter(l => (l.company || l.source) === 'CRAS')
    : isRwcUser
    ? leads.filter(l => (l.company || l.source || 'RWC') === 'RWC')
    : leads;

  const unassignedCount = scopedLeads.filter(l => l.stage === 'new').length;
  const myAssignedCount = scopedLeads.filter(l => l.assignedTo === currentUser.id).length;
  const pendingFollowupsCount = followups.filter(f => f.status === 'pending').length;

  const navItems = [
    {
      id: 'chat' as NavTab,
      label: 'Live WhatsApp',
      icon: MessageSquare,
      badge: canAssignLeads ? (unassignedCount > 0 ? unassignedCount : undefined) : (myAssignedCount > 0 ? myAssignedCount : undefined),
      badgeColor: 'bg-whatsapp text-slate-950',
      adminOnly: false,
    },
    {
      id: 'leads-kanban' as NavTab,
      label: 'Leads Pipeline',
      icon: KanbanSquare,
      adminOnly: false,
    },
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      adminOnly: false,
    },
    {
      id: 'broadcast' as NavTab,
      label: 'Team Broadcast 📢',
      icon: Megaphone,
      badge: unreadBroadcastsCount > 0 ? unreadBroadcastsCount : undefined,
      badgeColor: 'bg-amber-500 text-slate-950 font-black',
      adminOnly: false, // Visible to all team members
    },
    {
      id: 'settings' as NavTab,
      label: 'System Settings',
      icon: Sliders,
      adminOnly: true, // Super Admin only
    },
    {
      id: 'treatments' as NavTab,
      label: 'Treatments',
      icon: Sparkles,
      adminOnly: true, // Super Admin only
    },
    {
      id: 'templates' as NavTab,
      label: 'Templates & Nurture',
      icon: FileText,
      badge: pendingFollowupsCount > 0 ? pendingFollowupsCount : undefined,
      badgeColor: 'bg-emerald-600 text-white',
      adminOnly: false,
    },
    {
      id: 'reports' as NavTab,
      label: 'Analytics',
      icon: BarChart3,
      adminOnly: true, // Super Admin only
    },
    {
      id: 'coordinators' as NavTab,
      label: 'Staffs',
      icon: Users,
      adminOnly: true, // Super Admin only
    },
    {
      id: 'audit' as NavTab,
      label: 'Audit Trail',
      icon: ScrollText,
      adminOnly: true, // Super Admin only
    },
    {
      id: 'webhook-sandbox' as NavTab,
      label: 'Webhook Sandbox',
      icon: Code2,
      adminOnly: true, // Super Admin only
    },
    {
      id: 'architecture' as NavTab,
      label: 'API Specs',
      icon: Code2,
      adminOnly: true, // Super Admin only
    }
  ];

  const visibleNav = navItems.filter(item => {
    if (item.id === 'coordinators') return isSuperAdmin;
    if (item.adminOnly) return isSuperAdmin;
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 z-40 md:hidden backdrop-blur-xs animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        w-72 ${isCollapsed ? 'md:w-16' : 'md:w-56'} border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21] flex flex-col justify-between py-3 select-none shrink-0 transition-all duration-200 relative
        fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-2 overflow-y-auto">
          <div className={`hidden md:flex absolute bottom-2 ${isCollapsed ? 'right-1' : 'right-2'} z-10`}>
            <button type="button" onClick={() => setIsCollapsed((collapsed) => !collapsed)} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#202c33] transition-colors" aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile Header with Brand & Close button */}
          <div className="md:hidden px-4 py-2 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center shadow overflow-hidden ring-1 ring-slate-300 dark:ring-slate-700/50">
                <img src="/logo.png" alt="Alpha Health" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Alpha Health CRM</span>
            </div>
            <button 
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#202c33] active:bg-slate-200 dark:active:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation List */}
          <div className={isCollapsed ? 'px-1' : 'px-2'}>
            <nav className="space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.id === 'broadcast') {
                        markAllBroadcastsAsRead();
                      }
                      onCloseMobile?.();
                    }}
                    className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 sm:py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-[#202c33] dark:text-whatsapp font-bold shadow-xs' 
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#202c33]/60 active:bg-slate-200 dark:active:bg-[#202c33]'
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-whatsapp' : 'text-slate-400 dark:text-slate-400'}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge !== undefined && (
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                    {isCollapsed && item.badge !== undefined && (
                      <span className={`absolute top-1 right-1 min-w-3 h-3 px-0.5 text-[8px] leading-3 text-center font-black rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Sidebar Footer: Logged in status */}
        <div className="md:hidden px-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 mt-auto">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202c33]/50">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.fullName}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                {currentUser?.role === 'super_admin' 
                  ? 'Super Admin' 
                  : (currentUser?.role === 'leads_officer' 
                    ? 'Leads Officer' 
                    : (currentUser?.company === 'CRAS' ? 'Education Counsellor' : 'Patient Coordinator'))}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
