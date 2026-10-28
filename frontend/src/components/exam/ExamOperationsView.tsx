import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/api';
import { useCrm } from '../../context/CrmContext';

type Requirement = { id: string; number: string; status: string; paymentStatus: string; emailVerificationStatus?: string; coordinatorId?: string; revision: number; checklist: Record<string, boolean>; entitlementId?: string; studentId?: string; snapshot: Record<string, any> };
type ExamHandoff = { id: string; number: string; leadId: string; leadName: string; phone?: string; profession?: string; company?: string; submittedByName?: string; submittedAt: string; acceptedAt?: string; assignedAt?: string; officerAcceptedAt?: string; officerAcceptedByName?: string; startedAt?: string; completedAt?: string; requirementType?: string; examCountry?: string; examTitle?: string; authority?: string; priority?: string; services?: string[]; quotationNumber?: string; clientName?: string; clientEmail?: string; contactNumber?: string; paymentReceiptUrl?: string; paymentReceiptFileName?: string; receiptVoucherUrl?: string; receiptVoucherFileName?: string; receiptVoucherNo?: string; status: string; assignedOfficerId?: string | null; assignedOfficerName?: string | null; revision: number };
const transitions: Record<string, string[]> = { SUBMITTED: ['ACCEPTED','NEEDS_INFORMATION','REJECTED'], NEEDS_INFORMATION: [], ACCEPTED: ['PREPARING'], PREPARING: ['READY','EMAIL_VERIFICATION_PENDING'], EMAIL_VERIFICATION_PENDING: ['READY','PREPARING'], READY: ['PENDING_MANAGER_APPROVAL','PREPARING'], PENDING_MANAGER_APPROVAL: ['ON_HOLD'], RETURNED_FOR_CORRECTION: ['PREPARING','PENDING_MANAGER_APPROVAL'], APPROVED_ACTIVATION_PENDING: ['DELIVERED','ON_HOLD'], ON_HOLD: ['PREPARING','PENDING_MANAGER_APPROVAL'], DELIVERED: ['CLOSED'] };
const inputStyle = 'w-full rounded-lg border border-slate-600 bg-slate-900 p-2.5 text-sm text-white';
const formatExamDateTime = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const handoffStatusLabel = (status: string) => ({
  PENDING_ACCEPTANCE: 'Waiting for Head acceptance',
  ACCEPTED: 'Accepted by Head of Exam',
  ASSIGNED: 'Assigned — awaiting officer acceptance',
  OFFICER_ACCEPTED: 'Accepted by exam officer',
  IN_PROGRESS: 'Under progress',
  DELIVERED_TO_CRM: 'Provided successfully',
}[status] || status.replaceAll('_', ' '));

