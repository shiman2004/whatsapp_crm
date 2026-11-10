import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
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
  Sparkles,
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Async / status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => `${colomboDateKey().slice(0, 7)}-01`);

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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(appointments.length / pageSize));
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return appointments.slice(start, start + pageSize);
  }, [appointments, currentPage, pageSize]);

  // Calendar calculations
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
    <div className="flex h-full flex-col overflow-y-auto bg-[#F8FAFC] px-4 py-5 text-[#0F172A] transition-colors dark:bg-[#0B141A] dark:text-[#E9EDEF] sm:px-6 lg:px-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. Page Header                                                */}
      {/* ------------------------------------------------------------- */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:border-teal-500/30 dark:bg-teal-950/50 dark:text-teal-400">
              <Sparkles className="h-3 w-3 text-teal-600 dark:text-teal-400" />
              Clinical Operations
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Alpha Health Group</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              All Appointments
            </h1>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {totalAppointmentsCount} {totalAppointmentsCount === 1 ? 'Booking' : 'Bookings'}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
            Centralized clinical scheduling, patient appointments, and doctor allocations across all medical branches.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Calendar / Table View Switcher */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-[#1E293B]">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                view === 'table'
                  ? 'bg-teal-600 text-white shadow-xs dark:bg-teal-500 dark:text-[#0B141A]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                view === 'calendar'
                  ? 'bg-teal-600 text-white shadow-xs dark:bg-teal-500 dark:text-[#0B141A]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-[#1E293B] dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh appointments"
            aria-label="Refresh appointments"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => openBooking(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-teal-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:ring-offset-[#0B141A] sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Book Appointment</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. KPI Summary Cards (Six Balanced Modern Healthcare Cards)   */}
      {/* ------------------------------------------------------------- */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Appointment Statistics">
        {/* Total Appointments */}
        <div className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <span className="absolute inset-x-0 top-0 h-1 bg-teal-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {totalAppointmentsCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {activeCount} active in system
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <span className="absolute inset-x-0 top-0 h-1 bg-amber-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {pendingCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Awaiting confirmation
            </p>
          </div>
        </div>

        {/* Confirmed */}
        <div className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <span className="absolute inset-x-0 top-0 h-1 bg-emerald-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Confirmed</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {confirmedCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {rescheduledCount > 0 ? `${rescheduledCount} rescheduled` : 'Ready for visit'}
            </p>
          </div>
        </div>

        {/* Completed */}
        <div className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <span className="absolute inset-x-0 top-0 h-1 bg-blue-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completed</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <CheckCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {completedCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              Consultations fulfilled
            </p>
          </div>
        </div>

        {/* Cancelled */}
        <div className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <span className="absolute inset-x-0 top-0 h-1 bg-rose-500" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cancelled</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <XCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {cancelledCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              {cancellationRate}% cancellation rate
            </p>
          </div>
        </div>

        {/* No-show */}
        <div className="group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <span className="absolute inset-x-0 top-0 h-1 bg-slate-400" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">No-show</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <UserX className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {noShowCount}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Unattended / no answer
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. Compact, Responsive Filter Workspace                       */}
      {/* ------------------------------------------------------------- */}
      <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#1E293B]">
        <div className="flex flex-col gap-3">
          {/* Main Controls Row */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search patient, phone, serial..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500 dark:focus:border-teal-400 dark:focus:bg-slate-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Branch Selection */}
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={branchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-7 text-xs font-medium text-slate-900 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:focus:border-teal-400 dark:focus:bg-slate-900"
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
            <div className="relative">
              <Stethoscope className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={doctorId}
                onChange={(e) => handleDoctorChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-7 text-xs font-medium text-slate-900 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:focus:border-teal-400 dark:focus:bg-slate-900"
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
            <div className="relative">
              <Activity className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-7 text-xs font-medium text-slate-900 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:focus:border-teal-400 dark:focus:bg-slate-900"
              >
                <option value="">All Statuses</option>
                {Object.values(APPOINTMENT_STATUS_CONFIG).map((cfg) => (
                  <option key={cfg.key} value={cfg.key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date (Flatpickr) */}
            <div className="relative">
              <AppDatePicker
                value={startDate}
                maxDate={endDate || undefined}
                onChange={(val) => handleStartDateChange(val)}
                placeholder="From date"
                ariaLabel="From date"
                className="w-full"
                inputClassName="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500 dark:focus:border-teal-400 dark:focus:bg-slate-900"
              />
            </div>

            {/* To Date (Flatpickr) + Reset Button */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AppDatePicker
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={(val) => handleEndDateChange(val)}
                  placeholder="To date"
                  ariaLabel="To date"
                  className="w-full"
                  inputClassName="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-900 placeholder-slate-400 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500 dark:focus:border-teal-400 dark:focus:bg-slate-900"
                />
              </div>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="Clear all filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
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
                Clear all
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. Main Content: Table View OR Calendar View                  */}
      {/* ------------------------------------------------------------- */}
      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
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
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1E293B]">
          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-900/50">
                  <th scope="col" className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Date & Time
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Patient
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Treatment
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Doctor & Clinic
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4">
                        <div className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
                        <div className="mt-1.5 h-3 w-20 rounded-md bg-slate-100 dark:bg-slate-800" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />
                            <div className="h-3 w-24 rounded-md bg-slate-100 dark:bg-slate-800" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-3.5 w-24 rounded-md bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="ml-auto h-7 w-20 rounded-md bg-slate-200 dark:bg-slate-700" />
                      </td>
                    </tr>
                  ))
                ) : paginatedAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        <CalendarDays className="h-6 w-6" />
                      </div>
                      <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                        No appointments match these filters
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Try modifying your search query, clearing filters, or booking a new appointment.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
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
                          className="rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-500"
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
                        <td className="px-4 py-3.5 align-middle">
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
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-50 text-xs font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
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
                        <td className="px-4 py-3.5 align-middle">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.treatmentName || 'General Consultation'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {row.treatmentPrice ? `LKR ${Number(row.treatmentPrice).toLocaleString()}` : (row.appointmentType ? row.appointmentType.replace('_', ' ') : 'Standard visit')}
                          </p>
                        </td>

                        {/* 4. Doctor & Clinic */}
                        <td className="px-4 py-3.5 align-middle">
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
                        <td className="px-4 py-3.5 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-2xs ${statusConfig.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} />
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-4 py-3.5 align-middle text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* WhatsApp Quick Chat */}
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

                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => openDetails(row.id, 'view')}
                              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                              title="View details"
                              aria-label="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Reschedule */}
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

                            {/* Cancel */}
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

          {/* Table Pagination Bar */}
          {!loading && appointments.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/30 sm:flex-row">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span>
                  Showing{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(currentPage * pageSize, appointments.length)}
                  </strong>{' '}
                  of{' '}
                  <strong className="text-slate-900 dark:text-white">{appointments.length}</strong> appointments
                </span>

                <span className="text-slate-300 dark:text-slate-700">|</span>

                <div className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
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

              {/* Page Controls */}
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
                          ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-[#0B141A]'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
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
        /* 5. Calendar View (Redesigned Healthcare Monthly Grid)         */
        /* ------------------------------------------------------------- */
        <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-[#1E293B]">
          {/* Calendar Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="min-w-[140px] text-center text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                {formatDateKey(monthCursor, { month: 'long', year: 'numeric' })}
              </h3>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMonthCursor(`${colomboDateKey().slice(0, 7)}-01`)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Today
            </button>
          </div>

          {/* Days Grid */}
          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
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
                  className={`relative min-h-[96px] rounded-xl border p-1.5 text-left transition-all ${
                    inMonth
                      ? 'border-slate-200/80 bg-white hover:border-teal-500/40 hover:bg-teal-50/20 dark:border-slate-800 dark:bg-[#0B141A]/40 dark:hover:bg-teal-950/20'
                      : 'border-transparent bg-slate-50/40 opacity-40 dark:bg-slate-900/20'
                  } ${isToday ? 'ring-2 ring-teal-500 dark:ring-teal-400' : ''}`}
                >
                  {/* Click empty space to book on that day */}
                  {inMonth && (
                    <button
                      type="button"
                      aria-label={`Book on ${formatDateKey(day, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                      onClick={() => openBooking(null, day)}
                      className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  )}

                  {/* Day Number */}
                  <div className="relative z-10 flex items-center justify-between pointer-events-none">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        isToday
                          ? 'bg-teal-600 text-white'
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

                  {/* Appointment Chips */}
                  <div className="relative z-10 mt-1.5 space-y-1">
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
                          className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold transition-all hover:scale-[1.02] ${cfg.badgeClass}`}
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
                          openDetails(dayAppointments[3].id);
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
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. Quick Cancel Appointment Confirmation Modal                 */}
      {/* ------------------------------------------------------------- */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#1E293B]">
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

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50">
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
