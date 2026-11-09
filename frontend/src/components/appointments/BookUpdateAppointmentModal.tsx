import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Search,
  Stethoscope,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { Appointment, Branch, Lead, PatientSearchResult, Treatment, User as CrmUser } from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { getAppointmentStatusConfig } from '../../utils/appointmentStatusUtils';
import { addMinutesToTime, colomboDateKey, formatDateKey, toColomboISO } from '../../utils/appointmentTime';
import { AppDatePicker } from '../common/AppDatePicker';

export interface BookUpdateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointment: any) => void;
  lead?: Lead | null;
  appointmentId?: string | null;
  initialMode?: 'view' | 'reschedule';
  branches: Branch[];
  rooms?: any[];
  treatments: Treatment[];
  doctors: any[];
  users?: CrmUser[];
  defaultBranchId?: string;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultDoctorId?: string;
}

const STEPS = ['Patient', 'Treatment & Location', 'Schedule', 'Review'];
const APPOINTMENT_TYPES = ['consultation', 'treatment', 'follow_up', 'review'];

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `appt-${crypto.randomUUID()}`;
  return `appt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const BookUpdateAppointmentModal: React.FC<BookUpdateAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lead = null,
  appointmentId = null,
  branches = [],
  treatments = [],
  doctors = [],
  users = [],
  defaultBranchId = '',
  defaultDate = '',
  defaultStartTime = '09:00',
  defaultDoctorId = '',
}) => {
  const isEditMode = Boolean(appointmentId);

  const [step, setStep] = useState(0);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Patient
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [registering, setRegistering] = useState(false);

  // Treatment & location
  const [branchId, setBranchId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [appointmentType, setAppointmentType] = useState('consultation');

  // Schedule
  const [date, setDate] = useState(defaultDate || colomboDateKey());
  const [time, setTime] = useState(defaultStartTime);
  const [availability, setAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Review
  const [notes, setNotes] = useState('');
  const [initialStatus, setInitialStatus] = useState<'pending' | 'booked' | 'confirmed'>('pending');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedTreatment = treatments.find((t) => t.id === treatmentId);
  const duration = selectedTreatment?.durationMinutes || 30;
  const endTime = addMinutesToTime(time, duration);

  const branchDoctors = useMemo(() => {
    if (!branchId) return doctors;
    return doctors.filter((doctor) => !doctor.branchIds?.length || doctor.branchIds.includes(branchId));
  }, [doctors, branchId]);

  // Seed form on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setError(null);
    setSuccess(null);
    setCancelMode(false);
    setCancelReason('');
    setIdempotencyKey(newIdempotencyKey());

    if (appointmentId) {
      setLoadingDetails(true);
      appointmentService.getAppointment(appointmentId)
        .then((data) => {
          setAppointment(data);
          setPatient({
            patientId: data.patientId,
            displayName: data.patientName || 'Patient',
            whatsappNumber: data.patientPhone,
            leadId: data.leadId,
            serialNumber: data.leadSerialNumber,
          });
          setPatientName(data.patientName || '');
          setPatientPhone(data.patientPhone || '');
          setBranchId(data.branchId || defaultBranchId || branches[0]?.id || '');
          setDoctorId(data.doctorId || '');
          setTreatmentId(data.treatmentId || '');
          setCoordinatorId(data.coordinatorId || '');
          setAppointmentType(data.appointmentType || 'consultation');
          setDate(colomboDateKey(data.startTime));
          setTime(new Date(data.startTime).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false,
          }));
          setNotes(data.notes || '');
        })
        .catch((err) => setError(err.message || 'Failed to load appointment details'))
        .finally(() => setLoadingDetails(false));
      return;
    }

    setAppointment(null);
    setSearchQuery('');
    setSearchResults([]);
    setPatient(null);
    setPatientName(lead?.customer?.displayName || '');
    setPatientPhone(lead?.customer?.whatsappNumber || '');
    setBranchId(defaultBranchId || branches[0]?.id || '');
    setDoctorId(defaultDoctorId || '');
    setTreatmentId(lead?.treatmentId || treatments[0]?.id || '');
    setCoordinatorId(lead?.assignedTo || '');
    setAppointmentType('consultation');
    setDate(defaultDate || colomboDateKey());
    setTime(defaultStartTime || '09:00');
    setNotes('');
    setInitialStatus('pending');
  }, [isOpen, appointmentId, lead, defaultBranchId, defaultDate, defaultStartTime, defaultDoctorId, branches, treatments]);

  // Patient lookup
  useEffect(() => {
    if (!isOpen || isEditMode) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      appointmentService.searchPatients(q)
        .then((rows) => { if (active) setSearchResults(rows); })
        .catch(() => { if (active) setSearchResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchQuery, isOpen, isEditMode]);

  // Availability for the chosen branch/doctor/date
  useEffect(() => {
    if (!isOpen || step !== 2 || !branchId || !date || !doctorId) return;
    let active = true;
    setLoadingAvailability(true);
    setAvailability(null);
    appointmentService.getDoctorAvailability(branchId, date)
      .then((data) => {
        if (!active) return;
        const day = data.doctors.find((d) => d.doctorId === doctorId);
        setAvailability(day || null);
      })
      .catch((err) => { if (active) setError(err.message || 'Failed to load availability'); })
      .finally(() => { if (active) setLoadingAvailability(false); });
    return () => { active = false; };
  }, [isOpen, step, branchId, doctorId, date]);

  if (!isOpen) return null;

  const invalidateSchedule = (next: { branchId?: string; doctorId?: string; treatmentId?: string }) => {
    if (next.branchId !== undefined && next.branchId !== branchId) {
      setBranchId(next.branchId);
      setDoctorId('');
      setTime(defaultStartTime || '09:00');
      return;
    }
    if (next.doctorId !== undefined && next.doctorId !== doctorId) {
      setDoctorId(next.doctorId);
      setTime(defaultStartTime || '09:00');
      return;
    }
    if (next.treatmentId !== undefined) setTreatmentId(next.treatmentId);
  };

  const canContinue = (() => {
    if (step === 0) return Boolean(patient || (patientName.trim() && patientPhone.trim()));
    if (step === 1) return Boolean(branchId && doctorId && treatmentId);
    if (step === 2) return Boolean(date && time);
    return true;
  })();

  const handleQuickRegister = async () => {
    if (!patientName.trim() || !patientPhone.trim()) {
      setError('Enter a name and phone number to register the patient.');
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const created = await appointmentService.quickRegisterPatient({ name: patientName.trim(), phone: patientPhone.trim() });
      setPatient({
        patientId: created.id,
        displayName: created.displayName || patientName.trim(),
        whatsappNumber: created.whatsappNumber || patientPhone.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to register patient');
    } finally {
      setRegistering(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSuccess(null);

    if (!branchId || !doctorId || !treatmentId) {
      setError('Choose a branch, doctor and treatment before saving.');
      return;
    }
    if (!date || !time) {
      setError('Choose an appointment date and time.');
      return;
    }
    if (!isEditMode && !patient?.patientId && (!patientName.trim() || !patientPhone.trim())) {
      setError('Select a patient or enter a name and phone number.');
      return;
    }

    setSubmitting(true);
    const startTime = toColomboISO(date, time);
    const finishTime = toColomboISO(date, endTime);

    try {
      if (isEditMode && appointment) {
        await appointmentService.updateAppointment(appointment.id, {
          branchId,
          doctorId,
          treatmentId,
          startTime,
          endTime: finishTime,
          notes,
          appointmentType,
          leadId: patient?.leadId || null,
          coordinatorId: coordinatorId || null,
        });
        setSuccess('Appointment updated successfully.');
        window.setTimeout(() => { onSuccess(null); onClose(); }, 500);
      } else {
        const result = await appointmentService.createAppointment({
          branchId,
          doctorId,
          treatmentId,
          startTime,
          endTime: finishTime,
          patientId: patient?.patientId,
          patientName: patient?.displayName || patientName.trim(),
          patientPhone: patient?.whatsappNumber || patientPhone.trim(),
          leadId: patient?.leadId,
          coordinatorId: coordinatorId || undefined,
          appointmentType,
          status: initialStatus,
          notes,
          idempotencyKey,
        });
        setSuccess(result.idempotent ? 'This appointment was already saved.' : 'Appointment booked successfully.');
        window.setTimeout(() => { onSuccess(result.appointment); onClose(); }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save appointment. Check for a scheduling conflict.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    if (!cancelReason.trim()) {
      setError('Enter a cancellation reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await appointmentService.cancelAppointment(appointment.id, cancelReason.trim());
      setSuccess('Appointment cancelled.');
      window.setTimeout(() => { onSuccess(null); onClose(); }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const availableSlots = (availability?.slots || []).filter((slot: any) =>
    slot.status === 'available' || (appointment && slot.appointmentId === appointment.id)
  );

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="space-y-4">
          {isEditMode ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient</p>
              <p className="mt-1 text-sm font-bold text-white">{appointment?.patientName || 'Patient'}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-teal-400"><Phone className="h-3.5 w-3.5" />{appointment?.patientPhone || 'No phone recorded'}</p>
              {appointment?.leadSerialNumber && <p className="mt-1 font-mono text-[11px] text-slate-400">Lead {appointment.leadSerialNumber}</p>}
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-300">Search patient or lead</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, phone or lead serial number"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  />
                  {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-teal-400" />}
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {searchResults.map((row) => (
                    <button
                      key={`${row.patientId}-${row.leadId || 'none'}`}
                      type="button"
                      onClick={() => {
                        setPatient(row);
                        setPatientName(row.displayName || '');
                        setPatientPhone(row.whatsappNumber || row.phoneNumber || '');
                        setSearchResults([]);
                        setSearchQuery('');
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition-colors hover:border-teal-500/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">{row.displayName}</p>
                        <p className="truncate text-[11px] text-slate-400">{row.whatsappNumber || row.phoneNumber || 'No phone'}</p>
                      </div>
                      {row.serialNumber && <span className="shrink-0 font-mono text-[10px] text-teal-400">{row.serialNumber}</span>}
                    </button>
                  ))}
                </div>
              )}

              {patient ? (
                <div className="flex items-center justify-between rounded-xl border border-teal-500/30 bg-teal-500/10 p-3">
                  <div>
                    <p className="text-xs font-bold text-white">{patient.displayName}</p>
                    <p className="text-[11px] text-teal-300">{patient.whatsappNumber || patient.phoneNumber || 'No phone'}</p>
                  </div>
                  <button type="button" onClick={() => setPatient(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Clear patient">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-[11px] text-slate-400">No existing record selected. Book with a new patient, or search above to link a lead.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-300">Patient name</label>
                      <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-300">Phone number</label>
                      <input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickRegister}
                    disabled={registering}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 disabled:opacity-50"
                  >
                    {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Register patient
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-300">Branch / clinic</label>
            <select value={branchId} onChange={(e) => invalidateSchedule({ branchId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none">
              <option value="">Select branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-300">Doctor</label>
            <select value={doctorId} onChange={(e) => invalidateSchedule({ doctorId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none">
              <option value="">Select doctor</option>
              {branchDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}{doctor.title ? ` — ${doctor.title}` : ''}</option>)}
            </select>
            {doctorId && !branchDoctors.some((d) => d.id === doctorId) && <p className="mt-1 text-[10px] text-amber-400">This doctor is not assigned to the selected branch.</p>}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-300">Treatment / service</label>
            <select value={treatmentId} onChange={(e) => invalidateSchedule({ treatmentId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none">
              <option value="">Select treatment</option>
              {treatments.filter((t) => t.active !== false).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.durationMinutes ? ` (${t.durationMinutes}m)` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-300">Appointment type</label>
            <select value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs capitalize text-white focus:border-teal-500 focus:outline-none">
              {APPOINTMENT_TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold text-slate-300">Coordinator / lead owner (optional)</label>
            <select value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none">
              <option value="">Unassigned</option>
              {users.filter((u) => ['coordinator', 'sales_coordinator', 'leads_officer'].includes(u.role)).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.roleTitle || u.role})</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-teal-400" />{branches.find((b) => b.id === branchId)?.name || 'No branch selected'}</span>
            <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 text-teal-400" />{doctors.find((d) => d.id === doctorId)?.fullName || 'No doctor selected'}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-teal-400" />{duration} min</span>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Date</label>
              <AppDatePicker
                value={date}
                onChange={(val) => { if (val) { setDate(val); setTime(defaultStartTime || '09:00'); } }}
                clearable={false}
                className="w-full"
                inputClassName="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Selected time</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                <Clock className="h-4 w-4 text-teal-400" />
                <span className="font-mono">{time} – {endTime}</span>
                {availability?.scheduleConfigured === false && <span className="ml-auto text-[10px] text-amber-400">Branch hours</span>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-300">Available slots</p>
              {loadingAvailability && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />}
            </div>
            {!doctorId ? (
              <p className="text-[11px] text-slate-500">Choose a doctor to see available slots.</p>
            ) : loadingAvailability ? (
              <p className="text-[11px] text-slate-500">Checking availability…</p>
            ) : availableSlots.length === 0 ? (
              <p className="text-[11px] text-amber-400">No bookable slots for this doctor on this date. Try another date.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {availableSlots.map((slot: any) => {
                  const isCurrent = appointment && slot.appointmentId === appointment.id;
                  const selected = slot.startTime === time;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setTime(slot.startTime)}
                      className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] transition-colors ${
                        selected ? 'border-teal-400 bg-teal-500/20 text-teal-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-teal-500/50'
                      }`}
                    >
                      {slot.startTime}{isCurrent ? ' •' : ''}
                    </button>
                  );
                })}
              </div>
            )}
            {availability?.workingWindows?.length > 0 && (
              <p className="mt-2 text-[10px] text-slate-500">
                Working hours: {availability.workingWindows.map((w: any) => `${w.startTime}–${w.endTime}`).join(', ')}
              </p>
            )}
          </div>
        </div>
      );
    }

    const statusConfig = getAppointmentStatusConfig(initialStatus);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient</p>
            <p className="mt-1 text-xs font-bold text-white">{patient?.displayName || patientName || 'New patient'}</p>
            <p className="text-[11px] text-slate-400">{patient?.whatsappNumber || patientPhone || 'No phone'}</p>
            {patient?.serialNumber && <p className="mt-0.5 font-mono text-[10px] text-teal-400">{patient.serialNumber}</p>}
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Appointment</p>
            <p className="mt-1 text-xs font-bold text-white">{selectedTreatment?.name || treatmentId}</p>
            <p className="text-[11px] text-slate-400">{formatDateKey(date, { weekday: 'short', month: 'short', day: 'numeric' })} · {time}–{endTime}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Doctor & clinic</p>
            <p className="mt-1 text-xs font-bold text-white">{doctors.find((d) => d.id === doctorId)?.fullName || 'Doctor'}</p>
            <p className="text-[11px] text-slate-400">{branches.find((b) => b.id === branchId)?.name || 'Branch'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isEditMode ? 'Current status' : 'Initial status'}</p>
            {isEditMode ? (
              <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusConfig.badgeClass}`}>
                {statusConfig.iconEmoji} {statusConfig.label}
              </span>
            ) : (
              <select value={initialStatus} onChange={(e) => setInitialStatus(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:border-teal-500 focus:outline-none">
                <option value="pending">Pending</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-300">Notes</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the clinic team should know" className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none" />
        </div>

        {isEditMode && !cancelMode && (
          <button type="button" onClick={() => setCancelMode(true)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 hover:text-rose-300">
            <XCircle className="h-3.5 w-3.5" /> Cancel this appointment
          </button>
        )}
        {isEditMode && cancelMode && (
          <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
            <p className="text-[11px] font-semibold text-rose-300">Cancellation reason</p>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full rounded-lg border border-rose-500/40 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-rose-400 focus:outline-none" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelMode(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">Keep</button>
              <button type="button" onClick={handleCancelAppointment} disabled={submitting} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50">Confirm cancellation</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15 text-teal-400">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{isEditMode ? 'Update Appointment' : 'Book Appointment'}</h3>
              <p className="text-[11px] text-slate-400">{isEditMode ? 'Reschedule or update an existing booking' : 'Patient, treatment, location and time'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close booking form">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-950/30 px-5 py-2">
          {STEPS.map((label, index) => (
            <React.Fragment key={label}>
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                  index === step ? 'bg-teal-500/15 text-teal-300' : index < step ? 'text-teal-400 hover:bg-slate-800' : 'text-slate-500'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${index <= step ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  {index < step ? '✓' : index + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-800" />}
            </React.Fragment>
          ))}
        </div>

        {(error || success) && (
          <div className={`mx-5 mt-3 flex items-start gap-2 rounded-xl p-2.5 text-xs ${error ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{error || success}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingDetails ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading appointment…</div>
          ) : renderStep()}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950/40 px-5 py-3">
          <button type="button" onClick={step === 0 ? onClose : () => setStep(step - 1)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
            {step === 0 ? 'Cancel' : <><ArrowLeft className="h-3.5 w-3.5" /> Back</>}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canContinue} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-40">
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting || !canContinue} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500 disabled:opacity-50">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isEditMode ? 'Save changes' : 'Confirm booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
