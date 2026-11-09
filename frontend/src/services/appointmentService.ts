import { API_BASE_URL } from '../config/api';
import {
  Appointment,
  AppointmentStats,
  AppointmentStatus,
  AvailabilityBlock,
  Branch,
  Doctor,
  DoctorAvailabilityResponse,
  DoctorScheduleException,
  DoctorWeeklySchedule,
  PatientSearchResult,
  Room,
} from '../types';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('royal_crm_token') || '')
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}, fallbackMessage = 'Request failed'): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...getAuthHeaders(), ...(init.headers || {}) } });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error((result as any).error || fallbackMessage);
    err.status = res.status;
    err.conflictType = (result as any).conflictType;
    throw err;
  }
  return result as T;
}

function queryString(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export const appointmentService = {
  // Branches
  async getBranches(): Promise<Branch[]> {
    return request<Branch[]>('/api/branches', {}, 'Failed to load branches');
  },

  // Rooms (historical records / optional allocation only)
  async getRooms(branchId?: string): Promise<Room[]> {
    return request<Room[]>(`/api/rooms${queryString({ branchId })}`, {}, 'Failed to load rooms');
  },

  async createRoom(data: {
    name: string;
    roomNumber: string;
    branchId: string;
    color?: string;
    description?: string;
    operatingStart?: string;
    operatingEnd?: string;
    treatmentIds?: string[];
  }): Promise<{ success: boolean; room: Room }> {
    return request('/api/rooms', { method: 'POST', body: JSON.stringify(data) }, 'Failed to create room');
  },

  async updateRoom(id: string, data: Partial<Room>): Promise<{ success: boolean; room?: Room }> {
    return request(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, 'Failed to update room');
  },

  async deleteRoom(id: string): Promise<{ success: boolean; error?: string }> {
    return request(`/api/rooms/${id}`, { method: 'DELETE' }, 'Failed to deactivate room');
  },

  // Appointments
  async getAppointments(params: {
    branchId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    doctorId?: string;
    status?: string;
    patientId?: string;
    leadId?: string;
    q?: string;
    limit?: number;
  } = {}): Promise<Appointment[]> {
    const query = queryString({
      branchId: params.branchId,
      date: params.date,
      startDate: params.startDate,
      endDate: params.endDate,
      doctorId: params.doctorId,
      status: params.status,
      patientId: params.patientId,
      leadId: params.leadId,
      q: params.q,
      limit: params.limit ? String(params.limit) : undefined,
    });
    return request<Appointment[]>(`/api/appointments${query}`, {}, 'Failed to load appointments');
  },

  async getAppointmentStats(params: { branchId?: string; date?: string; startDate?: string; endDate?: string } = {}): Promise<AppointmentStats> {
    return request<AppointmentStats>(`/api/appointments/stats${queryString(params)}`, {}, 'Failed to load appointment stats');
  },

  async getAppointment(id: string): Promise<Appointment> {
    return request<Appointment>(`/api/appointments/${id}`, {}, 'Failed to load appointment details');
  },

  async createAppointment(data: {
    branchId: string;
    doctorId: string;
    treatmentId: string;
    startTime: string;
    endTime: string;
    roomId?: string;
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    leadId?: string;
    coordinatorId?: string;
    appointmentType?: string;
    status?: 'pending' | 'booked' | 'confirmed';
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; appointment: Appointment; idempotent?: boolean }> {
    return request('/api/appointments', { method: 'POST', body: JSON.stringify(data) }, 'Failed to book appointment');
  },

  async updateAppointment(id: string, data: Partial<{
    branchId: string;
    roomId: string | null;
    doctorId: string;
    treatmentId: string;
    startTime: string;
    endTime: string;
    notes: string;
    appointmentType: string;
    leadId: string | null;
    coordinatorId: string | null;
  }>): Promise<{ success: boolean; appointment: Appointment }> {
    return request(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, 'Failed to update appointment');
  },

  async rescheduleAppointment(
    id: string,
    data: {
      newStartTime: string;
      newEndTime: string;
      newRoomId?: string | null;
      newDoctorId?: string;
      newBranchId?: string;
      newTreatmentId?: string;
      reason?: string;
    }
  ): Promise<{ success: boolean; appointment?: Appointment }> {
    return request(`/api/appointments/${id}/reschedule`, { method: 'POST', body: JSON.stringify(data) }, 'Failed to reschedule appointment');
  },

  async cancelAppointment(id: string, reason: string): Promise<{ success: boolean }> {
    return request(`/api/appointments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }, 'Failed to cancel appointment');
  },

  async updateAppointmentStatus(
    id: string,
    status: AppointmentStatus,
    reason?: string
  ): Promise<{ success: boolean; newStatus: string }> {
    return request(`/api/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }, 'Failed to update status');
  },

  // Doctors & scheduling
  async getDoctors(branchId?: string): Promise<Doctor[]> {
    return request<Doctor[]>(`/api/doctors${queryString({ branchId })}`, {}, 'Failed to load doctors');
  },

  async getDoctorAvailability(branchId: string, date: string): Promise<DoctorAvailabilityResponse> {
    return request<DoctorAvailabilityResponse>(`/api/doctor-availability${queryString({ branchId, date })}`, {}, 'Failed to load doctor availability');
  },

  async getDoctorSchedule(doctorId: string, branchId?: string): Promise<{
    doctor: Doctor;
    weeklySchedules: DoctorWeeklySchedule[];
    exceptions: DoctorScheduleException[];
    branchIds: string[];
  }> {
    return request(`/api/doctors/${doctorId}/schedule${queryString({ branchId })}`, {}, 'Failed to load doctor schedule');
  },

  async getDoctorSchedules(params: { branchId?: string; doctorId?: string } = {}): Promise<DoctorWeeklySchedule[]> {
    return request<DoctorWeeklySchedule[]>(`/api/doctor-schedules${queryString(params)}`, {}, 'Failed to load schedules');
  },

  async createDoctorSchedule(data: {
    doctorId: string;
    branchId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; schedule: DoctorWeeklySchedule }> {
    return request('/api/doctor-schedules', { method: 'POST', body: JSON.stringify(data) }, 'Failed to create schedule');
  },

  async updateDoctorSchedule(id: string, data: Partial<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>): Promise<{ success: boolean; schedule: DoctorWeeklySchedule }> {
    return request(`/api/doctor-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, 'Failed to update schedule');
  },

  async deleteDoctorSchedule(id: string): Promise<{ success: boolean }> {
    return request(`/api/doctor-schedules/${id}`, { method: 'DELETE' }, 'Failed to delete schedule');
  },

  async getDoctorScheduleExceptions(params: { branchId?: string; doctorId?: string; from?: string; to?: string } = {}): Promise<DoctorScheduleException[]> {
    return request<DoctorScheduleException[]>(`/api/doctor-schedule-exceptions${queryString(params)}`, {}, 'Failed to load exceptions');
  },

  async createDoctorScheduleException(data: {
    doctorId: string;
    branchId: string;
    exceptionType: 'leave' | 'break' | 'unavailable';
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string;
  }): Promise<{ success: boolean; exception: DoctorScheduleException }> {
    return request('/api/doctor-schedule-exceptions', { method: 'POST', body: JSON.stringify(data) }, 'Failed to save exception');
  },

  async deleteDoctorScheduleException(id: string): Promise<{ success: boolean }> {
    return request(`/api/doctor-schedule-exceptions/${id}`, { method: 'DELETE' }, 'Failed to delete exception');
  },

  // Patient Search & Quick Registration
  async searchPatients(q: string): Promise<PatientSearchResult[]> {
    if (!q || q.length < 2) return [];
    return request<PatientSearchResult[]>(`/api/patients/search${queryString({ q })}`, {}, 'Failed to search patients');
  },

  async quickRegisterPatient(data: { name: string; phone: string }): Promise<any> {
    const result = await request<{ success: boolean; patient: any }>('/api/patients/quick-register', { method: 'POST', body: JSON.stringify(data) }, 'Failed to register patient');
    return result.patient;
  },

  // Availability Blocks (historical room blocks)
  async getAvailabilityBlocks(branchId?: string): Promise<AvailabilityBlock[]> {
    return request<AvailabilityBlock[]>(`/api/availability-blocks${queryString({ branchId })}`, {}, 'Failed to load blocks');
  },

  async createAvailabilityBlock(data: {
    branchId: string;
    roomId?: string;
    doctorId?: string;
    startTime: string;
    endTime: string;
    reason: string;
  }): Promise<any> {
    return request('/api/availability-blocks', { method: 'POST', body: JSON.stringify(data) }, 'Failed to create block');
  },

  async deleteAvailabilityBlock(id: string): Promise<any> {
    return request(`/api/availability-blocks/${id}`, { method: 'DELETE' }, 'Failed to delete block');
  },
};
