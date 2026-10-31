import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageSquare,
  Paperclip,
  Clock,
  ArrowLeftRight,
  Send,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  UserCheck,
  FileText,
  ExternalLink,
  Download,
  X,
  Bell,
  Eye,
  Check,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { useCrm } from '../../context/CrmContext';

export type DiscussionNote = {
  id: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  department?: string;
  content: string;
  createdAt: string;
  attachments?: Array<{ id?: string; url: string; fileName?: string; fileType?: string }>;
};

export type Attachment = {
  id: string;
  url: string;
  fileName: string;
  fileType?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt?: string;
  department?: string;
};

export type HistoryEntry = {
  at: string;
  actorId: string;
  action: string;
  status: string;
  reason?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  recipientId?: string | null;
  recipientRole?: string | null;
  eventType?: string;
  read?: boolean;
  createdAt?: string;
  at?: string;
};

export type Requirement = {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  materialsStatus?: string;
  paymentReference?: string;
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: string;
  submittedByOfficerId?: string;
  releaseRequestedAt?: string;
  emailVerificationStatus?: string;
  coordinatorId?: string;
  revision: number;
  checklist: Record<string, boolean>;
  entitlementId?: string;
  studentId?: string;
  managerApproval?: {
    decision?: string;
    managerId?: string;
    decidedAt?: string;
    comments?: string;
  };
  snapshot: Record<string, any>;
};

export type ExamHandoff = {
  id: string;
  number: string;
  leadId: string;
  leadName: string;
  phone?: string;
  email?: string;
  profession?: string;
  company?: string;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  acceptedByName?: string;
  assignedAt?: string;
  assignedOfficerId?: string | null;
  assignedOfficerName?: string | null;
  assignedBy?: string;
  assignmentReason?: string;
  previousOfficerId?: string | null;
  previousOfficerName?: string | null;
  reassignmentReason?: string;
  reassignedAt?: string;
  returnedAt?: string;
  returnedBy?: string;
  returnedByName?: string;
  returnReason?: string;
  officerAcceptedAt?: string;
  officerAcceptedBy?: string;
  officerAcceptedByName?: string;
  startedAt?: string;
  completedAt?: string;
  completionNote?: string;
  requirementType?: string;
  examCountry?: string;
  examTitle?: string;
  authority?: string;
  priority?: string;
  services?: string[];
  quotationNumber?: string;
  clientName?: string;
  clientEmail?: string;
  contactNumber?: string;
  paymentReceiptUrl?: string;
  paymentReceiptFileName?: string;
  receiptVoucherUrl?: string;
  receiptVoucherFileName?: string;
  receiptVoucherNo?: string;
  quotationTotal?: number | null;
  discount?: number | null;
  netAmount?: number | null;
  amountPaid?: number | null;
  balance?: number | null;
  paymentMethod?: string;
  transactionReference?: string;
  materialsStatus?: string;
  paymentReference?: string;
  paymentVerifiedBy?: string;
  paymentVerifiedByName?: string;
  paymentVerifiedAt?: string;
  status: string;
  paymentStatus?: string;
  revision: number;
  discussionHistory?: DiscussionNote[];
  attachments?: Attachment[];
  notifications?: NotificationItem[];
  history?: HistoryEntry[];
  notes?: string;
};

const transitions: Record<string, string[]> = {
  SUBMITTED: ['ACCEPTED', 'NEEDS_INFORMATION', 'REJECTED'],
  NEEDS_INFORMATION: [],
  ACCEPTED: ['PREPARING'],
  PREPARING: ['READY', 'EMAIL_VERIFICATION_PENDING'],
  EMAIL_VERIFICATION_PENDING: ['READY', 'PREPARING'],
  READY: ['PENDING_MANAGER_APPROVAL', 'PREPARING'],
  PENDING_MANAGER_APPROVAL: ['ON_HOLD'],
  RETURNED_FOR_CORRECTION: ['PREPARING', 'PENDING_MANAGER_APPROVAL'],
  APPROVED_ACTIVATION_PENDING: ['DELIVERED', 'ON_HOLD'],
  ON_HOLD: ['PREPARING', 'PENDING_MANAGER_APPROVAL'],
  DELIVERED: ['CLOSED'],
};

const inputStyle = 'w-full rounded-lg border border-slate-600 bg-slate-900 p-2.5 text-sm text-white focus:outline-hidden focus:border-teal-500';
const formatExamDateTime = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const handoffStatusLabel = (status: string) => ({
  PENDING_ACCEPTANCE: 'Waiting for Head acceptance',
  ACCEPTED: 'Accepted by Head of Exam',
  ASSIGNED: 'Assigned — awaiting officer acceptance',
  OFFICER_ACCEPTED: 'Accepted by exam officer',
  IN_PROGRESS: 'Under progress',
  DELIVERED_TO_CRM: 'Provided successfully',
  RETURNED_TO_SALES: 'Returned to Sales',
}[status] || status.replaceAll('_', ' '));

