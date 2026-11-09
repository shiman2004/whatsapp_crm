import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  MessageSquare,
  Phone,
  RotateCcw,
  Sparkles,
  Stethoscope,
  User,
  XCircle,
} from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { getAppointmentStatusConfig } from '../../utils/appointmentStatusUtils';
import { ActivityTimeline, FormDrawer } from '../ui';
import { addMinutesToTime, colomboDateKey, formatColomboDate, formatColomboDateTime, formatColomboTime, toColomboISO } from '../../utils/appointmentTime';
import { AppDatePicker, AppTimePicker } from '../common';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  appointmentId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  rooms?: any[];
  initialMode?: 'view' | 'reschedule' | 'cancel';
  onOpenWhatsAppChat?: (patientPhone: string) => void;
  onReschedule?: (appointmentId: string) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  appointmentId,
  onClose,
  onUpdated,
  initialMode = 'view',
  onOpenWhatsAppChat,
  onReschedule,
}) => {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedReason, setReschedReason] = useState('');

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchDetails = async () => {
    if (!appointmentId) return;
    setIsLoading(true);
    try {
      const data = await appointmentService.getAppointment(appointmentId);
      setAppointment(data);
      setReschedDate(colomboDateKey(data.startTime));
      setReschedTime(new Date(data.startTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false }));
    } catch (err: any) {
      setActionError(err.message || 'Failed to load appointment details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !appointmentId) return;
    setActionError(null);
    setIsRescheduling(initialMode === 'reschedule');
    setIsCancelling(initialMode === 'cancel');
    setTab('details');
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, appointmentId, initialMode]);

  const runAction = async (action: () => Promise<unknown>, message?: string) => {
    setSubmitting(true);
    setActionError(null);
    try {
      await action();
      await fetchDetails();
      onUpdated();
      if (message) setActionError(message);
      return true;
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = (status: AppointmentStatus, reason: string) => {
    if (!appointment) return;
    runAction(() => appointmentService.updateAppointmentStatus(appointment.id, status, reason));
  };

  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    if (onReschedule) {
      onReschedule(appointment.id);
      return;
    }
    const duration = appointment.treatmentDuration || 30;
    const ok = await runAction(() => appointmentService.rescheduleAppointment(appointment.id, {
      newStartTime: toColomboISO(reschedDate, reschedTime),
      newEndTime: toColomboISO(reschedDate, addMinutesToTime(reschedTime, duration)),
      reason: reschedReason.trim() || 'Rescheduled by clinic',
    }));
    if (ok) setIsRescheduling(false);
  };

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    if (!cancelReason.trim()) {
      setActionError('A cancellation reason is required.');
      return;
    }
    const ok = await runAction(() => appointmentService.cancelAppointment(appointment.id, cancelReason.trim()));
    if (ok) setIsCancelling(false);
  };

  const statusConfig = getAppointmentStatusConfig(appointment?.status);

  return (
    <FormDrawer
      open={isOpen}
      onClose={onClose}
      title="Appointment details"
      description={appointment ? `${appointment.branchName || 'Clinic'} · ${formatColomboDate(appointment.startTime, { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined}
      widthClass="max-w-xl"
      footer={(
        <div className="flex justify-end gap-2">
          {appointment && appointment.status !== 'cancelled' && (
            <>
              <button type="button" onClick={() => setIsRescheduling(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-300 hover:bg-orange-500/25">
                <RotateCcw className="h-3.5 w-3.5" /> Reschedule
              </button>
              <button type="button" onClick={() => setIsCancelling(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25">
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">Close</button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg border border-[#E0E5E7] p-1 dark:border-[#222D34]">
          {(['details', 'history'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${tab === key ? 'bg-teal-600 text-white' : 'text-[#667781] hover:bg-[#F0F2F5] dark:text-[#8696A0] dark:hover:bg-[#2A3942]'}`}
            >
              {key === 'history' && <History className="h-3.5 w-3.5" />}
              {key === 'details' ? 'Details' : 'Audit history'}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
          </div>
        )}

        {isLoading ? (
          <p className="py-10 text-center text-xs text-[#667781] dark:text-[#8696A0]">Loading appointment…</p>
        ) : !appointment ? (
          <p className="py-10 text-center text-xs text-rose-400">Appointment not found.</p>
        ) : tab === 'history' ? (
          <ActivityTimeline
            empty={<p className="py-6 text-center text-xs text-[#667781] dark:text-[#8696A0]">No status changes recorded yet.</p>}
            entries={(appointment.statusHistory || []).map((entry) => ({
              id: entry.id,
              title: entry.previousStatus ? `${getAppointmentStatusConfig(String(entry.previousStatus)).label} → ${getAppointmentStatusConfig(String(entry.newStatus)).label}` : getAppointmentStatusConfig(String(entry.newStatus)).label,
              detail: [entry.changedByName ? `By ${entry.changedByName}` : null, entry.reason].filter(Boolean).join(' · '),
              time: formatColomboDateTime(entry.changedAt),
              tone: String(entry.newStatus) === 'cancelled' ? 'danger' : String(entry.newStatus) === 'confirmed' ? 'success' : 'info',
            }))}
          />
        ) : isRescheduling && !onReschedule ? (
          <form onSubmit={submitReschedule} className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
            <p className="text-xs font-bold text-orange-300">Reschedule appointment</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-slate-400">New date</label>
                <AppDatePicker
                  value={reschedDate}
                  onChange={(val) => setReschedDate(val)}
                  clearable={false}
                  className="w-full"
                  inputClassName="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-slate-400">New start time</label>
                <AppTimePicker
                  value={reschedTime}
                  onChange={(val) => setReschedTime(val)}
                  clearable={false}
                  className="w-full"
                  inputClassName="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-400">Reason</label>
              <input value={reschedReason} onChange={(e) => setReschedReason(e.target.value)} placeholder="Why is this moving?" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-orange-400 focus:outline-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsRescheduling(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">Back</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-500 disabled:opacity-50">Save new time</button>
            </div>
          </form>
        ) : isCancelling ? (
          <form onSubmit={submitCancel} className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
            <p className="text-xs font-bold text-rose-300">Cancel appointment</p>
            <p className="text-[11px] text-slate-400">The patient will be notified and the slot will be released.</p>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancellation reason (required)" className="w-full rounded-lg border border-rose-500/40 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-rose-400 focus:outline-none" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCancelling(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">Keep</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50">Confirm cancellation</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#111B21]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15 text-sm font-bold text-teal-600 dark:text-teal-300">
                  {appointment.patientName?.charAt(0) || 'P'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">{appointment.patientName || 'Patient'}</p>
                  <p className="flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400"><Phone className="h-3 w-3" />{appointment.patientPhone || 'No phone'}</p>
                  {appointment.leadSerialNumber && <p className="font-mono text-[10px] text-[#667781] dark:text-[#8696A0]">{appointment.leadSerialNumber}{appointment.leadStage ? ` · ${appointment.leadStage}` : ''}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig.badgeClass}`}>{statusConfig.iconEmoji} {statusConfig.label}</span>
                {appointment.patientPhone && onOpenWhatsAppChat && (
                  <button type="button" onClick={() => onOpenWhatsAppChat(appointment.patientPhone!)} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-500 hover:bg-emerald-500/20" title="Open WhatsApp chat">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {[
                { icon: Calendar, label: 'Date & time', value: formatColomboDate(appointment.startTime, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), hint: `${formatColomboTime(appointment.startTime)} – ${formatColomboTime(appointment.endTime)}` },
                { icon: Stethoscope, label: 'Doctor', value: appointment.doctorName || 'Doctor', hint: appointment.doctorTitle || 'Attending' },
                { icon: Sparkles, label: 'Treatment', value: appointment.treatmentName || 'Treatment', hint: appointment.treatmentPrice ? `LKR ${Number(appointment.treatmentPrice).toLocaleString()}` : appointment.appointmentType || '' },
                { icon: Clock, label: 'Clinic', value: appointment.branchName || 'Clinic', hint: appointment.roomNumber ? `${appointment.roomNumber} · ${appointment.roomName}` : 'Doctor-led appointment' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#111B21]">
                  <p className="mb-1 flex items-center gap-1 text-[10px] text-[#667781] dark:text-[#8696A0]"><item.icon className="h-3 w-3 text-teal-500" />{item.label}</p>
                  <p className="truncate font-bold text-[#111B21] dark:text-[#E9EDEF]">{item.value}</p>
                  <p className="truncate text-[10px] text-[#667781] dark:text-[#8696A0]">{item.hint}</p>
                </div>
              ))}
            </div>

            {appointment.notes && (
              <div className="rounded-xl border border-[#E0E5E7] bg-white p-3 text-xs dark:border-[#222D34] dark:bg-[#111B21]">
                <p className="mb-1 text-[10px] text-[#667781] dark:text-[#8696A0]">Notes</p>
                <p className="text-[#111B21] dark:text-[#E9EDEF]">{appointment.notes}</p>
              </div>
            )}

            {appointment.status === 'cancelled' && appointment.cancellationReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
                <p className="mb-1 text-[10px] text-rose-400">Cancellation reason</p>
                <p className="text-rose-300">{appointment.cancellationReason}</p>
              </div>
            )}

            {appointment.status !== 'cancelled' && (
              <div className="space-y-2 border-t border-[#E0E5E7] pt-3 dark:border-[#222D34]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696A0]">Update status</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  <button type="button" onClick={() => changeStatus('confirmed', 'Customer confirmed the appointment')} disabled={submitting} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300">Confirm</button>
                  <button type="button" onClick={() => changeStatus('arrived', 'Customer arrived at the clinic')} disabled={submitting} className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1.5 text-[11px] font-bold text-purple-600 hover:bg-purple-500/20 disabled:opacity-50 dark:text-purple-300">Arrived</button>
                  <button type="button" onClick={() => changeStatus('paid', 'Payment completed')} disabled={submitting} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] font-bold text-amber-600 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300">Paid</button>
                  <button type="button" onClick={() => changeStatus('no_answer', 'Customer did not respond')} disabled={submitting} className="rounded-lg border border-slate-500/30 bg-slate-500/10 px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-500/20 disabled:opacity-50 dark:text-slate-300">No answer</button>
                  <button type="button" onClick={() => changeStatus('completed', 'Visit completed')} disabled={submitting} className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-2 py-1.5 text-[11px] font-bold text-teal-600 hover:bg-teal-500/20 disabled:opacity-50 dark:text-teal-300">Completed</button>
                  <button type="button" onClick={() => changeStatus('no_show', 'Customer did not attend')} disabled={submitting} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300">No show</button>
                </div>
              </div>
            )}

            {isRescheduling && onReschedule && (
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
                <p className="flex items-center gap-1.5 font-bold"><RotateCcw className="h-3.5 w-3.5" /> Open the booking form to move this appointment.</p>
              </div>
            )}

            <div className="rounded-xl border border-[#E0E5E7] bg-white p-3 text-[11px] text-[#667781] dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#8696A0]">
              <p className="flex items-center gap-1.5"><User className="h-3 w-3" /> Created by {appointment.createdByName || 'System'}</p>
              <p className="mt-0.5 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> {formatColomboDateTime(appointment.createdAt)}</p>
            </div>
          </>
        )}
      </div>
    </FormDrawer>
  );
};