function ExamHandoffInbox({ canManage, canHandle }: { canManage: boolean; canHandle: boolean }) {
  const { currentUser, users } = useCrm() as any;
  const [handoffs, setHandoffs] = useState<ExamHandoff[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const token = () => localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('crm_auth_token') || '';
  const request = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(API_BASE_URL + '/api/exam-ops' + path, { method, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Request failed.');
    return data.data;
  }, []);
  const refresh = useCallback(async () => {
    try {
      const rows = await request('/handoffs');
      setHandoffs(rows);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load exam handoffs.'); }
  }, [request]);
  useEffect(() => { if (!canHandle) return; void refresh(); const timer = window.setInterval(() => void refresh(), 30000); return () => window.clearInterval(timer); }, [canHandle, refresh]);
  if (!canHandle) return null;
  const officers = (users || []).filter((user: any) => user.active !== false && user.id !== currentUser?.id && ['coordinator', 'exam_coordinator', 'exam_providing_officer'].includes(user.role));
  const runAction = async (handoff: ExamHandoff, action: string, body: Record<string, unknown> = {}) => {
    setBusyId(handoff.id);
    try { await request(`/handoffs/${handoff.id}/${action}`, 'POST', { revision: handoff.revision, ...body }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update the handoff.'); }
    finally { setBusyId(null); }
  };
  const pending = handoffs.filter(row => row.status === 'PENDING_ACCEPTANCE').length;
  return <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-cyan-100">Exam Department Inbox {pending > 0 && <span className="ml-2 rounded-full bg-cyan-500 px-2 py-0.5 text-xs text-slate-950">{pending} new</span>}</h3><p className="text-xs text-slate-400">Sales forwards appear here for Head of Exam acceptance and officer assignment.</p></div><button className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs" onClick={() => void refresh()}>Refresh inbox</button></div>
    {error && <p className="text-xs text-amber-200">{error}</p>}
    {!handoffs.length ? <p className="text-sm text-slate-400">No exam handoffs have been forwarded yet.</p> : <div className="space-y-2">{handoffs.map(handoff => {
      const assignedToCurrentOfficer = !canManage && handoff.assignedOfficerId === currentUser?.id;
      const receiptHref = handoff.paymentReceiptUrl?.startsWith('http') ? handoff.paymentReceiptUrl : handoff.paymentReceiptUrl ? `${API_BASE_URL}${handoff.paymentReceiptUrl}` : '';
      return <div key={handoff.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{handoff.leadName}</strong><p className="text-xs text-slate-400">{handoff.number} · {handoff.phone || 'No phone'} · {handoff.submittedByName || 'Sales team'}</p></div><span className="rounded-full bg-slate-700 px-2 py-1 text-[11px] uppercase">{handoffStatusLabel(handoff.status)}</span></div>
        <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-950/40 p-2 text-xs text-slate-300"><div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3"><span>Requirement: <b>{handoff.requirementType === 'international' ? 'International' : handoff.requirementType === 'country_specific' ? 'Country-specific' : '—'}</b></span><span>Exam: <b>{handoff.examTitle || '—'}</b></span><span>Country: <b>{handoff.examCountry || '—'}</b></span><span>Authority: <b>{handoff.authority || '—'}</b></span><span>Priority: <b className={handoff.priority === 'urgent' ? 'text-rose-300' : 'text-teal-300'}>{handoff.priority === 'urgent' ? 'Urgent' : handoff.priority === 'regular_work' ? 'Regular work' : '—'}</b></span><span>Quotation: <b>{handoff.quotationNumber || '—'}</b></span><span>Voucher: <b>{handoff.receiptVoucherNo || '—'}</b></span><span>Client: <b>{handoff.clientName || handoff.leadName}</b></span><span>Email: <b>{handoff.clientEmail || '—'}</b></span><span>Services: <b>{(handoff.services || []).map(value => value.replaceAll('_', ' ')).join(', ') || '—'}</b></span></div><div className="mt-2 flex flex-wrap gap-3">{receiptHref && <a className="text-cyan-300 underline" href={receiptHref} target="_blank" rel="noreferrer">View payment receipt{handoff.paymentReceiptFileName ? ` (${handoff.paymentReceiptFileName})` : ''}</a>}{handoff.receiptVoucherUrl && <a className="text-cyan-300 underline" href={handoff.receiptVoucherUrl.startsWith('http') ? handoff.receiptVoucherUrl : `${API_BASE_URL}${handoff.receiptVoucherUrl}`} target="_blank" rel="noreferrer" download={handoff.receiptVoucherFileName || true}>View / download receipt voucher PDF{handoff.receiptVoucherFileName ? ` (${handoff.receiptVoucherFileName})` : ''}</a>}</div></div>
        <div className="mt-3 grid gap-1 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-3"><span>Forwarded: <b>{formatExamDateTime(handoff.submittedAt)}</b></span>{handoff.acceptedAt && <span>HOE accepted: <b>{formatExamDateTime(handoff.acceptedAt)}</b></span>}{handoff.assignedAt && <span>Assigned: <b>{formatExamDateTime(handoff.assignedAt)}</b></span>}{handoff.officerAcceptedAt && <span>Officer accepted: <b>{formatExamDateTime(handoff.officerAcceptedAt)}</b></span>}{handoff.startedAt && <span>Under progress: <b>{formatExamDateTime(handoff.startedAt)}</b></span>}{handoff.completedAt && <span>Provided successfully: <b>{formatExamDateTime(handoff.completedAt)}</b></span>}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><div className={`rounded-lg border p-2 text-[11px] ${handoff.submittedAt ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 text-slate-500'}`}><b>1. Forwarded</b><br />{formatExamDateTime(handoff.submittedAt)}</div><div className={`rounded-lg border p-2 text-[11px] ${handoff.acceptedAt ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 text-slate-500'}`}><b>2. Head accepted</b><br />{formatExamDateTime(handoff.acceptedAt)}</div><div className={`rounded-lg border p-2 text-[11px] ${handoff.officerAcceptedAt ? 'border-teal-500/40 bg-teal-500/10 text-teal-100' : 'border-slate-700 text-slate-500'}`}><b>3. Officer accepted</b><br />{formatExamDateTime(handoff.officerAcceptedAt)}</div><div className={`rounded-lg border p-2 text-[11px] ${handoff.startedAt ? 'border-teal-500/40 bg-teal-500/10 text-teal-100' : 'border-slate-700 text-slate-500'}`}><b>4. Under progress</b><br />{formatExamDateTime(handoff.startedAt)}</div><div className={`rounded-lg border p-2 text-[11px] ${handoff.completedAt ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 text-slate-500'}`}><b>5. Provided successfully</b><br />{formatExamDateTime(handoff.completedAt)}</div></div>
        {canManage && handoff.status === 'PENDING_ACCEPTANCE' && <button disabled={busyId === handoff.id} className="mt-3 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void runAction(handoff, 'accept')}>Accept handoff</button>}
        {canManage && ['ACCEPTED', 'ASSIGNED'].includes(handoff.status) && <div className="mt-3 flex flex-wrap items-center gap-2"><select className={inputStyle + ' max-w-sm'} value={selectedOfficer[handoff.id] || handoff.assignedOfficerId || ''} onChange={event => setSelectedOfficer(prev => ({ ...prev, [handoff.id]: event.target.value }))}><option value="">Select exam providing officer</option>{officers.map((officer: any) => <option key={officer.id} value={officer.id}>{officer.fullName} ({officer.roleTitle || 'Exam Providing Officer'})</option>)}</select><button disabled={busyId === handoff.id || !selectedOfficer[handoff.id] && !handoff.assignedOfficerId} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { const officerId = selectedOfficer[handoff.id] || handoff.assignedOfficerId || ''; const officer = officers.find((item: any) => item.id === officerId); void runAction(handoff, 'assign', { officerId, officerName: officer?.fullName || handoff.assignedOfficerName || 'Exam Providing Officer' }); }}>Assign to officer</button></div>}
        {assignedToCurrentOfficer && handoff.status === 'ASSIGNED' && <button disabled={busyId === handoff.id} className="mt-3 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void runAction(handoff, 'accept-assignment')}>Accept requirement</button>}
        {assignedToCurrentOfficer && handoff.status === 'OFFICER_ACCEPTED' && <button disabled={busyId === handoff.id} className="mt-3 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void runAction(handoff, 'start')}>Start work</button>}
        {assignedToCurrentOfficer && handoff.status === 'IN_PROGRESS' && <button disabled={busyId === handoff.id} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void runAction(handoff, 'complete', { reason: 'Exam materials delivered to CRM.' })}>Complete handoff</button>}
        {handoff.assignedOfficerName && <p className="mt-2 text-xs text-teal-300">Assigned to {handoff.assignedOfficerName}</p>}
      </div>;
    })}</div>}
  </div>;
}

export function ExamOperationsView() {
  const { currentUser } = useCrm();
  const roleTitle = String(currentUser?.roleTitle || '').toLowerCase();
  const admin = ['super_admin', 'exam_department_manager'].includes(currentUser?.role || '') || roleTitle.includes('head of exam') || roleTitle.includes('exam department manager');
  const canHandle = admin || ['coordinator', 'exam_coordinator', 'exam_providing_officer'].includes(currentUser?.role || '') || roleTitle.includes('exam providing') || roleTitle.includes('exam officer');
  const canViewRequirements = admin || ['super_admin', 'coordinator', 'leads_officer', 'sales_coordinator'].includes(currentUser?.role || '');
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
    const response = await fetch(API_BASE_URL + '/api/exam-ops' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Request failed.');
    return data.data;
  }, []);
  const refresh = useCallback(async () => {
    if (!canViewRequirements) { setRecords([]); setError(''); return; }
    setBusy(true);
    try { setRecords(await request('/requirements')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load operations.'); }
    finally { setBusy(false); }
  }, [canViewRequirements, request]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!admin) return;
    let stopped = false;
    let running = false;
    const check = async () => {
      if (document.hidden || running) return;
      running = true;
      try { const result = await request('/health'); if (!stopped) { setHealth(result); setHealthError(''); } }
      catch { if (!stopped) { setHealth(null); setHealthError('Automatic check unavailable. Operational health is unknown.'); } }
      finally { running = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [admin, request]);
  const active = records.find(r => r.id === selected);
  async function action(actionName: string, body: Record<string, unknown> = {}) {
    if (!active || busy) return;
    setBusy(true);
    try {
      await request('/requirements/' + active.id + '/' + actionName, 'POST', { revision: active.revision, reason, ...body });
      setReason(''); setReference(''); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update record.'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const body: Record<string, unknown> = Object.fromEntries(form.entries());
    body.durationDays = Number(body.durationDays); body.attemptAllowance = Number(body.attemptAllowance); body.amountMinor = Number(body.amountMinor);
    body.services = String(body.services).split('\n').map(x => x.trim()).filter(Boolean);
    setBusy(true);
    try { await request('/requirements', 'POST', body); setShowForm(false); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to submit.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 text-slate-100">
    <ExamHandoffInbox canManage={admin} canHandle={canHandle} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Exam Order & Access Management</h2><p className="text-sm text-slate-400">Sales handoff, preparation, manager approval and verified delivery</p></div><div className="flex gap-2">{canViewRequirements && <button disabled={busy} className={inputStyle} onClick={() => void refresh()}>Refresh</button>}{canViewRequirements && <button className={inputStyle} onClick={() => setShowForm(!showForm)}>New exam order</button>}{admin && <button disabled={busy} className={inputStyle} onClick={async () => { try { setHealth(await request('/health')); } catch (e) { setError(String(e)); } }}>Check problems</button>}</div></div>
    {error && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">{error}<p className="mt-1 text-xs">No success is assumed when storage or configuration is unavailable.</p></div>}
    {healthError && <p role="status" className="text-sm text-amber-200">{healthError}</p>}
    {health && <div className="rounded-xl border border-slate-700 p-4"><h3 className="font-bold">Operational checks — {new Date(health.checkedAt).toLocaleString()}</h3><p className="text-xs text-slate-400">Automatic checks every 60 seconds while this workspace is visible. {health.coverage}</p>{health.issues.length === 0 ? <p className="mt-2">No issues found within this check’s coverage.</p> : health.issues.map((issue: any) => <p className="mt-2 text-amber-200" key={issue.id}>{issue.title} · {issue.requirement}</p>)}</div>}
    {showForm && <form onSubmit={submit} className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 space-y-4"><h3 className="font-bold">New Exam Order & Sales Handover</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[
      ['orderId','Order reference'],['studentName','Student name'],['email','Student email'],['phone','Phone'],['country','Country'],['timeZone','Time zone'],['profession','Profession'],['authority','Authority'],['examName','Examination'],['packageId','Exact package code'],['packageVersion','Package version'],['currency','Currency code'],['amountMinor','Amount in minor currency units'],['durationDays','Access duration (days)'],['attemptAllowance','Attempt allowance'],
    ].map(([name,label]) => <label className="text-xs space-y-1" key={name}><span>{label}</span><input required name={name} type={name === 'email' ? 'email' : ['amountMinor','durationDays','attemptAllowance'].includes(name) ? 'number' : 'text'} min={name === 'amountMinor' ? 0 : 1} className={inputStyle} defaultValue={name === 'timeZone' ? 'Asia/Colombo' : name === 'currency' ? 'USD' : undefined} maxLength={500}/></label>)}</div><label className="block text-xs space-y-1"><span>Access starts</span><select name="startTrigger" className={inputStyle}><option value="activation">When the student activates</option><option value="purchase">Purchase timestamp</option><option value="fixed">Fixed timestamp</option></select></label><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs">Purchase timestamp (if applicable)<input name="purchasedAt" type="datetime-local" className={inputStyle}/></label><label className="text-xs">Fixed start (if applicable)<input name="fixedStart" type="datetime-local" className={inputStyle}/></label></div><label className="block text-xs">Included services (one per line)<textarea required name="services" className={inputStyle}/></label><button disabled={busy} className="rounded-lg bg-teal-600 px-4 py-2 font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Submit to Exam Department'}</button><p className="text-xs text-slate-400">Submission preserves sold terms and does not activate student access.</p></form>}
    <label className="block"><span className="sr-only">Search requirements</span><input className={inputStyle} placeholder="Search student, email, order or requirement" value={search} onChange={e => setSearch(e.target.value)}/></label>
    <div className="grid lg:grid-cols-2 gap-4"><div className="space-y-2">{records.filter(r => [r.number,r.snapshot.studentName,r.snapshot.email,r.snapshot.orderId].join(' ').toLowerCase().includes(search.toLowerCase())).map(r => <button key={r.id} onClick={() => { setSelected(r.id); setReason(''); }} className={'w-full text-left rounded-xl border p-4 ' + (selected === r.id ? 'border-teal-400 bg-teal-500/10' : 'border-slate-700 bg-slate-800/40')}><div className="flex justify-between gap-2"><strong>{r.snapshot.studentName}</strong><span className="text-xs">{r.status.replaceAll('_',' ')}</span></div><p className="text-xs text-slate-400 mt-1">{r.number} · {r.snapshot.examName} · {r.snapshot.orderId}</p><p className="text-xs mt-2">Payment: {r.paymentStatus} · {r.entitlementId ? 'Access prepared' : 'Access pending'}</p></button>)}{!records.length && !error && <p className="text-sm text-slate-400">{busy ? 'Loading…' : 'No handoffs yet. Submit a purchased requirement to begin.'}</p>}</div>
    {active && <div className="rounded-xl border border-slate-700 p-5 space-y-4"><h3 className="font-bold">{active.number} · {active.snapshot.studentName}</h3><p className="text-sm">{active.snapshot.email}<br/>{active.snapshot.profession} · {active.snapshot.authority}<br/>Package: {active.snapshot.packageId} / {active.snapshot.packageVersion}<br/>{active.snapshot.durationDays} days · starts on {active.snapshot.startTrigger}<br/>{active.snapshot.attemptAllowance} attempts</p><div className="grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-slate-800 p-2">Payment: <b>{active.paymentStatus}</b></span><span className="rounded-lg bg-slate-800 p-2">Email: <b>{active.emailVerificationStatus || 'PENDING'}</b></span></div><ul className="text-sm list-disc pl-5">{active.snapshot.services.map((s: string) => <li key={s}>{s}</li>)}</ul>{admin && <><label className="block text-xs">Reason / delivery confirmation<textarea className={inputStyle} value={reason} onChange={e => setReason(e.target.value)}/></label>{active.paymentStatus !== 'VERIFIED' && <div><label className="text-xs">Payment verification reference<input className={inputStyle} value={reference} onChange={e => setReference(e.target.value)}/></label><button disabled={busy} className="mt-2 rounded-lg border border-slate-600 p-2 text-sm" onClick={() => void action('verify-payment',{reference})}>Verify payment</button></div>}{['ACCEPTED','PREPARING'].includes(active.status) && <div className="flex flex-wrap gap-3">{['account','materials','exams','quality','contact'].map(key => <label key={key} className="text-sm flex gap-2"><input disabled={busy} type="checkbox" checked={Boolean(active.checklist[key])} onChange={e => void action('checklist',{[key]:e.target.checked})}/>{key}</label>)}</div>}{['PREPARING','EMAIL_VERIFICATION_PENDING','READY'].includes(active.status) && active.emailVerificationStatus !== 'VERIFIED' && <button disabled={busy} className="rounded-lg border border-amber-500 px-3 py-2 text-sm" onClick={() => void action('mark-email-verified')}>Record verified email evidence</button>}{active.status === 'PENDING_MANAGER_APPROVAL' && <div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm" onClick={() => void action('manager-approve')}>Approve access</button><button disabled={busy} className="rounded-lg border border-amber-500 px-3 py-2 text-sm" onClick={() => void action('manager-return')}>Return for correction</button><button disabled={busy} className="rounded-lg border border-rose-500 px-3 py-2 text-sm" onClick={() => void action('manager-reject')}>Reject</button></div>}<div className="flex flex-wrap gap-2">{(transitions[active.status] || []).map(status => <button key={status} disabled={busy} className="rounded-lg border border-teal-600 px-3 py-2 text-sm disabled:opacity-50" onClick={() => void action('transition',{status})}>{status.replaceAll('_',' ')}</button>)}</div>{active.status === 'APPROVED_ACTIVATION_PENDING' && !active.entitlementId && <div><label className="text-xs">Published material IDs (comma separated)<input value={materialIds} onChange={e => setMaterialIds(e.target.value)} className={inputStyle}/></label><button disabled={busy} className="mt-2 rounded-lg bg-teal-600 px-3 py-2" onClick={() => void action('prepare-access',{materialIds: materialIds.split(',').map(x => x.trim()).filter(Boolean)})}>Prepare approved access</button></div>}<p className="text-xs text-slate-400">Manager approval, activation, notification, and delivery remain separate audited steps.</p></>}</div>}</div>
  </section>;
}
