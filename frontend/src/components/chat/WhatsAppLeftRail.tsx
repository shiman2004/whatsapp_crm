import React from 'react';
import { 
  MessageSquare, 
  Settings,
  Sun,
  Moon
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { BlinkingBellNotification } from '../notifications/BlinkingBellNotification';

interface WhatsAppLeftRailProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  onOpenSettings?: () => void;
}

export const WhatsAppLeftRail: React.FC<WhatsAppLeftRailProps> = ({
  activeSection,
  setActiveSection,
  onOpenSettings
}) => {
  const { setChatListFilter, totalUnreadCountForUser, theme, toggleTheme } = useCrm();

  return (
    <aside className="hidden md:flex w-[68px] bg-[#f0f2f5] dark:bg-[#202c33] border-r border-[#d1d7db] dark:border-[#222e35] flex-col justify-between items-center py-2 select-none shrink-0 z-20">
      {/* Top Section: Blinking Bell Notification + Nav Icons */}
      <div className="flex flex-col items-center w-full">
        {/* 1. Real-Time Blinking & Glowing Notification Bell */}
        <div className="w-full flex flex-col items-center justify-center pt-1 pb-1">
          <BlinkingBellNotification variant="rail" />
        </div>

        {/* 2. Divider line between Bell and Chats */}
        <div className="w-8 h-[1px] bg-slate-300 dark:bg-[#2a3942]/60 my-2" />

        {/* 3. Chats Tab Icon Button */}
        <button
          onClick={() => {
            setActiveSection('chats');
            setChatListFilter('all');
          }}
          className={`relative p-2.5 rounded-full transition-all group cursor-pointer ${
            activeSection === 'chats' 
              ? 'bg-slate-300/80 dark:bg-[#374248] text-[#111b21] dark:text-white shadow-xs' 
              : 'text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200 dark:hover:bg-[#374248]/60 hover:text-[#111b21] dark:hover:text-white'
          }`}
          title="All Chats"
        >
          <MessageSquare className="w-5 h-5" />
          {totalUnreadCountForUser > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#25D366] text-black font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-md">
              {totalUnreadCountForUser > 99 ? '99+' : totalUnreadCountForUser}
            </span>
          )}
        </button>
      </div>

      {/* Bottom Navigation: Theme Toggle + Settings */}
      <div className="flex flex-col items-center gap-2.5 w-full pb-2">
        {/* Light / Dark Theme Quick Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200 dark:hover:bg-[#374248]/60 hover:text-[#111b21] dark:hover:text-white transition-all cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 text-slate-700 hover:-rotate-12 transition-transform" />
          )}
        </button>

        <button
          onClick={() => onOpenSettings ? onOpenSettings() : null}
          className="p-2.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200 dark:hover:bg-[#374248]/60 hover:text-[#111b21] dark:hover:text-white transition-all cursor-pointer"
          title="Notification Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
