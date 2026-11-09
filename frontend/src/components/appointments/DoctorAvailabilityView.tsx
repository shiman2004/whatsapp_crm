import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Appointment, Branch, Doctor, DoctorAvailabilityDay, DoctorAvailabilityResponse } from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { useCrm } from '../../context/CrmContext';
import { getAppointmentStatusConfig } from '../../utils/appointmentStatusUtils';
import { colomboDateKey, formatDateKey, shiftDateKey, weekDates } from '../../utils/appointmentTime';
import { EmptyState, ErrorState, PageHeader } from '../ui';
import { BookUpdateAppointmentModal } from './BookUpdateAppointmentModal';
import { AppointmentDetailModal } from './AppointmentDetailModal';
import { AppDatePicker } from '../common';

const SLOT_HEIGHT = 46;
const DEFAULT_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const minutes = (8 * 60) + (i * 30);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

const slotTone: Record<string, string> = {
  available: 'hover:bg-teal-500/10 cursor-pointer',
  booked: 'bg-sky-500/10 cursor-pointer',
  blocked: 'bg-rose-500/10 cursor-not-allowed',
  outside_hours: 'bg-[#F5F7F8] dark:bg-[#182229]',
};

export const DoctorAvailabilityView: React.FC = () => {
  const { treatments, users } = useCrm();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(colomboDateKey());
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [availability, setAvailability] = useState<DoctorAvailabilityResponse | null>(null);
  const [weekData, setWeekData] = useState<Record<string, DoctorAvailabilityResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDefaults, setBookingDefaults] = useState({ date, time: '09:00', doctorId: '' });

  useEffect(() => {
    Promise.all([appointmentService.getBranches(), appointmentService.getDoctors()])
      .then(([branchList, doctorList]) => {
        setBranches(branchList);
        setDoctors(doctorList);
        setBranchId((current) => current || branchList[0]?.id || '');
      })
      .catch((err) => setError(err.message || 'Failed to load branches and doctors'));
  }, []);

  const dates = useMemo(() => (mode === 'week' ? weekDates(date) : [date]), [mode, date]);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'day') {
        setAvailability(await appointmentService.getDoctorAvailability(branchId, date));
      } else {
        const results = await Promise.all(dates.map((day) => appointmentService.getDoctorAvailability(branchId, day)));
        setWeekData(Object.fromEntries(results.map((item) => [item.date, item])));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load doctor availability');
    } finally {
      setLoading(false);
    }
  }, [branchId, date, mode, dates]);

  useEffect(() => { load(); }, [load]);

  const step = (delta: number) => setDate((current) => shiftDateKey(current, delta));

  const openBooking = (doctorId: string, day: string, time: string) => {
    setBookingDefaults({ date: day, time, doctorId });
    setBookingOpen(true);
  };

  const appointmentById = (day: DoctorAvailabilityDay, id?: string | null): Appointment | undefined =>
    id ? day.appointments.find((appointment) => appointment.id === id) : undefined;

  const dayView = availability && (
    <div className="mt-4 overflow-x-auto rounded-xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33]">
      {availability.doctors.length === 0 ? (
        <div className="p-8"><EmptyState icon={CalendarDays} title="No doctors available at this branch" description="Assign doctors to this branch in Doctor Scheduling." compact /></div>
      ) : (
        <div className="min-w-fit">
          <div className="flex border-b border-[#E0E5E7] dark:border-[#222D34]">
            <div className="sticky left-0 z-10 w-16 shrink-0 bg-white p-2 text-center text-[10px] font-bold uppercase text-[#667781] dark:bg-[#202C33] dark:text-[#8696A0]">Time</div>
            {availability.doctors.map((doctor) => (
              <div key={doctor.doctorId} className="w-52 shrink-0 border-l border-[#E0E5E7] p-2.5 dark:border-[#222D34]">
                <p className="truncate text-xs font-bold text-[#111B21] dark:text-[#E9EDEF]">{doctor.doctorName}</p>
                <p className="truncate text-[10px] text-[#667781] dark:text-[#8696A0]">{doctor.doctorTitle || 'Doctor'} · {doctor.branchName}</p>
                <p className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${doctor.scheduleConfigured ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300' : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'}`}>
                  {doctor.scheduleConfigured ? doctor.workingWindows.map((w) => `${w.startTime}–${w.endTime}`).join(', ') : 'Branch hours · no roster'}
                </p>
              </div>
            ))}
          </div>
          <div className="flex">
            <div className="sticky left-0 z-10 w-16 shrink-0 divide-y divide-[#E0E5E7]/60 bg-white dark:divide-[#222D34] dark:bg-[#202C33]">
              {DEFAULT_SLOTS.map((slot) => (
                <div key={slot} style={{ height: SLOT_HEIGHT }} className="flex items-start justify-center pt-1.5 font-mono text-[10px] font-semibold text-[#667781] dark:text-[#8696A0]">{slot}</div>
              ))}
            </div>
            {availability.doctors.map((doctor) => (
              <div key={doctor.doctorId} className="w-52 shrink-0 border-l border-[#E0E5E7] dark:border-[#222D34]">
                {doctor.slots.map((slot) => {
                  const appointment = appointmentById(doctor, slot.appointmentId);
                  const config = appointment ? getAppointmentStatusConfig(appointment.status) : null;
                  return (
                    <div
                      key={slot.startTime}
                      style={{ height: SLOT_HEIGHT }}
                      onClick={() => {
                        if (slot.status === 'available') openBooking(doctor.doctorId, date, slot.startTime);
                        else if (appointment) setSelectedAppointmentId(appointment.id);
                      }}
                      className={`group relative border-b border-[#E0E5E7]/60 px-1 py-0.5 dark:border-[#222D34]/70 ${slotTone[slot.status] || ''}`}
                      title={appointment ? `${appointment.patientName} · ${appointment.treatmentName}` : slot.status === 'available' ? `Book ${slot.startTime}` : slot.status.replace('_', ' ')}
                    >
                      {appointment ? (
                        <div className={`h-full overflow-hidden rounded border px-1.5 py-0.5 text-[10px] font-semibold ${config?.badgeClass}`}>
                          <span className="block truncate">{appointment.patientName || 'Patient'}</span>
                          <span className="block truncate text-[9px] opacity-80">{appointment.treatmentName}</span>
                        </div>
                      ) : slot.status === 'available' ? (
                        <div className="flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="inline-flex items-center gap-0.5 rounded bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white"><Plus className="h-2.5 w-2.5" />Book</span>
                        </div>
                      ) : slot.status === 'blocked' ? (
                        <span className="flex h-full items-center justify-center text-[9px] font-semibold text-rose-400">Blocked</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const weekView = (
    <div className="mt-4 overflow-x-auto rounded-xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33]">
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#E0E5E7] dark:border-[#222D34]">
            <th className="w-40 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#667781] dark:text-[#8696A0]">Doctor</th>
            {dates.map((day) => (
              <th key={day} className="px-2 py-2 text-center text-[10px] font-bold text-[#667781] dark:text-[#8696A0]">
                <span className="block">{formatDateKey(day, { weekday: 'short' })}</span>
                <span className="block text-[11px] text-[#111B21] dark:text-[#E9EDEF]">{formatDateKey(day, { month: 'short', day: 'numeric' })}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.values(weekData)[0]?.doctors || []).map((doctor) => (
            <tr key={doctor.doctorId} className="border-b border-[#E0E5E7]/60 last:border-0 dark:border-[#222D34]/70">
              <td className="px-3 py-2">
                <p className="font-bold text-[#111B21] dark:text-[#E9EDEF]">{doctor.doctorName}</p>
                <p className="text-[10px] text-[#667781] dark:text-[#8696A0]">{doctor.doctorTitle || 'Doctor'}</p>
              </td>
              {dates.map((day) => {
                const dayDoctor = weekData[day]?.doctors.find((d) => d.doctorId === doctor.doctorId);
                const dayAppointments = dayDoctor?.appointments || [];
                const availableCount = (dayDoctor?.slots || []).filter((slot) => slot.status === 'available').length;
                return (
                  <td key={day} className="px-1.5 py-1.5 align-top">
                    <div className="min-h-[64px] space-y-1 rounded-lg border border-[#E0E5E7]/60 p-1 dark:border-[#222D34]">
                      {dayAppointments.slice(0, 2).map((appointment) => (
                        <button type="button" key={appointment.id} onClick={() => setSelectedAppointmentId(appointment.id)} className={`block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-semibold ${getAppointmentStatusConfig(appointment.status).badgeClass}`}>
                          {new Date(appointment.startTime).toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false })} {appointment.patientName}
                        </button>
                      ))}
                      {dayAppointments.length > 2 && <p className="text-[9px] font-bold text-teal-500">+{dayAppointments.length - 2} more</p>}
                      {availableCount > 0 && (
                        <button type="button" onClick={() => openBooking(doctor.doctorId, day, dayDoctor?.slots.find((slot) => slot.status === 'available')?.startTime || '09:00')} className="w-full rounded border border-dashed border-teal-500/40 px-1 py-0.5 text-[9px] font-semibold text-teal-600 hover:bg-teal-500/10 dark:text-teal-300">
                          {availableCount} free · book
                        </button>
                      )}
                      {dayAppointments.length === 0 && availableCount === 0 && <p className="px-1 py-2 text-center text-[9px] text-[#667781] dark:text-[#8696A0]">No slots</p>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {Object.keys(weekData).length === 0 && <div className="p-6"><EmptyState title="No doctors available" compact /></div>}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F5F7F8] px-3 py-4 text-[#111B21] dark:bg-[#111B21] dark:text-[#E9EDEF] sm:px-5">
      <PageHeader
        eyebrow="Appointment room"
        title="Doctor Availability"
        description="See each doctor's real working windows, leave and booked slots. Click a free slot to book."
        actions={(
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-2 text-xs font-semibold dark:border-[#222D34] dark:bg-[#202C33]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#E0E5E7] bg-white p-2.5 dark:border-[#222D34] dark:bg-[#202C33]">
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <div className="flex items-center rounded-lg border border-[#E0E5E7] p-0.5 dark:border-[#222D34]">
          <button type="button" onClick={() => step(mode === 'week' ? -7 : -1)} className="rounded p-1.5 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]" aria-label="Previous"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <AppDatePicker
            value={date}
            onChange={(val) => { if (val) setDate(val); }}
            clearable={false}
            className="w-32"
            inputClassName="bg-transparent border-0 px-1 text-xs font-semibold outline-none dark:text-[#E9EDEF]"
          />
          <button type="button" onClick={() => step(mode === 'week' ? 7 : 1)} className="rounded p-1.5 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]" aria-label="Next"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
        <button type="button" onClick={() => setDate(colomboDateKey())} className="rounded-lg border border-[#E0E5E7] px-2.5 py-1.5 text-[11px] font-semibold dark:border-[#222D34]">Today</button>
        <div className="flex rounded-lg border border-[#E0E5E7] p-0.5 dark:border-[#222D34]">
          <button type="button" onClick={() => setMode('day')} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${mode === 'day' ? 'bg-teal-600 text-white' : 'text-[#667781] dark:text-[#8696A0]'}`}>Day</button>
          <button type="button" onClick={() => setMode('week')} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${mode === 'week' ? 'bg-teal-600 text-white' : 'text-[#667781] dark:text-[#8696A0]'}`}>Week</button>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#667781] dark:text-[#8696A0]"><Clock className="h-3.5 w-3.5" />{mode === 'week' ? `${formatDateKey(dates[0])} – ${formatDateKey(dates[6])}` : formatDateKey(date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      </div>

      {error && <div className="mt-4"><ErrorState message={error} onRetry={load} /></div>}
      {!error && loading && <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E0E5E7] bg-white p-6 text-xs text-[#667781] dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#8696A0]"><AlertCircle className="h-4 w-4 animate-pulse" />Loading availability…</div>}
      {!error && !loading && mode === 'day' && dayView}
      {!error && !loading && mode === 'week' && weekView}

      <AppointmentDetailModal
        isOpen={Boolean(selectedAppointmentId)}
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        onUpdated={load}
      />

      <BookUpdateAppointmentModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSuccess={() => { setBookingOpen(false); load(); }}
        branches={branches}
        treatments={treatments}
        doctors={doctors}
        users={users}
        defaultBranchId={branchId}
        defaultDate={bookingDefaults.date}
        defaultStartTime={bookingDefaults.time}
        defaultDoctorId={bookingDefaults.doctorId}
      />
    </div>
  );
};
