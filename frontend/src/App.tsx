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
import { LoginScreen } from './components/auth/LoginScreen';

import { MessageSquare, KanbanSquare, LayoutDashboard, Menu } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { currentUser, setSelectedLeadId, selectedLeadId, leads, canAssignLeads } = useCrm();

  const unassignedCount = leads.filter(l => l.stage === 'new').length;
  const myAssignedCount = leads.filter(l => l.assignedTo === currentUser?.id).length;
  const badgeCount = canAssignLeads ? unassignedCount : myAssignedCount;

  // Protect Super Admin only tabs against direct navigation by other roles
  React.useEffect(() => {
    if (currentUser?.role !== 'super_admin' && (activeTab === 'coordinators' || activeTab === 'audit')) {
      setActiveTab('dashboard');
    }
  }, [currentUser?.role, activeTab]);

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveTab('chat');
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Header */}
      <Header 
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} 
      />

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
          activeTab === 'chat' ? 'p-0 bg-[#0b141a]' : 'p-3 sm:p-6 overflow-y-auto bg-slate-900/30'
        }`}>
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'leads-kanban' && <LeadsView onSelectLead={handleSelectLead} />}
          {activeTab === 'chat' && <LeadDetailWorkspace onBackToKanban={() => setActiveTab('leads-kanban')} />}
          {activeTab === 'treatments' && <TreatmentsManager />}
          {activeTab === 'coordinators' && currentUser?.role === 'super_admin' && <CoordinatorsManager />}
          {activeTab === 'templates' && <TemplatesManager />}
          {activeTab === 'reports' && <AnalyticsView />}
          {activeTab === 'audit' && <AuditLogsViewer />}
          {activeTab === 'webhook-sandbox' && <WebhookSimulatorPlayground />}
          {activeTab === 'architecture' && <ArchitectureBlueprint />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Hidden when inside active chat message composer) */}
      {!(activeTab === 'chat' && !!selectedLeadId) && (
        <nav className="md:hidden h-14 bg-[#111b21] border-t border-slate-800 flex items-center justify-around px-2 shrink-0 z-30 select-none">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'chat' ? 'text-whatsapp font-bold' : 'text-slate-400 hover:text-slate-200'
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
