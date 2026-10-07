import React, { useState } from 'react';
import { 
  Phone, 
  Sparkles, 
  Check, 
  Copy, 
  ExternalLink,
  ChevronDown,
  UserCheck,
  Globe
} from 'lucide-react';
import { Lead, LeadStage } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { WhatsAppCallModal } from './WhatsAppCallModal';

import { formatWhatsAppDisplay } from '../../utils/phoneUtils';

interface CustomerProfileCardProps {
  lead: Lead;
}

export const CustomerProfileCard: React.FC<CustomerProfileCardProps> = ({ lead }) => {
  const { 
    categories, 
    treatments, 
    users, 
    isSuperAdmin, 
    assignLead, 
    updateLeadStage 
  } = useCrm();

  const [copied, setCopied] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);

  const category = categories.find(c => c.id === lead.categoryId);
  const treatment = treatments.find(t => t.id === lead.treatmentId);
  const coordinator = users.find(u => u.id === lead.assignedTo);
  const coordinators = users.filter(u => u.role === 'coordinator');

  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);

  const copyPhone = () => {
    if (rawPhone) {
      navigator.clipboard.writeText(rawPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateLeadStage(lead.id, e.target.value as LeadStage);
  };

  const handleCoordinatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    assignLead(lead.id, e.target.value);
  };

  return (
    <div className="w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/70 p-3.5 space-y-3.5 overflow-y-auto max-h-full flex flex-col justify-between select-none">
      <div className="space-y-3">
        {/* Patient Photo & Info Header */}
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800/70">
          <div className="relative shrink-0">
            <img
              src={lead.customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={lead.customer?.displayName}
              className="w-10 h-10 rounded-full object-cover border border-teal-500/40 shadow"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 absolute bottom-0 right-0"></span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-xs text-slate-100 truncate">{lead.customer?.displayName}</h3>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span className="font-mono text-[10px] text-slate-300 truncate">{displayPhone || rawPhone}</span>
              {rawPhone && (
                <button 
                  onClick={copyPhone} 
                  className="text-slate-400 hover:text-teal-300 p-0.5"
                  title="Copy phone"
                >
                  {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lead Stage Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Lead Stage
          </label>
          <div className="relative">
            <select
              value={lead.stage}
              onChange={handleStageChange}
              className="w-full bg-slate-900 border border-slate-700/80 hover:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-100 outline-none transition-colors cursor-pointer appearance-none"
            >
              <option value="new">🟡 New Inquiry</option>
              <option value="assigned">🔵 Assigned</option>
              <option value="contacted">🟣 Contacted</option>
              <option value="interested">🟢 Interested</option>
              <option value="follow_up">🟣 Follow-Up Sequence</option>
              <option value="converted">🎉 Converted (Closed Won)</option>
              <option value="lost">🔴 Lost / Closed</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Coordinator Selector */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Assigned Coordinator
            </label>
            {isSuperAdmin && (
              <span className="text-[9px] text-gold-400 font-semibold">Change</span>
            )}
          </div>

          {isSuperAdmin ? (
            <div className="relative">
              <select
                value={lead.assignedTo || ''}
                onChange={handleCoordinatorChange}
                className="w-full bg-slate-900 border border-slate-700/80 hover:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-100 outline-none transition-colors cursor-pointer appearance-none"
              >
                <option value="" disabled>-- Select Coordinator --</option>
                {coordinators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.activeLeadsCount || 0} active)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-200 font-medium truncate">
                {coordinator ? coordinator.fullName : 'Unassigned'}
              </span>
            </div>
          )}
        </div>

        {/* Treatment & Clinical Details */}
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">Required Service:</span>
            <p className="font-bold text-teal-300 text-xs truncate mt-0.5">
              {treatment?.name || category?.name || 'General Consultation'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{category?.name}</p>
          </div>

          {treatment?.priceRange && (
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Package:</span>
              <span className="font-mono font-semibold text-emerald-400">{treatment.priceRange.split('/')[0]}</span>
            </div>
          )}

          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-amber-400" /> Language:
            </span>
            <span className="font-bold text-slate-200 uppercase">
              {lead.language === 'si' ? 'සිංහල' : lead.language === 'ta' ? 'தமிழ்' : 'English'}
            </span>
          </div>
        </div>
      </div>

      {/* Action shortcuts */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800/70">
        <button
          onClick={() => setShowCallModal(true)}
          className="w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Phone className="w-3 h-3" />
          <span>Call Patient</span>
        </button>

        <a
          href={`https://wa.me/${lead.customer?.whatsappNumber.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3 h-3 text-slate-400" />
          <span>Open WhatsApp Web</span>
        </a>
      </div>

      {showCallModal && (
        <WhatsAppCallModal lead={lead} onClose={() => setShowCallModal(false)} />
      )}
    </div>
  );
};
