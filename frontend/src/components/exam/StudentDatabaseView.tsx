import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, Edit3, ExternalLink, Loader2, MessageCircle, Plus, RefreshCw, Search, UserRound, UsersRound, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { API_BASE_URL } from '../../config/api';

type StudentInquiry = {
  id: string;
  contactNumber: string;
  contactDigits: string;
  receivedDate: string | null;
  courseType: string;
  sourceAssignedTo: string;
  leadStatus: string;
  name: string;
  professional: string;
  place: string;
  remark: string;
  followUpDate: string | null;
  followUpStatus: string;
  followUpRemark: string;
  sourceSheets: string[];
  coordinatorId: string | null;
  coordinatorName: string | null;
  updatedAt: string;
};

type Summary = {
  total: number;
  assigned: number;
  unassigned: number;
  withFollowUp: number;
  statuses: Record<string, number>;
  courses: Record<string, number>;
  coordinators: Record<string, number>;
};

const emptySummary: Summary = { total: 0, assigned: 0, unassigned: 0, withFollowUp: 0, statuses: {}, courses: {}, coordinators: {} };
const followUpStatuses = ['Needs follow-up', 'Contacted', 'No answer', 'Interested', 'Enrolled', 'Not interested', 'Completed'];
type StudentDraft = {
  contactNumber: string;
  receivedDate: string;
  courseType: string;
  sourceAssignedTo: string;
  leadStatus: string;
  name: string;
  professional: string;
  place: string;
  remark: string;
  followUpDate: string;
  followUpStatus: string;
  followUpRemark: string;
  coordinatorId: string;
  coordinatorName: string;
};
const emptyDraft: StudentDraft = {
  contactNumber: '', receivedDate: '', courseType: '', sourceAssignedTo: '', leadStatus: 'New inquiry', name: '', professional: '', place: '', remark: '', followUpDate: '', followUpStatus: '', followUpRemark: '', coordinatorId: '', coordinatorName: '',
};
const editorFieldClass = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400';

