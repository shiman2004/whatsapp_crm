import React, { useState } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { ToastContainer } from './components/layout/ToastContainer';
import { WhatsAppSimulator } from './components/simulator/WhatsAppSimulator';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { LeadsView } from './components/leads/LeadsView';
import { LeadDetailWorkspace } from './components/chat/LeadDetailWorkspace';
import { TreatmentsManager } from './components/admin/TreatmentsManager';
import { CoordinatorsManager } from './components/admin/CoordinatorsManager';
import { TemplatesManager } from './components/admin/TemplatesManager';
import { AuditLogsViewer } from './components/admin/AuditLogsViewer';
import { ArchitectureBlueprint } from './components/admin/ArchitectureBlueprint';
import { WebhookSimulatorPlayground } from './components/admin/WebhookSimulatorPlayground';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const { setSelectedLeadId } = useCrm();

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveTab('chat');
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Header */}
      <Header />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dynamic Workspace Panel */}
        <main className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
          activeTab === 'chat' ? 'p-0 bg-[#0b141a]' : 'p-6 overflow-y-auto bg-slate-900/30'
        }`}>
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'leads-kanban' && <LeadsView onSelectLead={handleSelectLead} />}
          {activeTab === 'chat' && <LeadDetailWorkspace onBackToKanban={() => setActiveTab('leads-kanban')} />}
          {activeTab === 'treatments' && <TreatmentsManager />}
          {activeTab === 'coordinators' && <CoordinatorsManager />}
          {activeTab === 'templates' && <TemplatesManager />}
          {activeTab === 'reports' && <DashboardOverview />}
          {activeTab === 'audit' && <AuditLogsViewer />}
          {activeTab === 'webhook-sandbox' && <WebhookSimulatorPlayground />}
          {activeTab === 'architecture' && <ArchitectureBlueprint />}
        </main>
      </div>

      {/* WhatsApp Interactive Mobile Phone Simulator */}
      <WhatsAppSimulator />

      {/* Real-time Toasts */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <CrmProvider>
      <MainLayout />
    </CrmProvider>
  );
}
