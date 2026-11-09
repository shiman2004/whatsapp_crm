import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  Filter,
  LayoutGrid,
  Plus,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import {
  Appointment,
  AppointmentStats,
  Branch,
  Doctor,
} from '../../types';
import { appointmentService } from '../../services/appointmentService';
import { useCrm } from '../../context/CrmContext';
import { getAppointmentStatusConfig, APPOINTMENT_STATUS_CONFIG } from '../../utils/appointmentStatusUtils';
import { colomboDateKey, colomboTimeKey, formatColomboDate, formatDateKey, shiftDateKey, weekDates } from '../../utils/appointmentTime';
import { AppDatePicker } from '../common';
import { DataTable, EmptyState, ErrorState, FilterToolbar, PageHeader, SearchInput, StatCard, type DataColumn } from '../ui';
import { BookUpdateAppointmentModal } from './BookUpdateAppointmentModal';
import { AppointmentDetailModal } from './AppointmentDetailModal';

type ViewMode = 'table' | 'calendar';

export const AppointmentBookingsView: React.FC = () => {
  const { currentUser, treatments, users, setSelectedLeadId, setActiveNavTab } = useCrm();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<AppointmentStats | null>(null);

  const [branchId, setBranchId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('table');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => `${colomboDateKey().slice(0, 7)}-01`);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'reschedule'>('view');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingAppointmentId, setBookingAppointmentId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');

  useEffect(() => {
    Promise.all([appointmentService.getBranches(), appointmentService.getDoctors()])
      .then(([branchList, doctorList]) => {
        setBranches(branchList);
        setDoctors(doctorList);
        if (branchList.length > 0) {
          const match = branchList.find((b) => b.name.toLowerCase().includes((currentUser?.branch || '').toLowerCase()));
          setBranchId((current) => current || match?.id || branchList[0].id);
        }
      })
      .catch((err) => setError(err.message || 'Failed to load branches and doctors'));
  }, [currentUser]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { branchId: branchId || undefined, doctorId: doctorId || undefined, status: status || undefined, startDate: startDate || undefined, endDate: endDate || undefined };
      const [list, summary] = await Promise.all([
        appointmentService.getAppointments({ ...params, q: search.trim() || undefined }),
        appointmentService.getAppointmentStats(params),
      ]);
      setAppointments(list);
      setStats(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [branchId, doctorId, status, startDate, endDate, search]);

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const resetFilters = () => {
    setDoctorId('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  const openBooking = (appointmentId: string | null = null, date = '') => {
    setBookingAppointmentId(appointmentId);
    setBookingDate(date);
    setBookingOpen(true);
  };

  const openDetails = (id: string, mode: 'view' | 'reschedule' = 'view') => {
    setDetailMode(mode);
    setSelectedAppointmentId(id);
  };

  const openWhatsApp = (phone: string) => {
    const lead = appointments.find((a) => a.patientPhone === phone);
    if (lead?.leadId) {
      setSelectedLeadId(lead.leadId);
      setActiveNavTab('chat');
    }
  };

  const columns: DataColumn<Appointment>[] = [
    {
      key: 'time',
      header: 'Date & time',
      render: (row) => (
        <div className="min-w-[130px]">
          <p className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{formatColomboDate(row.startTime, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <p className="font-mono text-[11px] text-[#667781] dark:text-[#8696A0]">{colomboTimeKey(row.startTime)} – {colomboTimeKey(row.endTime)}</p>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (row) => (
        <div className="min-w-[150px]">
          <p className="font-semibold text-[#111B21] dark:text-[#E9EDEF]">{row.patientName || 'Patient'}</p>
          <p className="text-[11px] text-[#667781] dark:text-[#8696A0]">{row.patientPhone || 'No phone'}{row.leadSerialNumber ? ` · ${row.leadSerialNumber}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'treatment',
      header: 'Treatment',
      render: (row) => <span className="text-[#111B21] dark:text-[#E9EDEF]">{row.treatmentName || '—'}</span>,
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (row) => (
        <div className="min-w-[120px]">
          <p className="text-[#111B21] dark:text-[#E9EDEF]">{row.doctorName || 'Doctor'}</p>
          <p className="text-[10px] text-[#667781] dark:text-[#8696A0]">{row.branchName || ''}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const config = getAppointmentStatusConfig(row.status);
        return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.badgeClass}`}>{config.iconEmoji} {config.label}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); openDetails(row.id); }} className="rounded-lg p-1.5 text-[#667781] hover:bg-[#F0F2F5] hover:text-[#111B21] dark:text-[#8696A0] dark:hover:bg-[#2A3942] dark:hover:text-[#E9EDEF]" title="View details">
            <Eye className="h-3.5 w-3.5" />
          </button>
          {row.status !== 'cancelled' && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); openBooking(row.id); }} className="rounded-lg p-1.5 text-orange-500 hover:bg-orange-500/10" title="Reschedule">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); openDetails(row.id); }} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10" title="Cancel">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((appointment) => {
      const key = colomboDateKey(appointment.startTime);
      map.set(key, [...(map.get(key) || []), appointment]);
    });
    return map;
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const monthStart = monthCursor;
    const firstWeek = weekDates(monthStart);
    return [...firstWeek, ...Array.from({ length: 5 }, (_, week) => weekDates(shiftDateKey(firstWeek[0], (week + 1) * 7))).flat()];
  }, [monthCursor]);

  const changeMonth = (delta: number) => {
    const [year, month] = monthCursor.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setMonthCursor(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F5F7F8] px-3 py-4 text-[#111B21] dark:bg-[#111B21] dark:text-[#E9EDEF] sm:px-5">
      <PageHeader
        eyebrow="Appointment room"
        title="All Appointments"
        description="Every booking across branches, doctors and treatments. Doctor, clinic and time are authoritative; rooms are optional historical data."
        actions={(
          <>
            <div className="flex rounded-lg border border-[#E0E5E7] bg-white p-0.5 dark:border-[#222D34] dark:bg-[#202C33]">
              <button type="button" onClick={() => setView('table')} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${view === 'table' ? 'bg-teal-600 text-white' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                <ClipboardList className="h-3.5 w-3.5" /> Table
              </button>
              <button type="button" onClick={() => setView('calendar')} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${view === 'calendar' ? 'bg-teal-600 text-white' : 'text-[#667781] dark:text-[#8696A0]'}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Calendar
              </button>
            </div>
            <button type="button" onClick={() => openBooking(null)} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-500">
              <Plus className="h-4 w-4" /> Book appointment
            </button>
          </>
        )}
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={stats?.total ?? '—'} icon={CalendarDays} tone="teal" />
        <StatCard label="Pending" value={stats?.pending ?? '—'} icon={Clock} tone="amber" />
        <StatCard label="Confirmed" value={stats?.confirmed ?? '—'} icon={ClipboardList} tone="blue" />
        <StatCard label="Completed" value={stats?.completed ?? '—'} icon={ClipboardList} tone="violet" />
        <StatCard label="Cancelled" value={stats?.cancelled ?? '—'} icon={XCircle} tone="rose" hint={stats ? `${stats.cancellationRate}% rate` : undefined} />
        <StatCard label="No-show" value={stats?.noShow ?? '—'} icon={XCircle} tone="slate" />
      </div>

      <div className="mt-4 rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#202C33]">
        <FilterToolbar>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#667781] dark:text-[#8696A0]"><Filter className="h-3.5 w-3.5" /> Filters</div>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
            <option value="">All doctors</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]">
            <option value="">All statuses</option>
            {Object.values(APPOINTMENT_STATUS_CONFIG).map((config) => <option key={config.key} value={config.key}>{config.label}</option>)}
          </select>
          <AppDatePicker
            value={startDate}
            maxDate={endDate || undefined}
            onChange={(val) => setStartDate(val)}
            placeholder="From date"
            ariaLabel="From date"
            className="w-36"
            inputClassName="rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]"
          />
          <AppDatePicker
            value={endDate}
            minDate={startDate || undefined}
            onChange={(val) => setEndDate(val)}
            placeholder="To date"
            ariaLabel="To date"
            className="w-36"
            inputClassName="rounded-lg border border-[#E0E5E7] bg-white px-2.5 py-1.5 text-xs dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF]"
          />
          <SearchInput value={search} onValueChange={setSearch} placeholder="Patient, phone or lead" className="w-48" />
          <button type="button" onClick={resetFilters} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#667781] hover:bg-[#F0F2F5] dark:text-[#8696A0] dark:hover:bg-[#2A3942]">Reset</button>
          <button type="button" onClick={load} className="rounded-lg p-1.5 text-[#667781] hover:bg-[#F0F2F5] dark:text-[#8696A0] dark:hover:bg-[#2A3942]" title="Refresh"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </FilterToolbar>
      </div>

      {error ? (
        <div className="mt-4"><ErrorState message={error} onRetry={load} /></div>
      ) : view === 'table' ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33]">
          <DataTable
            columns={columns}
            rows={appointments}
            getRowKey={(row) => row.id}
            onRowClick={(row) => openDetails(row.id)}
            caption="All appointments"
            empty={<div className="p-6"><EmptyState icon={CalendarDays} title="No appointments match these filters" description="Adjust the filters or book a new appointment." compact /></div>}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#E0E5E7] bg-white p-3 dark:border-[#222D34] dark:bg-[#202C33]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => changeMonth(-1)} className="rounded-lg p-1.5 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <h3 className="min-w-[130px] text-center text-sm font-bold">{formatDateKey(monthCursor, { month: 'long', year: 'numeric' })}</h3>
              <button type="button" onClick={() => changeMonth(1)} className="rounded-lg p-1.5 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => setMonthCursor(`${colomboDateKey().slice(0, 7)}-01`)} className="rounded-lg border border-[#E0E5E7] px-2.5 py-1 text-[11px] font-semibold dark:border-[#222D34]">Today</button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="py-1 text-[10px] font-bold uppercase tracking-wide text-[#667781] dark:text-[#8696A0]">{day}</div>)}
            {calendarDays.map((day) => {
              const dayAppointments = appointmentsByDate.get(day) || [];
              const inMonth = day.slice(0, 7) === monthCursor.slice(0, 7);
              const isToday = day === colomboDateKey();
              return (
                <div
                  key={day}
                  className={`relative min-h-[76px] rounded-lg border p-1 text-left transition-colors ${inMonth ? 'border-[#E0E5E7] hover:bg-[#F0F2F5] dark:border-[#222D34] dark:hover:bg-[#2A3942]' : 'border-transparent opacity-40'} ${isToday ? 'ring-1 ring-teal-500' : ''}`}
                >
                  {inMonth && (
                    <button
                      type="button"
                      aria-label={`Book appointment on ${formatDateKey(day, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                      onClick={() => openBooking(null, day)}
                      className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  )}
                  <span className={`relative z-10 pointer-events-none text-[10px] font-bold ${isToday ? 'text-teal-500' : ''}`}>{Number(day.slice(-2))}</span>
                  <div className="relative z-10 mt-1 space-y-0.5">
                    {dayAppointments.slice(0, 2).map((appointment) => {
                      const config = getAppointmentStatusConfig(appointment.status);
                      return (
                        <button
                          type="button"
                          key={appointment.id}
                          onClick={(event) => { event.stopPropagation(); openDetails(appointment.id); }}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-semibold transition-colors hover:brightness-110 ${config.badgeClass}`}
                          title={`View ${appointment.patientName || 'patient'} appointment details`}
                        >
                          {colomboTimeKey(appointment.startTime)} {appointment.patientName || 'Patient'}
                        </button>
                      );
                    })}
                    {dayAppointments.length > 2 && (
                      <button type="button" onClick={(event) => { event.stopPropagation(); openDetails(dayAppointments[0].id); }} className="block text-[9px] font-bold text-teal-500 hover:underline">
                        +{dayAppointments.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AppointmentDetailModal
        isOpen={Boolean(selectedAppointmentId)}
        appointmentId={selectedAppointmentId}
        initialMode={detailMode}
        onClose={() => setSelectedAppointmentId(null)}
        onUpdated={load}
        onOpenWhatsAppChat={openWhatsApp}
        onReschedule={(id) => { setSelectedAppointmentId(null); openBooking(id); }}
      />

      <BookUpdateAppointmentModal
        isOpen={bookingOpen}
        appointmentId={bookingAppointmentId}
        onClose={() => setBookingOpen(false)}
        onSuccess={() => { setBookingOpen(false); setBookingAppointmentId(null); setBookingDate(''); load(); }}
        branches={branches}
        treatments={treatments}
        doctors={doctors}
        users={users}
        defaultBranchId={branchId}
        defaultDate={bookingDate || startDate || colomboDateKey()}
      />
    </div>
  );
};
