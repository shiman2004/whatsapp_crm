import React from 'react';
import { MarketingContact, MarketingLeadConversion } from './types';
import { Sparkles, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Loader2, X, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

interface MarketingConversionModalProps {
  contact: MarketingContact;
  onClose: () => void;
  onConverted: (convertedContact: MarketingContact, createdLeadId: string) => void;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

export const MarketingConversionModal: React.FC<MarketingConversionModalProps> = ({
  contact,
  onClose,
  onConverted,
  onRequestApi,
}) => {
  const { setActiveNavTab, setSelectedLeadId, currentUser } = useCrm();
  const [officerNote, setOfficerNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [duplicateLead, setDuplicateLead] = React.useState<any | null>(null);
  const [conversionRequest, setConversionRequest] = React.useState<MarketingLeadConversion | null>(null);
  const [successLead, setSuccessLead] = React.useState<any | null>(null);

  const handleInitialConvert = async () => {
    setSubmitting(true);
    setError('');
    try {
      // 1. Send conversion request with autoApprove flag
      const response = await onRequestApi(`/api/marketing/contacts/${contact.id}/conversion-request`, {
        method: 'POST',
        body: JSON.stringify({
          note: officerNote.trim() || undefined,
          autoApprove: true,
        }),
      });

      const data = response?.data;
      if (data?.duplicate) {
        // Duplicate CRM Lead detected!
        setDuplicateLead(data.lead);
        setConversionRequest(data.conversion);
      } else if (data?.lead) {
        // Direct conversion succeeded!
        setSuccessLead(data.lead);
        onConverted(
          { ...contact, lifecycleStatus: 'converted', convertedLeadId: data.lead.id },
          data.lead.id
        );
      } else if (data?.status === 'pending') {
        // Conversion request submitted for admin review
        setConversionRequest(data);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Conversion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkExisting = async () => {
    if (!conversionRequest) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await onRequestApi(`/api/marketing/conversion-requests/${conversionRequest.id}/link-existing`, {
        method: 'POST',
      });

      if (response?.data?.lead) {
        setSuccessLead(response.data.lead);
        onConverted(
          { ...contact, lifecycleStatus: 'converted', convertedLeadId: response.data.lead.id },
          response.data.lead.id
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Linking existing lead failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNavigateToLead = () => {
    if (successLead?.id) {
      setSelectedLeadId(successLead.id);
      setActiveNavTab('leads-kanban');
      onClose();
    }
  };

  const handleOpenChat = () => {
    if (successLead?.id) {
      setSelectedLeadId(successLead.id);
      setActiveNavTab('chat');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0D1526] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Convert to CRM Lead</h3>
              <p className="text-xs text-slate-400 font-mono">{contact.normalizedPhone} • {contact.serialNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Succeeded view */}
          {successLead ? (
            <div className="p-5 rounded-xl border border-teal-500/40 bg-teal-500/10 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-teal-400 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white">Conversion Complete!</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Contact has been converted into the active CRM sales pipeline with Serial{' '}
                  <strong className="text-teal-300 font-mono">#{successLead.serialNumber || successLead.id?.slice(0, 8)}</strong>.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open CRM Live Chat</span>
                </button>
                <button
                  type="button"
                  onClick={handleNavigateToLead}
                  className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold text-xs hover:bg-teal-500/30 inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Open in Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : duplicateLead ? (
            /* Duplicate lead detected view */
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Existing Lead Match Detected</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A lead with phone <strong className="font-mono text-white">{contact.normalizedPhone}</strong> already exists in the <strong className="text-white">{duplicateLead.company}</strong> pipeline.
                </p>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                  Lead Serial: #{duplicateLead.serialNumber} • Stage: {duplicateLead.stage}
                </div>
              </div>

              <p className="text-xs text-slate-400">
                To prevent duplicate customer records, you can link this marketing contact and attribute the acquisition to the existing lead.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleLinkExisting}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 inline-flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                  Link & Append Marketing Activity
                </button>
              </div>
            </div>
          ) : (
            /* Normal conversion form */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Target Company Scope:</span>
                  <strong className="text-white">{contact.company || currentUser?.company || 'RWC'}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Contact Source:</span>
                  <strong className="text-white">{contact.originalSource}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Consent Status:</span>
                  <span className="text-emerald-400 font-bold">Verified Opt-in</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pipeline Stage:</span>
                  <strong className="text-teal-300">New Qualified Lead</strong>
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-300">
                  Qualification Note for Patient Coordinators / Counsellors
                </span>
                <textarea
                  rows={3}
                  value={officerNote}
                  onChange={e => setOfficerNote(e.target.value)}
                  placeholder="e.g. Prospect inquired about knee pain therapy; requested consultation callback on Saturday."
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleInitialConvert}
                  className="px-4 py-2 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 inline-flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Route to Pipeline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
