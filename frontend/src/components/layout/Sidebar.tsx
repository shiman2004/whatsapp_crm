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
  X
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export type NavTab = 
  | 'dashboard' 
  | 'leads-kanban' 
  | 'chat' 
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
  const { isSuperAdmin, isLeadsOfficer, canAssignLeads, currentUser, leads, followups } = useCrm();

  const unassignedCount = leads.filter(l => l.stage === 'new').length;
  const myAssignedCount = leads.filter(l => l.assignedTo === currentUser.id).length;
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
      id: 'treatments' as NavTab,
      label: 'Treatments',
      icon: Sparkles,
      adminOnly: false,
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
      adminOnly: false,
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
      adminOnly: false,
    },
    {
      id: 'architecture' as NavTab,
      label: 'API Specs',
      icon: Code2,
      adminOnly: false,
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
        w-72 md:w-56 border-r border-slate-800 bg-[#111b21] flex flex-col justify-between py-3 select-none shrink-0
        fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl ring-1 ring-slate-800' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-2 overflow-y-auto">
          {/* Mobile Header with Brand & Close button */}
          <div className="md:hidden px-4 py-2 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white p-0.5 flex items-center justify-center shadow overflow-hidden ring-1 ring-slate-700/50">
                <img src="/logo.png" alt="Alpha Health" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">Alpha Health CRM</span>
            </div>
            <button 
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#202c33] active:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation List */}
          <div className="px-2">
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
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 sm:py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#202c33] text-whatsapp font-bold shadow-xs' 
                        : 'text-slate-300 hover:text-white hover:bg-[#202c33]/60 active:bg-[#202c33]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-whatsapp' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${item.badgeColor}`}>
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
        <div className="md:hidden px-3 pt-3 border-t border-slate-800/80 mt-auto">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-[#202c33]/50">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="text-xs font-bold text-white truncate">{currentUser?.fullName}</p>
              <p className="text-[10px] text-emerald-400 truncate">
                {currentUser?.role === 'super_admin' ? 'Super Admin' : (currentUser?.role === 'leads_officer' ? 'Leads Officer' : 'Coordinator')}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
