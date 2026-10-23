import React from 'react';
import { MarketingContact, MarketingActivity, MarketingConsentEvent, ConsentStatus } from './types';
import { LifecycleBadge, ConsentBadge } from './MarketingBadges';
import { MarketingConversionModal } from './MarketingConversionModal';
import {
  X,
  Phone,
  MessageSquare,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  Send,
  Plus,
  Loader2,
  Info,
  User,
  Tag,
  Building2,
  Layers,
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

  // Listen to Escape key to close drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const rawPhoneDigits = contact?.normalizedPhone?.replace(/[^0-9]/g, '') || '';
  const coordinatorName = contact?.assignedOwner?.fullName;
  const coordinatorRole = contact?.assignedOwner?.roleTitle;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketing-drawer-title"
      >
        {/* Backdrop button - clicking outside closes drawer */}
        <button
          type="button"
          aria-label="Close contact drawer"
          onClick={onClose}
          className="absolute inset-0 w-full h-full bg-slate-950/75 backdrop-blur-xs cursor-default transition-opacity animate-in fade-in duration-150"
        />

        {/* Slide-over drawer container */}
        <aside className="absolute inset-y-0 right-0 flex h-full w-full max-w-xl flex-col bg-[#09111f] border-l border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
          {/* Top Drawer Header with Prominent Close (X) Icon */}
          <div className="px-6 py-5 border-b border-slate-800/90 bg-[#0b1625] shrink-0">
            {/* Top row: Badges and Close Button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-400 font-mono bg-teal-950/80 px-2.5 py-1 rounded-md border border-teal-800/60">
                  {contact?.serialNumber || 'MKT-CONTACT'}
                </span>
                {contact?.company && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {contact.company}
                  </span>
                )}
              </div>

              {/* Dedicated Prominent Close (X) Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="Close contact drawer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Middle row: Name and Phone */}
            <div className="mt-3">
              <h2 id="marketing-drawer-title" className="text-xl font-bold text-white tracking-tight">
                {contact?.name || 'Public Marketing Contact'}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-teal-300">
                  {contact?.normalizedPhone || (loading ? 'Loading phone...' : 'No number')}
                </span>
                {contact?.normalizedPhone && (
                  <button
                    type="button"
                    onClick={copyPhone}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copy phone"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                {copied && <span className="text-[11px] text-emerald-400 font-medium">Copied!</span>}
              </div>
            </div>

            {/* Direct Outreach Action Buttons: Call & WhatsApp */}
            {contact?.normalizedPhone && (
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <a
                  href={`tel:${contact.normalizedPhone}`}
                  className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call Contact
                </a>
                <a
                  href={`https://wa.me/${rawPhoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-xs hover:bg-teal-500/30 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                  WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Drawer Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                {/* Contact Ownership & Metadata Summary Card */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d182a] space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-500" /> Source & Group
                      </span>
                      <p className="font-medium text-slate-200 mt-0.5 truncate">
                        {contact.originalSource}
                      </p>
                      {contact.sourceGroupName && (
                        <p className="text-[10px] text-teal-400/90 font-mono truncate">
                          {contact.sourceGroupName}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" /> Assigned Coordinator
                      </span>
                      {coordinatorName ? (
                        <div className="mt-0.5">
                          <p className="font-semibold text-indigo-300 truncate">
                            {coordinatorName}
                          </p>
                          {coordinatorRole && (
                            <p className="text-[10px] text-slate-400 truncate">
                              {coordinatorRole}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 font-medium mt-0.5">Unassigned</p>
                      )}
                    </div>
                  </div>

                  {contact.tags && contact.tags.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                      <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                      {contact.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Badges & Quick Action Panel */}
                <div className="p-4 rounded-2xl border border-slate-800/90 bg-[#0d182a] shadow-inner shadow-black/10 space-y-3">
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
                    <span className="text-xs text-slate-400 font-semibold">Update pipeline status</span>
                    <select
                      disabled={isUpdatingStatus}
                      value={contact.lifecycleStatus}
                      onChange={e => handleStatusChange(e.target.value)}
                      className="rounded-lg bg-slate-950/70 border border-slate-700 text-xs text-white py-2 px-3 outline-none focus:border-teal-400"
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
                <div className="rounded-2xl border border-teal-400/35 bg-gradient-to-br from-teal-400/[0.11] via-[#0d1f2b] to-[#0d182a] p-5 space-y-3 shadow-[0_0_30px_rgba(20,184,166,0.06)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-teal-300 uppercase tracking-[0.14em] flex items-center gap-1.5">
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
                <div className="rounded-2xl border border-slate-800/90 bg-[#0d182a] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.12em] flex items-center gap-1.5">
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
                            className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs space-y-1.5"
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
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.12em]">
                    Interaction Notes & Timeline
                  </h4>

                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add follow-up notes, phone call summaries, or customer queries..."
                      className="w-full rounded-xl border border-slate-700/90 bg-[#0d182a] p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30"
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
        </aside>
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
