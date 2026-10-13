import React, { useState, useEffect } from 'react';
import { Bell, X, Sparkles } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { requestDesktopNotificationPermission, showDesktopNativeNotification } from '../../utils/nativeNotificationUtils';
import { playWhatsAppChime } from '../../utils/soundUtils';

export const DesktopNotificationBanner: React.FC = () => {
  const { updateNotificationSettings } = useCrm();
  const [showBanner, setShowBanner] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    // Check if dismissed before
    const isDismissed = sessionStorage.getItem('rw_notif_banner_dismissed') === 'true';
    if (Notification.permission === 'default' && !isDismissed) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  const handleEnable = async () => {
    const permission = await requestDesktopNotificationPermission();
    if (permission === 'granted') {
      updateNotificationSettings({ nativeBrowser: true });
      setShowBanner(false);
      playWhatsAppChime();
      showDesktopNativeNotification('Royal Wellness CRM — Active 🌿', {
        body: "Windows desktop notifications enabled! You'll receive alerts even when using other websites or apps.",
        icon: '/logo.png',
      });
    } else {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('rw_notif_banner_dismissed', 'true');
  };

  return (
    <div className="bg-[#182229] border-b border-[#00a884]/40 px-4 py-2.5 flex items-center justify-between text-xs text-[#d1d7db] shadow-md z-30 select-none animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center shrink-0">
          <Bell className="w-3.5 h-3.5" />
        </div>
        <p className="leading-tight">
          <strong className="text-white">Get notified of new WhatsApp messages</strong>
          <span className="text-[#8696a0] ml-1.5 hidden sm:inline">
            Receive desktop alerts on your screen even when browsing other websites or apps.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          type="button"
          onClick={handleEnable}
          className="px-3 py-1 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-slate-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <Sparkles className="w-3 h-3" />
          <span>Turn On</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-[#8696a0] hover:text-white rounded-md hover:bg-[#374248] transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
