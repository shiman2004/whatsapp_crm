import React from 'react';
import { 
  MessageSquare, 
  Phone, 
  CircleDashed, 
  Radio, 
  Users, 
  Sparkles, 
  Settings,
  Archive,
  Star
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

  const unreadCount = leads.filter(l => (l.unreadCount || 0) > 0).length || 62;

  return (
    <aside className="w-[60px] bg-[#202c33] border-r border-[#222e35] flex flex-col justify-between items-center py-3 select-none shrink-0 z-20">
      {/* Top Main Navigation Icons */}
      <div className="flex flex-col items-center gap-4 w-full">
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
              ? 'bg-[#374248] text-white' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
          }`}
          title="Calls"
        >
          <Phone className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-[#25D366] text-black font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
            6
          </span>
        </button>

        {/* Status / Stories Tab */}
        <button
          onClick={() => setActiveSection('status')}
          className={`relative p-2.5 rounded-full transition-all group ${
            activeSection === 'status' 
              ? 'bg-[#374248] text-white' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
          }`}
          title="Status"
        >
          <CircleDashed className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#25D366] ring-2 ring-[#202c33]" />
        </button>

        {/* Channels / Broadcast */}
        <button
          onClick={() => setActiveSection('channels')}
          className={`p-2.5 rounded-full transition-all ${
            activeSection === 'channels' 
              ? 'bg-[#374248] text-white' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
          }`}
          title="Channels"
        >
          <Radio className="w-5 h-5" />
        </button>

        {/* Communities */}
        <button
          onClick={() => setActiveSection('communities')}
          className={`p-2.5 rounded-full transition-all ${
            activeSection === 'communities' 
              ? 'bg-[#374248] text-white' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-white'
          }`}
          title="Communities"
        >
          <Users className="w-5 h-5" />
        </button>

        {/* Meta AI (Purple Gradient Icon from WhatsApp Web) */}
        <button
          onClick={() => setActiveSection('meta-ai')}
          className={`p-2.5 rounded-full transition-all relative ${
            activeSection === 'meta-ai' 
              ? 'bg-purple-900/40 text-purple-300 ring-1 ring-purple-500/50' 
              : 'text-[#aebac1] hover:bg-[#374248]/60 hover:text-purple-400'
          }`}
          title="Meta AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
        </button>
      </div>

      {/* Bottom Profile & Settings */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Starred */}
        <button
          onClick={() => setActiveSection('starred')}
          className="p-2.5 rounded-full text-[#aebac1] hover:bg-[#374248]/60 hover:text-white transition-all"
          title="Starred Messages"
        >
          <Star className="w-4 h-4" />
        </button>

        {/* Archived */}
        <button
          onClick={() => setActiveSection('archived')}
          className="p-2.5 rounded-full text-[#aebac1] hover:bg-[#374248]/60 hover:text-white transition-all"
          title="Archived Chats"
        >
          <Archive className="w-4 h-4" />
        </button>

        {/* Settings Gear */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-full text-[#aebac1] hover:bg-[#374248]/60 hover:text-white transition-all"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User Profile Avatar */}
        <div className="pt-1">
          <img
            src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={currentUser.fullName}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-emerald-500/60 cursor-pointer hover:scale-105 transition-transform"
            title={`${currentUser.fullName} (${currentUser.role})`}
          />
        </div>
      </div>
    </aside>
  );
};
