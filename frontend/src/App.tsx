import React, { useState } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { ToastContainer } from './components/layout/ToastContainer';
import { WhatsAppSimulator } from './components/simulator/WhatsAppSimulator';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { LeadsView } from './components/leads/LeadsView';
import { LeadDetailWorkspace } from './components/chat/LeadDetailWorkspace';
import { TreatmentsManager } from './components/admin/TreatmentsManager';
import { CoordinatorsManager } from './components/admin/CoordinatorsManager';
import { TemplatesManager } from './components/admin/TemplatesManager';
import { AuditLogsViewer } from './components/admin/AuditLogsViewer';
import { ArchitectureBlueprint } from './components/admin/ArchitectureBlueprint';
import { WebhookSimulatorPlayground } from './components/admin/WebhookSimulatorPlayground';
import { SuperAdminSettingsView } from './components/admin/SuperAdminSettings/SuperAdminSettingsView';
import { TeamBroadcastView } from './components/broadcast/TeamBroadcastView';
import { AppointmentSchedulerView } from './components/appointments/AppointmentSchedulerView';
import { LoginScreen } from './components/auth/LoginScreen';

import { MessageSquare, KanbanSquare, LayoutDashboard, Menu } from 'lucide-react';
import { NotificationContainer } from './components/notifications/NotificationContainer';
import { NotificationSettingsModal } from './components/notifications/NotificationSettingsModal';
import { DesktopNotificationBanner } from './components/notifications/DesktopNotificationBanner';

const MainLayout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { 
    currentUser, 
    setSelectedLeadId, 
    selectedLeadId, 
    leads, 
    canAssignLeads,
    notificationSettingsOpen,
    setNotificationSettingsOpen,
    activeNavTab,
    setActiveNavTab
  } = useCrm();

  const activeTab = activeNavTab;
  const setActiveTab = setActiveNavTab;

  const unassignedCount = leads.filter(l => l.stage === 'new').length;
  const myAssignedCount = leads.filter(l => l.assignedTo === currentUser?.id).length;
  const badgeCount = canAssignLeads ? unassignedCount : myAssignedCount;

  // Protect Super Admin only tabs against direct navigation by other roles
  React.useEffect(() => {
    const adminOnlyTabs: NavTab[] = [
      'settings',
      'coordinators',
      'audit',
      'treatments',
      'reports',
      'webhook-sandbox',
      'architecture'
    ];
    if (currentUser?.role !== 'super_admin' && adminOnlyTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [currentUser?.role, activeTab]);

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveTab('chat');
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none transition-colors">
      {/* Header */}
      <Header 
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} 
      />

      {/* WhatsApp Web Desktop Notification Permission Banner (shown if not yet granted) */}
      <DesktopNotificationBanner />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Workspace Panel */}
        <main className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
          activeTab === 'chat' ? 'p-0 bg-[#efeae2] dark:bg-[#0b141a]' : 
          activeTab === 'appointment-rooms' ? 'p-0 overflow-hidden bg-slate-950' : 
          'p-3 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900/30'
        }`}>
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'leads-kanban' && <LeadsView onSelectLead={handleSelectLead} />}
          {activeTab === 'chat' && <LeadDetailWorkspace onBackToKanban={() => setActiveTab('leads-kanban')} />}
          {activeTab === 'appointment-rooms' && <AppointmentSchedulerView />}
          {activeTab === 'settings' && currentUser?.role === 'super_admin' && <SuperAdminSettingsView />}
          {activeTab === 'treatments' && currentUser?.role === 'super_admin' && <TreatmentsManager />}
          {activeTab === 'coordinators' && currentUser?.role === 'super_admin' && <CoordinatorsManager />}
          {activeTab === 'templates' && <TemplatesManager />}
          {activeTab === 'broadcast' && <TeamBroadcastView />}
          {activeTab === 'reports' && currentUser?.role === 'super_admin' && <AnalyticsView />}
          {activeTab === 'audit' && currentUser?.role === 'super_admin' && <AuditLogsViewer />}
          {activeTab === 'webhook-sandbox' && currentUser?.role === 'super_admin' && <WebhookSimulatorPlayground />}
          {activeTab === 'architecture' && currentUser?.role === 'super_admin' && <ArchitectureBlueprint />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden when inside active chat message composer) */}
      {!(activeTab === 'chat' && !!selectedLeadId) && (
        <nav className="md:hidden h-14 bg-white dark:bg-[#111b21] border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 shrink-0 z-30 select-none">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'chat' ? 'text-whatsapp font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {badgeCount > 0 && (
                <span className="absolute -top-1 -right-2.5 bg-whatsapp text-slate-950 font-black text-[9px] min-w-[15px] h-[15px] px-0.5 rounded-full flex items-center justify-center shadow-xs">
                  {badgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leads-kanban')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'leads-kanban' ? 'text-whatsapp font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KanbanSquare className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'text-whatsapp font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Menu</span>
          </button>
        </nav>
      )}

      {/* WhatsApp Interactive Mobile Phone Simulator */}
      <WhatsAppSimulator />

      {/* Real-time Toasts */}
      <ToastContainer />

      {/* WhatsApp Web Desktop Notification Card Popups (Bottom-Right Viewport) */}
      <NotificationContainer onNavigateToChat={(leadId) => handleSelectLead(leadId)} />

      {/* Desktop Notification Settings Modal */}
      <NotificationSettingsModal 
        isOpen={notificationSettingsOpen} 
        onClose={() => setNotificationSettingsOpen(false)} 
      />
    </div>
  );
};

const RootApp: React.FC = () => {
  const { isAuthenticated } = useCrm();

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  return <MainLayout />;
};

export default function App() {
  return (
    <CrmProvider>
      <RootApp />
    </CrmProvider>
  );
}
