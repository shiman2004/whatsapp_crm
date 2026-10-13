import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Volume2, 
  Globe, 
  Eye, 
  Play, 
  Sparkles, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { playWhatsAppChime } from '../../utils/soundUtils';

import { requestDesktopNotificationPermission, showDesktopNativeNotification } from '../../utils/nativeNotificationUtils';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    notificationSettings, 
    updateNotificationSettings, 
    dispatchTestNotification 
  } = useCrm();

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestNativePermission = async () => {
    const permission = await requestDesktopNotificationPermission();
    setBrowserPermission(permission);
    if (permission === 'granted') {
      updateNotificationSettings({ nativeBrowser: true });
      showDesktopNativeNotification('Royal Wellness WhatsApp CRM', {
        body: "Windows desktop notifications enabled! You'll receive alerts even when using other websites or apps.",
        icon: '/logo.png'
      });
    } else {
      updateNotificationSettings({ nativeBrowser: false });
    }
  };

  const handleTestSound = () => {
    playWhatsAppChime();
  };

  const handleTestNotification = () => {
    dispatchTestNotification();
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#202c33] border border-[#2a3942] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#182229] border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#e9edef]">Desktop Notifications</h3>
              <p className="text-[11px] text-[#8696a0]">Configure WhatsApp alerts & popups</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#374248] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-4 text-xs text-[#d1d7db]">
          {/* 1. In-App Desktop Popups */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#111b21] border border-[#2a3942]/60">
            <div className="flex items-start gap-3">
              <Bell className="w-4 h-4 text-[#00a884] mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-[#e9edef] block">In-App Desktop Popups</span>
                <span className="text-[11px] text-[#8696a0] block leading-relaxed">
                  Show WhatsApp Web-style popup card at the bottom-right corner when messages arrive.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
              <input
                type="checkbox"
                checked={notificationSettings.enabled}
                onChange={(e) => updateNotificationSettings({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#374248] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00a884]"></div>
            </label>
          </div>

          {/* 2. Notification Chime Sound */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#111b21] border border-[#2a3942]/60">
            <div className="flex items-start gap-3">
              <Volume2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-[#e9edef] block">Message Notification Sound</span>
                <span className="text-[11px] text-[#8696a0] block leading-relaxed">
                  Play gentle WhatsApp tone when a new incoming message is received.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <button
                type="button"
                onClick={handleTestSound}
                className="p-1 px-2 rounded-lg bg-[#202c33] hover:bg-[#374248] text-slate-300 hover:text-white border border-[#2a3942] text-[10px] flex items-center gap-1 transition-all"
                title="Test audio chime"
              >
                <Play className="w-3 h-3 text-sky-400" />
                <span>Test</span>
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings.sound}
                  onChange={(e) => updateNotificationSettings({ sound: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#374248] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00a884]"></div>
              </label>
            </div>
          </div>

          {/* 3. Native Browser Notifications (When tab in background) */}
          <div className="p-3 rounded-xl bg-[#111b21] border border-[#2a3942]/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-[#e9edef] block">Native Browser Notifications</span>
                  <span className="text-[11px] text-[#8696a0] block leading-relaxed">
                    Show Windows/macOS desktop banner when CRM tab is in background or minimized.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                  type="checkbox"
                  checked={notificationSettings.nativeBrowser && browserPermission === 'granted'}
                  disabled={browserPermission !== 'granted'}
                  onChange={(e) => updateNotificationSettings({ nativeBrowser: e.target.checked })}
                  className="sr-only peer disabled:opacity-50"
                />
                <div className="w-10 h-5 bg-[#374248] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00a884]"></div>
              </label>
            </div>

            {/* Permission Status Box */}
            <div className="pt-1 flex items-center justify-between text-[11px] border-t border-[#2a3942]/40">
              <span className="text-[#8696a0]">
                Permission Status: {' '}
                <strong className={
                  browserPermission === 'granted' ? 'text-emerald-400' :
                  browserPermission === 'denied' ? 'text-rose-400' : 'text-amber-400'
                }>
                  {browserPermission === 'granted' ? 'Granted' : browserPermission === 'denied' ? 'Denied by Browser' : 'Not Requested'}
                </strong>
              </span>

              {browserPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestNativePermission}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors"
                >
                  Enable Permissions
                </button>
              )}
            </div>
            {browserPermission === 'denied' && (
              <p className="text-[10px] text-rose-300/80 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                <span>To receive native alerts, click the lock icon in your browser address bar and set Notifications to Allow.</span>
              </p>
            )}
          </div>

          {/* 4. Message Content Preview */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#111b21] border border-[#2a3942]/60">
            <div className="flex items-start gap-3">
              <Eye className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-[#e9edef] block">Show Message Preview</span>
                <span className="text-[11px] text-[#8696a0] block leading-relaxed">
                  Display the message text preview inside the notification popup.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
              <input
                type="checkbox"
                checked={notificationSettings.showPreview}
                onChange={(e) => updateNotificationSettings({ showPreview: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#374248] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00a884]"></div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#182229] border-t border-[#2a3942] flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestNotification}
            className="px-3 py-1.5 rounded-xl bg-[#202c33] hover:bg-[#374248] text-emerald-400 border border-[#2a3942] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Send Test Notification</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
