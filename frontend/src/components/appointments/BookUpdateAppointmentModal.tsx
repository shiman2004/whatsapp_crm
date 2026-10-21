import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Building2, 
  Stethoscope, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw, 
  XCircle, 
  Info,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  Languages
} from 'lucide-react';
import { Branch, Room, Appointment, AppointmentStatus, Lead, User as CrmUser, Treatment } from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { getAppointmentStatusConfig, APPOINTMENT_STATUS_CONFIG } from '../../utils/appointmentStatusUtils';
import { getLeadCompany } from '../../utils/companyUtils';

export interface BookUpdateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointment: any) => void;
  lead?: Lead | null;
  appointmentId?: string | null;
  initialMode?: 'view' | 'reschedule';
  branches: Branch[];
  rooms: Room[];
  treatments: Treatment[];
  doctors: any[];
  users?: CrmUser[];
  defaultBranchId?: string;
  defaultDate?: string;
  defaultStartTime?: string;
}

export const BookUpdateAppointmentModal: React.FC<BookUpdateAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lead = null,
  appointmentId = null,
  initialMode = 'view',
  branches = [],
  rooms = [],
  treatments = [],
  doctors = [],
  users = [],
  defaultBranchId = '',
  defaultDate = '',
  defaultStartTime = '10:30'
}) => {
  const isEditMode = !!appointmentId;

  // Active appointment state if editing
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Form State: Client Information
  const [inqSerialNo, setInqSerialNo] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [company, setCompany] = useState<'RWC' | 'CRAS'>('RWC');
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');
  const [assignedCoordinatorId, setAssignedCoordinatorId] = useState<string>('');

  // Form State: Appointment Details
  const [appointmentType, setAppointmentType] = useState<string>('Consultation');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>('');
  const [appointmentTime, setAppointmentTime] = useState<string>('10:30');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [appointmentNotes, setAppointmentNotes] = useState<string>('');

  // Form State: Appointment Status
  const [status, setStatus] = useState<AppointmentStatus>('booked');

  // Form State: Reschedule Info
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Form State: Cancellation Info
  const [cancellationReason, setCancellationReason] = useState<string>('');

  // System Audit Info
  const [createdBy, setCreatedBy] = useState<string>('Staff');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string>('Staff');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load existing appointment if editing
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const todayStr = new Date().toISOString().split('T')[0];

    if (appointmentId) {
      setIsLoadingDetails(true);
      appointmentService.getAppointment(appointmentId)
        .then((data) => {
          setAppointment(data);
          setStatus(data.status || 'booked');

          // Parse start time
          if (data.startTime) {
            const d = new Date(data.startTime);
            setAppointmentDate(d.toISOString().split('T')[0]);
            setAppointmentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
          }

          setSelectedBranchId(data.branchId || defaultBranchId || branches[0]?.id || '');
          setSelectedRoomId(data.roomId || rooms[0]?.id || '');
          setSelectedDoctorId(data.doctorId || doctors[0]?.id || '');
          setSelectedTreatmentId(data.treatmentId || treatments[0]?.id || '');
          setAppointmentNotes(data.notes || '');

          if (data.cancellationReason) {
            setCancellationReason(data.cancellationReason);
          }

          setClientName(data.patientName || lead?.customer?.displayName || '');
          setContactNumber(data.patientPhone || lead?.customer?.whatsappNumber || '');
          setInqSerialNo(lead?.serialNumber || `APT-${data.id.slice(-6)}`);
          const detectedCompany = (lead?.company as any) || (lead ? getLeadCompany(lead).code : 'RWC');
          setCompany(detectedCompany === 'CRAS' ? 'CRAS' : 'RWC');

          setCreatedBy(data.createdByName || 'Staff');
          setCreatedAt(data.createdAt ? new Date(data.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString());
          setLastUpdatedBy(data.createdByName || 'Staff');
          setLastUpdatedAt(new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }));

          if (initialMode === 'reschedule') {
            setStatus('rescheduled');
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to load appointment details');
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    } else {
      // New Booking Mode from Lead
      setAppointment(null);
      setStatus('booked');
      setInqSerialNo(lead?.serialNumber || `INQ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`);
      setClientName(lead?.customer?.displayName || '');
      setContactNumber(lead?.customer?.whatsappNumber || '');
      const detectedCompany = (lead?.company as any) || (lead ? getLeadCompany(lead).code : 'RWC');
      setCompany(detectedCompany === 'CRAS' ? 'CRAS' : 'RWC');
      setSelectedTreatmentId(lead?.treatmentId || treatments[0]?.id || '');
      setAssignedCoordinatorId(lead?.assignedTo || '');

      setSelectedBranchId(defaultBranchId || branches[0]?.id || '');
      setSelectedRoomId(rooms[0]?.id || '');
      setSelectedDoctorId(doctors[0]?.id || '');
      setAppointmentDate(defaultDate || todayStr);
      setAppointmentTime(defaultStartTime || '10:30');
      setAppointmentType('Consultation');
      setPreferredLanguage(lead?.language === 'si' ? 'Sinhala' : lead?.language === 'ta' ? 'Tamil' : 'English');
      setAppointmentNotes('');
      setRescheduleReason('');
      setCancellationReason('');

      setCreatedBy('Staff');
      setCreatedAt(new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }));
      setLastUpdatedBy('Staff');
      setLastUpdatedAt(new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }));
    }
  }, [isOpen, appointmentId, lead, defaultBranchId, defaultDate, defaultStartTime, branches, rooms, treatments, doctors, initialMode]);

  if (!isOpen) return null;

  // Filter rooms matching selected branch
  const branchRooms = rooms.filter(r => !selectedBranchId || r.branchId === selectedBranchId);

  // Active status badge config
  const statusConfig = getAppointmentStatusConfig(status);

  // Calculate End Time based on treatment duration
  const getEndTimeISO = (startDateStr: string, startTimeStr: string, durationMinutes = 45): string => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const start = new Date(`${startDateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return end.toISOString();
  };

  const getStartTimeISO = (startDateStr: string, startTimeStr: string): string => {
    const [h, m] = startTimeStr.split(':').map(Number);
    return new Date(`${startDateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`).toISOString();
  };

  // Handle Submit (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!clientName.trim()) {
      setErrorMessage('Client Name is required.');
      return;
    }
    if (!contactNumber.trim()) {
      setErrorMessage('Contact Number is required.');
      return;
    }
    if (!appointmentDate) {
      setErrorMessage('Appointment Date is required.');
      return;
    }
    if (!appointmentTime) {
      setErrorMessage('Appointment Time is required.');
      return;
    }

    // Determine target room
    const targetRoomId = selectedRoomId || branchRooms[0]?.id || rooms[0]?.id;
    if (!targetRoomId) {
      setErrorMessage('Please select an active clinical room.');
      return;
    }

    const targetBranchId = selectedBranchId || branches[0]?.id || 'branch-colombo';
    const targetDoctorId = selectedDoctorId || doctors[0]?.id || 'user-admin-1';
    const targetTreatmentId = selectedTreatmentId || treatments[0]?.id || 't-skin-1';

    const treatmentObj = treatments.find(t => t.id === targetTreatmentId);
    const duration = treatmentObj?.durationMinutes || 45;

    const startISO = getStartTimeISO(appointmentDate, appointmentTime);
    const endISO = getEndTimeISO(appointmentDate, appointmentTime, duration);

    setIsSubmitting(true);
    try {
      if (isEditMode && appointment) {
        // 1. Reschedule if date/time/room changed or status is rescheduled
        const hasTimeOrRoomChanged = appointment.roomId !== targetRoomId || 
          new Date(appointment.startTime).toISOString() !== startISO;

        if (status === 'rescheduled' || hasTimeOrRoomChanged) {
          await appointmentService.rescheduleAppointment(appointment.id, {
            newStartTime: startISO,
            newEndTime: endISO,
            newRoomId: targetRoomId,
            reason: rescheduleReason.trim() || 'Appointment moved to another date or time'
          });
        }

        // 2. Cancellation if status is cancelled
        if (status === 'cancelled') {
          await appointmentService.cancelAppointment(
            appointment.id, 
            cancellationReason.trim() || 'Appointment cancelled by customer or coordinator'
          );
        } else if (status !== appointment.status) {
          // 3. Status update
          await appointmentService.updateAppointmentStatus(
            appointment.id,
            status,
            status === 'paid' ? 'Customer completed payment' :
            status === 'arrived' ? 'Customer arrived at the location' :
            status === 'confirmed' ? 'Customer confirmed the appointment' :
            status === 'no_answer' ? 'Customer did not respond' :
            `Status updated to ${status}`
          );
        }

        setSuccessMessage('Appointment updated successfully!');
        setTimeout(() => {
          onSuccess(appointment);
          onClose();
        }, 600);

      } else {
        // Create Mode
        const newApptRes = await appointmentService.createAppointment({
          branchId: targetBranchId,
          roomId: targetRoomId,
          doctorId: targetDoctorId,
          treatmentId: targetTreatmentId,
          startTime: startISO,
          endTime: endISO,
          patientId: lead?.customerId || lead?.customer?.id,
          patientName: clientName.trim(),
          patientPhone: contactNumber.trim(),
          notes: appointmentNotes.trim()
        });

        // If status was changed from default 'booked', update it
        if (status !== 'booked' && newApptRes?.appointment?.id) {
          await appointmentService.updateAppointmentStatus(newApptRes.appointment.id, status, `Initial status set to ${status}`).catch(() => null);
        }

        setSuccessMessage('Appointment booked successfully!');
        setTimeout(() => {
          onSuccess(newApptRes.appointment);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save appointment. Please check for scheduling conflicts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 1. Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5 text-teal-400" />
            </div>
            <h3 className="font-bold text-base text-white tracking-wide">
              {isEditMode ? 'Book / Update Appointment' : (company === 'CRAS' ? 'Enrollment Student' : 'Book Appointment')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Current Appointment Status Bar & INQ Serial No Banner */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider mb-1">
              Current Appointment Status
            </span>
            <div 
              className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-sm border ${statusConfig.badgeClass}`}
              title={statusConfig.description}
            >
              <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
              <span>{statusConfig.iconEmoji}</span>
              <span>{statusConfig.label}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider mb-0.5">
              INQ Serial No.
            </span>
            <span className="font-mono font-black text-sm text-slate-100 tracking-wider">
              {inqSerialNo || 'INQ-PENDING'}
            </span>
          </div>
        </div>

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 3. Scrollable Modal Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4 space-y-4">

          {/* Top 2-Column Grid: Client Information vs Appointment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Left Card: Client Information */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800 text-teal-400 font-bold text-xs uppercase tracking-wide">
                <User className="w-4 h-4" />
                <span>Client Information</span>
              </div>

              {/* INQ Serial No (Readonly) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  INQ Serial No. <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={inqSerialNo}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono select-none cursor-not-allowed"
                />
              </div>

              {/* Client Name */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Client Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. John Tan"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Contact Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +60 12-345 6789"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Company */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Company <span className="text-rose-400">*</span>
                </label>
                <select
                  value={company}
                  onChange={(e) => setCompany(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="RWC">RWC (Royal Wellness)</option>
                  <option value="CRAS">CRAS (Education)</option>
                </select>
              </div>

              {/* Treatment / Service */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Treatment / Service <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedTreatmentId}
                  onChange={(e) => setSelectedTreatmentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.durationMinutes ? `(${t.durationMinutes}m)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Coordinator */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Assigned Coordinator
                </label>
                <select
                  value={assignedCoordinatorId}
                  onChange={(e) => setAssignedCoordinatorId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">-- Unassigned --</option>
                  {users.filter(u => u.role === 'coordinator' || u.role === 'leads_officer').map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.roleTitle || u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Card: Appointment Details */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800 text-teal-400 font-bold text-xs uppercase tracking-wide">
                <CalendarDays className="w-4 h-4" />
                <span>Appointment Details</span>
              </div>

              {/* Appointment Type */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Appointment Type <span className="text-rose-400">*</span>
                </label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="Consultation">Consultation</option>
                  <option value="Treatment Session">Treatment Session</option>
                  <option value="Laser Therapy">Laser Therapy</option>
                  <option value="IV Infusion">IV Infusion</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Review">Review</option>
                </select>
              </div>

              {/* Branch / Location & Clinical Room */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Branch / Location <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Room / Suite <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {branchRooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.roomNumber} - {r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Doctor / Consultant / Staff */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Doctor / Consultant / Staff <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName} ({d.roleTitle || d.role})</option>
                  ))}
                </select>
              </div>

              {/* Appointment Date & Appointment Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Appointment Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Appointment Time <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Preferred Language */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Preferred Language
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="English">English</option>
                  <option value="Sinhala">Sinhala</option>
                  <option value="Tamil">Tamil</option>
                </select>
              </div>

              {/* Appointment Notes */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Appointment Notes
                </label>
                <textarea
                  rows={2}
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="e.g. Client interested in hair analysis and treatment plan."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>
            </div>

          </div>

          {/* Section 3: Appointment Status Selector Card */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800 text-teal-400 font-bold text-xs uppercase tracking-wide">
              <FileText className="w-4 h-4" />
              <span>Appointment Status</span>
            </div>

            <div className="max-w-md">
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Appointment Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="booked">🔵 Booked (Appointment successfully booked)</option>
                <option value="confirmed">🟢 Confirmed (Customer confirmed the appointment)</option>
                <option value="arrived">🟣 Arrived (Customer arrived at the location)</option>
                <option value="paid">🟡 Paid (Customer completed payment)</option>
                <option value="rescheduled">🟠 Rescheduled (Appointment moved to another date or time)</option>
                <option value="cancelled">🔴 Cancelled (Appointment cancelled)</option>
                <option value="no_answer">⚫ No Answer (Customer did not respond)</option>
              </select>
            </div>
          </div>

          {/* Section 4 & 5: Conditional Accordion Cards (Reschedule Information & Cancellation Information) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Reschedule Information Card */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <span>Reschedule Information</span>
              </div>

              {status !== 'rescheduled' ? (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Reschedule information will be shown when status is set to <strong>"Rescheduled"</strong>.</span>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <label className="text-[11px] font-semibold text-purple-200 block">
                    Reschedule Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Reason for moving date or time window..."
                    className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 resize-none"
                  />
                  <p className="text-[10px] text-purple-300">
                    💡 Changing Appointment Date and Time above will automatically register this new slot.
                  </p>
                </div>
              )}
            </div>

            {/* Cancellation Information Card */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Cancellation Information</span>
              </div>

              {status !== 'cancelled' ? (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Cancellation information will be shown when status is set to <strong>"Appointment Cancelled"</strong>.</span>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <label className="text-[11px] font-semibold text-rose-200 block">
                    Cancellation Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Reason patient or clinic cancelled appointment..."
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-400 resize-none"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Section 6: System Information (Audit Grid) */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800 text-teal-400 font-bold text-xs uppercase tracking-wide">
              <Clock className="w-4 h-4" />
              <span>System Information</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Appointment Created By</span>
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 font-medium truncate select-none">
                  {createdBy}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Created Date & Time</span>
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 font-mono text-[11px] truncate select-none">
                  {createdAt || '—'}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Last Updated By</span>
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 font-medium truncate select-none">
                  {lastUpdatedBy}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Last Updated Date & Time</span>
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 font-mono text-[11px] truncate select-none">
                  {lastUpdatedAt || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer inside scrollable area or pinned */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {isEditMode ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Appointment'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : (company === 'CRAS' ? 'Enroll Student' : 'Save Appointment')}
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};

