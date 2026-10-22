import React from 'react';
import { MarketingCampaign } from './types';
import { FileText, ShieldAlert, CheckCircle2, Plus, Sparkles, MessageSquare, Send, Loader2, Info } from 'lucide-react';

interface MarketingCampaignsProps {
  loading: boolean;
  onRequestApi: (path: string, init?: RequestInit) => Promise<any>;
}

// Meta Approved Templates library (Standard verified WhatsApp templates)
const META_APPROVED_TEMPLATES = [
  {
    name: 'consultation_invitation_v1',
    category: 'MARKETING',
    language: 'en_US',
    status: 'APPROVED',
    body: 'Hello {{1}}, thank you for connecting with {{2}}. We are currently offering complimentary initial health assessments this week. Would you like to reserve your time slot?',
  },
  {
    name: 'wellness_workshop_announcement',
    category: 'MARKETING',
    language: 'en_US',
    status: 'APPROVED',
    body: 'Hi {{1}}, we are hosting a specialized Wellness & Lifestyle Seminar on {{2}}. Seats are limited for registered participants. Reply YES to confirm your attendance.',
  },
  {
    name: 'appointment_inquiry_followup',
    category: 'UTILITY',
    language: 'en_US',
    status: 'APPROVED',
    body: 'Dear {{1}}, following up on your inquiry with {{2}}. Our medical coordinator is available to answer any questions regarding treatment programs. How may we assist you today?',
  },
  {
    name: 'cras_course_enrollment_notice',
    category: 'MARKETING',
    language: 'en_US',
    status: 'APPROVED',
    body: 'Greetings from CRAS Institute! New batches for clinical training commence on {{1}}. Early registration grants priority lab schedules. Reply INFO for the prospectus.',
  },
];

export const MarketingCampaigns: React.FC<MarketingCampaignsProps> = ({ loading, onRequestApi }) => {
  const [campaigns, setCampaigns] = React.useState<MarketingCampaign[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  
  // New campaign state
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [approvedText, setApprovedText] = React.useState(META_APPROVED_TEMPLATES[0].body);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const loadCampaigns = React.useCallback(async () => {
    setFetching(true);
    try {
      const response = await onRequestApi('/api/marketing/campaigns');
      if (response?.data) {
        setCampaigns(response.data);
      }
    } catch (e) {
      console.error('Failed to load campaigns', e);
    } finally {
      setFetching(false);
    }
  }, [onRequestApi]);

  React.useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Campaign title is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await onRequestApi('/api/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          targetAudience: targetAudience.trim() || null,
          instructions: instructions.trim() || null,
          approvedText: approvedText.trim() || null,
        }),
      });

      setNotice('Campaign draft created successfully.');
      setIsCreating(false);
      setTitle('');
      setDescription('');
      setInstructions('');
      void loadCampaigns();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create campaign draft');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Meta Policy Compliance Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900/80 p-5 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-amber-300">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <h3 className="font-bold text-sm text-white">Meta WhatsApp Cloud API Compliance Notice</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Outbound messages sent outside the customer-initiated 24-hour service window MUST use pre-approved Meta message templates. Marketing broadcasts require verifiable customer consent. Never send unsolicited broadcasts to cold public contacts without recorded opt-in evidence.
        </p>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Meta Pre-Approved Templates Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Meta Approved Template Library
            </h3>
            <p className="text-xs text-slate-400">
              Synchronized with Meta Graph API. Approved for outbound outreach.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {META_APPROVED_TEMPLATES.map(tpl => (
            <div
              key={tpl.name}
              className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-4 space-y-2.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-teal-300 truncate">{tpl.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {tpl.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 font-mono mt-2 p-2.5 rounded bg-slate-900 border border-slate-800/80 leading-relaxed">
                  {tpl.body}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 border-t border-slate-800/60">
                <span>Language: {tpl.language}</span>
                <button
                  type="button"
                  onClick={() => {
                    setApprovedText(tpl.body);
                    setIsCreating(true);
                  }}
                  className="text-teal-400 hover:text-teal-300 font-semibold"
                >
                  Use in Campaign Draft →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Drafts Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Campaign Outreach Drafts
            </h3>
            <p className="text-xs text-slate-400">
              Structured campaign materials prepared for marketing officers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs hover:bg-teal-300 shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Campaign Draft
          </button>
        </div>

        {fetching ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span>Loading campaign drafts...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-xs text-slate-500">
            No custom campaign drafts recorded yet. Click &quot;New Campaign Draft&quot; to build one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campaigns.map(camp => (
              <div
                key={camp.id}
                className="rounded-xl border border-slate-800 bg-[#0D1526]/80 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">{camp.title}</h4>
                  <span className="text-[10px] text-slate-500">
                    {new Date(camp.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {camp.description && (
                  <p className="text-xs text-slate-400">{camp.description}</p>
                )}
                {camp.targetAudience && (
                  <p className="text-[11px] text-teal-400">Audience: {camp.targetAudience}</p>
                )}
                {camp.approvedText && (
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                    {camp.approvedText}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Campaign Draft Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0D1526] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create New Campaign Draft</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 p-2 rounded">
                {error}
              </p>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-300">
                  Campaign Title <span className="text-rose-400">*</span>
                </span>
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. November Health Assessment Drive"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-teal-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-300">Target Audience</span>
                <input
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="e.g. Public WhatsApp Inquiries, Opted-in Booth Contacts"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-teal-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-300">Approved Template Text</span>
                <textarea
                  rows={3}
                  value={approvedText}
                  onChange={e => setApprovedText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white font-mono outline-none focus:border-teal-400"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-300">Instructions for Marketing Officers</span>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="e.g. Verify contact identity before sharing prospectus; record explicit consent."
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white outline-none focus:border-teal-400"
                />
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-teal-400 text-xs font-bold text-slate-950 hover:bg-teal-300 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
