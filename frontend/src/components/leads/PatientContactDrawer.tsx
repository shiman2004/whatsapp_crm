import React from 'react';
import { Clock3, Copy, ExternalLink, MessageCircle, Phone, ShieldCheck, User, X } from 'lucide-react';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { CompanyTagBadge } from '../common/CompanyTagBadge';
import { formatWhatsAppDisplay } from '../../utils/phoneUtils';

interface PatientContactDrawerProps { lead: Lead; onClose: () => void; }

export const PatientContactDrawer: React.FC<PatientContactDrawerProps> = ({ lead, onClose }) => {
  const { categories, treatments, users, messages, notes } = useCrm();
  const category = categories.find(item => item.id === lead.categoryId);
  const treatment = treatments.find(item => item.id === lead.treatmentId);
  const coordinator = users.find(user => user.id === lead.assignedTo);
  const assignedBy = lead.assignedByName || users.find(user => user.id === lead.assignedById)?.fullName || 'System';
  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);
  const leadMessages = messages.filter(message => message.leadId === lead.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const leadNotes = notes.filter(note => note.leadId === lead.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const activity = [
    { type: 'lead', label: 'Lead received', detail: `${lead.source || 'WhatsApp'} · ${lead.stage.replace('_', ' ')}`, date: lead.createdAt, color: 'bg-emerald-500', icon: <MessageCircle className="h-3 w-3" /> },
    ...(lead.assignedAt ? [{ type: 'assignment', label: 'Assigned to coordinator', detail: coordinator?.fullName || 'Assigned coordinator', date: lead.assignedAt, color: 'bg-blue-500', icon: <User className="h-3 w-3" /> }] : []),
    ...leadNotes.slice(0, 3).map(note => ({ type: 'note', label: 'Internal note', detail: note.note, date: note.updatedAt || note.createdAt, color: 'bg-violet-500', icon: <ShieldCheck className="h-3 w-3" /> })),
    ...leadMessages.slice(0, 6).map(message => ({ type: message.direction, label: message.direction === 'inbound' ? 'Last customer message' : 'Last coordinator response', detail: message.content, date: message.createdAt, color: message.direction === 'inbound' ? 'bg-emerald-500' : 'bg-sky-500', icon: <MessageCircle className="h-3 w-3" /> }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Patient contact details">
    <button type="button" aria-label="Close patient details" className="absolute inset-0 w-full cursor-default bg-slate-950/60 backdrop-blur-[1px]" onClick={onClose} />
    <aside className="absolute right-0 top-0 h-full w-[30vw] min-w-[320px] max-w-[460px] max-sm:w-full max-sm:min-w-0 overflow-y-auto border-l border-slate-700 bg-slate-950 shadow-2xl">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-start justify-between"><div className="flex min-w-0 items-center gap-2.5">
          {lead.customer?.avatarUrl ? <img src={lead.customer.avatarUrl} alt={lead.customer.displayName} className="h-11 w-11 rounded-full border border-teal-500/40 object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">{(lead.customer?.displayName || 'WA').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'WA'}</div>}
          <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-100">{lead.customer?.displayName || 'WhatsApp Customer'}</h2><p className="truncate font-mono text-[10px] text-slate-400">{displayPhone || rawPhone || 'No phone number'}</p><CompanyTagBadge lead={lead} size="xs" /></div>
        </div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close patient details"><X className="h-4 w-4" /></button></div>
        <div className="mt-2 flex gap-1.5">{rawPhone && <a href={`tel:${rawPhone}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-[10px] font-semibold text-emerald-300"><Phone className="h-3 w-3" /> Call</a>}{rawPhone && <a href={`https://wa.me/${rawPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-slate-800 px-2 py-1.5 text-[10px] font-semibold text-slate-300"><ExternalLink className="h-3 w-3" /> WhatsApp</a>}{rawPhone && <button type="button" onClick={() => navigator.clipboard.writeText(rawPhone)} className="rounded-md bg-slate-800 px-2 text-slate-300" aria-label="Copy phone number"><Copy className="h-3 w-3" /></button>}</div>
      </header>
      <div className="space-y-3 p-3">
        <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">Current Status</h3><span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold capitalize text-violet-300">{lead.stage.replace('_', ' ')}</span></div><div className="grid grid-cols-2 gap-2"><Status label="Coordinator" value={coordinator?.fullName || 'Unassigned'} /><Status label="Assigned By" value={assignedBy} /><Status label="Treatment" value={treatment?.name || category?.name || 'Not selected'} /><Status label="Language" value={(lead.language || lead.customer?.preferredLanguage || 'en').toUpperCase()} /></div></section>
        <section className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5"><Detail label="Inquiry ID" value={lead.serialNumber || lead.id} /><Detail label="Source" value={lead.source || 'WhatsApp'} /><Detail label="Received" value={new Date(lead.createdAt).toLocaleString()} /><Detail label="Assign Time" value={lead.assignedAt ? new Date(lead.assignedAt).toLocaleString() : 'Not assigned'} /></section>
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Activity History</h3><span className="text-[9px] text-slate-500">{activity.length} events</span></div><div className="space-y-2.5">{activity.length ? activity.map((item, index) => <div key={`${item.type}-${item.date}-${index}`} className="flex gap-2"><div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${item.color}`}>{item.icon}</div><div className="min-w-0 flex-1 border-b border-slate-800/70 pb-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold text-slate-200">{item.label}</p><span className="shrink-0 text-[8px] text-slate-500">{new Date(item.date).toLocaleDateString()}</span></div><p className="mt-0.5 line-clamp-2 text-[9px] text-slate-400">{item.detail}</p><p className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-600"><Clock3 className="h-2.5 w-2.5" />{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div>) : <p className="py-4 text-center text-[10px] text-slate-500">No activity recorded yet.</p>}</div></section>
      </div>
    </aside>
  </div>;
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 break-words text-[10px] font-medium capitalize text-slate-200">{value}</p></div>;
const Status: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0"><p className="text-[8px] text-slate-500">{label}</p><p className="truncate text-[10px] font-semibold text-slate-200">{value}</p></div>;
