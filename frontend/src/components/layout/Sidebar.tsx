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
      label: 'Coordinators',
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
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        w-64 md:w-56 border-r border-slate-800 bg-[#111b21] flex flex-col justify-between py-3 select-none shrink-0
        fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-2">
          {/* Mobile Header with Close button */}
          <div className="md:hidden px-4 pb-2 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Navigation</span>
            <button 
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#202c33]"
            >
              <X className="w-4 h-4" />
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
                    onClick={() => {
                      setActiveTab(item.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive 
                        ? 'bg-[#202c33] text-whatsapp font-bold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-whatsapp' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
};
