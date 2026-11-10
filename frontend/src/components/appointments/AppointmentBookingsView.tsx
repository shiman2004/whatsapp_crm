import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpDown,
  Building2,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Stethoscope,
  Table,
  UserX,
  X,
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
import { BookUpdateAppointmentModal } from './BookUpdateAppointmentModal';
import { AppointmentDetailModal } from './AppointmentDetailModal';

type ViewMode = 'table' | 'calendar';
type CalendarMode = 'month' | 'week' | 'day';
type SortKey = 'startTime' | 'patientName' | 'doctorName' | 'status' | null;

export const AppointmentBookingsView: React.FC = () => {
  const { currentUser, treatments, users, setSelectedLeadId, setActiveNavTab } = useCrm();

  // Data states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<AppointmentStats | null>(null);

  // Filter states
  const [branchId, setBranchId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('table');

  // Pagination & Sorting states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Async / status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [calendarCursor, setCalendarCursor] = useState(() => colomboDateKey());
  const calendarContainerRef = useRef<HTMLElement | null>(null);

  // Modal states
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingAppointmentId, setBookingAppointmentId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');

  // Quick cancel modal state
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Load branches & doctors on mount
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
      .catch((err) => setError(err.message || 'Failed to load clinic branches and doctors'));
  }, [currentUser]);

  // Main data load function
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        branchId: branchId || undefined,
        doctorId: doctorId || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
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

  // Filter change handlers that reset pagination
  const handleBranchChange = (val: string) => { setBranchId(val); setCurrentPage(1); };
  const handleDoctorChange = (val: string) => { setDoctorId(val); setCurrentPage(1); };
  const handleStatusChange = (val: string) => { setStatus(val); setCurrentPage(1); };
  const handleStartDateChange = (val: string) => { setStartDate(val); setCurrentPage(1); };
  const handleEndDateChange = (val: string) => { setEndDate(val); setCurrentPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setCurrentPage(1); };

  const resetFilters = () => {
    setDoctorId('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setCurrentPage(1);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (doctorId) count++;
    if (status) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (search.trim()) count++;
    return count;
  }, [doctorId, status, startDate, endDate, search]);

  const openBooking = (appointmentId: string | null = null, date = '') => {
    setBookingAppointmentId(appointmentId);
    setBookingDate(date);
    setBookingOpen(true);
  };

  const openDetails = (id: string, mode: 'view' | 'reschedule' | 'cancel' = 'view') => {
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

  const promptCancel = (appointment: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelTarget(appointment);
    setCancelReasonInput('');
    setCancelError(null);
  };

  const confirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    if (!cancelReasonInput.trim()) {
      setCancelError('Please provide a reason for the cancellation.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await appointmentService.cancelAppointment(cancelTarget.id, cancelReasonInput.trim());
      setCancelTarget(null);
      setCancelReasonInput('');
      await load();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  // Sorting & Pagination calculation
  const toggleSort = (key: Exclude<SortKey, null>) => {
    setCurrentPage(1);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  const sortedAppointments = useMemo(() => {
    if (!sortKey) return appointments;
    const copy = [...appointments];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'startTime') {
        cmp = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      } else if (sortKey === 'patientName') {
        cmp = String(a.patientName || '').localeCompare(String(b.patientName || ''));
      } else if (sortKey === 'doctorName') {
        cmp = String(a.doctorName || '').localeCompare(String(b.doctorName || ''));
      } else if (sortKey === 'status') {
        cmp = String(a.status || '').localeCompare(String(b.status || ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [appointments, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedAppointments.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAppointments.slice(start, start + pageSize);
  }, [sortedAppointments, currentPage, pageSize]);

  // Calendar calculations & dimension recalculation when toggling back from hidden/table view
  const monthCursor = `${calendarCursor.slice(0, 7)}-01`;

  useEffect(() => {
    if (view !== 'calendar') return;
    let rafId = 0;
    rafId = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      calendarContainerRef.current?.getBoundingClientRect();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [view, calendarMode, calendarCursor]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((appointment) => {
      const key = colomboDateKey(appointment.startTime);
      map.set(key, [...(map.get(key) || []), appointment]);
    });
    map.forEach((list, key) => {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      map.set(key, list);
    });
    return map;
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const firstWeek = weekDates(monthCursor);
    return [...firstWeek, ...Array.from({ length: 5 }, (_, week) => weekDates(shiftDateKey(firstWeek[0], (week + 1) * 7))).flat()];
  }, [monthCursor]);

  const activeWeekDays = useMemo(() => weekDates(calendarCursor), [calendarCursor]);

  const stepCalendar = (delta: number) => {
    if (calendarMode === 'month') {
      const [year, month] = monthCursor.split('-').map(Number);
      const next = new Date(Date.UTC(year, month - 1 + delta, 1));
      setCalendarCursor(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`);
    } else if (calendarMode === 'week') {
      setCalendarCursor((cur) => shiftDateKey(cur, delta * 7));
    } else {
      setCalendarCursor((cur) => shiftDateKey(cur, delta));
    }
  };

  // Calculated KPI values
  const totalAppointmentsCount = stats?.total ?? appointments.length;
  const pendingCount = stats?.pending ?? appointments.filter((a) => a.status === 'pending').length;
  const confirmedCount = stats?.confirmed ?? appointments.filter((a) => ['confirmed', 'booked'].includes(a.status)).length;
  const completedCount = stats?.completed ?? appointments.filter((a) => ['completed', 'paid'].includes(a.status)).length;
  const cancelledCount = stats?.cancelled ?? appointments.filter((a) => a.status === 'cancelled').length;
  const noShowCount = stats?.noShow ?? appointments.filter((a) => ['no_show', 'no_answer'].includes(a.status)).length;
  const rescheduledCount = stats?.rescheduled ?? appointments.filter((a) => a.status === 'rescheduled').length;
  const activeCount = stats?.active ?? appointments.filter((a) => !['cancelled', 'no_show', 'no_answer', 'completed', 'paid'].includes(a.status)).length;
  const cancellationRate = stats?.cancellationRate ?? (totalAppointmentsCount ? Math.round((cancelledCount / totalAppointmentsCount) * 100) : 0);

  const getPatientInitials = (name?: string) => {
    if (!name) return 'PT';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="min-h-full w-full min-w-0 flex flex-col gap-3 bg-[#F8FAFC] px-3 py-3 pb-6 text-[#0F172A] transition-colors dark:bg-[#111B21] dark:text-[#E9EDEF] sm:px-4 lg:px-5">
      {/* ------------------------------------------------------------- */}
      {/* 1. Page Heading + Primary Booking Action                      */}
      {/* ------------------------------------------------------------- */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">
            All Appointments
          </h1>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {totalAppointmentsCount} {totalAppointmentsCount === 1 ? 'Booking' : 'Bookings'}
          </span>
          <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 lg:inline">
            • Clinical scheduling across all branches
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
            title="Refresh appointments"
            aria-label="Refresh appointments"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => openBooking(null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#128C7E] px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#075E54] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 dark:ring-offset-[#111B21] sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Book Appointment</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Compact KPI Summary Cards (90–105px height)                */}
      {/* ------------------------------------------------------------- */}
      <section className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Appointment Statistics">
        {/* Total Appointments */}
        <div className="group relative flex min-h-[90px] max-h-[104px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-teal-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {totalAppointmentsCount}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {activeCount} active
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="group relative flex min-h-[90px] max-h-[104px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-amber-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {pendingCount}
            </p>
            <p className="truncate text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Awaiting confirmation
            </p>
          </div>
        </div>

        {/* Confirmed */}
        <div className="group relative flex min-h-[90px] max-h-[104px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Confirmed</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {confirmedCount}
            </p>
            <p className="truncate text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {rescheduledCount > 0 ? `${rescheduledCount} rescheduled` : 'Ready for visit'}
            </p>
          </div>
        </div>

        {/* Completed */}
        <div className="group relative flex min-h-[90px] max-h-[104px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-blue-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <CheckCheck className="h-3.5 w-3.5" />
            </span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {completedCount}
            </p>
            <p className="truncate text-[11px] font-medium text-blue-600 dark:text-blue-400">
              Consultations fulfilled
            </p>
          </div>
        </div>

        {/* Cancelled */}
        <div className="group relative flex min-h-[90px] max-h-[104px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-rose-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cancelled</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" />
            </span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {cancelledCount}
            </p>
            <p className="truncate text-[11px] font-medium text-rose-600 dark:text-rose-400">
              {cancellationRate}% cancel rate
            </p>
          </div>
        </div>

        {/* No-show */}
        <div className="group relative flex min-h-[90px] max-h-[104px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-xs transition-all hover:shadow-md dark:border-[#222D34] dark:bg-[#202C33]">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-slate-400" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">No-show</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <UserX className="h-3.5 w-3.5" />
            </span>
          </div>
          <div>
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {noShowCount}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Unattended / no answer
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. Table / Calendar View Selector & Quick Controls            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs dark:border-[#222D34] dark:bg-[#202C33]"
          role="tablist"
          aria-label="Appointment view selector"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'table'}
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              view === 'table'
                ? 'bg-[#128C7E] text-white shadow-xs dark:bg-[#25D366] dark:text-[#111B21]'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'calendar'}
            onClick={() => setView('calendar')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              view === 'calendar'
                ? 'bg-[#128C7E] text-white shadow-xs dark:bg-[#25D366] dark:text-[#111B21]'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Calendar</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="hidden text-slate-500 dark:text-slate-400 sm:inline">
            {view === 'table'
              ? `${sortedAppointments.length} matching records`
              : `${appointments.length} events in schedule`}
          </span>
          <button
            type="button"
            onClick={resetFilters}
            disabled={activeFiltersCount === 0}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
          >
            <Filter className="h-3 w-3 text-teal-600 dark:text-teal-400" />
            <span>Reset Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Compact, Responsive Filter Toolbar                         */}
      {/* ------------------------------------------------------------- */}
      <section className="shrink-0 min-w-0 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-[#222D34] dark:bg-[#202C33]">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
            {/* Search Input */}
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search patient, phone, serial..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-[#128C7E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF] dark:placeholder-[#8696A0] dark:focus:border-[#25D366] dark:focus:bg-[#111B21]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Branch Selection */}
            <div className="relative min-w-0 lg:col-span-2">
              <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={branchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                aria-label="Filter by branch"
                className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-6 text-xs font-medium text-slate-900 transition-colors focus:border-[#128C7E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF] dark:focus:border-[#25D366] dark:focus:bg-[#111B21]"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Doctor Selection */}
            <div className="relative min-w-0 lg:col-span-2">
              <Stethoscope className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={doctorId}
                onChange={(e) => handleDoctorChange(e.target.value)}
                aria-label="Filter by doctor"
                className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-6 text-xs font-medium text-slate-900 transition-colors focus:border-[#128C7E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF] dark:focus:border-[#25D366] dark:focus:bg-[#111B21]"
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selection */}
            <div className="relative min-w-0 lg:col-span-2">
              <Activity className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                aria-label="Filter by status"
                className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-6 text-xs font-medium text-slate-900 transition-colors focus:border-[#128C7E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF] dark:focus:border-[#25D366] dark:focus:bg-[#111B21]"
              >
                <option value="">All Statuses</option>
                {Object.values(APPOINTMENT_STATUS_CONFIG).map((cfg) => (
                  <option key={cfg.key} value={cfg.key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Paired Date Range Pickers (Never occupy full-width stacked rows) */}
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3">
              <div className="min-w-0">
                <AppDatePicker
                  value={startDate}
                  maxDate={endDate || undefined}
                  onChange={(val) => handleStartDateChange(val)}
                  placeholder="From date"
                  ariaLabel="From date"
                  className="w-full"
                  inputClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-[#128C7E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF] dark:placeholder-[#8696A0] dark:focus:border-[#25D366] dark:focus:bg-[#111B21]"
                />
              </div>
              <div className="min-w-0">
                <AppDatePicker
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={(val) => handleEndDateChange(val)}
                  placeholder="To date"
                  ariaLabel="To date"
                  className="w-full"
                  inputClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-[#128C7E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-[#222D34] dark:bg-[#111B21] dark:text-[#E9EDEF] dark:placeholder-[#8696A0] dark:focus:border-[#25D366] dark:focus:bg-[#111B21]"
                />
              </div>
            </div>
          </div>

          {/* Active Filter Badges Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-[#222D34]">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <Filter className="h-3 w-3" />
                Active ({activeFiltersCount}):
              </span>
              {search && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  Search: "{search}"
                  <button type="button" onClick={() => setSearch('')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {doctorId && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  Doctor: {doctors.find((d) => d.id === doctorId)?.fullName || 'Selected'}
                  <button type="button" onClick={() => setDoctorId('')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {status && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  Status: {APPOINTMENT_STATUS_CONFIG[status]?.label || status}
                  <button type="button" onClick={() => setStatus('')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  Date: {startDate || 'Start'} to {endDate || 'End'}
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="hover:opacity-75"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-bold text-teal-600 hover:underline dark:text-teal-400"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. Main Content: Table View OR Calendar View                  */}
      {/* ------------------------------------------------------------- */}
      {error ? (
        <div className="shrink-0 rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <h3 className="mt-2 text-sm font-bold text-rose-900 dark:text-rose-200">Unable to load appointments</h3>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : view === 'table' ? (
        <section className="min-w-0 shrink-0 rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-[#222D34] dark:bg-[#202C33]" aria-label="Appointments Table">
          {/* Table Container */}
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 dark:border-[#222D34] dark:bg-[#111B21]/50">
                  <th scope="col" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => toggleSort('startTime')}
                      className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                    >
                      <span>Date & Time</span>
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'startTime' ? 'text-teal-500' : 'opacity-50'}`} />
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => toggleSort('patientName')}
                      className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                    >
                      <span>Patient</span>
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'patientName' ? 'text-teal-500' : 'opacity-50'}`} />
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Treatment
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => toggleSort('doctorName')}
                      className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                    >
                      <span>Doctor & Clinic</span>
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'doctorName' ? 'text-teal-500' : 'opacity-50'}`} />
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-white"
                    >
                      <span>Status</span>
                      <ArrowUpDown className={`h-3 w-3 ${sortKey === 'status' ? 'text-teal-500' : 'opacity-50'}`} />
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-2.5">
                        <div className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
                        <div className="mt-1.5 h-3 w-20 rounded-md bg-slate-100 dark:bg-slate-800" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />
                            <div className="h-3 w-24 rounded-md bg-slate-100 dark:bg-slate-800" />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="h-3.5 w-24 rounded-md bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="ml-auto h-7 w-20 rounded-md bg-slate-200 dark:bg-slate-700" />
                      </td>
                    </tr>
                  ))
                ) : paginatedAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <h4 className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white">
                        No appointments match these filters
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Try modifying your search query, clearing filters, or booking a new appointment.
                      </p>
                      <div className="mt-3.5 flex items-center justify-center gap-2">
                        {activeFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Clear Filters
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openBooking(null)}
                          className="rounded-xl bg-[#128C7E] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#075E54]"
                        >
                          Book Appointment
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAppointments.map((row) => {
                    const statusConfig = getAppointmentStatusConfig(row.status);
                    const canReschedule = row.status !== 'cancelled';
                    const canCancel = row.status !== 'cancelled';

                    return (
                      <tr
                        key={row.id}
                        onClick={() => openDetails(row.id)}
                        className="group cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        {/* 1. Date & Time */}
                        <td className="px-3 py-2.5 align-middle">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {formatColomboDate(row.startTime, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>
                              {colomboTimeKey(row.startTime)} – {colomboTimeKey(row.endTime)}
                            </span>
                          </div>
                        </td>

                        {/* 2. Patient */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-500/20 bg-teal-50 text-[11px] font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                              {getPatientInitials(row.patientName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900 dark:text-white">
                                {row.patientName || 'Anonymous Patient'}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {row.patientPhone ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="h-2.5 w-2.5 text-slate-400" />
                                    {row.patientPhone}
                                  </span>
                                ) : (
                                  <span>No phone</span>
                                )}
                                {row.leadSerialNumber && (
                                  <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    #{row.leadSerialNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Treatment */}
                        <td className="px-3 py-2.5 align-middle">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.treatmentName || 'General Consultation'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {row.treatmentPrice ? `LKR ${Number(row.treatmentPrice).toLocaleString()}` : (row.appointmentType ? row.appointmentType.replace('_', ' ') : 'Standard visit')}
                          </p>
                        </td>

                        {/* 4. Doctor & Clinic */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                            <Stethoscope className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                            <span>{row.doctorName || 'Assigned Doctor'}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <MapPin className="h-2.5 w-2.5 text-slate-400" />
                            <span>{row.branchName || 'Alpha Health Clinic'}</span>
                            {row.roomNumber && (
                              <span className="rounded bg-slate-100 px-1 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Rm {row.roomNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Status Badge */}
                        <td className="px-3 py-2.5 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-2xs ${statusConfig.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} />
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-3 py-2.5 align-middle text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {row.patientPhone && (
                              <button
                                type="button"
                                onClick={() => openWhatsApp(row.patientPhone!)}
                                className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                title="Open WhatsApp Chat"
                                aria-label="Open WhatsApp Chat"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openDetails(row.id, 'view')}
                              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                              title="View details"
                              aria-label="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {canReschedule && (
                              <button
                                type="button"
                                onClick={() => openBooking(row.id)}
                                className="rounded-lg p-1.5 text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50"
                                title="Reschedule appointment"
                                aria-label="Reschedule appointment"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {canCancel && (
                              <button
                                type="button"
                                onClick={(e) => promptCancel(row, e)}
                                className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                                title="Cancel appointment"
                                aria-label="Cancel appointment"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          {!loading && sortedAppointments.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/50 px-3 py-2.5 text-xs dark:border-[#222D34] dark:bg-[#111B21]/30 sm:flex-row">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span>
                  Showing{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(currentPage * pageSize, sortedAppointments.length)}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-slate-900 dark:text-white">{sortedAppointments.length}</strong> appointments
                </span>

                <span className="text-slate-300 dark:text-slate-700">|</span>

                <div className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Rows per page"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per page</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = idx + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = Math.min(currentPage - 2 + idx, totalPages - (4 - idx));
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#128C7E] text-white dark:bg-[#25D366] dark:text-[#111B21]'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF] dark:hover:bg-[#202C33]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* ------------------------------------------------------------- */
        /* 6. Calendar View (Month / Week / Day Schedule Grid)           */
        /* ------------------------------------------------------------- */
        <section
          ref={calendarContainerRef}
          aria-label="Appointments Calendar"
          className="w-full min-w-0 shrink-0 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-[#222D34] dark:bg-[#202C33]"
        >
          {/* Calendar Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5 dark:border-[#222D34]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepCalendar(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF]"
                aria-label={`Previous ${calendarMode}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="min-w-[160px] text-center text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                {calendarMode === 'month'
                  ? formatDateKey(monthCursor, { month: 'long', year: 'numeric' })
                  : calendarMode === 'week'
                  ? `${formatDateKey(activeWeekDays[0], { month: 'short', day: 'numeric' })} – ${formatDateKey(activeWeekDays[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : formatDateKey(calendarCursor, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                type="button"
                onClick={() => stepCalendar(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF]"
                aria-label={`Next ${calendarMode}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarCursor(colomboDateKey())}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF]"
              >
                Today
              </button>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-[#222D34] dark:bg-[#111B21]">
              {(['month', 'week', 'day'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarMode(mode)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                    calendarMode === mode
                      ? 'bg-[#128C7E] text-white shadow-2xs dark:bg-[#25D366] dark:text-[#111B21]'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-teal-600 dark:text-teal-400" />
              Loading calendar events...
            </div>
          ) : calendarMode === 'month' ? (
            <div className="mt-2.5 w-full min-w-0 overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-7 gap-1.5 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    className="py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {day}
                  </div>
                ))}

                {calendarDays.map((day) => {
                  const dayAppointments = appointmentsByDate.get(day) || [];
                  const inMonth = day.slice(0, 7) === monthCursor.slice(0, 7);
                  const isToday = day === colomboDateKey();

                  return (
                    <div
                      key={day}
                      className={`relative min-h-[84px] sm:min-h-[92px] rounded-xl border p-1.5 text-left transition-all ${
                        inMonth
                          ? 'border-slate-200/80 bg-white hover:border-teal-500/40 hover:bg-teal-50/20 dark:border-[#222D34] dark:bg-[#111B21]/40 dark:hover:bg-teal-950/20'
                          : 'border-transparent bg-slate-50/40 opacity-45 dark:bg-[#111B21]/20'
                      } ${isToday ? 'ring-2 ring-teal-500 dark:ring-teal-400' : ''}`}
                    >
                      <button
                        type="button"
                        aria-label={`Book on ${formatDateKey(day, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                        onClick={() => openBooking(null, day)}
                        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      />

                      <div className="relative z-10 flex items-center justify-between pointer-events-none">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                            isToday
                              ? 'bg-[#128C7E] text-white dark:bg-[#25D366] dark:text-[#111B21]'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {Number(day.slice(-2))}
                        </span>
                        {dayAppointments.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-400">
                            {dayAppointments.length}
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 mt-1 space-y-1">
                        {dayAppointments.slice(0, 3).map((appt) => {
                          const cfg = getAppointmentStatusConfig(appt.status);
                          return (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(appt.id);
                              }}
                              className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold transition-all hover:scale-[1.01] ${cfg.badgeClass}`}
                              title={`${colomboTimeKey(appt.startTime)} - ${appt.patientName || 'Patient'} (${cfg.label})`}
                            >
                              <span className="font-mono">{colomboTimeKey(appt.startTime)}</span> {appt.patientName || 'Patient'}
                            </button>
                          );
                        })}

                        {dayAppointments.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCalendarCursor(day);
                              setCalendarMode('day');
                            }}
                            className="block w-full text-center text-[10px] font-bold text-teal-600 hover:underline dark:text-teal-400"
                          >
                            +{dayAppointments.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : calendarMode === 'week' ? (
            <div className="mt-2.5 w-full min-w-0 overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-7 gap-2">
                {activeWeekDays.map((day) => {
                  const dayAppointments = appointmentsByDate.get(day) || [];
                  const isToday = day === colomboDateKey();
                  return (
                    <div
                      key={day}
                      className={`flex min-h-[260px] flex-col rounded-xl border p-2 ${
                        isToday
                          ? 'border-teal-500/60 bg-teal-50/20 dark:border-teal-500/50 dark:bg-teal-950/10'
                          : 'border-slate-200/80 bg-slate-50/40 dark:border-[#222D34] dark:bg-[#111B21]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5 dark:border-[#222D34]">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">
                            {formatDateKey(day, { weekday: 'short' })}
                          </p>
                          <p className={`text-xs font-extrabold ${isToday ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-slate-900 dark:text-white'}`}>
                            {formatDateKey(day, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openBooking(null, day)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-teal-600 hover:bg-teal-50 dark:border-[#222D34] dark:bg-[#202C33] dark:text-[#25D366]"
                          title={`Book on ${day}`}
                          aria-label={`Book on ${day}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 flex-1 space-y-1.5">
                        {dayAppointments.length === 0 ? (
                          <p className="py-6 text-center text-[11px] text-slate-400">No bookings</p>
                        ) : (
                          dayAppointments.map((appt) => {
                            const cfg = getAppointmentStatusConfig(appt.status);
                            return (
                              <button
                                key={appt.id}
                                type="button"
                                onClick={() => openDetails(appt.id)}
                                className={`block w-full rounded-lg border p-1.5 text-left text-[11px] transition-shadow hover:shadow-sm ${cfg.badgeClass}`}
                              >
                                <p className="font-mono text-[10px] font-bold">
                                  {colomboTimeKey(appt.startTime)} – {colomboTimeKey(appt.endTime)}
                                </p>
                                <p className="truncate font-bold">{appt.patientName || 'Patient'}</p>
                                <p className="truncate text-[10px] opacity-80">{appt.doctorName || 'Doctor'}</p>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Day View */
            <div className="mt-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs dark:border-[#222D34] dark:bg-[#111B21]/40">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {(appointmentsByDate.get(calendarCursor) || []).length} scheduled appointments for{' '}
                  {formatDateKey(calendarCursor, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => openBooking(null, calendarCursor)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#128C7E] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#075E54]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Book this day
                </button>
              </div>

              {(appointmentsByDate.get(calendarCursor) || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-[#222D34] dark:text-slate-400">
                  No appointments scheduled for this date.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 dark:divide-[#222D34] dark:border-[#222D34]">
                  {(appointmentsByDate.get(calendarCursor) || []).map((appt) => {
                    const cfg = getAppointmentStatusConfig(appt.status);
                    return (
                      <div
                        key={appt.id}
                        onClick={() => openDetails(appt.id)}
                        className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-[#111B21]/60"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 dark:bg-[#111B21] dark:text-[#E9EDEF]">
                            {colomboTimeKey(appt.startTime)} – {colomboTimeKey(appt.endTime)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900 dark:text-white">
                              {appt.patientName || 'Anonymous Patient'}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {appt.treatmentName || 'Consultation'} • {appt.doctorName || 'Doctor'} • {appt.branchName || 'Clinic'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.badgeClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
                            {cfg.label}
                          </span>
                          {appt.patientPhone && (
                            <button
                              type="button"
                              onClick={() => openWhatsApp(appt.patientPhone!)}
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                              title="Open WhatsApp Chat"
                              aria-label="Open WhatsApp Chat"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openDetails(appt.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="View details"
                            aria-label="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. Quick Cancel Appointment Confirmation Modal                 */}
      {/* ------------------------------------------------------------- */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#222D34] dark:bg-[#202C33]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <XCircle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Cancel Appointment</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to cancel this scheduled appointment?
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-[#222D34] dark:bg-[#111B21]/50">
              <p className="font-bold text-slate-900 dark:text-white">
                {cancelTarget.patientName || 'Patient'}
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                {formatColomboDate(cancelTarget.startTime, { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                {colomboTimeKey(cancelTarget.startTime)} • {cancelTarget.doctorName || 'Doctor'}
              </p>
            </div>

            <form onSubmit={confirmCancellation} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="e.g. Patient requested, Doctor unwell, Rescheduled"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              {/* Quick reason suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {['Patient requested', 'Doctor unavailable', 'Schedule conflict', 'Patient no-show'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReasonInput(reason)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {cancelError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{cancelError}</p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setCancelTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {cancelling && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. Appointment Detail Drawer / Modal                          */}
      {/* ------------------------------------------------------------- */}
      <AppointmentDetailModal
        isOpen={Boolean(selectedAppointmentId)}
        appointmentId={selectedAppointmentId}
        initialMode={detailMode}
        onClose={() => setSelectedAppointmentId(null)}
        onUpdated={load}
        onOpenWhatsAppChat={openWhatsApp}
        onReschedule={(id) => {
          setSelectedAppointmentId(null);
          openBooking(id);
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* 8. Booking & Rescheduling Modal                               */}
      {/* ------------------------------------------------------------- */}
      <BookUpdateAppointmentModal
        isOpen={bookingOpen}
        appointmentId={bookingAppointmentId}
        onClose={() => setBookingOpen(false)}
        onSuccess={() => {
          setBookingOpen(false);
          setBookingAppointmentId(null);
          setBookingDate('');
          load();
        }}
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

export default AppointmentBookingsView;
