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
  PanelLeftOpen,
  CalendarDays,
  Upload,
  Contact,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
  ChevronDown,
  Clock,
  BookOpen,
  Target,
  FileCheck2,
  Database,
  Inbox,
  Edit3,
  CheckSquare,
  GraduationCap
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export type NavTab = 
  | 'dashboard' 
  | 'leads-kanban' 
  | 'chat' 
  | 'broadcast'
  | 'appointment-rooms'
  | 'settings'
  | 'security-access'
  | 'treatments' 
  | 'coordinators' 
  | 'templates' 
  | 'reports' 
  | 'audit'
  | 'webhook-sandbox'
  | 'architecture'
  | 'exam'
  | 'marketing'
  | 'exam-department'
  | 'patient-assessment';

export interface SubItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  eventKey: string;
  adminOnly?: boolean;
}

export interface NavItemDef {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
  adminOnly?: boolean;
  examStaffOnly?: boolean;
  clinicalStaffOnly?: boolean;
  studentOnly?: boolean;
  subItems?: SubItemDef[];
}

export interface NavSectionDef {
  id: string;
  title: string;
  items: NavItemDef[];
}

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
  
  // Collapsible category sections (all open by default)
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});

  // Collapsible sub-menus for tabs with child pages
  const [expandedSubmenus, setExpandedSubmenus] = React.useState<Record<string, boolean>>({
    marketing: activeTab === 'marketing',
    'exam-department': activeTab === 'exam-department',
    settings: activeTab === 'settings',
  });

  // Track active sub-page per module
  const [currentMarketingPage, setCurrentMarketingPage] = React.useState('dashboard');
  const [currentExamSubTab, setCurrentExamSubTab] = React.useState('operations');
  const [currentSettingsSubTab, setCurrentSettingsSubTab] = React.useState('courses');

  // Auto-expand relevant submenu when parent tab is selected
  React.useEffect(() => {
    if (['marketing', 'exam-department', 'settings'].includes(activeTab)) {
      setExpandedSubmenus(prev => ({
        ...prev,
        [activeTab]: true
      }));
    }
  }, [activeTab]);

  // Synchronize sub-tab changes from CustomEvents
  React.useEffect(() => {
    const handleMarketingPage = (event: Event) => {
      const page = (event as CustomEvent<string>).detail;
      if (page) setCurrentMarketingPage(page);
    };
    const handleExamSubTab = (event: Event) => {
      const sub = (event as CustomEvent<string>).detail;
      if (sub) setCurrentExamSubTab(sub);
    };
    const handleSettingsSubTab = (event: Event) => {
      const sub = (event as CustomEvent<string>).detail;
      if (sub) setCurrentSettingsSubTab(sub);
    };

    window.addEventListener('marketing-page-change', handleMarketingPage);
    window.addEventListener('exam-subtab-change', handleExamSubTab);
    window.addEventListener('settings-subtab-change', handleSettingsSubTab);

    return () => {
      window.removeEventListener('marketing-page-change', handleMarketingPage);
      window.removeEventListener('exam-subtab-change', handleExamSubTab);
      window.removeEventListener('settings-subtab-change', handleSettingsSubTab);
    };
  }, []);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleSubmenu = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedSubmenus(prev => ({
      ...prev,
      [tabId]: !prev[tabId]
    }));
  };

  const { 
    isSuperAdmin, 
    isLeadsOfficer, 
    canAssignLeads, 
    currentUser, 
    leads, 
    followups, 
    unreadBroadcastsCount, 
    markAllBroadcastsAsRead 
  } = useCrm();

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

  const navSections: NavSectionDef[] = [
    {
      id: 'operations',
      title: 'Operations & Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'chat',
          label: 'Live WhatsApp',
          icon: MessageSquare,
          badge: canAssignLeads ? (unassignedCount > 0 ? unassignedCount : undefined) : (myAssignedCount > 0 ? myAssignedCount : undefined),
          badgeColor: 'bg-whatsapp text-slate-950',
        },
        {
          id: 'leads-kanban',
          label: 'Leads Pipeline',
          icon: KanbanSquare,
        },
        {
          id: 'appointment-rooms',
          label: 'Appointment Room',
          icon: CalendarDays,
        },
        {
          id: 'broadcast',
          label: 'Team Broadcast 📢',
          icon: Megaphone,
          badge: unreadBroadcastsCount > 0 ? unreadBroadcastsCount : undefined,
          badgeColor: 'bg-amber-500 text-slate-950 font-black',
        },
      ],
    },
    {
      id: 'clinical-academic',
      title: 'Clinical & Academic',
      items: [
        {
          id: 'patient-assessment',
          label: 'Patient Assessment & Reports',
          icon: ClipboardCheck,
          clinicalStaffOnly: true,
        },
        {
          id: 'exam-department',
          label: 'Exam Department',
          icon: ClipboardList,
          examStaffOnly: true,
          subItems: [
            { id: 'operations', label: 'Exam Operations', icon: Inbox, eventKey: 'exam-subtab-change' },
            { id: 'dashboard', label: 'Exam Dashboard', icon: LayoutDashboard, eventKey: 'exam-subtab-change' },
            { id: 'courses', label: 'Course Catalog', icon: BookOpen, eventKey: 'exam-subtab-change' },
            { id: 'study-materials', label: 'Study Materials', icon: FileText, eventKey: 'exam-subtab-change' },
            { id: 'question-bank', label: 'Question Bank', icon: Database, eventKey: 'exam-subtab-change' },
            { id: 'mock-tests', label: 'Mock Tests', icon: FileCheck2, eventKey: 'exam-subtab-change' },
            { id: 'my-drafts', label: 'My Drafts', icon: Edit3, eventKey: 'exam-subtab-change' },
            { id: 'approval-queue', label: 'Approval Queue', icon: CheckSquare, eventKey: 'exam-subtab-change', adminOnly: true },
            { id: 'mcq-practice', label: 'MCQ Practice', icon: Target, eventKey: 'exam-subtab-change' },
            { id: 'requests', label: 'Material Requests', icon: Inbox, eventKey: 'exam-subtab-change' },
          ],
        },
        {
          id: 'exam',
          label: 'Exam Portal',
          icon: Clock,
          studentOnly: true,
        },
      ],
    },
    {
      id: 'marketing-nurture',
      title: 'Marketing & Outreach',
      items: [
        {
          id: 'marketing',
          label: 'Public Contact Marketing',
          icon: Megaphone,
          subItems: [
            { id: 'dashboard', label: 'Marketing Dashboard', icon: LayoutDashboard, eventKey: 'marketing-page-change' },
            { id: 'add', label: 'Add Public Numbers', icon: Upload, eventKey: 'marketing-page-change' },
            { id: 'uploads', label: 'My Uploads', icon: FileText, eventKey: 'marketing-page-change' },
            { id: 'contacts', label: 'Contact Database', icon: Contact, eventKey: 'marketing-page-change' },
            { id: 'assignment', label: 'Contact Assignment', icon: Users, eventKey: 'marketing-page-change' },
            { id: 'tasks', label: 'My Marketing Tasks', icon: ClipboardList, eventKey: 'marketing-page-change' },
            { id: 'campaigns', label: 'Campaign Content', icon: FileText, eventKey: 'marketing-page-change' },
            { id: 'reports', label: 'Marketing Reports', icon: BarChart3, eventKey: 'marketing-page-change' },
          ],
        },
        {
          id: 'templates',
          label: 'Templates & Nurture',
          icon: FileText,
          badge: pendingFollowupsCount > 0 ? pendingFollowupsCount : undefined,
          badgeColor: 'bg-emerald-600 text-white',
        },
      ],
    },
    {
      id: 'management',
      title: 'Management & Analytics',
      items: [
        {
          id: 'reports',
          label: 'Analytics',
          icon: BarChart3,
          adminOnly: true,
        },
        {
          id: 'coordinators',
          label: 'Staffs',
          icon: Users,
          adminOnly: true,
        },
        {
          id: 'treatments',
          label: 'Treatments',
          icon: Sparkles,
          adminOnly: true,
        },
      ],
    },
    {
      id: 'system',
      title: 'System & Security',
      items: [
        {
          id: 'settings',
          label: 'System Settings',
          icon: Sliders,
          adminOnly: true,
          subItems: [
            { id: 'courses', label: 'Courses & Programs', icon: BookOpen, eventKey: 'settings-subtab-change' },
            { id: 'treatments', label: 'Treatments Catalog', icon: Sparkles, eventKey: 'settings-subtab-change' },
            { id: 'stages', label: 'Lead Funnel Stages', icon: KanbanSquare, eventKey: 'settings-subtab-change' },
            { id: 'admins', label: 'Admin Accounts', icon: ShieldCheck, eventKey: 'settings-subtab-change' },
            { id: 'exam-settings', label: 'Exam Department Settings', icon: GraduationCap, eventKey: 'settings-subtab-change' },
          ],
        },
        {
          id: 'security-access',
          label: 'Security & Access',
          icon: ShieldCheck,
          adminOnly: true,
        },
        {
          id: 'audit',
          label: 'Audit Trail',
          icon: ScrollText,
          adminOnly: true,
        },
        {
          id: 'webhook-sandbox',
          label: 'Webhook Sandbox',
          icon: Code2,
          adminOnly: true,
        },
        {
          id: 'architecture',
          label: 'API Specs',
          icon: Code2,
          adminOnly: true,
        },
      ],
    },
  ];

  const isItemVisible = (item: NavItemDef) => {
    if (item.id === 'coordinators') return isSuperAdmin;
    if (item.adminOnly) return isSuperAdmin;
    if (item.examStaffOnly) {
      return ['super_admin','coordinator','leads_officer','exam_department_manager','exam_coordinator','exam_providing_officer'].includes(currentUser?.role || '');
    }
    if (item.clinicalStaffOnly) {
      return ['super_admin','clinical_nurse','clinical_doctor','report_analyst'].includes(currentUser?.role || '');
    }
    if (item.studentOnly) {
      return String(currentUser?.role) === 'student';
    }
    return true;
  };

  const visibleSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(isItemVisible),
    }))
    .filter(section => section.items.length > 0);

  const getSubActiveState = (tabId: NavTab, subId: string) => {
    if (tabId === 'marketing') return activeTab === 'marketing' && currentMarketingPage === subId;
    if (tabId === 'exam-department') return activeTab === 'exam-department' && currentExamSubTab === subId;
    if (tabId === 'settings') return activeTab === 'settings' && currentSettingsSubTab === subId;
    return false;
  };

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
        w-72 ${isCollapsed ? 'md:w-16' : 'md:w-64'} border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21] flex flex-col h-full max-h-screen select-none shrink-0 transition-all duration-200 relative
        fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Navigation Content Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Mobile Header with Brand & Close button */}
          <div className="md:hidden px-4 py-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between shrink-0">
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

          {/* Scrollable Navigation List */}
          <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-1' : 'px-2'} py-2 space-y-2.5 custom-sidebar-scroll`}>
            {visibleSections.map((section, sIdx) => {
              const isSectionCollapsed = !!collapsedSections[section.id];

              return (
                <div key={section.id} className="space-y-1">
                  {/* Visual Divider between sections */}
                  {sIdx > 0 && (
                    <div className={`my-1.5 ${isCollapsed ? 'px-2' : 'px-2'}`}>
                      <div className="border-t border-slate-100 dark:border-slate-800/80" />
                    </div>
                  )}

                  {/* Section Header with Click-to-Collapse Accordion */}
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-2.5 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors group cursor-pointer"
                      title={isSectionCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
                    >
                      <span>{section.title}</span>
                      <ChevronDown className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300 ${isSectionCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  )}

                  {/* Section Items (Rendered when section is expanded, or always in collapsed icon mode) */}
                  {(!isSectionCollapsed || isCollapsed) && (
                    <nav className="space-y-0.5 animate-in fade-in duration-150">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isSubmenuExpanded = !isCollapsed && !!expandedSubmenus[item.id];
                        const activeItemClass = 'bg-emerald-50 text-emerald-800 dark:bg-[#202c33] dark:text-whatsapp font-bold shadow-xs';
                        const activeIconClass = 'text-emerald-600 dark:text-whatsapp';

                        return (
                          <React.Fragment key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab(item.id);
                                if (hasSubItems) {
                                  // If already active, toggle submenu; otherwise expand it
                                  if (activeTab === item.id) {
                                    toggleSubmenu(item.id);
                                  } else {
                                    setExpandedSubmenus(prev => ({ ...prev, [item.id]: true }));
                                  }
                                }
                                if (item.id === 'broadcast') {
                                  markAllBroadcastsAsRead();
                                }
                                onCloseMobile?.();
                              }}
                              title={isCollapsed ? (item.badge !== undefined ? `${item.label} (${item.badge})` : item.label) : undefined}
                              className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-2.5'} py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                isActive 
                                  ? activeItemClass
                                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#202c33]/60 active:bg-slate-200 dark:active:bg-[#202c33]'
                              }`}
                            >
                              <div className={`flex items-center min-w-0 ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? activeIconClass : 'text-slate-400 dark:text-slate-400'}`} />
                                {!isCollapsed && (
                                  <span className="truncate text-left font-medium leading-none">
                                    {item.label}
                                  </span>
                                )}
                              </div>
                              {!isCollapsed && (
                                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                  {item.badge !== undefined && (
                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${item.badgeColor}`}>
                                      {item.badge}
                                    </span>
                                  )}
                                  {hasSubItems && (
                                    <span 
                                      onClick={(e) => toggleSubmenu(item.id, e)}
                                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors"
                                    >
                                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isSubmenuExpanded ? 'rotate-180' : ''}`} />
                                    </span>
                                  )}
                                </div>
                              )}
                              {isCollapsed && item.badge !== undefined && (
                                <span className={`absolute top-1 right-1 min-w-3 h-3 px-0.5 text-[8px] leading-3 text-center font-black rounded-full ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>

                            {/* Sub-Items List */}
                            {hasSubItems && isSubmenuExpanded && !isCollapsed && (
                              <div className="ml-4 border-l border-slate-200 dark:border-slate-700/70 pl-2 space-y-0.5 py-1 animate-in fade-in duration-150">
                                {item.subItems!.filter(sub => {
                                  if (sub.adminOnly && !isSuperAdmin && currentUser?.role !== 'exam_department_manager') return false;
                                  return true;
                                }).map(sub => {
                                  const isSubActive = getSubActiveState(item.id, sub.id);

                                  return (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => {
                                        setActiveTab(item.id);
                                        if (item.id === 'marketing') setCurrentMarketingPage(sub.id);
                                        if (item.id === 'exam-department') setCurrentExamSubTab(sub.id);
                                        if (item.id === 'settings') setCurrentSettingsSubTab(sub.id);
                                        
                                        window.dispatchEvent(new CustomEvent(sub.eventKey, { detail: sub.id }));
                                        onCloseMobile?.();
                                      }}
                                      className={`w-full rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors flex items-center justify-between cursor-pointer ${
                                        isSubActive
                                          ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold'
                                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-teal-300'
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5 truncate">
                                        {React.createElement(sub.icon, { className: 'w-3 h-3 shrink-0' })}
                                        <span className="truncate">{sub.label}</span>
                                      </span>
                                      {isSubActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </nav>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop Collapse Toggle Footer */}
        <div className="hidden md:flex items-center justify-between px-3 py-2.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#111b21] shrink-0">
          {!isCollapsed && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 select-none">
              Collapse sidebar
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            className={`p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#202c33] transition-colors cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile Sidebar Footer: Logged in status */}
        <div className="md:hidden px-3 py-2.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#111b21] mt-auto shrink-0">
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
