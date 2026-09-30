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
  Code2
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
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { isSuperAdmin, currentUser, leads, followups } = useCrm();

  const unassignedCount = leads.filter(l => l.stage === 'new').length;
  const myAssignedCount = leads.filter(l => l.assignedTo === currentUser.id).length;
  const pendingFollowupsCount = followups.filter(f => f.status === 'pending').length;

  const navItems = [
    {
      id: 'chat' as NavTab,
      label: 'Live WhatsApp',
      icon: MessageSquare,
      badge: isSuperAdmin ? (unassignedCount > 0 ? unassignedCount : undefined) : (myAssignedCount > 0 ? myAssignedCount : undefined),
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
      adminOnly: true,
    },
    {
      id: 'coordinators' as NavTab,
      label: 'Coordinators',
      icon: Users,
      adminOnly: true,
    },
    {
      id: 'templates' as NavTab,
      label: 'Templates & Nurture',
      icon: FileText,
      badge: pendingFollowupsCount > 0 ? pendingFollowupsCount : undefined,
      badgeColor: 'bg-emerald-600 text-white',
      adminOnly: true,
    },
    {
      id: 'reports' as NavTab,
      label: 'Analytics',
      icon: BarChart3,
      adminOnly: false,
    },
    {
      id: 'audit' as NavTab,
      label: 'Audit Trail',
      icon: ScrollText,
      adminOnly: true,
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

  const visibleNav = navItems.filter(item => !item.adminOnly || isSuperAdmin);

  return (
    <aside className="w-56 border-r border-slate-800 bg-[#111b21] flex flex-col justify-between py-3 select-none shrink-0">
      <div className="space-y-4">
        {/* User Card */}
        <div className="px-3">
          <div className="p-2.5 rounded-xl bg-[#202c33] border border-slate-700/60 flex items-center gap-2.5">
            <img 
              src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
              alt={currentUser.fullName}
              className="w-8 h-8 rounded-full object-cover border border-emerald-500/40"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-100 truncate">{currentUser.fullName}</p>
              <span className="text-[10px] text-slate-400 capitalize">
                {isSuperAdmin ? 'Super Admin' : 'Coordinator'}
              </span>
            </div>
          </div>
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
                  onClick={() => setActiveTab(item.id)}
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
  );
};
