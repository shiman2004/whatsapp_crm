import React from 'react';
import { 
  MessageSquare, 
  Phone, 
  Settings
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

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
  const { currentUser, leads } = useCrm();

  const unreadCount = leads.filter(l => (l.unreadCount || 0) > 0).length;

  return (
    <aside className="w-[60px] bg-[#202c33] border-r border-[#222e35] flex flex-col justify-between items-center py-4 select-none shrink-0 z-20">
      {/* Top Navigation Icons */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Chats Tab */}
        <button
          onClick={() => setActiveSection('chats')}
          className={`relative p-2.5 rounded-full transition-all group ${
            activeSection === 'chats' 
              ? 'bg-[#374248] text-white shadow-sm' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
          }`}
          title="Chats"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#25D366] text-black font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-md">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Calls Tab */}
        <button
          onClick={() => setActiveSection('calls')}
          className={`relative p-2.5 rounded-full transition-all group ${
            activeSection === 'calls' 
              ? 'bg-[#374248] text-white shadow-sm' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
          }`}
          title="Calls"
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Profile & Settings */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Settings Gear */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-full text-[#aebac1] hover:bg-[#374248]/60 hover:text-white transition-all"
          title="Settings & CRM Details"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User Profile Avatar */}
        <div>
          <img
            src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={currentUser.fullName}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/60 cursor-pointer hover:scale-105 transition-transform"
            title={`${currentUser.fullName} (${currentUser.role})`}
          />
        </div>
      </div>
    </aside>
  );
};