export function ReturnToSalesModal({
  handoff,
  onClose,
  onSubmit,
}: {
  handoff: ExamHandoff | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!handoff) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError('A mandatory return reason of at least 3 characters is required.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return case to sales.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400">
            <RotateCcw className="w-5 h-5" />
            <h3 className="font-bold text-lg">Return Case to Sales</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
            <p><b>Case:</b> {handoff.number} · {handoff.leadName}</p>
            <p><b>Current Status:</b> {handoffStatusLabel(handoff.status)}</p>
          </div>
          {error && <p className="text-xs text-rose-300 rounded-lg bg-rose-500/10 p-2.5 border border-rose-500/30">{error}</p>}
          <label className="block text-xs font-semibold text-slate-300 space-y-1.5">
            <span>Mandatory Return Reason (minimum 3 characters) *</span>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain what must be corrected or why documentation is incomplete..."
              className={inputStyle}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium hover:bg-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || reason.trim().length < 3}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{busy ? 'Returning…' : 'Confirm Return to Sales'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AssignOfficerModal({
  handoff,
  officers,
  onClose,
  onSubmit,
}: {
  handoff: ExamHandoff | null;
  officers: any[];
  onClose: () => void;
  onSubmit: (officerId: string, officerName: string, reason: string) => Promise<void>;
}) {
  const isReassignment = Boolean(handoff?.assignedOfficerId && handoff?.status !== 'ACCEPTED');
  const [officerId, setOfficerId] = useState(handoff?.assignedOfficerId || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!handoff) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId) {
      setError('Please select an Exam Providing Officer.');
      return;
    }
    if (isReassignment && reason.trim().length < 3) {
      setError('Reassignment requires a mandatory reason of at least 3 characters.');
      return;
    }
    const selected = officers.find(o => o.id === officerId);
    setError('');
    setBusy(true);
    try {
      await onSubmit(officerId, selected?.fullName || selected?.name || 'Exam Providing Officer', reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign officer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-teal-500/40 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-teal-400">
            {isReassignment ? <ArrowLeftRight className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            <h3 className="font-bold text-lg">{isReassignment ? 'Reassign Exam Providing Officer' : 'Assign Exam Providing Officer'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
            <p><b>Case:</b> {handoff.number} · {handoff.leadName}</p>
            {isReassignment && <p className="text-amber-300"><b>Currently Assigned To:</b> {handoff.assignedOfficerName || handoff.assignedOfficerId}</p>}
          </div>
          {error && <p className="text-xs text-rose-300 rounded-lg bg-rose-500/10 p-2.5 border border-rose-500/30">{error}</p>}
          <label className="block text-xs font-semibold text-slate-300 space-y-1.5">
            <span>Select Exam Providing Officer *</span>
            <select
              required
              value={officerId}
              onChange={e => setOfficerId(e.target.value)}
              className={inputStyle}
            >
              <option value="">-- Choose Officer --</option>
              {officers.map(o => (
                <option key={o.id} value={o.id}>
                  {o.fullName || o.name || o.email} ({o.roleTitle || o.role?.replaceAll('_', ' ') || 'Officer'})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-300 space-y-1.5">
            <span>
              {isReassignment ? 'Mandatory Reassignment Reason (min 3 characters) *' : 'Assignment Reason / Specialization Notes'}
            </span>
            <textarea
              required={isReassignment}
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={isReassignment ? 'e.g. Reassigned due to medical leave of primary officer; priority case.' : 'e.g. Assigned based on UAE medical licensing specialization.'}
              className={inputStyle}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium hover:bg-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !officerId || (isReassignment && reason.trim().length < 3)}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{busy ? 'Saving…' : isReassignment ? 'Confirm Reassignment' : 'Assign Officer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CaseDetailsDrawer({
  handoff,
  onClose,
  onAddNote,
}: {
  handoff: ExamHandoff | null;
  onClose: () => void;
  onAddNote: (noteText: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'discussion' | 'attachments' | 'timeline' | 'overview'>('discussion');
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [noteError, setNoteError] = useState('');

  if (!handoff) return null;

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    setNoteError('');
    try {
      await onAddNote(noteText.trim());
      setNoteText('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Could not add note.');
    } finally {
      setBusy(false);
    }
  };

  const receiptHref = handoff.paymentReceiptUrl?.startsWith('http')
    ? handoff.paymentReceiptUrl
    : handoff.paymentReceiptUrl
    ? `${API_BASE_URL}${handoff.paymentReceiptUrl}`
    : '';

  const voucherHref = handoff.receiptVoucherUrl?.startsWith('http')
    ? handoff.receiptVoucherUrl
    : handoff.receiptVoucherUrl
    ? `${API_BASE_URL}${handoff.receiptVoucherUrl}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="flex flex-col h-[90vh] w-full max-w-4xl rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-cyan-200">{handoff.leadName}</h2>
              <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-mono text-cyan-400">
                {handoff.number}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${handoff.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'}`}>
                {handoff.priority === 'urgent' ? 'Urgent' : 'Regular'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Status: <b className="text-slate-200">{handoffStatusLabel(handoff.status)}</b> · Forwarded by {handoff.submittedByName || 'Sales'} on {formatExamDateTime(handoff.submittedAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 border-b border-slate-800 bg-slate-950/30 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('discussion')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold border-b-2 transition-colors ${activeTab === 'discussion' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discussion History ({(handoff.discussionHistory || []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold border-b-2 transition-colors ${activeTab === 'attachments' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Paperclip className="w-4 h-4" />
            <span>Attachments ({(handoff.attachments || []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Clock className="w-4 h-4" />
            <span>Lifecycle Timeline ({(handoff.history || []).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 py-2.5 font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-4 h-4" />
            <span>Case Overview</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: DISCUSSION HISTORY */}
          {activeTab === 'discussion' && (
            <div className="flex flex-col h-full justify-between space-y-4">
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {!(handoff.discussionHistory || []).length ? (
                  <p className="text-sm text-slate-400 text-center py-8">No discussion notes recorded yet.</p>
                ) : (
                  (handoff.discussionHistory || []).map((note, idx) => {
                    const isExam = note.department === 'Exam Department';
                    return (
                      <div
                        key={note.id || idx}
                        className={`rounded-xl border p-3.5 space-y-1.5 ${isExam ? 'border-teal-500/30 bg-teal-500/5 mr-6' : 'border-cyan-500/30 bg-cyan-500/5 ml-6'}`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{note.senderName || 'Staff'}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isExam ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'}`}>
                              {note.department || (isExam ? 'Exam Department' : 'Sales')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{formatExamDateTime(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handlePostNote} className="pt-3 border-t border-slate-800 space-y-2">
                {noteError && <p className="text-xs text-rose-300">{noteError}</p>}
                <div className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a case discussion note with department attribution..."
                    className={inputStyle}
                  />
                  <button
                    type="submit"
                    disabled={busy || !noteText.trim()}
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{busy ? 'Posting…' : 'Send'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified Case Attachments</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                {receiptHref && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-teal-500/20 border border-teal-500/30 px-2 py-0.5 text-[11px] font-bold text-teal-300">
                        Payment Receipt
                      </span>
                      <span className="text-[11px] text-slate-400">Verified</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200 truncate" title={handoff.paymentReceiptFileName || 'Payment Receipt'}>
                      {handoff.paymentReceiptFileName || 'receipt.pdf'}
                    </p>
                    <a
                      href={receiptHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:underline pt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Receipt</span>
                    </a>
                  </div>
                )}
                {voucherHref && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                        Receipt Voucher PDF
                      </span>
                      <span className="text-[11px] text-slate-400">Voucher: {handoff.receiptVoucherNo || 'RV-—'}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200 truncate" title={handoff.receiptVoucherFileName || 'Receipt Voucher'}>
                      {handoff.receiptVoucherFileName || 'voucher.pdf'}
                    </p>
                    <a
                      href={voucherHref}
                      target="_blank"
                      rel="noreferrer"
                      download={handoff.receiptVoucherFileName || true}
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:underline pt-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Voucher</span>
                    </a>
                  </div>
                )}
                {(handoff.attachments || [])
                  .filter(a => a.url !== handoff.paymentReceiptUrl && a.url !== handoff.receiptVoucherUrl)
                  .map((att, i) => (
                    <div key={att.id || i} className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                          {att.department || 'Document'}
                        </span>
                        <span className="text-[11px] text-slate-400">{formatExamDateTime(att.uploadedAt)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-200 truncate" title={att.fileName}>
                        {att.fileName}
                      </p>
                      <a
                        href={att.url.startsWith('http') ? att.url : `${API_BASE_URL}${att.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:underline pt-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Document</span>
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 3: LIFECYCLE TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audited State Transitions</h4>
              <div className="space-y-3 relative pl-4 border-l-2 border-slate-800">
                {(handoff.history || []).map((step, i) => (
                  <div key={i} className="relative pb-2">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-900" />
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-cyan-300 uppercase tracking-wide">{step.action.replaceAll('_', ' ')}</span>
                        <span className="text-slate-400">{formatExamDateTime(step.at)}</span>
                      </div>
                      <p className="text-xs text-slate-300">Actor: <span className="font-mono text-slate-400">{step.actorId}</span> · Status: <b>{step.status}</b></p>
                      {step.reason && (
                        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded p-1.5 mt-1">
                          <b>Reason / Note:</b> {step.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                  <h5 className="font-bold text-slate-200 border-b border-slate-800 pb-1">Client Contact Details</h5>
                  <p>Name: <b className="text-slate-100">{handoff.clientName || handoff.leadName}</b></p>
                  <p>Email: <b className="text-slate-100">{handoff.clientEmail || '—'}</b></p>
                  <p>Contact: <b className="text-slate-100">{handoff.contactNumber || handoff.phone || '—'}</b></p>
                  <p>Company: <b className="text-slate-100">{handoff.company || 'RWC'}</b></p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                  <h5 className="font-bold text-slate-200 border-b border-slate-800 pb-1">Exam Licensing Specifications</h5>
                  <p>Exam Title: <b className="text-slate-100">{handoff.examTitle || '—'}</b></p>
                  <p>Country: <b className="text-slate-100">{handoff.examCountry || '—'}</b></p>
                  <p>Authority: <b className="text-slate-100">{handoff.authority || '—'}</b></p>
                  <p>Profession: <b className="text-slate-100">{handoff.profession || '—'}</b></p>
                  <p>Quotation: <b className="text-slate-100">{handoff.quotationNumber || '—'}</b></p>
                  <p>Receipt Voucher: <b className="text-slate-100">{handoff.receiptVoucherNo || '—'}</b></p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                <h5 className="font-bold text-slate-200 border-b border-slate-800 pb-1">Selected Services</h5>
                <div className="flex flex-wrap gap-2">
                  {(handoff.services || []).map(svc => (
                    <span key={svc} className="rounded-lg bg-teal-500/10 border border-teal-500/30 px-2.5 py-1 text-teal-200 font-semibold">
                      {svc.replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
              {handoff.reassignmentReason && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                  <b>Reassignment Reason:</b> {handoff.reassignmentReason}
                </div>
              )}
              {handoff.returnReason && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">
                  <b>Return to Sales Reason:</b> {handoff.returnReason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamHandoffInbox({ canManage, canHandle }: { canManage: boolean; canHandle: boolean }) {
  const { currentUser, users } = useCrm() as any;
  const [handoffs, setHandoffs] = useState<ExamHandoff[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Modals state
  const [activeReturnHandoff, setActiveReturnHandoff] = useState<ExamHandoff | null>(null);
  const [activeAssignHandoff, setActiveAssignHandoff] = useState<ExamHandoff | null>(null);
  const [activeDetailHandoff, setActiveDetailHandoff] = useState<ExamHandoff | null>(null);

  const token = () => localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('crm_auth_token') || '';

  const request = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(API_BASE_URL + '/api/exam-ops' + path, {
      method,
      headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Request failed.');
    return data.data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const rows = await request('/handoffs');
      setHandoffs(rows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load exam handoffs.');
    }
  }, [request]);

  useEffect(() => {
    if (!canHandle) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [canHandle, refresh]);

  if (!canHandle) return null;

  const officers = (users || []).filter(
    (user: any) =>
      user.active !== false &&
      user.id !== currentUser?.id &&
      ['coordinator', 'exam_coordinator', 'exam_providing_officer'].includes(user.role)
  );

  const runAction = async (handoff: ExamHandoff, action: string, body: Record<string, unknown> = {}) => {
    setBusyId(handoff.id);
    try {
      await request(`/handoffs/${handoff.id}/${action}`, 'POST', { revision: handoff.revision, ...body });
      await refresh();
      if (activeDetailHandoff?.id === handoff.id) {
        const updated = await request(`/handoffs/${handoff.id}`);
        setActiveDetailHandoff(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update the handoff.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddNoteToCase = async (noteText: string) => {
    if (!activeDetailHandoff) return;
    await request(`/handoffs/${activeDetailHandoff.id}/notes`, 'POST', {
      revision: activeDetailHandoff.revision,
      content: noteText,
    });
    await refresh();
    const updated = await request(`/handoffs/${activeDetailHandoff.id}`);
    setActiveDetailHandoff(updated);
  };

  const pending = handoffs.filter(row => row.status === 'PENDING_ACCEPTANCE').length;

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-cyan-100 flex items-center gap-2">
            <span>Exam Department Inbox</span>
            {pending > 0 && <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-bold text-slate-950">{pending} new</span>}
          </h3>
          <p className="text-xs text-slate-400">Sales forwards appear here for Head of Exam acceptance, assignment, reassignments, and returns.</p>
        </div>
        <button type="button" className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10 cursor-pointer" onClick={() => void refresh()}>
          Refresh inbox
        </button>
      </div>

      {error && <p className="text-xs text-amber-200 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30">{error}</p>}

      {!handoffs.length ? (
        <p className="text-sm text-slate-400">No exam handoffs have been forwarded yet.</p>
      ) : (
        <div className="space-y-3">
          {handoffs.map(handoff => {
            const assignedToCurrentOfficer = !canManage && handoff.assignedOfficerId === currentUser?.id;
            const receiptHref = handoff.paymentReceiptUrl?.startsWith('http')
              ? handoff.paymentReceiptUrl
              : handoff.paymentReceiptUrl
              ? `${API_BASE_URL}${handoff.paymentReceiptUrl}`
              : '';
            const isReturned = handoff.status === 'RETURNED_TO_SALES';

            return (
              <div key={handoff.id} className={`rounded-xl border p-4 space-y-3 ${isReturned ? 'border-rose-500/30 bg-rose-950/10' : 'border-slate-700 bg-slate-900/70'}`}>
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-base text-slate-100">{handoff.leadName}</strong>
                      <span className="font-mono text-xs text-cyan-400">{handoff.number}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {handoff.phone || 'No phone'} · Client: {handoff.clientName || handoff.leadName} · Submitted by {handoff.submittedByName || 'Sales team'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${isReturned ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-700 text-slate-200'}`}>
                      {handoffStatusLabel(handoff.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveDetailHandoff(handoff)}
                      className="px-3 py-1 rounded-lg border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Case Details</span>
                      {(handoff.discussionHistory || []).length > 0 && (
                        <span className="rounded-full bg-cyan-600 px-1.5 py-0.2 text-[10px] text-white">
                          {(handoff.discussionHistory || []).length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Return Reason Banner */}
                {isReturned && handoff.returnReason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <b>Returned to Sales on {formatExamDateTime(handoff.returnedAt)}:</b> {handoff.returnReason}
                    </div>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3 text-xs text-slate-300 space-y-2">
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    <span>Requirement: <b>{handoff.requirementType === 'international' ? 'International' : 'Country-specific'}</b></span>
                    <span>Exam: <b>{handoff.examTitle || '—'}</b></span>
                    <span>Country: <b>{handoff.examCountry || '—'}</b></span>
                    <span>Authority: <b>{handoff.authority || '—'}</b></span>
                    <span>Priority: <b className={handoff.priority === 'urgent' ? 'text-rose-300' : 'text-teal-300'}>{handoff.priority === 'urgent' ? 'Urgent' : 'Regular'}</b></span>
                    <span>Quotation: <b>{handoff.quotationNumber || '—'}</b></span>
                    <span>Payment: <b className={handoff.paymentStatus === 'VERIFIED' ? 'text-emerald-300' : 'text-amber-300'}>{handoff.paymentStatus === 'VERIFIED' ? '✓ Verified' : '🔒 Pending'}</b></span>
                    <span>Materials: <b className={handoff.materialsStatus === 'MATERIALS_RELEASED' ? 'text-teal-300' : 'text-slate-400'}>{handoff.materialsStatus === 'MATERIALS_RELEASED' ? 'Released' : 'Locked'}</b></span>
                    <span>Voucher: <b>{handoff.receiptVoucherNo || '—'}</b></span>
                    <span>Email: <b>{handoff.clientEmail || '—'}</b></span>
                    <span>Services: <b>{(handoff.services || []).map(v => v.replaceAll('_', ' ')).join(', ') || '—'}</b></span>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1 border-t border-slate-800">
                    {receiptHref && (
                      <a className="text-cyan-300 hover:underline flex items-center gap-1" href={receiptHref} target="_blank" rel="noreferrer">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>View payment receipt{handoff.paymentReceiptFileName ? ` (${handoff.paymentReceiptFileName})` : ''}</span>
                      </a>
                    )}
                    {handoff.receiptVoucherUrl && (
                      <a
                        className="text-cyan-300 hover:underline flex items-center gap-1"
                        href={handoff.receiptVoucherUrl.startsWith('http') ? handoff.receiptVoucherUrl : `${API_BASE_URL}${handoff.receiptVoucherUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        download={handoff.receiptVoucherFileName || true}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Receipt voucher PDF{handoff.receiptVoucherFileName ? ` (${handoff.receiptVoucherFileName})` : ''}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Lifecycle Pipeline Trackers */}
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5 text-[11px]">
                  <div className={`rounded-lg border p-2 ${handoff.submittedAt ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-slate-800 text-slate-500'}`}>
                    <b>1. Forwarded</b><br />{formatExamDateTime(handoff.submittedAt)}
                  </div>
                  <div className={`rounded-lg border p-2 ${handoff.acceptedAt ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-slate-800 text-slate-500'}`}>
                    <b>2. Head accepted</b><br />{formatExamDateTime(handoff.acceptedAt)}
                  </div>
                  <div className={`rounded-lg border p-2 ${handoff.officerAcceptedAt ? 'border-teal-500/40 bg-teal-500/10 text-teal-100' : 'border-slate-800 text-slate-500'}`}>
                    <b>3. Officer accepted</b><br />{formatExamDateTime(handoff.officerAcceptedAt)}
                  </div>
                  <div className={`rounded-lg border p-2 ${handoff.startedAt ? 'border-teal-500/40 bg-teal-500/10 text-teal-100' : 'border-slate-800 text-slate-500'}`}>
                    <b>4. Under progress</b><br />{formatExamDateTime(handoff.startedAt)}
                  </div>
                  <div className={`rounded-lg border p-2 ${handoff.completedAt ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-slate-800 text-slate-500'}`}>
                    <b>5. Provided successfully</b><br />{formatExamDateTime(handoff.completedAt)}
                  </div>
                </div>

                {/* Assigned Officer attribution & Reassignment notice */}
                {handoff.assignedOfficerName && (
                  <div className="text-xs text-teal-300 flex items-center justify-between">
                    <span>Assigned to: <b>{handoff.assignedOfficerName}</b> {handoff.assignedAt && `on ${formatExamDateTime(handoff.assignedAt)}`}</span>
                    {handoff.reassignmentReason && (
                      <span className="text-amber-300 text-[11px] font-medium" title={handoff.reassignmentReason}>
                        (Reassigned: {handoff.reassignmentReason})
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Head of Exam Actions */}
                  {canManage && handoff.status === 'PENDING_ACCEPTANCE' && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                      onClick={() => void runAction(handoff, 'accept')}
                    >
                      {busyId === handoff.id ? 'Accepting…' : 'Accept Handoff'}
                    </button>
                  )}

                  {canManage && handoff.status === 'ACCEPTED' && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg bg-teal-600 hover:bg-teal-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      onClick={() => setActiveAssignHandoff(handoff)}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Assign Officer</span>
                    </button>
                  )}

                  {canManage && ['ASSIGNED', 'OFFICER_ACCEPTED', 'IN_PROGRESS'].includes(handoff.status) && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg border border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-300 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      onClick={() => setActiveAssignHandoff(handoff)}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Reassign Officer</span>
                    </button>
                  )}

                  {canManage && ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ASSIGNED', 'OFFICER_ACCEPTED', 'IN_PROGRESS'].includes(handoff.status) && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg border border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-1.5 text-xs font-bold text-rose-300 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      onClick={() => setActiveReturnHandoff(handoff)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return to Sales</span>
                    </button>
                  )}

                  {/* Officer Actions */}
                  {assignedToCurrentOfficer && handoff.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                      onClick={() => void runAction(handoff, 'accept-assignment')}
                    >
                      {busyId === handoff.id ? 'Accepting…' : 'Accept Requirement'}
                    </button>
                  )}

                  {assignedToCurrentOfficer && handoff.status === 'OFFICER_ACCEPTED' && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg bg-teal-600 hover:bg-teal-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                      onClick={() => void runAction(handoff, 'start')}
                    >
                      {busyId === handoff.id ? 'Starting…' : 'Start Work'}
                    </button>
                  )}

                  {assignedToCurrentOfficer && handoff.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      disabled={busyId === handoff.id}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      onClick={() => void runAction(handoff, 'complete', { reason: 'Exam materials delivered to CRM.' })}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{busyId === handoff.id ? 'Completing…' : 'Complete Handoff'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Return to Sales Modal */}
      {activeReturnHandoff && (
        <ReturnToSalesModal
          handoff={activeReturnHandoff}
          onClose={() => setActiveReturnHandoff(null)}
          onSubmit={async (reason) => {
            await runAction(activeReturnHandoff, 'return', { reason });
          }}
        />
      )}

      {/* Assign / Reassign Officer Modal */}
      {activeAssignHandoff && (
        <AssignOfficerModal
          handoff={activeAssignHandoff}
          officers={officers}
          onClose={() => setActiveAssignHandoff(null)}
          onSubmit={async (officerId, officerName, reason) => {
            await runAction(activeAssignHandoff, 'assign', { officerId, officerName, reason });
          }}
        />
      )}

      {/* Case Details & Discussion Drawer */}
      {activeDetailHandoff && (
        <CaseDetailsDrawer
          handoff={activeDetailHandoff}
          onClose={() => setActiveDetailHandoff(null)}
          onAddNote={handleAddNoteToCase}
        />
      )}
    </div>
  );
}

export function ExamOperationsView() {
  const { currentUser } = useCrm();
  const roleTitle = String(currentUser?.roleTitle || '').toLowerCase();
  const admin =
    ['super_admin', 'exam_department_manager'].includes(currentUser?.role || '') ||
    roleTitle.includes('head of exam') ||
    roleTitle.includes('exam department manager');
  const isFinance =
    ['super_admin', 'finance_officer'].includes(currentUser?.role || '') ||
    roleTitle.includes('finance');
  const isExamManager =
    currentUser?.role === 'exam_department_manager' ||
    roleTitle.includes('head of exam') ||
    roleTitle.includes('exam department manager');
  const canHandle =
    admin ||
    ['coordinator', 'exam_coordinator', 'exam_providing_officer'].includes(currentUser?.role || '') ||
    roleTitle.includes('exam providing') ||
    roleTitle.includes('exam officer');
  const canViewRequirements =
    admin || isFinance || ['super_admin', 'coordinator', 'leads_officer', 'sales_coordinator', 'finance_officer'].includes(currentUser?.role || '');

  const [records, setRecords] = useState<Requirement[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [materialIds, setMaterialIds] = useState('');
  const [health, setHealth] = useState<any>(null);
  const [healthError, setHealthError] = useState('');
  const [search, setSearch] = useState('');

  const request = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const token = localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('crm_auth_token') || '';
    const response = await fetch(API_BASE_URL + '/api/exam-ops' + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Request failed.');
    return data.data;
  }, []);

  const refresh = useCallback(async () => {
    if (!canViewRequirements) {
      setRecords([]);
      setError('');
      return;
    }
    setBusy(true);
    try {
      setRecords(await request('/requirements'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load operations.');
    } finally {
      setBusy(false);
    }
  }, [canViewRequirements, request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!admin) return;
    let stopped = false;
    let running = false;
    const check = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        const result = await request('/health');
        if (!stopped) {
          setHealth(result);
          setHealthError('');
        }
      } catch {
        if (!stopped) {
          setHealth(null);
          setHealthError('Automatic check unavailable. Operational health is unknown.');
        }
      } finally {
        running = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [admin, request]);

  const active = records.find(r => r.id === selected);

  async function action(actionName: string, body: Record<string, unknown> = {}) {
    if (!active || busy) return;
    setBusy(true);
    try {
      await request('/requirements/' + active.id + '/' + actionName, 'POST', {
        revision: active.revision,
        reason,
        ...body,
      });
      setReason('');
      setReference('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update record.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form.entries());
    body.durationDays = Number(body.durationDays);
    body.attemptAllowance = Number(body.attemptAllowance);
    body.amountMinor = Number(body.amountMinor);
    body.services = String(body.services)
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      await request('/requirements', 'POST', body);
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 text-slate-100">
      <ExamHandoffInbox canManage={admin} canHandle={canHandle} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-xl font-bold">Exam Order & Access Management</h2>
          <p className="text-sm text-slate-400">Sales handoff, preparation, manager approval and verified delivery</p>
        </div>
        <div className="flex gap-2">
          {canViewRequirements && (
            <button type="button" disabled={busy} className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-white" onClick={() => void refresh()}>
              Refresh
            </button>
          )}
          {canViewRequirements && (
            <button type="button" className="px-3 py-1.5 rounded-lg bg-teal-600 text-xs font-bold text-white" onClick={() => setShowForm(!showForm)}>
              New exam order
            </button>
          )}
          {admin && (
            <button
              type="button"
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-white"
              onClick={async () => {
                try {
                  setHealth(await request('/health'));
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Check problems
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
          {error}
          <p className="mt-1 text-xs">No success is assumed when storage or configuration is unavailable.</p>
        </div>
      )}

      {healthError && <p role="status" className="text-sm text-amber-200">{healthError}</p>}

      {health && (
        <div className="rounded-xl border border-slate-700 p-4">
          <h3 className="font-bold">Operational checks — {new Date(health.checkedAt).toLocaleString()}</h3>
          <p className="text-xs text-slate-400">
            Automatic checks every 60 seconds while this workspace is visible. {health.coverage}
          </p>
          {health.issues.length === 0 ? (
            <p className="mt-2 text-emerald-400">No issues found within this check’s coverage.</p>
          ) : (
            health.issues.map((issue: any) => (
              <p className="mt-2 text-amber-200" key={issue.id}>
                {issue.title} · {issue.requirement}
              </p>
            ))
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 space-y-4">
          <h3 className="font-bold">New Exam Order & Sales Handover</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['orderId', 'Order reference'],
              ['studentName', 'Student name'],
              ['email', 'Student email'],
              ['phone', 'Phone'],
              ['country', 'Country'],
              ['timeZone', 'Time zone'],
              ['profession', 'Profession'],
              ['authority', 'Authority'],
              ['examName', 'Examination'],
              ['packageId', 'Exact package code'],
              ['packageVersion', 'Package version'],
              ['currency', 'Currency code'],
              ['amountMinor', 'Amount in minor currency units'],
              ['durationDays', 'Access duration (days)'],
              ['attemptAllowance', 'Attempt allowance'],
            ].map(([name, label]) => (
              <label className="text-xs space-y-1" key={name}>
                <span>{label}</span>
                <input
                  required
                  name={name}
                  type={
                    name === 'email'
                      ? 'email'
                      : ['amountMinor', 'durationDays', 'attemptAllowance'].includes(name)
                      ? 'number'
                      : 'text'
                  }
                  min={name === 'amountMinor' ? 0 : 1}
                  className={inputStyle}
                  defaultValue={name === 'timeZone' ? 'Asia/Colombo' : name === 'currency' ? 'USD' : undefined}
                  maxLength={500}
                />
              </label>
            ))}
          </div>
          <label className="block text-xs space-y-1">
            <span>Access starts</span>
            <select name="startTrigger" className={inputStyle}>
              <option value="activation">When the student activates</option>
              <option value="purchase">Purchase timestamp</option>
              <option value="fixed">Fixed timestamp</option>
            </select>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs">
              Purchase timestamp (if applicable)
              <input name="purchasedAt" type="datetime-local" className={inputStyle} />
            </label>
            <label className="text-xs">
              Fixed start (if applicable)
              <input name="fixedStart" type="datetime-local" className={inputStyle} />
            </label>
          </div>
          <label className="block text-xs">
            Included services (one per line)
            <textarea required name="services" className={inputStyle} />
          </label>
          <button disabled={busy} className="rounded-lg bg-teal-600 px-4 py-2 font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Submit to Exam Department'}
          </button>
          <p className="text-xs text-slate-400">Submission preserves sold terms and does not activate student access.</p>
        </form>
      )}

      <label className="block">
        <span className="sr-only">Search requirements</span>
        <input
          className={inputStyle}
          placeholder="Search student, email, order or requirement"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </label>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {records
            .filter(r =>
              [r.number, r.snapshot?.studentName, r.snapshot?.email, r.snapshot?.orderId]
                .join(' ')
                .toLowerCase()
                .includes(search.toLowerCase())
            )
            .map(r => (
              <button
                type="button"
                key={r.id}
                onClick={() => {
                  setSelected(r.id);
                  setReason('');
                }}
                className={
                  'w-full text-left rounded-xl border p-4 ' +
                  (selected === r.id ? 'border-teal-400 bg-teal-500/10' : 'border-slate-700 bg-slate-800/40')
                }
              >
                <div className="flex justify-between gap-2">
                  <strong>{r.snapshot?.studentName}</strong>
                  <span className="text-xs font-semibold">{r.status.replaceAll('_', ' ')}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {r.number} · {r.snapshot?.examName} · {r.snapshot?.orderId}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${r.paymentStatus === 'VERIFIED' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                    {r.paymentStatus === 'VERIFIED' ? '✓ Payment Verified' : '🔒 Payment Pending'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${r.materialsStatus === 'MATERIALS_RELEASED' || r.entitlementId ? 'border-teal-500/40 bg-teal-500/10 text-teal-300' : r.status === 'PENDING_MANAGER_APPROVAL' ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                    {r.materialsStatus === 'MATERIALS_RELEASED' || r.entitlementId ? 'Materials Released' : r.status === 'PENDING_MANAGER_APPROVAL' ? 'Pending Approval' : 'Materials Locked'}
                  </span>
                </div>
              </button>
            ))}
          {!records.length && !error && (
            <p className="text-sm text-slate-400">{busy ? 'Loading…' : 'No handoffs yet. Submit a purchased requirement to begin.'}</p>
          )}
        </div>

        {active && (
          <div className="rounded-xl border border-slate-700 p-5 space-y-4">
            <h3 className="font-bold">
              {active.number} · {active.snapshot?.studentName}
            </h3>
            <p className="text-sm">
              {active.snapshot?.email}
              <br />
              {active.snapshot?.profession} · {active.snapshot?.authority}
              <br />
              Package: {active.snapshot?.packageId} / {active.snapshot?.packageVersion}
              <br />
              {active.snapshot?.durationDays} days · starts on {active.snapshot?.startTrigger}
              <br />
              {active.snapshot?.attemptAllowance} attempts
            </p>
            {/* Status Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`rounded-lg border p-2.5 ${active.paymentStatus === 'VERIFIED' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>
                <p className="font-bold flex items-center gap-1.5">
                  <span>{active.paymentStatus === 'VERIFIED' ? '✓' : '🔒'}</span>
                  <span>Payment: {active.paymentStatus}</span>
                </p>
                {active.paymentReference && <p className="text-[11px] mt-0.5 text-slate-300">Ref: {active.paymentReference}</p>}
                {active.paymentStatus !== 'VERIFIED' && <p className="text-[10px] mt-0.5 text-amber-300">Materials locked until Finance confirms payment.</p>}
              </div>
              <div className={`rounded-lg border p-2.5 ${active.materialsStatus === 'MATERIALS_RELEASED' || active.entitlementId ? 'border-teal-500/40 bg-teal-500/10 text-teal-200' : active.status === 'PENDING_MANAGER_APPROVAL' ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                <p className="font-bold flex items-center gap-1.5">
                  <span>{active.materialsStatus === 'MATERIALS_RELEASED' || active.entitlementId ? '🔓' : '🔒'}</span>
                  <span>Materials: {active.materialsStatus === 'MATERIALS_RELEASED' || active.entitlementId ? 'RELEASED' : active.status === 'PENDING_MANAGER_APPROVAL' ? 'PENDING APPROVAL' : 'LOCKED'}</span>
                </p>
                <p className="text-[10px] mt-0.5 text-slate-400">
                  {active.entitlementId ? 'Active student entitlement' : active.status === 'PENDING_MANAGER_APPROVAL' ? 'Awaiting Manager authorization' : 'Maker-Checker approval required'}
                </p>
              </div>
            </div>

            {/* Financial & Quotation Details */}
            {(active.snapshot?.quotationNumber || active.snapshot?.amountMinor || active.snapshot?.paymentMethod) && (
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 text-xs space-y-1.5">
                <h4 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Financial & Quotation Details</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <p>Quotation No: <b>{active.snapshot?.quotationNumber || '—'}</b></p>
                  <p>Payment Method: <b>{active.snapshot?.paymentMethod || 'Bank Wire / Transfer'}</b></p>
                  <p>Total / Net: <b>{active.snapshot?.netAmount ? `${active.snapshot?.currency || 'USD'} ${active.snapshot?.netAmount}` : active.snapshot?.amountMinor ? `${active.snapshot?.currency || 'USD'} ${(active.snapshot?.amountMinor / 100).toFixed(2)}` : '—'}</b></p>
                  <p>Paid / Balance: <b>{active.snapshot?.amountPaid ? `${active.snapshot?.currency || 'USD'} ${active.snapshot?.amountPaid}` : active.paymentStatus === 'VERIFIED' ? 'Full Paid' : 'Pending'}</b></p>
                </div>
              </div>
            )}

            <ul className="text-sm list-disc pl-5">
              {(active.snapshot?.services || []).map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>

            {/* 1. Independent Finance Officer Payment Verification */}
            {active.paymentStatus !== 'VERIFIED' && (
              isFinance ? (
                <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 space-y-2">
                  <h4 className="font-bold text-cyan-200 text-xs uppercase tracking-wide">Independent Finance Payment Verification</h4>
                  <p className="text-xs text-slate-300">Dedicated Finance Officer independent verification. Materials remain strictly locked until confirmed.</p>
                  <label className="text-xs block space-y-1">
                    <span>Bank / Gateway Transaction Reference *</span>
                    <input className={inputStyle} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TXN-ALF-99281 / Standard Chartered" />
                  </label>
                  <button
                    type="button"
                    disabled={busy || reference.trim().length < 3}
                    className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 text-xs font-bold disabled:opacity-50"
                    onClick={() => void action('verify-payment', { reference })}
                  >
                    Confirm & Verify Payment
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <b>Finance Verification Required:</b> Study materials remain strictly locked until an independent Finance Officer verifies payment.
                </div>
              )
            )}

            {/* 2. 4-Point Preparation Checklist (Exam Providing Officer) */}
            {(canHandle || admin) && ['ACCEPTED', 'PREPARING', 'READY'].includes(active.status) && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                <h4 className="font-bold text-teal-200 text-xs uppercase tracking-wide">4-Point Preparation Checklist (Maker-Checker Step 1)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['account', 'materials', 'exams', 'quality'].map(key => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <input
                        disabled={busy}
                        type="checkbox"
                        checked={Boolean(active.checklist[key])}
                        onChange={e => void action('checklist', { [key]: e.target.checked })}
                      />
                      <span className="capitalize">{key} Check Passed</span>
                    </label>
                  ))}
                </div>
                {active.paymentStatus === 'VERIFIED' ? (
                  <button
                    type="button"
                    disabled={busy || !active.checklist?.account || !active.checklist?.materials || !active.checklist?.exams || !active.checklist?.quality}
                    className="w-full rounded-lg bg-teal-600 hover:bg-teal-500 text-white p-2.5 text-xs font-bold disabled:opacity-50"
                    onClick={() => void action('transition', { status: 'PENDING_MANAGER_APPROVAL', submittedByOfficerId: currentUser?.id })}
                  >
                    Submit Material Release Request for Manager Approval
                  </button>
                ) : (
                  <p className="text-[11px] text-amber-300">Payment must be verified by Finance before release request can be submitted.</p>
                )}
              </div>
            )}

            {/* 3. Maker-Checker Manager Approval & Self-Approval Prevention */}
            {active.status === 'PENDING_MANAGER_APPROVAL' && (
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4 space-y-3">
                <h4 className="font-bold text-indigo-200 text-xs uppercase tracking-wide">Maker-Checker Manager Authorization (Step 2)</h4>
                {currentUser?.id && active.submittedByOfficerId === currentUser.id ? (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200">
                    <b>Self-Approval Forbidden:</b> You submitted this release request ({active.submittedByOfficerId}). In compliance with maker-checker segregation, an independent Exam Department Manager or Super Administrator must authorize release.
                  </div>
                ) : admin ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300">Independent manager authorization to release materials and provision student access.</p>
                    <label className="text-xs block space-y-1">
                      <span>Approval Reason / Notes *</span>
                      <textarea className={inputStyle} value={reason} onChange={e => setReason(e.target.value)} placeholder="All DHA syllabus materials, clinical MCQs and mock exams verified for release." />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold disabled:opacity-50"
                        onClick={() => void action('manager-approve')}
                      >
                        Approve & Release Materials
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg border border-amber-500 text-amber-300 px-3 py-2 text-xs font-bold"
                        onClick={() => void action('manager-return')}
                      >
                        Return for Correction
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg border border-rose-500 text-rose-300 px-3 py-2 text-xs font-bold"
                        onClick={() => void action('manager-reject')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Awaiting independent Exam Department Manager authorization.</p>
                )}
              </div>
            )}

            {/* Email verification helper */}
            {['PREPARING', 'EMAIL_VERIFICATION_PENDING', 'READY'].includes(active.status) &&
              active.emailVerificationStatus !== 'VERIFIED' && admin && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-200"
                  onClick={() => void action('mark-email-verified', { reason: 'Verified via student onboarding verification' })}
                >
                  Record verified student email evidence
                </button>
              )}

            {/* General Lifecycle Transitions */}
            {admin && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(transitions[active.status] || []).map(status => (
                  <button
                    type="button"
                    key={status}
                    disabled={busy}
                    className="rounded-lg border border-teal-600 px-3 py-2 text-xs disabled:opacity-50"
                    onClick={() => void action('transition', { status })}
                  >
                    {status.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            )}

            {/* Material Entitlement Activation */}
            {active.status === 'APPROVED_ACTIVATION_PENDING' && !active.entitlementId && admin && (
              <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-4 space-y-3">
                <h4 className="font-bold text-teal-200 text-xs uppercase tracking-wide">Automatic Portal Entitlement Activation</h4>
                <label className="text-xs block space-y-1">
                  <span>Published material IDs (comma separated)</span>
                  <input value={materialIds} onChange={e => setMaterialIds(e.target.value)} placeholder="mat-dha-core, mat-dha-qbank" className={inputStyle} />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-2 text-xs font-bold"
                  onClick={() =>
                    void action('prepare-access', {
                      materialIds: materialIds
                        .split(',')
                        .map(x => x.trim())
                        .filter(Boolean),
                    })
                  }
                >
                  Activate Student Portal Materials
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Payment verification, maker-checker authorization, activation, and delivery remain separate audited steps.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
