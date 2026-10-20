import { API_BASE_URL } from '../config/api';
import { Branch, Room, Appointment, AppointmentStatus, AvailabilityBlock } from '../types';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem('rw_crm_auth_token') || localStorage.getItem('royal_crm_token') || '')
    : '';
  const userId = typeof window !== 'undefined'
    ? (localStorage.getItem('rw_crm_auth_user_id') || 'user-admin-1')
    : 'user-admin-1';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    'x-coordinator-id': userId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const appointmentService = {
  // Branches
  async getBranches(): Promise<Branch[]> {
    const res = await fetch(`${API_BASE_URL}/api/branches`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load branches');
    return res.json();
  },

  // Rooms
  async getRooms(branchId?: string): Promise<Room[]> {
    const url = branchId ? `${API_BASE_URL}/api/rooms?branchId=${encodeURIComponent(branchId)}` : `${API_BASE_URL}/api/rooms`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load rooms');
    return res.json();
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
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create room');
    return result;
  },

  async updateRoom(id: string, data: Partial<Room>): Promise<{ success: boolean; room?: Room }> {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update room');
    return result;
  },

  async deleteRoom(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to deactivate room');
    return result;
  },

  // Appointments
  async getAppointments(params: {
    branchId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Appointment[]> {
    const query = new URLSearchParams();
    if (params.branchId) query.set('branchId', params.branchId);
    if (params.date) query.set('date', params.date);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);

    const res = await fetch(`${API_BASE_URL}/api/appointments?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load appointments');
    return res.json();
  },

  async getAppointment(id: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load appointment details');
    return res.json();
  },

  async createAppointment(data: {
    branchId: string;
    roomId: string;
    doctorId: string;
    treatmentId: string;
    startTime: string;
    endTime: string;
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    notes?: string;
  }): Promise<{ success: boolean; appointment: Appointment }> {
    const res = await fetch(`${API_BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      const err: any = new Error(result.error || 'Failed to book appointment');
      err.conflictType = result.conflictType;
      throw err;
    }
    return result;
  },

  async rescheduleAppointment(
    id: string,
    data: {
      newStartTime: string;
      newEndTime: string;
      newRoomId?: string;
      reason?: string;
    }
  ): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/appointments/${id}/reschedule`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to reschedule appointment');
    return result;
  },

  async cancelAppointment(id: string, reason: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/appointments/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to cancel appointment');
    return result;
  },

  async updateAppointmentStatus(
    id: string,
    status: AppointmentStatus,
    reason?: string
  ): Promise<{ success: boolean; newStatus: string }> {
    const res = await fetch(`${API_BASE_URL}/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update status');
    return result;
  },

  // Doctors / Staff
  async getDoctors(branchId?: string): Promise<any[]> {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/doctors${query}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load doctors');
    return res.json();
  },

  // Patient Search & Quick Registration
  async searchPatients(q: string): Promise<any[]> {
    if (!q || q.length < 2) return [];
    const res = await fetch(`${API_BASE_URL}/api/patients/search?q=${encodeURIComponent(q)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  async quickRegisterPatient(data: { name: string; phone: string }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/patients/quick-register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to register patient');
    return result.patient;
  },

  // Availability Blocks
  async getAvailabilityBlocks(branchId?: string): Promise<AvailabilityBlock[]> {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/availability-blocks${query}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  async createAvailabilityBlock(data: {
    branchId: string;
    roomId?: string;
    doctorId?: string;
    startTime: string;
    endTime: string;
    reason: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/availability-blocks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create block');
    return result;
  },

  async deleteAvailabilityBlock(id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/availability-blocks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  }
};

