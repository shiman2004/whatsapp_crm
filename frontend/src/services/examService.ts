import { API_BASE_URL } from '../config/api';

export interface ExamCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  displayOrder?: number;
  materialCount?: number;
}

export interface ExamMaterialRequest {
  id: string;
  requestNumber?: string;
  title: string;
  categoryId?: string;
  categoryName?: string;
  type: string;
  requestedBy: string;
  requesterId?: string;
  candidateName?: string;
  candidatePhone?: string;
  leadId?: string;
  requestDate: string;
  status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Completed';
  urgency?: 'Normal' | 'High' | 'Urgent';
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ExamMaterial {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  type: string;
  description?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  fileSizeFormatted?: string;
  externalUrl?: string;
  targetProfession?: string;
  uploadedBy?: string;
  uploaderName?: string;
  downloadCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface ExamMockTest {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  targetProfession?: string;
  totalQuestions: number;
  durationMinutes: number;
  passingScore: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  questionPaperUrl?: string;
  answerKeyUrl?: string;
  explanationUrl?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface ExamProvision {
  id: string;
  candidateName: string;
  candidatePhone?: string;
  candidateEmail?: string;
  leadId?: string;
  categoryId: string;
  categoryName: string;
  packageName: string;
  provisionDate: string;
  validUntil?: string;
  accessStatus: 'Active' | 'Expired' | 'Revoked' | 'Pending Activation';
  materialsIncluded?: string[];
  providedBy?: string;
  notes?: string;
}

export interface ExamDashboardStats {
  pendingRequestsCount: number;
  totalExamsProvidedCount: number;
  totalStudyMaterialsCount: number;
  totalMockTestsCount: number;
  categoryCounts: Record<string, number>;
  recentRequests: ExamMaterialRequest[];
}

export interface ExamReportsData {
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  inProgressRequests: number;
  totalMaterials: number;
  totalMockTests: number;
  totalProvisions: number;
  categoryBreakdown: Array<{ category: string; count: number; percentage: number }>;
  recentProvisions: ExamProvision[];
}

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

export const examService = {
  // 1. Dashboard Stats
  async getDashboardStats(): Promise<ExamDashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/exam/dashboard-stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exam dashboard stats');
    const json = await res.json();
    return json.data;
  },

  // 2. Categories
  async getCategories(): Promise<ExamCategory[]> {
    const res = await fetch(`${API_BASE_URL}/api/exam/categories`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exam categories');
    const json = await res.json();
    return json.data;
  },

  async createCategory(data: Partial<ExamCategory>): Promise<ExamCategory> {
    const res = await fetch(`${API_BASE_URL}/api/exam/categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create category');
    const json = await res.json();
    return json.data;
  },

  async updateCategory(id: string, data: Partial<ExamCategory>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/categories/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update category');
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete category');
  },

  // 3. Material Requests
  async getRequests(filters?: { category?: string; status?: string; search?: string }): Promise<ExamMaterialRequest[]> {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/exam/requests${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load material requests');
    const json = await res.json();
    return json.data;
  },

  async createRequest(data: {
    title: string;
    categoryId?: string;
    categoryName?: string;
    type: string;
    candidateName?: string;
    candidatePhone?: string;
    urgency?: string;
    notes?: string;
  }): Promise<ExamMaterialRequest> {
    const res = await fetch(`${API_BASE_URL}/api/exam/requests`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit exam material request');
    }
    const json = await res.json();
    return json.data;
  },

  async updateRequestStatus(id: string, status: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/requests/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update request status');
  },

  async deleteRequest(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/requests/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete request');
  },

  // 4. Exam Materials
  async getMaterials(filters?: { category?: string; type?: string; search?: string }): Promise<ExamMaterial[]> {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters?.search) params.append('search', filters.search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/exam/materials${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exam materials');
    const json = await res.json();
    return json.data;
  },

  async createMaterial(data: Partial<ExamMaterial>): Promise<ExamMaterial> {
    const res = await fetch(`${API_BASE_URL}/api/exam/materials`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add exam material');
    }
    const json = await res.json();
    return json.data;
  },

  async deleteMaterial(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/materials/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete material');
  },

  async incrementDownload(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/exam/materials/${id}/download-count`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).catch(() => null);
  },

  // 5. File Upload (Supports up to 1GB base64 or link)
  async uploadExamFile(payload: {
    fileName: string;
    dataUrl?: string;
    externalUrl?: string;
    fileSize?: number;
    fileType?: string;
  }): Promise<{ url: string; fileName: string; fileSizeFormatted?: string; fileType?: string }> {
    const res = await fetch(`${API_BASE_URL}/api/exam/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'File upload failed');
    }
    return res.json();
  },

  // 6. Mock Tests
  async getMockTests(): Promise<ExamMockTest[]> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mock-tests`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load mock tests');
    const json = await res.json();
    return json.data;
  },

  async createMockTest(data: Partial<ExamMockTest>): Promise<ExamMockTest> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mock-tests`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create mock test');
    const json = await res.json();
    return json.data;
  },

  async deleteMockTest(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mock-tests/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete mock test');
  },

  // 7. Exam Provisions
  async getProvisions(): Promise<ExamProvision[]> {
    const res = await fetch(`${API_BASE_URL}/api/exam/provisions`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load provisions');
    const json = await res.json();
    return json.data;
  },

  async createProvision(data: Partial<ExamProvision>): Promise<ExamProvision> {
    const res = await fetch(`${API_BASE_URL}/api/exam/provisions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to provision exam access');
    const json = await res.json();
    return json.data;
  },

  async deleteProvision(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/provisions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete provision record');
  },

  // 8. Reports
  async getReports(): Promise<ExamReportsData> {
    const res = await fetch(`${API_BASE_URL}/api/exam/reports`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exam reports');
    const json = await res.json();
    return json.data;
  }
};