function authHeaders() {
  const token = localStorage.getItem('rw_crm_auth_token') || '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.error || 'Unable to load student database.');
  return payload.data as T;
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function digits(value: string | undefined) {
  return String(value || '').replace(/\D/g, '');
}

export const StudentDatabaseView: React.FC = () => {
  const { leads, users, setSelectedLeadId, setActiveNavTab } = useCrm();
  const [items, setItems] = useState<StudentInquiry[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [course, setCourse] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [savingId, setSavingId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StudentDraft>(emptyDraft);
  const [savingForm, setSavingForm] = useState(false);

  const coordinatorUsers = useMemo(() => users.filter(user => user.active !== false && ['coordinator', 'exam_coordinator', 'exam_providing_officer', 'exam_department_manager'].includes(user.role)), [users]);
  const statusOptions = useMemo(() => Object.keys(summary.statuses).filter(value => value !== 'Not recorded').sort(), [summary.statuses]);
  const courseOptions = useMemo(() => Object.keys(summary.courses).filter(value => value !== 'Not recorded').sort(), [summary.courses]);
  const coordinatorOptions = useMemo(() => Object.keys(summary.coordinators).filter(value => value !== 'Not recorded').sort(), [summary.coordinators]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = useMemo(() => {
    if (pageCount <= 6) return Array.from({ length: pageCount }, (_, index) => index + 1);
    if (page <= 3) return [1, 2, 3, 4, 5, pageCount];
    if (page >= pageCount - 2) return [1, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
    return [1, page - 1, page, page + 1, pageCount];
  }, [page, pageCount]);

  const load = useCallback(async (pageOverride = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageOverride), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (course) params.set('course', course);
      if (coordinator) params.set('coordinator', coordinator);
      const result = await request<{ items: StudentInquiry[]; total: number; summary: Summary }>(`/api/student-database/contacts?${params.toString()}`);
      setItems(result.items || []);
      setTotal(result.total || 0);
      setSummary(result.summary || emptySummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load student database.');
    } finally {
      setLoading(false);
    }
  }, [coordinator, course, page, pageSize, search, status]);

  useEffect(() => { void load(); }, [load]);

  const updateRecord = async (id: string, patch: Partial<StudentInquiry>) => {
    setSavingId(id);
    setError('');
    try {
      const updated = await request<StudentInquiry>(`/api/student-database/contacts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const previous = items.find(item => item.id === id);
      setItems(current => current.map(item => item.id === id ? updated : item));
      setSummary(current => {
        const wasAssigned = Boolean(previous?.coordinatorId || previous?.coordinatorName);
        const isAssigned = Boolean(updated.coordinatorId || updated.coordinatorName);
        const delta = Number(isAssigned) - Number(wasAssigned);
        return delta === 0 ? current : { ...current, assigned: current.assigned + delta, unassigned: Math.max(0, current.unassigned - delta) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save student record.');
    } finally {
      setSavingId('');
    }
  };

  const openNewStudent = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setError('');
    setEditorOpen(true);
  };

  const openEditStudent = (item: StudentInquiry) => {
    setEditingId(item.id);
    setDraft({
      contactNumber: item.contactNumber || '',
      receivedDate: item.receivedDate || '',
      courseType: item.courseType || '',
      sourceAssignedTo: item.sourceAssignedTo || '',
      leadStatus: item.leadStatus || '',
      name: item.name || '',
      professional: item.professional || '',
      place: item.place || '',
      remark: item.remark || '',
      followUpDate: item.followUpDate || '',
      followUpStatus: item.followUpStatus || '',
      followUpRemark: item.followUpRemark || '',
      coordinatorId: item.coordinatorId || '',
      coordinatorName: item.coordinatorName || '',
    });
    setError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (savingForm) return;
    setEditorOpen(false);
    setEditingId(null);
  };

  const saveStudent = async () => {
    if (!draft.name.trim() && !draft.contactNumber.trim()) {
      setError('Enter a student name or contact number before saving.');
      return;
    }
    setSavingForm(true);
    setError('');
    const payload = {
      ...draft,
      receivedDate: draft.receivedDate || null,
      followUpDate: draft.followUpDate || null,
      coordinatorId: draft.coordinatorId || null,
      coordinatorName: draft.coordinatorName || null,
    };
    try {
      const saved = await request<StudentInquiry>(editingId ? `/api/student-database/contacts/${encodeURIComponent(editingId)}` : '/api/student-database/contacts', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setEditorOpen(false);
      setEditingId(null);
      if (!editingId) setPage(1);
      await load(editingId ? page : 1);
      if (editingId) setItems(current => current.map(item => item.id === saved.id ? saved : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save student details.');
    } finally {
      setSavingForm(false);
    }
  };

  const openCrmContact = (item: StudentInquiry) => {
    const phone = digits(item.contactNumber);
    const lead = leads.find(candidate => digits(candidate.customer?.whatsappNumber || candidate.customer?.phoneNumber) === phone || (phone && digits(candidate.customer?.whatsappNumber || candidate.customer?.phoneNumber).endsWith(phone)));
    if (!lead) {
      setError(`No WhatsApp CRM contact is linked to ${item.name || item.contactNumber || 'this record'} yet.`);
      return;
    }
    setSelectedLeadId(lead.id);
    setActiveNavTab('chat');
  };

  return (
    <section className="space-y-5" aria-label="Student database and follow-up">
      <header className="rounded-2xl border border-rose-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950/30 p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-rose-300">
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.18em]">CRAS student operations</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Student Database &amp; Follow-up</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Search course inquiries, assign the correct course coordinator, schedule follow-up, and open the linked CRM contact when it exists.</p>
            <p className="mt-2 text-xs text-slate-500">Imported from the CRAS course inquiry workbook. Original Exam Department and Patient workspaces remain separate.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openNewStudent} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-rose-950/40 hover:bg-rose-400">
              <Plus className="h-4 w-4" /> Add student
            </button>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Total inquiries', value: summary.total, icon: ClipboardList, color: 'text-rose-300' },
          { label: 'Assigned coordinator', value: summary.assigned, icon: UserRound, color: 'text-cyan-300' },
          { label: 'Needs assignment', value: summary.unassigned, icon: UsersRound, color: 'text-amber-300' },
          { label: 'Follow-up data', value: summary.withFollowUp, icon: CalendarClock, color: 'text-emerald-300' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{card.label}</span><card.icon className={`h-4 w-4 ${card.color}`} /></div>
            <div className="mt-2 text-2xl font-black text-white">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_190px_220px_220px_auto]">
          <label className="relative block"><span className="sr-only">Search students</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="Search name, phone, course, place..." className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-rose-400" /></label>
          <select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400"><option value="">All lead statuses</option>{statusOptions.map(option => <option key={option} value={option}>{option}</option>)}</select>
          <select value={course} onChange={event => { setPage(1); setCourse(event.target.value); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400"><option value="">All courses / services</option>{courseOptions.map(option => <option key={option} value={option}>{option}</option>)}</select>
          <select value={coordinator} onChange={event => { setPage(1); setCoordinator(event.target.value); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400"><option value="">All coordinators</option>{coordinatorOptions.map(option => <option key={option} value={option}>{option}</option>)}</select>
          <select value={pageSize} onChange={event => { setPage(1); setPageSize(Number(event.target.value)); }} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400"><option value="25">25 rows</option><option value="50">50 rows</option><option value="100">100 rows</option></select>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><h2 className="font-bold text-white">Course inquiry records</h2><p className="text-xs text-slate-500">Showing {total === 0 ? 0 : ((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}</p></div><div className="text-xs text-slate-500">Coordinator assignment is saved securely</div></div>
        {loading ? <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin text-rose-300" /> Loading student records...</div> : items.length === 0 ? <div className="p-16 text-center text-sm text-slate-400">No student inquiries match these filters.</div> : <div className="max-h-[calc(100vh-370px)] overflow-auto"><table className="min-w-[1530px] w-full border-separate border-spacing-0 text-left text-sm"><thead className="sticky top-0 z-30 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="sticky left-0 top-0 z-40 w-[80px] min-w-[80px] border-b border-slate-700 bg-slate-900 px-3 py-3">Sel No.</th><th className="sticky left-[80px] top-0 z-40 w-[230px] min-w-[230px] border-b border-slate-700 bg-slate-900 px-4 py-3">Student / contact</th><th className="sticky left-[310px] top-0 z-40 w-[140px] min-w-[140px] border-b border-slate-700 bg-slate-900 px-4 py-3">Date received</th><th className="sticky left-[450px] top-0 z-40 w-[250px] min-w-[250px] border-b border-slate-700 bg-slate-900 px-4 py-3">Course / service</th><th className="border-b border-slate-700 px-4 py-3">Lead status</th><th className="border-b border-slate-700 px-4 py-3">Course coordinator</th><th className="border-b border-slate-700 px-4 py-3">Follow-up</th><th className="border-b border-slate-700 px-4 py-3">Contact</th></tr></thead><tbody className="divide-y divide-slate-800/80">{items.map(item => <tr key={item.id} className="group align-top hover:bg-slate-900/60"><td className="sticky left-0 z-20 w-[80px] min-w-[80px] border-b border-slate-800 bg-slate-950 px-3 py-4 text-center shadow-[4px_0_8px_-8px_rgba(0,0,0,0.8)] group-hover:bg-slate-900/90"><span className="font-mono text-xs font-bold text-slate-400">{item.id.replace(/^cras-/, '')}</span></td><td className="sticky left-[80px] z-20 w-[230px] min-w-[230px] border-b border-slate-800 bg-slate-950 px-4 py-4 shadow-[4px_0_8px_-8px_rgba(0,0,0,0.8)] group-hover:bg-slate-900/90"><div className="font-bold text-white">{item.name || 'Name not recorded'}</div><div className="mt-1 text-xs text-cyan-300">{item.contactNumber || 'No contact number'}</div>{item.professional && <div className="mt-1 max-w-[190px] text-xs text-slate-500">{item.professional}</div>}</td><td className="sticky left-[310px] z-20 w-[140px] min-w-[140px] border-b border-slate-800 bg-slate-950 px-4 py-4 text-xs text-slate-300 shadow-[4px_0_8px_-8px_rgba(0,0,0,0.8)] group-hover:bg-slate-900/90"><div className="font-semibold text-slate-200">{formatDate(item.receivedDate)}</div><div className="mt-1 text-slate-500">{item.place || 'Place not recorded'}</div></td><td className="sticky left-[450px] z-20 w-[250px] min-w-[250px] border-b border-slate-800 bg-slate-950 px-4 py-4 shadow-[4px_0_8px_-8px_rgba(0,0,0,0.8)] group-hover:bg-slate-900/90"><div className="max-w-[240px] font-semibold text-rose-200">{item.courseType || 'Course not recorded'}</div>{item.remark && <div className="mt-1 max-w-[240px] text-xs text-slate-500" title={item.remark}>{item.remark}</div>}</td><td className="border-b border-slate-800 px-4 py-4"><span className="inline-flex max-w-[160px] rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">{item.leadStatus || 'Not recorded'}</span>{item.sourceAssignedTo && <div className="mt-2 text-[11px] text-slate-500">Source: {item.sourceAssignedTo}</div>}</td><td className="border-b border-slate-800 px-4 py-4"><div className="flex min-w-[210px] items-center gap-2"><select value={item.coordinatorId || ''} disabled={savingId === item.id} onChange={event => { const selected = coordinatorUsers.find(user => user.id === event.target.value); void updateRecord(item.id, { coordinatorId: selected?.id || null, coordinatorName: selected?.fullName || null }); }} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-cyan-400"><option value="">Unassigned</option>{coordinatorUsers.map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.role.replaceAll('_', ' ')}</option>)}</select>{savingId === item.id && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-300" />}</div>{item.coordinatorName && <div className="mt-1 text-[11px] text-cyan-300">Assigned: {item.coordinatorName}</div>}</td><td className="border-b border-slate-800 px-4 py-4"><div className="min-w-[190px] space-y-2"><div className="flex gap-2"><select value={item.followUpStatus || ''} disabled={savingId === item.id} onChange={event => void updateRecord(item.id, { followUpStatus: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-emerald-400"><option value="">Status</option>{followUpStatuses.map(option => <option key={option} value={option}>{option}</option>)}{item.followUpStatus && !followUpStatuses.includes(item.followUpStatus) && <option value={item.followUpStatus}>{item.followUpStatus}</option>}</select><input aria-label={'Follow-up date for ' + (item.name || item.id)} type="date" value={item.followUpDate || ''} disabled={savingId === item.id} onChange={event => void updateRecord(item.id, { followUpDate: event.target.value || null })} className="w-[130px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none focus:border-emerald-400" /></div>{item.followUpRemark && <div className="max-w-[220px] text-[11px] text-slate-500" title={item.followUpRemark}>{item.followUpRemark}</div>}</div></td><td className="border-b border-slate-800 px-4 py-4"><div className="flex min-w-[180px] flex-wrap gap-2"><button type="button" onClick={() => openEditStudent(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20"><Edit3 className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => openCrmContact(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"><MessageCircle className="h-3.5 w-3.5" /> Open CRM</button></div></td></tr>)}</tbody></table></div>}
        <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-500">Showing {total === 0 ? 0 : ((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of <b className="text-slate-300">{total.toLocaleString()}</b> student inquiries · Page {page} of {pageCount}</span><div className="flex flex-wrap items-center gap-1.5"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40">Previous</button>{pageNumbers.map((number, index) => <React.Fragment key={number}>{index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-xs text-slate-600">…</span>}<button type="button" disabled={loading} onClick={() => setPage(number)} className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs font-bold ${page === number ? 'border-rose-400 bg-rose-500/20 text-rose-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{number}</button></React.Fragment>)}<button type="button" disabled={page >= pageCount || loading} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40">Next</button></div></div>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="student-editor-title" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-rose-400/30 bg-slate-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
              <div><h2 id="student-editor-title" className="text-lg font-black text-white">{editingId ? 'Edit student details' : 'Add new student inquiry'}</h2><p className="mt-1 text-xs text-slate-400">Complete the course inquiry and follow-up information for the coordinator.</p></div>
              <button type="button" onClick={closeEditor} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close editor"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-300">Student name<input autoFocus value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} className={editorFieldClass} placeholder="Full student name" /></label>
              <label className="text-xs font-semibold text-slate-300">Contact number<input value={draft.contactNumber} onChange={event => setDraft(current => ({ ...current, contactNumber: event.target.value }))} className={editorFieldClass} placeholder="+94..." /></label>
              <label className="text-xs font-semibold text-slate-300">Date received<input type="date" value={draft.receivedDate} onChange={event => setDraft(current => ({ ...current, receivedDate: event.target.value }))} className={editorFieldClass} /></label>
              <label className="text-xs font-semibold text-slate-300">Course / service<input value={draft.courseType} onChange={event => setDraft(current => ({ ...current, courseType: event.target.value }))} className={editorFieldClass} placeholder="Hair Transplant, PMU..." /></label>
              <label className="text-xs font-semibold text-slate-300">Professional / qualification<input value={draft.professional} onChange={event => setDraft(current => ({ ...current, professional: event.target.value }))} className={editorFieldClass} placeholder="Doctor, nurse, student..." /></label>
              <label className="text-xs font-semibold text-slate-300">Place / country<input value={draft.place} onChange={event => setDraft(current => ({ ...current, place: event.target.value }))} className={editorFieldClass} placeholder="Colombo, Sri Lanka..." /></label>
              <label className="text-xs font-semibold text-slate-300">Lead status<select value={draft.leadStatus} onChange={event => setDraft(current => ({ ...current, leadStatus: event.target.value }))} className={editorFieldClass}><option value="">Not recorded</option>{statusOptions.map(option => <option key={option} value={option}>{option}</option>)}{draft.leadStatus && !statusOptions.includes(draft.leadStatus) && <option value={draft.leadStatus}>{draft.leadStatus}</option>}</select></label>
              <label className="text-xs font-semibold text-slate-300">Source / assigned staff<input value={draft.sourceAssignedTo} onChange={event => setDraft(current => ({ ...current, sourceAssignedTo: event.target.value }))} className={editorFieldClass} placeholder="Student Counselor" /></label>
              <label className="text-xs font-semibold text-slate-300 md:col-span-2">Course inquiry / remark<textarea value={draft.remark} onChange={event => setDraft(current => ({ ...current, remark: event.target.value }))} className={`${editorFieldClass} min-h-20 resize-y`} placeholder="Inquiry details, requested course, or notes" /></label>
              <label className="text-xs font-semibold text-slate-300">Course coordinator<select value={draft.coordinatorId} onChange={event => { const selected = coordinatorUsers.find(user => user.id === event.target.value); setDraft(current => ({ ...current, coordinatorId: selected?.id || '', coordinatorName: selected?.fullName || '' })); }} className={editorFieldClass}><option value="">Unassigned</option>{coordinatorUsers.map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.role.replaceAll('_', ' ')}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-300">Follow-up status<select value={draft.followUpStatus} onChange={event => setDraft(current => ({ ...current, followUpStatus: event.target.value }))} className={editorFieldClass}><option value="">Not recorded</option>{followUpStatuses.map(option => <option key={option} value={option}>{option}</option>)}{draft.followUpStatus && !followUpStatuses.includes(draft.followUpStatus) && <option value={draft.followUpStatus}>{draft.followUpStatus}</option>}</select></label>
              <label className="text-xs font-semibold text-slate-300">Follow-up date<input type="date" value={draft.followUpDate} onChange={event => setDraft(current => ({ ...current, followUpDate: event.target.value }))} className={editorFieldClass} /></label>
              <label className="text-xs font-semibold text-slate-300 md:col-span-2">Follow-up notes<textarea value={draft.followUpRemark} onChange={event => setDraft(current => ({ ...current, followUpRemark: event.target.value }))} className={`${editorFieldClass} min-h-20 resize-y`} placeholder="Next action, call result, or coordinator note" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950 px-5 py-4"><button type="button" onClick={closeEditor} disabled={savingForm} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void saveStudent()} disabled={savingForm} className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-2 text-sm font-black text-white hover:bg-rose-400 disabled:opacity-50">{savingForm && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? 'Save changes' : 'Add student'}</button></div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><p>Only authenticated exam-operations staff can view this PII. Updates are saved to the protected local CRM data store with the record update time.</p><ExternalLink className="hidden h-4 w-4 shrink-0 text-slate-600 sm:block" /></div>
    </section>
  );
};
