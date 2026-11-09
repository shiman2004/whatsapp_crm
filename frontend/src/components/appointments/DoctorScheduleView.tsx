import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import {
  Appointment,
  Branch,
  Doctor,
  DoctorScheduleException,
  DoctorWeeklySchedule,
} from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { getAppointmentStatusConfig } from '../../utils/appointmentStatusUtils';
import {
  WEEKDAY_LABELS,
  colomboDateKey,
  formatColomboTime,
  formatDateKey,
  shiftDateKey,
  weekDates,
} from '../../utils/appointmentTime';
import { AppDatePicker, AppTimePicker } from '../common';
import { EmptyState, ErrorState, PageHeader, SearchInput } from '../ui';
import { AppointmentDetailModal } from './AppointmentDetailModal';

const EXCEPTION_LABELS: Record<string, string> = {
  leave: 'Leave',
  break: 'Break',
  unavailable: 'Unavailable',
};

const EXCEPTION_TONES: Record<string, string> = {
  leave: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  break: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  unavailable: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00+05:30`).getUTCDay();
}

/** DATE columns can serialise as full ISO strings; compare on YYYY-MM-DD only. */
function dateOnly(value?: string | null): string {
  return String(value || '').slice(0, 10);
}

function branchMatchesDoctor(doctor: Doctor, branchId: string, schedules: DoctorWeeklySchedule[], branchName: string): boolean {
  if (!branchId) return true;
  const doctorSchedules = schedules.filter((row) => row.doctorId === doctor.id);
  if (doctorSchedules.length > 0) return doctorSchedules.some((row) => row.branchId === branchId);
  return !doctor.branch || doctor.branch.toLowerCase().includes(branchName.toLowerCase());
}

export const DoctorScheduleView: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<DoctorWeeklySchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorScheduleException[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [branchFilter, setBranchFilter] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [date, setDate] = useState(colomboDateKey());
  const [mode, setMode] = useState<'day' | 'week'>('week');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const [windowForm, setWindowForm] = useState({ branchId: '', dayOfWeek: String(weekdayOf(colomboDateKey())), startTime: '08:00', endTime: '12:00' });
  const [exceptionForm, setExceptionForm] = useState({
    exceptionType: 'leave',
    branchId: '',
    startDate: colomboDateKey(),
    endDate: colomboDateKey(),
    startTime: '',
    endTime: '',
    reason: '',
  });

  const dates = useMemo(() => (mode === 'week' ? weekDates(date) : [date]), [mode, date]);
  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name || 'Unassigned branch';

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchList, doctorList, scheduleList, exceptionList] = await Promise.all([
        appointmentService.getBranches(),
        appointmentService.getDoctors(),
        appointmentService.getDoctorSchedules(),
        appointmentService.getDoctorScheduleExceptions(),
      ]);
      setBranches(branchList);
      setDoctors(doctorList);
      setSchedules(scheduleList);
      setExceptions(exceptionList);
      setSelectedDoctorId((current) => current || doctorList[0]?.id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load doctor schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const loadAppointments = useCallback(async () => {
    if (!selectedDoctorId) { setAppointments([]); return; }
    try {
      setAppointments(await appointmentService.getAppointments({
        doctorId: selectedDoctorId,
        branchId: branchFilter || undefined,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        limit: 500,
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to load doctor appointments');
    }
  }, [selectedDoctorId, branchFilter, dates]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const specializations = useMemo(
    () => [...new Set(doctors.map((doctor) => doctor.title).filter(Boolean))].sort() as string[],
    [doctors],
  );

  const visibleDoctors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return doctors.filter((doctor) => {
      if (needle && !`${doctor.fullName} ${doctor.title || ''} ${doctor.branch || ''}`.toLowerCase().includes(needle)) return false;
      if (specialization && doctor.title !== specialization) return false;
      return branchMatchesDoctor(doctor, branchFilter, schedules, branchName(branchFilter));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctors, schedules, search, specialization, branchFilter, branches]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId);
  const doctorSchedules = schedules.filter((row) => row.doctorId === selectedDoctorId);
  const doctorExceptions = exceptions.filter((row) => row.doctorId === selectedDoctorId);
  const branchScopedSchedules = doctorSchedules.filter((row) => !branchFilter || row.branchId === branchFilter);
  const branchAssignments = [...new Set(doctorSchedules.map((row) => row.branchId))];

  const step = (delta: number) => setDate((current) => shiftDateKey(current, mode === 'week' ? delta * 7 : delta));

  const resetForms = useCallback((nextBranchId: string) => {
    const fallbackBranch = nextBranchId || branchFilter || branches[0]?.id || '';
    setWindowForm((current) => ({ ...current, branchId: current.branchId || fallbackBranch }));
    setExceptionForm((current) => ({ ...current, branchId: current.branchId || fallbackBranch }));
  }, [branchFilter, branches]);

  useEffect(() => { resetForms(''); }, [resetForms]);

  const addWindow = async () => {
    if (!selectedDoctorId) return;
    setBusy(true);
    setError(null);
    try {
      await appointmentService.createDoctorSchedule({
        doctorId: selectedDoctorId,
        branchId: windowForm.branchId,
        dayOfWeek: Number(windowForm.dayOfWeek),
        startTime: windowForm.startTime,
        endTime: windowForm.endTime,
      });
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to save working window');
    } finally {
      setBusy(false);
    }
  };

  const addException = async () => {
    if (!selectedDoctorId) return;
    setBusy(true);
    setError(null);
    try {
      await appointmentService.createDoctorScheduleException({
        doctorId: selectedDoctorId,
        branchId: exceptionForm.branchId,
        exceptionType: exceptionForm.exceptionType as 'leave' | 'break' | 'unavailable',
        startDate: exceptionForm.startDate,
        endDate: exceptionForm.endDate,
        startTime: exceptionForm.startTime || null,
        endTime: exceptionForm.endTime || null,
        reason: exceptionForm.reason || undefined,
      });
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to save exception');
    } finally {
      setBusy(false);
    }
  };

  const deleteWindow = async (id: string) => {
    if (!window.confirm('Delete this working window? Existing appointments are not affected.')) return;
    setBusy(true);
    try {
      await appointmentService.deleteDoctorSchedule(id);
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to delete working window');
    } finally {
      setBusy(false);
    }
  };

  const deleteException = async (id: string) => {
    if (!window.confirm('Delete this exception? The doctor becomes available again for that period.')) return;
    setBusy(true);
    try {
      await appointmentService.deleteDoctorScheduleException(id);
      await loadRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to delete exception');
    } finally {
      setBusy(false);
    }
  };

  const roster = (
    <aside className="w-full shrink-0 rounded-xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33] lg:w-72">
      <div className="space-y-2 border-b border-[#E0E5E7] p-2.5 dark:border-[#222D34]">
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search doctors…" />
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
          <option value="">All branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <select value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
          <option value="">All specializations</option>
          {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="max-h-[520px] divide-y divide-[#E0E5E7]/60 overflow-y-auto dark:divide-[#222D34]">
        {visibleDoctors.map((doctor) => {
          const doctorBranchIds = [...new Set(schedules.filter((row) => row.doctorId === doctor.id).map((row) => row.branchId))];
          return (
            <button
              type="button"
              key={doctor.id}
              onClick={() => setSelectedDoctorId(doctor.id)}
              className={`block w-full px-3 py-2.5 text-left transition-colors ${selectedDoctorId === doctor.id ? 'bg-teal-500/10' : 'hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]'}`}
            >
              <p className="truncate text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{doctor.fullName}</p>
              <p className="truncate text-[10px] text-[#667781] dark:text-[#8696A0]">{doctor.title || 'Doctor'}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {doctorBranchIds.length > 0 ? doctorBranchIds.map((id) => (
                  <span key={id} className="rounded bg-[#F0F2F5] px-1.5 py-0.5 text-[9px] font-semibold text-[#667781] dark:bg-[#2A3942] dark:text-[#8696A0]">{branchName(id)}</span>
                )) : (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-300">No roster</span>
                )}
              </div>
            </button>
          );
        })}
        {visibleDoctors.length === 0 && <p className="p-4 text-center text-[11px] text-[#667781] dark:text-[#8696A0]">No doctors match these filters.</p>}
      </div>
    </aside>
  );

  const calendar = selectedDoctor && (
    <div className="overflow-x-auto rounded-xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33]">
      <div className={`grid min-w-fit ${mode === 'week' ? 'grid-cols-7' : 'grid-cols-1'}`}>
        {dates.map((day) => {
          const daySchedules = branchScopedSchedules
            .filter((row) => row.dayOfWeek === weekdayOf(day) && row.isActive !== false)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const dayExceptions = doctorExceptions.filter((row) => (!branchFilter || row.branchId === branchFilter) && dateOnly(row.startDate) <= day && dateOnly(row.endDate) >= day);
          const dayAppointments = appointments
            .filter((appointment) => colomboDateKey(appointment.startTime) === day)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day} className="min-h-[260px] border-l border-[#E0E5E7] first:border-l-0 dark:border-[#222D34]">
              <div className="border-b border-[#E0E5E7] px-2 py-1.5 dark:border-[#222D34]">
                <p className="text-[10px] font-bold uppercase text-[#667781] dark:text-[#8696A0]">{formatDateKey(day, { weekday: 'short' })}</p>
                <p className="text-[11px] font-bold text-[#111B21] dark:text-[#E9EDEF]">{formatDateKey(day)}</p>
              </div>
              <div className="space-y-1 p-1.5">
                {daySchedules.map((row) => (
                  <div key={row.id} className="group rounded border border-teal-500/25 bg-teal-500/5 px-1.5 py-1 text-[10px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-teal-700 dark:text-teal-300">{row.startTime}–{row.endTime}</span>
                      {!branchFilter && <span className="truncate text-[9px] text-[#667781] dark:text-[#8696A0]">{branchName(row.branchId)}</span>}
                      <button type="button" onClick={() => deleteWindow(row.id)} disabled={busy} className="rounded p-0.5 text-[#667781] opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 dark:text-[#8696A0]" title="Delete working window"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
                {dayExceptions.map((row) => (
                  <div key={row.id} className={`rounded px-1.5 py-1 text-[10px] ${EXCEPTION_TONES[row.exceptionType] || EXCEPTION_TONES.unavailable}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold">{EXCEPTION_LABELS[row.exceptionType] || row.exceptionType}{row.startTime ? ` ${row.startTime}–${row.endTime}` : ''}</span>
                      <button type="button" onClick={() => deleteException(row.id)} disabled={busy} className="rounded p-0.5 opacity-60 hover:text-rose-500" title="Delete exception"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    {row.reason && <p className="truncate text-[9px] opacity-80">{row.reason}</p>}
                  </div>
                ))}
                {dayAppointments.map((appointment) => {
                  const config = getAppointmentStatusConfig(appointment.status);
                  return (
                    <button type="button" key={appointment.id} onClick={() => setSelectedAppointmentId(appointment.id)} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[9px] font-semibold ${config.badgeClass}`} title={`${appointment.patientName} · ${appointment.treatmentName}`}>
                      {formatColomboTime(appointment.startTime)} {appointment.patientName || 'Patient'}
                    </button>
                  );
                })}
                {daySchedules.length === 0 && dayExceptions.length === 0 && dayAppointments.length === 0 && (
                  <p className="px-1 py-3 text-center text-[9px] text-[#667781] dark:text-[#8696A0]">No roster</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const detail = selectedDoctor ? (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#202C33]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#111B21] dark:text-[#E9EDEF]">{selectedDoctor.fullName}</p>
            <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">{selectedDoctor.title || 'Doctor'}{selectedDoctor.phone ? ` · ${selectedDoctor.phone}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {branchAssignments.length > 0 ? branchAssignments.map((id) => (
              <span key={id} className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[9px] font-semibold text-teal-600 dark:text-teal-300">{branchName(id)}</span>
            )) : <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-300">Branch hours · no roster</span>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#E0E5E7] p-0.5 dark:border-[#222D34]">
            <button type="button" onClick={() => step(-1)} className="rounded p-1.5 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]" aria-label="Previous"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <AppDatePicker
              value={date}
              onChange={(val) => { if (val) setDate(val); }}
              clearable={false}
              className="w-32"
              inputClassName="bg-transparent border-0 px-1 text-xs font-semibold outline-none dark:text-[#E9EDEF]"
            />
            <button type="button" onClick={() => step(1)} className="rounded p-1.5 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]" aria-label="Next"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <button type="button" onClick={() => setDate(colomboDateKey())} className="rounded-lg border border-[#E0E5E7] px-2.5 py-1.5 text-[11px] font-semibold dark:border-[#222D34]">Today</button>
          <div className="flex rounded-lg border border-[#E0E5E7] p-0.5 dark:border-[#222D34]">
            <button type="button" onClick={() => setMode('day')} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${mode === 'day' ? 'bg-teal-600 text-white' : 'text-[#667781] dark:text-[#8696A0]'}`}>Day</button>
            <button type="button" onClick={() => setMode('week')} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${mode === 'week' ? 'bg-teal-600 text-white' : 'text-[#667781] dark:text-[#8696A0]'}`}>Week</button>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#667781] dark:text-[#8696A0]"><Clock className="h-3.5 w-3.5" />{mode === 'week' ? `${formatDateKey(dates[0])} – ${formatDateKey(dates[6])}` : formatDateKey(date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {calendar}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#202C33]">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]"><Clock className="h-3.5 w-3.5 text-teal-500" />Add working window</h3>
          <p className="mt-1 text-[10px] text-[#667781] dark:text-[#8696A0]">Recurring weekly hours. Overlapping windows are rejected by the server.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select value={windowForm.branchId} onChange={(e) => setWindowForm({ ...windowForm, branchId: e.target.value })} className="rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-[11px] dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
              <option value="">Select branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={windowForm.dayOfWeek} onChange={(e) => setWindowForm({ ...windowForm, dayOfWeek: e.target.value })} className="rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-[11px] dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
              {WEEKDAY_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
            </select>
            <AppTimePicker
              value={windowForm.startTime}
              onChange={(val) => setWindowForm({ ...windowForm, startTime: val })}
              placeholder="Start time"
              inputClassName="py-1.5 text-[11px]"
            />
            <AppTimePicker
              value={windowForm.endTime}
              onChange={(val) => setWindowForm({ ...windowForm, endTime: val })}
              placeholder="End time"
              inputClassName="py-1.5 text-[11px]"
            />
          </div>
          <button type="button" onClick={addWindow} disabled={busy || !windowForm.branchId} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"><Plus className="h-3 w-3" />Add window</button>
        </div>

        <div className="rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#202C33]">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]"><CalendarDays className="h-3.5 w-3.5 text-rose-400" />Add leave, break or exception</h3>
          <p className="mt-1 text-[10px] text-[#667781] dark:text-[#8696A0]">Blocks doctor booking for the selected dates. Leave the times empty for a full day.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select value={exceptionForm.exceptionType} onChange={(e) => setExceptionForm({ ...exceptionForm, exceptionType: e.target.value })} className="rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-[11px] dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
              <option value="leave">Leave</option>
              <option value="break">Break</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <select value={exceptionForm.branchId} onChange={(e) => setExceptionForm({ ...exceptionForm, branchId: e.target.value })} className="rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-[11px] dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
              <option value="">Select branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <AppDatePicker
              value={exceptionForm.startDate}
              onChange={(val) => setExceptionForm({ ...exceptionForm, startDate: val, endDate: val < exceptionForm.endDate ? exceptionForm.endDate : val })}
              placeholder="Start date"
              inputClassName="py-1.5 text-[11px]"
            />
            <AppDatePicker
              value={exceptionForm.endDate}
              minDate={exceptionForm.startDate}
              onChange={(val) => setExceptionForm({ ...exceptionForm, endDate: val })}
              placeholder="End date"
              inputClassName="py-1.5 text-[11px]"
            />
            <AppTimePicker
              value={exceptionForm.startTime}
              onChange={(val) => setExceptionForm({ ...exceptionForm, startTime: val })}
              placeholder="Start time (opt)"
              inputClassName="py-1.5 text-[11px]"
              clearable={true}
            />
            <AppTimePicker
              value={exceptionForm.endTime}
              onChange={(val) => setExceptionForm({ ...exceptionForm, endTime: val })}
              placeholder="End time (opt)"
              inputClassName="py-1.5 text-[11px]"
              clearable={true}
            />
            <input type="text" value={exceptionForm.reason} onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })} placeholder="Reason (optional)" className="col-span-2 rounded-lg border border-[#E0E5E7] bg-white px-2 py-1.5 text-[11px] dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]" />
          </div>
          <button type="button" onClick={addException} disabled={busy || !exceptionForm.branchId} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"><Plus className="h-3 w-3" />Add exception</button>
        </div>
      </div>

      {doctorExceptions.length > 0 && (
        <div className="rounded-xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33]">
          <div className="border-b border-[#E0E5E7] px-3 py-2 text-xs font-bold text-[#111B21] dark:border-[#222D34] dark:text-[#E9EDEF]">Doctor exceptions</div>
          <div className="divide-y divide-[#E0E5E7]/60 dark:divide-[#222D34]">
            {doctorExceptions.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${EXCEPTION_TONES[row.exceptionType] || EXCEPTION_TONES.unavailable}`}>{EXCEPTION_LABELS[row.exceptionType] || row.exceptionType}</span>
                  <span className="text-[11px] font-semibold text-[#111B21] dark:text-[#E9EDEF]">{dateOnly(row.startDate)}{dateOnly(row.endDate) !== dateOnly(row.startDate) ? ` → ${dateOnly(row.endDate)}` : ''}</span>
                  {row.startTime && <span className="ml-1 text-[10px] text-[#667781] dark:text-[#8696A0]">{row.startTime}–{row.endTime}</span>}
                  <span className="ml-1.5 text-[10px] text-[#667781] dark:text-[#8696A0]">{branchName(row.branchId)}</span>
                  {row.reason && <span className="ml-1.5 text-[10px] italic text-[#667781] dark:text-[#8696A0]">{row.reason}</span>}
                </div>
                <button type="button" onClick={() => deleteException(row.id)} disabled={busy} className="rounded p-1 text-[#667781] hover:text-rose-500 dark:text-[#8696A0]" title="Delete exception"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F5F7F8] px-3 py-4 text-[#111B21] dark:bg-[#111B21] dark:text-[#E9EDEF] sm:px-5">
      <PageHeader
        eyebrow="Appointment room"
        title="Doctor Scheduling"
        description="Maintain each doctor's weekly roster, branch assignments, leave and breaks. Doctor, clinic and time decide availability."
        actions={(
          <button type="button" onClick={() => { loadRoster(); loadAppointments(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-2 text-xs font-semibold dark:border-[#222D34] dark:bg-[#202C33]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      />

      {error && <div className="mt-4"><ErrorState message={error} onRetry={loadRoster} /></div>}

      {!error && loading && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E0E5E7] bg-white p-6 text-xs text-[#667781] dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#8696A0]">
          <AlertCircle className="h-4 w-4 animate-pulse" />Loading doctor schedules…
        </div>
      )}

      {!error && !loading && (
        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          {roster}
          <div className="min-w-0 flex-1">
            {doctors.length === 0 ? (
              <div className="rounded-xl border border-[#E0E5E7] bg-white p-8 dark:border-[#222D34] dark:bg-[#202C33]">
                <EmptyState icon={Stethoscope} title="No doctors found" description="Add doctors in the treatment/doctor catalogue before configuring schedules." compact />
              </div>
            ) : detail}
          </div>
        </div>
      )}

      <AppointmentDetailModal
        isOpen={Boolean(selectedAppointmentId)}
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        onUpdated={loadAppointments}
      />
    </div>
  );
};
