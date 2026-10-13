import React from 'react';
import { 
  MessageSquare, 
  Settings
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
  const { setChatListFilter, totalUnreadCountForUser } = useCrm();

  return (
    <aside className="hidden md:flex w-[68px] bg-[#202c33] border-r border-[#222e35] flex-col justify-between items-center py-2 select-none shrink-0 z-20">
      {/* Top Section: Blinking Bell Notification + Nav Icons */}
      <div className="flex flex-col items-center w-full">
        {/* 1. Real-Time Blinking & Glowing Notification Bell (Exact location beside WhatsApp heading) */}
        <div className="w-full flex flex-col items-center justify-center pt-1 pb-1">
          <BlinkingBellNotification variant="rail" />
        </div>

        {/* 2. Divider line between Bell and Chats */}
        <div className="w-8 h-[1px] bg-[#2a3942]/60 my-2" />

        {/* 3. Chats Tab Icon Button */}
        <button
          onClick={() => {
            setActiveSection('chats');
            setChatListFilter('all');
          }}
          className={`relative p-2.5 rounded-full transition-all group ${
            activeSection === 'chats' 
              ? 'bg-[#374248] text-white shadow-sm' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
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

      {/* Bottom Navigation: Settings */}
      <div className="flex flex-col items-center gap-3 w-full pb-2">
        <button
          onClick={() => onOpenSettings ? onOpenSettings() : null}
          className="p-2.5 rounded-full text-[#aebac1] hover:bg-[#374248]/60 hover:text-white transition-all cursor-pointer"
          title="Notification Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
