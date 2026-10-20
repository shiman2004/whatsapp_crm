import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Sparkles, 
  Stethoscope, 
  Phone, 
  DoorOpen, 
  History, 
  CheckCircle2, 
  RotateCcw, 
  XCircle, 
  AlertCircle,
  Play,
  MessageSquare
} from 'lucide-react';
import { Appointment, AppointmentStatus, Room } from '../../types';
import { appointmentService } from '../../services/appointmentService';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  appointmentId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  rooms: Room[];
  onOpenWhatsAppChat?: (patientPhone: string) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  appointmentId,
  onClose,
  onUpdated,
  rooms,
  onOpenWhatsAppChat
}) => {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  // Reschedule Form State
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [reschedDate, setReschedDate] = useState<string>('');
  const [reschedStartTime, setReschedStartTime] = useState<string>('');
  const [reschedRoomId, setReschedRoomId] = useState<string>('');
  const [reschedReason, setReschedReason] = useState<string>('');

  // Cancel Form State
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchDetails = async () => {
    if (!appointmentId) return;
    setIsLoading(true);
    try {
      const data = await appointmentService.getAppointment(appointmentId);
      setAppointment(data);
      if (data.startTime) {
        const d = new Date(data.startTime);
        setReschedDate(d.toISOString().split('T')[0]);
        setReschedStartTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        setReschedRoomId(data.roomId);
      }
    } catch (e: any) {
      setActionError(e.message || 'Failed to load appointment details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && appointmentId) {
      setActionError(null);
      setIsRescheduling(false);
      setIsCancelling(false);
      setActiveTab('details');
      fetchDetails();
    }
  }, [isOpen, appointmentId]);

  if (!isOpen) return null;

  const handleStatusChange = async (newStatus: AppointmentStatus, reason?: string) => {
    if (!appointment) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await appointmentService.updateAppointmentStatus(appointment.id, newStatus, reason);
      await fetchDetails();
      onUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update appointment status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    setActionError(null);

    const durationMin = appointment.treatmentDuration || 45;
    const [h, m] = reschedStartTime.split(':').map(Number);
    const totalMin = (h * 60) + m + durationMin;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const reschedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const newStartISO = new Date(`${reschedDate}T${reschedStartTime}:00.000Z`).toISOString();
    const newEndISO = new Date(`${reschedDate}T${reschedEndTime}:00.000Z`).toISOString();

    setIsSubmitting(true);
    try {
      await appointmentService.rescheduleAppointment(appointment.id, {
        newStartTime: newStartISO,
        newEndTime: newEndISO,
        newRoomId: reschedRoomId || appointment.roomId,
        reason: reschedReason.trim() || 'Rescheduled via calendar'
      });
      setIsRescheduling(false);
      await fetchDetails();
      onUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Slot conflict detected while rescheduling.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;
    if (!cancelReason.trim()) {
      setActionError('Cancellation reason is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await appointmentService.cancelAppointment(appointment.id, cancelReason.trim());
      setIsCancelling(false);
      await fetchDetails();
      onUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">Confirmed</span>;
      case 'checked_in':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">Checked In</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 animate-pulse">In Progress</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Completed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">Cancelled</span>;
      case 'no_show':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">No Show</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide">Appointment Workspace</h3>
              <p className="text-xs text-slate-400">
                {appointment?.branchName || 'Alpha Health'} &bull; {appointment?.roomName || 'Room'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'details' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Details & Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4">
          {actionError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mb-2" />
              <span className="text-xs">Loading appointment details...</span>
            </div>
          ) : !appointment ? (
            <p className="text-xs text-rose-400 text-center py-8">Appointment not found.</p>
          ) : activeTab === 'history' ? (
            /* Chronological Audit Trail */
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <History className="w-4 h-4 text-teal-400" />
                <span>Status Change Audit Trail</span>
              </h4>

              {(!appointment.statusHistory || appointment.statusHistory.length === 0) ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">No status changes recorded yet.</p>
              ) : (
                <div className="space-y-2.5 border-l-2 border-slate-800 ml-3 pl-4">
                  {appointment.statusHistory.map((h, i) => (
                    <div key={h.id || i} className="relative text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-500 absolute -left-[21px] top-1 ring-4 ring-slate-900" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white capitalize">
                          {h.previousStatus ? `${h.previousStatus} ➔ ${h.newStatus}` : h.newStatus}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(h.changedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">By {h.changedByName}</p>
                      {h.reason && (
                        <p className="text-[11px] text-teal-300/80 bg-slate-950/60 p-1.5 rounded-md mt-1 border border-slate-800">
                          &ldquo;{h.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isRescheduling ? (
            /* Reschedule Form */
            <form onSubmit={handleRescheduleSubmit} className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reschedule Appointment</span>
              </h4>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">New Date</label>
                  <input
                    type="date"
                    value={reschedDate}
                    onChange={(e) => setReschedDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">New Start Time</label>
                  <select
                    value={reschedStartTime}
                    onChange={(e) => setReschedStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    {Array.from({ length: 25 }, (_, i) => {
                      const h = Math.floor(i / 2) + 8;
                      const m = (i % 2) * 30;
                      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      return <option key={time} value={time}>{time}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Room</label>
                <select
                  value={reschedRoomId}
                  onChange={(e) => setReschedRoomId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} &bull; {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Reason for Rescheduling</label>
                <input
                  type="text"
                  placeholder="e.g. Patient requested afternoon schedule change"
                  value={reschedReason}
                  onChange={(e) => setReschedReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRescheduling(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          ) : isCancelling ? (
            /* Cancel Form */
            <form onSubmit={handleCancelSubmit} className="space-y-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Appointment</span>
              </h4>
              <p className="text-[11px] text-slate-300">
                Are you sure you want to cancel this booking? A cancellation notification will be sent to the patient.
              </p>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Reason for Cancellation (Required)</label>
                <input
                  type="text"
                  placeholder="e.g. Patient unavailable / medical postponement..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelling(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
                >
                  {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          ) : (
            /* Main Details & Workflow Actions */
            <div className="space-y-4">
              {/* Patient Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                    {appointment.patientName?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{appointment.patientName || 'Patient'}</h4>
                    <p className="text-xs text-teal-400 font-mono flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      <span>{appointment.patientPhone || 'No Phone Recorded'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(appointment.status)}
                  {appointment.patientPhone && onOpenWhatsAppChat && (
                    <button
                      type="button"
                      onClick={() => onOpenWhatsAppChat(appointment.patientPhone!)}
                      className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 transition-colors"
                      title="Open WhatsApp Chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Schedule Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-teal-400" />
                    <span>Date & Time</span>
                  </span>
                  <p className="font-bold text-white">
                    {new Date(appointment.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    {new Date(appointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(appointment.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <DoorOpen className="w-3 h-3 text-teal-400" />
                    <span>Clinical Suite</span>
                  </span>
                  <p className="font-bold text-white truncate">
                    {appointment.roomNumber} &bull; {appointment.roomName}
                  </p>
                  <p className="text-[11px] text-teal-400 truncate mt-0.5">{appointment.branchName}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3 text-teal-400" />
                    <span>Treatment</span>
                  </span>
                  <p className="font-bold text-white truncate">{appointment.treatmentName}</p>
                  {appointment.treatmentPrice && (
                    <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      LKR {Number(appointment.treatmentPrice).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                    <Stethoscope className="w-3 h-3 text-teal-400" />
                    <span>Doctor / Specialist</span>
                  </span>
                  <p className="font-bold text-white truncate">{appointment.doctorName}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{appointment.doctorTitle || 'Attending'}</p>
                </div>
              </div>

              {/* Notes */}
              {appointment.notes && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-400 block mb-1">Clinical Notes</span>
                  <p className="text-slate-200">{appointment.notes}</p>
                </div>
              )}

              {/* Cancellation Reason if cancelled */}
              {appointment.status === 'cancelled' && appointment.cancellationReason && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                  <span className="text-[10px] text-rose-300 block mb-1">Cancellation Reason</span>
                  <p className="text-rose-200">{appointment.cancellationReason}</p>
                </div>
              )}

              {/* Clinical Workflow Status Actions */}
              {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Workflow Actions
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {appointment.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('checked_in', 'Patient arrived at clinic front desk')}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Check In</span>
                      </button>
                    )}

                    {(appointment.status === 'confirmed' || appointment.status === 'checked_in') && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('in_progress', 'Doctor started clinical session')}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl text-xs font-bold bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border border-teal-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Session</span>
                      </button>
                    )}

                    {appointment.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange('completed', 'Treatment completed successfully')}
                        disabled={isSubmitting}
                        className="p-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStatusChange('no_show', 'Patient did not attend appointment')}
                      disabled={isSubmitting}
                      className="p-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>No Show</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRescheduling(true)}
                      disabled={isSubmitting}
                      className="p-2 rounded-xl text-xs font-bold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCancelling(true)}
                      disabled={isSubmitting}
                      className="p-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

