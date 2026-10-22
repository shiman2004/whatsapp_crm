import React from 'react';
import { MarketingContact, MarketingActivity, MarketingConsentEvent, LifecycleStatus, ConsentStatus } from './types';
import { LifecycleBadge, ConsentBadge } from './MarketingBadges';
import { MarketingConversionModal } from './MarketingConversionModal';
import {
  X,
  Phone,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Sparkles,
  MessageSquare,
  Send,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface MarketingContactDrawerProps {
  contactId: string;
  onClose: () => void;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
  onContactUpdated: () => void;
}

export const MarketingContactDrawer: React.FC<MarketingContactDrawerProps> = ({
  contactId,
  onClose,
  onRequestApi,
  onContactUpdated,
}) => {
  const [contact, setContact] = React.useState<MarketingContact | null>(null);
  const [activities, setActivities] = React.useState<MarketingActivity[]>([]);
  const [consentEvents, setConsentEvents] = React.useState<MarketingConsentEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Interactive forms
  const [noteText, setNoteText] = React.useState('');
  const [submittingNote, setSubmittingNote] = React.useState(false);

  // Consent form
  const [isLoggingConsent, setIsLoggingConsent] = React.useState(false);
  const [newConsentStatus, setNewConsentStatus] = React.useState<ConsentStatus>('verified');
  const [consentEvidence, setConsentEvidence] = React.useState('');
  const [submittingConsent, setSubmittingConsent] = React.useState(false);

  // Status changer
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  // Conversion modal
  const [showConversionModal, setShowConversionModal] = React.useState(false);

  // Copy feedback
  const [copied, setCopied] = React.useState(false);

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await onRequestApi(`/api/marketing/contacts/${contactId}`);
      if (response?.data) {
        setContact(response.data.contact);
        setActivities(response.data.activities || []);
        setConsentEvents(response.data.consent || []);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactId, onRequestApi]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const copyPhone = () => {
    if (contact?.normalizedPhone) {
      navigator.clipboard.writeText(contact.normalizedPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!contact) return;
    setIsUpdatingStatus(true);
    try {
      await onRequestApi(`/api/marketing/contacts/${contact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      void loadDetail();
      onContactUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status update failed');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !noteText.trim()) return;

    setSubmittingNote(true);
    try {
      await onRequestApi(`/api/marketing/contacts/${contact.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setNoteText('');
      void loadDetail();
      onContactUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRecordConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !consentEvidence.trim()) return;

    setSubmittingConsent(true);
    try {
      await onRequestApi(`/api/marketing/contacts/${contact.id}/consent`, {
        method: 'POST',
        body: JSON.stringify({
          status: newConsentStatus,
          evidence: consentEvidence.trim(),
          purpose: 'Marketing outreach & consultation follow-up',
          channel: 'WhatsApp CRM',
        }),
      });
      setIsLoggingConsent(false);
      setConsentEvidence('');
      void loadDetail();
      onContactUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to record consent');
    } finally {
      setSubmittingConsent(false);
    }
  };

  const isEligibleForConversion =
    contact &&
    contact.consentStatus === 'verified' &&
    contact.lifecycleStatus === 'interested' &&
    !contact.convertedLeadId;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
        <div className="w-full max-w-xl bg-[#0D1526] border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
          {/* Top Drawer Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/70">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400">
                {contact?.serialNumber || 'Marketing Contact'}
              </span>
              <h2 className="text-base font-bold text-white mt-0.5 flex items-center gap-2 font-mono">
                {contact?.normalizedPhone || 'Loading...'}
                {contact?.normalizedPhone && (
                  <button
                    type="button"
                    onClick={copyPhone}
                    className="p-1 rounded text-slate-400 hover:text-white"
                    title="Copy phone"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                {copied && <span className="text-[10px] text-teal-300 font-sans font-bold">Copied!</span>}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {loading ? (
              <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                <span>Loading contact record...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs">
                {error}
              </div>
            ) : contact ? (
              <>
                {/* Status Badges & Quick Action Panel */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Lifecycle Status:</span>
                    <LifecycleBadge status={contact.lifecycleStatus} size="md" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Consent Status:</span>
                    <ConsentBadge status={contact.consentStatus} size="md" />
                  </div>

                  {/* Quick Status Dropdown */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">Update Status:</span>
                    <select
                      disabled={isUpdatingStatus}
                      value={contact.lifecycleStatus}
                      onChange={e => handleStatusChange(e.target.value)}
                      className="rounded bg-slate-900 border border-slate-700 text-xs text-white py-1 px-2.5 outline-none focus:border-teal-400"
                    >
                      <option value="new">New</option>
                      <option value="assigned">Assigned</option>
                      <option value="contacted">Contacted</option>
                      <option value="follow_up_pending">Follow-up Pending</option>
                      <option value="interested">Interested</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="no_response">No Response</option>
                      <option value="do_not_contact">Do Not Contact</option>
                    </select>
                  </div>
                </div>

                {/* Lead Conversion CTA Banner */}
                <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> CRM Lead Conversion
                    </span>
                    {contact.convertedLeadId && (
                      <span className="text-[10px] font-mono text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-800">
                        Lead Linked: {contact.convertedLeadId.slice(0, 8)}
                      </span>
                    )}
                  </div>

                  {contact.convertedLeadId ? (
                    <p className="text-xs text-slate-300">
                      This contact has been successfully converted into an active CRM sales lead.
                    </p>
                  ) : isEligibleForConversion ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300">
                        Contact is qualified (<strong className="text-emerald-300">Interested</strong>) with <strong className="text-emerald-300">Verified Consent</strong>. Ready to route into the CRM pipeline.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowConversionModal(true)}
                        className="w-full py-2.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Sparkles className="w-4 h-4" /> Convert to Qualified CRM Lead
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-300 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-amber-400" /> Conversion Protection Gate:
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        To route into the sales pipeline, contact must have <strong className="text-emerald-400">Verified Opt-in Consent</strong> and status set to <strong className="text-emerald-400">Interested</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Consent Management & Evidence Logger */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Consent Verification & Evidence
                    </h4>
                    {!isLoggingConsent && (
                      <button
                        type="button"
                        onClick={() => setIsLoggingConsent(true)}
                        className="text-xs text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Log Consent
                      </button>
                    )}
                  </div>

                  {isLoggingConsent ? (
                    <form onSubmit={handleRecordConsent} className="space-y-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">Consent Decision</span>
                        <select
                          value={newConsentStatus}
                          onChange={e => setNewConsentStatus(e.target.value as ConsentStatus)}
                          className="mt-1 w-full rounded bg-slate-900 border border-slate-700 text-xs text-white p-2 outline-none focus:border-teal-400"
                        >
                          <option value="verified">Verified Opt-in (Explicitly agreed)</option>
                          <option value="unknown">Pending / Unknown</option>
                          <option value="opted_out">Opted-out / Denied</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                          Verification Evidence / Proof <span className="text-rose-400">*</span>
                        </span>
                        <input
                          required
                          value={consentEvidence}
                          onChange={e => setConsentEvidence(e.target.value)}
                          placeholder="e.g. Replied YES to opt-in prompt / Booth inquiry form signed"
                          className="mt-1 w-full rounded bg-slate-900 border border-slate-700 text-xs text-white p-2 outline-none focus:border-teal-400"
                        />
                      </label>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsLoggingConsent(false)}
                          className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingConsent}
                          className="px-3 py-1.5 rounded bg-teal-400 text-slate-950 text-xs font-bold hover:bg-teal-300 flex items-center gap-1.5"
                        >
                          {submittingConsent && <Loader2 className="w-3 h-3 animate-spin" />}
                          Record Event
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-1.5">
                      {consentEvents.length === 0 ? (
                        <p className="text-xs text-slate-500">No consent events logged yet. Default status is pending.</p>
                      ) : (
                        consentEvents.map(evt => (
                          <div
                            key={evt.id}
                            className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <ConsentBadge status={evt.status} />
                              <span className="text-[10px] text-slate-500">
                                {new Date(evt.recordedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px]">&quot;{evt.evidence}&quot;</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Notes & Activity Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Interaction Notes & Timeline
                  </h4>

                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add follow-up notes, phone call summaries, or customer queries..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingNote || !noteText.trim()}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {submittingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Add Note
                      </button>
                    </div>
                  </form>

                  {/* Timeline list */}
                  <div className="space-y-2 pt-2">
                    {activities.length === 0 ? (
                      <p className="text-xs text-slate-500">No activity history logged yet.</p>
                    ) : (
                      activities.map(act => (
                        <div
                          key={act.id}
                          className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span className="font-bold text-slate-300 uppercase tracking-wider">
                              {act.type.replace('_', ' ')}
                            </span>
                            <span>{new Date(act.createdAt).toLocaleString()}</span>
                          </div>
                          {act.note && <p className="text-slate-300">{act.note}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Conversion Confirmation Modal */}
      {showConversionModal && contact && (
        <MarketingConversionModal
          contact={contact}
          onClose={() => setShowConversionModal(false)}
          onConverted={(convertedContact) => {
            setContact(convertedContact);
            void loadDetail();
            onContactUpdated();
          }}
          onRequestApi={onRequestApi}
        />
      )}
    </>
  );
};
