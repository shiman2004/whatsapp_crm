import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { LeadsView } from './components/leads/LeadsView';
import { LeadDetailWorkspace } from './components/chat/LeadDetailWorkspace';
import { LoginScreen } from './components/auth/LoginScreen';
import { ToastContainer } from './components/layout/ToastContainer';
import {
  dispatchIntent,
  isNavItemVisible,
  resolveRoute,
  routeForTab,
  navigateToPath,
  type NavTab,
} from './config/navigation';
import { useHashPath } from './hooks/useHashRoute';
import { EmptyState, InlineLoader } from './components/ui';
import { Compass } from 'lucide-react';

// Lazy-loaded secondary & admin modules for code-splitting and small initial chunk sizes
const AnalyticsView = lazy(() => import('./components/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
const TreatmentsManager = lazy(() => import('./components/admin/TreatmentsManager').then((m) => ({ default: m.TreatmentsManager })));
const TemplatesManager = lazy(() => import('./components/admin/TemplatesManager').then((m) => ({ default: m.TemplatesManager })));
const AuditLogsViewer = lazy(() => import('./components/admin/AuditLogsViewer').then((m) => ({ default: m.AuditLogsViewer })));
const ArchitectureBlueprint = lazy(() => import('./components/admin/ArchitectureBlueprint').then((m) => ({ default: m.ArchitectureBlueprint })));
const StudentExamPage = lazy(() => import('./components/StudentExamPage').then((m) => ({ default: m.StudentExamPage })));
const WebhookSimulatorPlayground = lazy(() => import('./components/admin/WebhookSimulatorPlayground').then((m) => ({ default: m.WebhookSimulatorPlayground })));
const SuperAdminSettingsView = lazy(() => import('./components/admin/SuperAdminSettings/SuperAdminSettingsView').then((m) => ({ default: m.SuperAdminSettingsView })));
const SecurityAccessView = lazy(() => import('./components/admin/SecurityAccessView').then((m) => ({ default: m.SecurityAccessView })));
const UserManagementView = lazy(() => import('./components/admin/user-management/UserManagementView').then((m) => ({ default: m.UserManagementView })));
const TeamBroadcastView = lazy(() => import('./components/broadcast/TeamBroadcastView').then((m) => ({ default: m.TeamBroadcastView })));
const AppointmentSchedulerView = lazy(() => import('./components/appointments/AppointmentSchedulerView').then((m) => ({ default: m.AppointmentSchedulerView })));
const MarketingModule = lazy(() => import('./components/marketing/MarketingModule').then((m) => ({ default: m.MarketingModule })));
const ExamDepartmentWorkspace = lazy(() => import('./components/exam/ExamDepartmentWorkspace').then((m) => ({ default: m.ExamDepartmentWorkspace })));
const StudentPortal = lazy(() => import('./components/exam/StudentPortal').then((m) => ({ default: m.StudentPortal })));
const PatientAssessmentWorkspace = lazy(() => import('./components/clinical/PatientAssessmentWorkspace').then((m) => ({ default: m.PatientAssessmentWorkspace })));

const NotFound: React.FC = () => (
  <div className="mx-auto mt-10 w-full max-w-xl">
    <EmptyState
      icon={Compass}
      title="This page is not available"
      description="The link is unknown or you do not have access to this module. Choose a destination from the navigation."
      action={
        <button
          type="button"
          onClick={() => navigateToPath('/dashboard')}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 dark:ring-offset-[#0b141a]"
        >
          Go to dashboard
        </button>
      }
    />
  </div>
);

const MainLayout: React.FC = () => {
  const { currentUser, setSelectedLeadId, setActiveNavTab, activeNavTab } = useCrm();
  const path = useHashPath();
  const route = resolveRoute(path);
  const previousTab = useRef<NavTab>(activeNavTab);

  // 1. URL → active module. The URL is the source of truth.
  useEffect(() => {
    if (!route) return;
    if (!isNavItemVisible(route.item, currentUser)) {
      navigateToPath('/dashboard');
      return;
    }
    if (activeNavTab !== route.item.id) setActiveNavTab(route.item.id);
    dispatchIntent(route);
    // activeNavTab intentionally omitted: it is updated here, not read to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, currentUser?.role, currentUser?.marketingAccess]);

  // 2. Programmatic module change (mobile nav, cross-module actions) → URL.
  useEffect(() => {
    if (previousTab.current === activeNavTab) return;
    previousTab.current = activeNavTab;
    const current = resolveRoute(window.location.hash.replace(/^#/, '') || '/dashboard');
    if (current?.item.id === activeNavTab) return;
    window.history.replaceState(null, '', `#${routeForTab(activeNavTab)}`);
    window.dispatchEvent(new Event('hashchange'));
  }, [activeNavTab]);

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveNavTab('chat');
    navigateToPath('/inbox');
  };

  const isAllowed = !route || isNavItemVisible(route.item, currentUser);
  // Render from the URL so deep links paint the right module on first frame.
  const activeModule: NavTab = route?.item.id ?? activeNavTab;

  const renderModule = () => {
    if (!route) return <NotFound />;
    if (!isAllowed) return <NotFound />;

    switch (activeModule) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'leads-kanban':
        return <LeadsView onSelectLead={handleSelectLead} />;
      case 'chat':
        return <LeadDetailWorkspace onBackToKanban={() => navigateToPath('/leads/all')} />;
      case 'appointment-rooms':
        return <AppointmentSchedulerView />;
      case 'marketing':
        return <MarketingModule />;
      case 'settings':
        return currentUser?.role === 'super_admin' ? <SuperAdminSettingsView /> : <NotFound />;
      case 'security-access':
        return currentUser?.role === 'super_admin' ? <SecurityAccessView /> : <NotFound />;
      case 'user-management':
      case 'coordinators':
        return currentUser?.role === 'super_admin' ? <UserManagementView /> : <NotFound />;
      case 'treatments':
        return currentUser?.role === 'super_admin' ? <TreatmentsManager /> : <NotFound />;
      case 'templates':
        return <TemplatesManager />;
      case 'broadcast':
        return <TeamBroadcastView />;
      case 'reports':
        return currentUser?.role === 'super_admin' ? <AnalyticsView /> : <NotFound />;
      case 'audit':
        return currentUser?.role === 'super_admin' ? <AuditLogsViewer /> : <NotFound />;
      case 'webhook-sandbox':
        return currentUser?.role === 'super_admin' ? <WebhookSimulatorPlayground /> : <NotFound />;
      case 'exam-department':
        return ['super_admin', 'coordinator', 'leads_officer', 'exam_department_manager', 'exam_coordinator', 'exam_providing_officer'].includes(currentUser?.role || '') ? (
          <ExamDepartmentWorkspace initialSubTab={route.child?.id ?? 'operations'} />
        ) : (
          <NotFound />
        );
      case 'patient-assessment':
        return ['super_admin', 'clinical_nurse', 'clinical_doctor', 'report_analyst'].includes(currentUser?.role || '') ? (
          <PatientAssessmentWorkspace />
        ) : (
          <NotFound />
        );
      case 'exam':
        return <StudentExamPage />;
      case 'architecture':
        return currentUser?.role === 'super_admin' ? <ArchitectureBlueprint /> : <NotFound />;
      default:
        return <NotFound />;
    }
  };

  return (
    <AppShell activeTab={activeNavTab} onSelectLead={handleSelectLead}>
      <Suspense fallback={<InlineLoader label="Loading workspace module…" />}>{renderModule()}</Suspense>
    </AppShell>
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
  const [hash, setHash] = React.useState(() => window.location.hash);
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const isStudent =
    window.location.pathname.startsWith('/student') ||
    hash.startsWith('#/student') ||
    hash === '#student';

  if (isStudent) {
    return (
      <Suspense fallback={<InlineLoader label="Loading student portal…" />}>
        <StudentPortal />
      </Suspense>
    );
  }
  return (
    <CrmProvider>
      <RootApp />
    </CrmProvider>
  );
}
