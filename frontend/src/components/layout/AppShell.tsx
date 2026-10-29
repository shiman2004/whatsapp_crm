import React from 'react';
import { LayoutDashboard, Menu, MessageSquare, SquareKanban } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './ToastContainer';
import { NotificationContainer } from '../notifications/NotificationContainer';
import { NotificationSettingsModal } from '../notifications/NotificationSettingsModal';
import { DesktopNotificationBanner } from '../notifications/DesktopNotificationBanner';
import { ExamHandoffRequestModal } from '../exam/ExamHandoffRequestModal';
import { WhatsAppSimulator } from '../simulator/WhatsAppSimulator';
import { navigateToPath, routeForTab, type NavTab } from '../../config/navigation';
import { cn } from '../ui';

interface AppShellProps {
  activeTab: NavTab;
  children: React.ReactNode;
  onSelectLead: (leadId: string) => void;
}

const BOTTOM_NAV: Array<{ tab: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { tab: 'chat', label: 'Inbox', icon: MessageSquare },
  { tab: 'leads-kanban', label: 'Pipeline', icon: SquareKanban },
  { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export const AppShell: React.FC<AppShellProps> = ({ activeTab, children, onSelectLead }) => {
  const {
    setActiveNavTab,
    notificationSettingsOpen,
    setNotificationSettingsOpen,
    totalUnreadCountForUser,
    selectedLeadId,
  } = useCrm();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navigate = (tab: NavTab) => {
    setActiveNavTab(tab);
    navigateToPath(routeForTab(tab));
  };

  const unread = totalUnreadCountForUser || 0;

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-[#F5F7F8] font-sans text-[#111B21] transition-colors dark:bg-[#111B21] dark:text-[#E9EDEF]">
      <Header onToggleMobileSidebar={() => setMobileOpen((v) => !v)} onOpenLead={onSelectLead} />

      <DesktopNotificationBanner />
      <ExamHandoffRequestModal />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => navigate(tab)}
          isMobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            activeTab === 'chat'
              ? 'bg-[#ECE5DD] p-0 dark:bg-[#111B21]'
              : activeTab === 'appointment-rooms'
              ? 'overflow-hidden bg-[#F5F7F8] p-0 dark:bg-[#111B21]'
              : 'overflow-y-auto bg-[#F5F7F8] p-3 sm:p-5 dark:bg-[#111B21]',
          )}
        >
          {children}
        </main>
      </div>

      {!(activeTab === 'chat' && !!selectedLeadId) && (
        <nav
          aria-label="Quick navigation"
          className="z-30 flex h-14 shrink-0 items-center justify-around border-t border-[#E0E5E7] bg-white px-2 md:hidden dark:border-[#222D34] dark:bg-[#202C33]"
        >
          {BOTTOM_NAV.map(({ tab, label, icon: Icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => navigate(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 transition-colors',
                  isActive ? 'text-[#128C7E] dark:text-[#25D366] font-semibold' : 'text-[#667781] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]',
                )}
              >
                <Icon className="h-5 w-5" />
                {tab === 'chat' && unread > 0 && (
                  <span className="absolute right-1.5 top-0 min-w-[15px] rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 text-[#667781] transition-colors hover:text-[#111B21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]"
            aria-label="Open full menu"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      )}

      <ToastContainer />
      <NotificationContainer />
      <WhatsAppSimulator />
      {notificationSettingsOpen && (
        <NotificationSettingsModal
          isOpen={notificationSettingsOpen}
          onClose={() => setNotificationSettingsOpen(false)}
        />
      )}
    </div>
  );
};
