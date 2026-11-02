import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, Copy, ListPlus, MessageCircle, Phone, ShieldCheck, Tag, User, X } from 'lucide-react';
import { PRESET_LABELS } from '../chat/WhatsAppChatList';
import { Lead } from '../../types';
import { useCrm } from '../../context/CrmContext';
import { CompanyTagBadge } from '../common/CompanyTagBadge';
import { formatWhatsAppDisplay } from '../../utils/phoneUtils';

interface PatientContactDrawerProps { lead: Lead; onClose: () => void; onOpenWhatsApp: () => void; }

export const PatientContactDrawer: React.FC<PatientContactDrawerProps> = ({ lead, onClose, onOpenWhatsApp }) => {
  const { categories, treatments, users, messages, notes, chatLabels, leadLabels, toggleLeadLabel, currentUser } = useCrm();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const category = categories.find(item => item.id === lead.categoryId);
  const treatment = treatments.find(item => item.id === lead.treatmentId);
  const coordinator = users.find(user => user.id === lead.assignedTo);
  const assignedBy = lead.assignedByName || users.find(user => user.id === lead.assignedById)?.fullName || 'System';
  // Assign Labels & Lists state
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(event.target as Node)) {
        setLabelPickerOpen(false);
      }
    };
    if (labelPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [labelPickerOpen]);

  const allAvailableLabels = chatLabels && chatLabels.length > 0 ? chatLabels : PRESET_LABELS;
  const availableLabels = allAvailableLabels.filter((lbl: any) => {
    if (lbl.isActive === false) return false;
    if (lbl.company && lbl.company !== 'ALL' && lead.company) {
      if (lbl.company !== lead.company) return false;
    }
    if (lbl.allowedRoles && lbl.allowedRoles !== 'ALL' && currentUser?.role) {
      try {
        const allowed = Array.isArray(lbl.allowedRoles)
          ? lbl.allowedRoles
          : (lbl.allowedRoles.startsWith('[') ? JSON.parse(lbl.allowedRoles) : lbl.allowedRoles.split(',').map((s: string) => s.trim()));
        if (!allowed.includes('ALL') && !allowed.includes('all') && !allowed.includes(currentUser.role)) {
          return false;
        }
      } catch {}
    }
    return true;
  });

  const activeLabelIds = leadLabels[lead.id] || lead.labels || [];
  const assignedLabels = activeLabelIds.map(id => 
    allAvailableLabels.find((l: any) => l.id === id || l.key === id) || 
    PRESET_LABELS.find(l => l.id === id || (l as any).key === id)
  ).filter(Boolean);

  const rawPhone = lead.customer?.whatsappNumber || '';
  const displayPhone = lead.customer?.phoneNumber || formatWhatsAppDisplay(rawPhone);
  const customerName = lead.customer?.displayName || 'WhatsApp Customer';

  const activity = useMemo(() => {
    const leadMessages = messages.filter(message => message.leadId === lead.id);
    const leadNotes = notes.filter(note => note.leadId === lead.id);
    return [
      { type: 'lead', label: 'Lead received', detail: `${lead.source || 'WhatsApp'} · ${lead.stage.replace(/_/g, ' ')}`, date: lead.createdAt, color: 'bg-emerald-500', icon: <MessageCircle className="h-4 w-4" /> },
      ...(lead.assignedAt ? [{ type: 'assignment', label: 'Assigned to coordinator', detail: coordinator?.fullName || 'Assigned coordinator', date: lead.assignedAt, color: 'bg-blue-500', icon: <User className="h-4 w-4" /> }] : []),
      ...leadNotes.map(note => ({ type: 'note', label: note.updatedAt ? 'Internal note · updated' : 'Internal note', detail: note.note, date: note.updatedAt || note.createdAt, color: 'bg-violet-500', icon: <ShieldCheck className="h-4 w-4" /> })),
      ...leadMessages.map(message => ({ type: message.direction, label: message.direction === 'inbound' ? 'Customer message' : 'CRM response', detail: message.content || 'Message content unavailable', date: message.createdAt, color: message.direction === 'inbound' ? 'bg-emerald-500' : 'bg-sky-500', icon: <MessageCircle className="h-4 w-4" /> }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [messages, notes, lead.id, lead.source, lead.stage, lead.createdAt, lead.assignedAt, coordinator?.fullName]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const copyPhone = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(rawPhone);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2200);
  };

  const dateTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  return <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="patient-drawer-title">
    <button type="button" aria-label="Close patient details" className="absolute inset-0 w-full cursor-default bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
    <aside className="absolute inset-y-0 right-0 flex h-[100dvh] w-[min(100vw,520px)] flex-col overflow-hidden border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111B21] text-slate-900 dark:text-slate-100 shadow-2xl sm:w-[min(92vw,520px)] lg:w-[min(42vw,560px)]">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#202C33] px-5 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          {lead.customer?.avatarUrl ? <img src={lead.customer.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl border border-teal-500/30 object-cover" /> : <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-xl font-bold text-white">{customerName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'WA'}</div>}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="patient-drawer-title" className="break-words text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">{customerName}</h2>
            <p className="mt-1 break-all font-mono text-sm text-slate-600 dark:text-slate-300">{displayPhone || rawPhone || 'No phone number available'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><CompanyTagBadge lead={lead} size="sm" /><span className="text-xs text-slate-500">Contact details</span></div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="-mr-2 -mt-2 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400" aria-label="Close patient details"><X className="h-5 w-5" /></button>
        </div>
        <section aria-labelledby="contact-section-title" className="mt-5">
          <div className="mb-2 flex items-center justify-between"><h3 id="contact-section-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</h3>{copyState !== 'idle' && <span role="status" className={`text-xs ${copyState === 'copied' ? 'text-emerald-400' : 'text-amber-300'}`}>{copyState === 'copied' ? 'Phone copied' : 'Could not copy phone'}</span>}</div>
          <div className="grid grid-cols-2 gap-2">
            {rawPhone ? <a href={`tel:${rawPhone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"><Phone className="h-4 w-4" />Call</a> : <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm text-slate-500">No number to call</span>}
            {rawPhone ? <button type="button" onClick={onOpenWhatsApp} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"><MessageCircle className="h-4 w-4" />WhatsApp</button> : <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-800 px-3 text-sm text-slate-500">No WhatsApp number</span>}
          </div>
          {rawPhone && <button type="button" onClick={copyPhone} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400"><Copy className="h-4 w-4" />Copy phone number</button>}
        </section>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <section aria-labelledby="status-section-title" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 id="status-section-title" className="text-sm font-semibold text-slate-100">Current status</h3><span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold capitalize text-violet-200">{lead.stage.replace(/_/g, ' ')}</span></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Status label="Coordinator" value={coordinator?.fullName || 'Unassigned'} /><Status label="Assigned by" value={assignedBy} /></div>
        </section>

        {/* Assign Labels / Lists Section */}
        <section aria-labelledby="labels-section-title" className="space-y-2 relative" ref={labelPickerRef}>
          <div className="flex items-center justify-between">
            <h3 id="labels-section-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span>Assign Labels</span>
            </h3>
            <button
              type="button"
              onClick={() => setLabelPickerOpen(prev => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
              title="Add to list / assign labels"
            >
              <ListPlus className="h-3.5 w-3.5" />
              <span>Add to list</span>
            </button>
          </div>

          {/* Active Assigned Labels Badges */}
          <div className="flex flex-wrap gap-1.5 items-center min-h-[34px] p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            {assignedLabels.length > 0 ? (
              assignedLabels.map((lbl: any) => {
                const isCustom = !lbl.bgColor && !lbl.color?.includes('bg-') && lbl.color;
                return (
                  <span
                    key={lbl.id || lbl.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                      lbl.bgColor || lbl.color || 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30'
                    }`}
                    style={isCustom ? { backgroundColor: `${lbl.color}20`, color: lbl.color, borderColor: `${lbl.color}40` } : undefined}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${lbl.dotColor || lbl.dot || 'bg-amber-400'}`}
                      style={isCustom ? { backgroundColor: lbl.color } : undefined}
                    />
                    <span>{lbl.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleLeadLabel(lead.id, lbl.id || lbl.key)}
                      className="hover:opacity-75 p-0.5 -mr-0.5 cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      title={`Remove ${lbl.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="text-xs text-slate-500 italic px-1">
                No labels assigned yet. Click "+ Add to list" to assign.
              </span>
            )}
          </div>

          {/* Label Picker Popover */}
          {labelPickerOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#182229] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Select Assign Labels
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Click to toggle</span>
              </div>
              <div className="space-y-1 pt-1">
                {availableLabels.map((lbl: any) => {
                  const isChecked = activeLabelIds.includes(lbl.id) || activeLabelIds.includes(lbl.key);
                  const isCustom = !lbl.dotColor && !lbl.dot && lbl.color;
                  return (
                    <button
                      key={lbl.id || lbl.key}
                      type="button"
                      onClick={() => toggleLeadLabel(lead.id, lbl.id || lbl.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                        isChecked
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-500/40 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-700 dark:text-slate-300 border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${lbl.dotColor || lbl.dot || 'bg-amber-400'}`}
                          style={isCustom ? { backgroundColor: lbl.color } : undefined}
                        />
                        <span>{lbl.name}</span>
                      </span>
                      {isChecked && <Check className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="details-section-title">
          <h3 id="details-section-title" className="mb-3 text-sm font-semibold text-slate-100">Lead details</h3>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
            <Detail label="Inquiry ID" value={lead.serialNumber || lead.id} />
            <Detail label="Source" value={lead.source || 'WhatsApp'} />
            <Detail label="Treatment / course" value={treatment?.name || category?.name || 'Not selected'} />
            <Detail label="Language" value={(lead.language || lead.customer?.preferredLanguage || 'en').toUpperCase()} />
            <Detail label="Received" value={dateTime(lead.createdAt)} />
            <Detail label="Assigned" value={lead.assignedAt ? dateTime(lead.assignedAt) : 'Not assigned'} />
          </div>
        </section>

        <section aria-labelledby="activity-section-title" className="pb-2">
          <div className="mb-3 flex items-center justify-between"><h3 id="activity-section-title" className="text-sm font-semibold text-slate-100">Recent activity</h3><span className="text-xs text-slate-500">Latest {activity.length} events</span></div>
          {activity.length ? <ol className="space-y-0">{activity.map((item, index) => <li key={`${item.type}-${item.date}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
            {index < activity.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-800" />}
            <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ring-4 ring-slate-950 ${item.color}`}>{item.icon}</span>
            <div className="min-w-0 flex-1 border-b border-slate-800/80 pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="text-sm font-semibold text-slate-200">{item.label}</p><time className="text-xs text-slate-500">{dateTime(item.date)}</time></div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-400">{item.detail}</p>
            </div>
          </li>)}</ol> : <p className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>}
          {activity.length === 10 && <p className="mt-3 text-center text-xs text-slate-500">Showing the 10 most recent events</p>}
        </section>
      </div>
    </aside>
  </div>;
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0 bg-white dark:bg-slate-900/80 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-200">{value}</p></div>;
const Status: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p></div>;
