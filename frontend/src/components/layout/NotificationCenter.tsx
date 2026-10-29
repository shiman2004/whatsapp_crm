import React from 'react';
import { Bell, CalendarClock, CheckCheck, MessageSquare, Megaphone, Settings2, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { navigateToPath } from '../../config/navigation';
import { cn } from '../ui';

interface NotificationCenterProps {
  onOpenLead: (leadId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onOpenLead }) => {
  const {
    totalUnreadCountForUser,
    openUnreadChats,
    unreadBroadcastsCount,
    followups,
    desktopNotifications,
    dismissDesktopNotification,
    notifications,
    dismissNotification,
    setNotificationSettingsOpen,
  } = useCrm();

  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pendingFollowups = followups.filter((f) => f.status === 'pending').length;
  const unread = totalUnreadCountForUser || 0;
  const total = unread + unreadBroadcastsCount + pendingFollowups;

  const shortcut = (path: string) => {
    setOpen(false);
    navigateToPath(path);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={total > 0 ? `Notifications, ${total} pending` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-white dark:ring-[#0b141a]">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification center"
          className="absolute right-0 z-[70] mt-2 w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f1b26]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-white/5">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Notifications</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNotificationSettingsOpen(true);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <Settings2 className="h-3 w-3" /> Settings
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 border-b border-slate-100 p-2.5 dark:border-white/5">
            {[
              { label: 'Unread chats', value: unread, icon: MessageSquare, onClick: () => { setOpen(false); openUnreadChats(); navigateToPath('/inbox'); } },
              { label: 'Follow-ups', value: pendingFollowups, icon: CalendarClock, onClick: () => shortcut('/templates') },
              { label: 'Broadcasts', value: unreadBroadcastsCount, icon: Megaphone, onClick: () => shortcut('/broadcast') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="rounded-lg border border-slate-100 px-2 py-2 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-white/5 dark:hover:border-teal-500/30 dark:hover:bg-teal-500/5"
                >
                  <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-white">{item.value}</span>
                  <span className="block text-[9.5px] text-slate-500 dark:text-slate-400">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {desktopNotifications.length === 0 && notifications.length === 0 && (
              <div className="px-3 py-8 text-center">
                <CheckCheck className="mx-auto h-5 w-5 text-teal-500" />
                <p className="mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">You are all caught up</p>
                <p className="mt-0.5 text-[10px] text-slate-400">No unread WhatsApp alerts or system messages.</p>
              </div>
            )}

            {desktopNotifications.slice(0, 6).map((item) => (
              <div key={item.id} className="group flex items-start gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenLead(item.leadId);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{item.contactName}</p>
                  <p className="line-clamp-2 text-[10.5px] text-slate-500 dark:text-slate-400">{item.messageText || 'New WhatsApp message'}</p>
                  <p className="mt-0.5 text-[9.5px] text-slate-400">{item.timeDisplay}</p>
                </button>
                <button
                  type="button"
                  onClick={() => dismissDesktopNotification(item.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:text-slate-600 group-hover:opacity-100 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {notifications.slice(0, 4).map((item) => (
              <div key={item.id} className="group flex items-start gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0 dark:border-white/5">
                <span
                  className={cn(
                    'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                    item.type === 'lead' ? 'bg-teal-500' : item.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                  <p className="line-clamp-2 text-[10.5px] text-slate-500 dark:text-slate-400">{item.message}</p>
                  <p className="mt-0.5 text-[9.5px] text-slate-400">{item.timestamp}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissNotification(item.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:text-slate-600 group-hover:opacity-100 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
