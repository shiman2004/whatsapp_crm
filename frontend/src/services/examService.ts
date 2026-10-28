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
  perQuestionSeconds?: number;
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

export interface ExamMcqQuestion {
  id: string;
  title: string;
  questionText: string;
  categoryId?: string;
  categoryName?: string;
  subject?: string;
  imageUrl?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  rememberNote1: string;
  rememberNote2: string;
  rememberNote3: string;
  explanation?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  displayOrder?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface ExamMcqPracticeAttempt {
  id: string;
  sessionId?: string;
  studentId?: string;
  studentName: string;
  studentIdentifier?: string;
  examTitle?: string;
  categoryId?: string;
  questionId: string;
  questionTitle?: string;
  firstSelectedAnswer: string;
  numberOfAttempts: number;
  attemptsHistory?: string[];
  finalCorrectAnswer: string;
  isCorrectFirstTry?: boolean;
  timeSpentSeconds: number;
  createdAt: string;
}

export interface ExamMcqStats {
  totalQuestions: number;
  totalAttempts: number;
  firstTryCorrect: number;
  firstTryAccuracy: number;
  uniqueStudents: number;
}

export interface ExamCourse {
  id: string;
  courseCode: string;
  courseName: string;
  examAuthority: string;
  profession: string;
  country: string;
  description?: string;
  thumbnail?: string;
  status: 'Active' | 'Inactive' | 'Draft';
  accessType?: 'Free' | 'Paid' | 'Assigned Students Only';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  subjectsCount?: number;
  questionsCount?: number;
  mockTestsCount?: number;
  materialsCount?: number;
}

export interface ExamSubject {
  id: string;
  courseId: string;
  subjectName: string;
  description?: string;
  status: 'Active' | 'Inactive';
  sortOrder: number;
  questionsCount?: number;
}

export interface ExamPlatformQuestion {
  id: string;
  questionCode: string;
  courseId: string;
  subjectId: string;
  subject?: string;
  topic?: string;
  title?: string;
  questionText: string;
  questionImage?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  rememberNote1: string;
  rememberNote2: string;
  rememberNote3: string;
  detailedExplanation?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionType: 'Practice' | 'Mock Test' | 'Both';
  status: 'Active' | 'Inactive' | 'Draft';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamPracticeSessionData {
  currentQuestionIndex: number;
  completedQuestionIds: string[];
  questionAttemptsState: Record<string, { attempts: string[]; isCorrect: boolean; timeSpent: number }>;
  totalTimeSpent: number;
}

export interface ExamMockTestPlatform {
  id: string;
  courseId: string;
  mockTestName: string;
  subjectScope?: string;
  description?: string;
  durationMinutes: number;
  perQuestionSeconds?: number;
  totalQuestions: number;
  passPercentage: number;
  randomQuestionOrder: boolean;
  randomAnswerOrder: boolean;
  allowBackNavigation: boolean;
  showResults: 'Immediately' | 'After Admin Release';
  status: 'Draft' | 'Published' | 'Inactive';
  questions?: Array<Omit<ExamPlatformQuestion, 'correctAnswer' | 'rememberNote1' | 'rememberNote2' | 'rememberNote3' | 'detailedExplanation'>>;
}

export interface ExamMockTestAttemptRecord {
  id: string;
  studentId: string;
  studentName: string;
  mockTestId: string;
  mockTestName: string;
  courseId: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  score: number;
  percentage: number;
  result: 'PASS' | 'FAIL';
  timeTakenSeconds: number;
  answersSnapshot: Array<{
    questionId: string;
    questionCode: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    optionE: string;
    studentAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    rememberNotes: string[];
    detailedExplanation?: string;
  }>;
  submittedAt: string;
}

export interface ExamStudyMaterialPlatform {
  id: string;
  courseId: string;
  subjectId: string;
  topic?: string;
  title: string;
  description?: string;
  materialType: 'PDF' | 'DOC' | 'PPT' | 'Video' | 'Notes' | 'Web Link';
  fileUrl?: string;
  externalUrl?: string;
  thumbnail?: string;
  allowDownload: boolean;
  status: 'Active' | 'Inactive';
  uploadedBy?: string;
  uploadedAt: string;
}

export interface ExamGuidelinePlatform {
  id: string;
  courseId: string;
  guidelineTitle: string;
  section: string;
  content: string;
  officialReferenceUrl?: string;
  updatedDate: string;
  status: 'Active' | 'Inactive';
}

export interface StudentProgressAnalyticsData {
  studentName: string;
  totalQuestionsAttempted: number;
  accuracyRate: number;
  averageAttemptsPerQuestion: number;
  timeStudiedMinutes: number;
  subjectsAnalysis: Array<{
    subject: string;
    totalQuestions: number;
    correctFirstTry: number;
    accuracy: number;
    status: 'Weak' | 'Needs Improvement' | 'Strong';
  }>;
  recommendedPractice: Array<{
    subject: string;
    recommendation: string;
    accuracy: number;
  }>;
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
  },

  // 9. Interactive MCQ Practice Module
  async getMcqQuestions(params?: { categoryId?: string; search?: string }): Promise<ExamMcqQuestion[]> {
    const query = new URLSearchParams();
    if (params?.categoryId && params.categoryId !== 'all') query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    const url = `${API_BASE_URL}/api/exam/mcq/questions${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load MCQ practice questions');
    const json = await res.json();
    return json.data || [];
  },

  async createMcqQuestion(data: Partial<ExamMcqQuestion>): Promise<ExamMcqQuestion> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mcq/questions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create question' }));
      throw new Error(err.error || 'Failed to create MCQ question');
    }
    const json = await res.json();
    return json.data;
  },

  async updateMcqQuestion(id: string, data: Partial<ExamMcqQuestion>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mcq/questions/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update question' }));
      throw new Error(err.error || 'Failed to update MCQ question');
    }
  },

  async deleteMcqQuestion(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mcq/questions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete MCQ question');
  },

  async recordPracticeAttempt(attempt: Partial<ExamMcqPracticeAttempt>): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mcq/record-attempt`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(attempt),
    });
    if (!res.ok) throw new Error('Failed to record practice attempt');
  },

  async getPracticeAttempts(params?: { studentId?: string; limit?: number }): Promise<ExamMcqPracticeAttempt[]> {
    const query = new URLSearchParams();
    if (params?.studentId) query.set('studentId', params.studentId);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const url = `${API_BASE_URL}/api/exam/mcq/attempts${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load practice attempts');
    const json = await res.json();
    return json.data || [];
  },

  async getMcqStats(): Promise<ExamMcqStats> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mcq/stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load MCQ statistics');
    const json = await res.json();
    return json.data;
  },

  // =========================================================================
  // 10. HEALTHCARE EXAM PLATFORM: COURSES
  // =========================================================================
  async getCourses(): Promise<ExamCourse[]> {
    const res = await fetch(`${API_BASE_URL}/api/exam/courses`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load exam courses');
    const json = await res.json();
    return json.data || [];
  },

  async getCourseById(id: string): Promise<ExamCourse> {
    const res = await fetch(`${API_BASE_URL}/api/exam/courses/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load course details');
    const json = await res.json();
    return json.data;
  },

  async createCourse(data: Partial<ExamCourse>): Promise<ExamCourse> {
    const res = await fetch(`${API_BASE_URL}/api/exam/courses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create course' }));
      throw new Error(err.error || 'Failed to create course');
    }
    const json = await res.json();
    return json.data;
  },

  // =========================================================================
  // 11. SUBJECTS / CATEGORIES
  // =========================================================================
  async getCourseSubjects(courseId?: string): Promise<ExamSubject[]> {
    const url = courseId
      ? `${API_BASE_URL}/api/exam/courses/${courseId}/subjects`
      : `${API_BASE_URL}/api/exam/subjects`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load subjects');
    const json = await res.json();
    return json.data || [];
  },

  async createSubject(courseId: string, data: { subjectName: string; sortOrder?: number }): Promise<ExamSubject> {
    const res = await fetch(`${API_BASE_URL}/api/exam/courses/${courseId}/subjects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create subject');
    const json = await res.json();
    return json.data;
  },

  // =========================================================================
  // 12. CENTRALIZED QUESTION BANK
  // =========================================================================
  async getQuestionBank(params?: {
    courseId?: string;
    subjectId?: string;
    difficulty?: string;
    questionType?: string;
    search?: string;
  }): Promise<ExamPlatformQuestion[]> {
    const q = new URLSearchParams();
    if (params?.courseId && params.courseId !== 'all') q.set('courseId', params.courseId);
    if (params?.subjectId && params.subjectId !== 'all') q.set('subjectId', params.subjectId);
    if (params?.difficulty && params.difficulty !== 'all') q.set('difficulty', params.difficulty);
    if (params?.questionType && params.questionType !== 'all') q.set('questionType', params.questionType);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    const url = `${API_BASE_URL}/api/exam/questions${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load question bank');
    const json = await res.json();
    return json.data || [];
  },

  async createQuestionBankItem(data: Partial<ExamPlatformQuestion>): Promise<ExamPlatformQuestion> {
    const res = await fetch(`${API_BASE_URL}/api/exam/questions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create question' }));
      throw new Error(err.error || 'Failed to create question');
    }
    const json = await res.json();
    return json.data;
  },

  async updateQuestionBankItem(id: string, data: Partial<ExamPlatformQuestion>): Promise<ExamPlatformQuestion> {
    const res = await fetch(`${API_BASE_URL}/api/exam/questions/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update question');
    const json = await res.json();
    return json.data;
  },

  async deleteQuestionBankItem(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/questions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete question');
  },

  async bulkImportQuestions(questions: any[]): Promise<{ importedCount: number; duplicatesCount: number; errorsCount: number }> {
    const res = await fetch(`${API_BASE_URL}/api/exam/questions/bulk-import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ questions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
      throw new Error(err.error || 'Bulk import failed');
    }
    const json = await res.json();
    return json.data;
  },

  // =========================================================================
  // 13. MCQ PRACTICE RUNNER: SERVER-SIDE VALIDATION & PERSISTENCE
  // =========================================================================
  async checkPracticeAnswerServer(params: {
    questionId: string;
    selectedAnswer: string;
    attemptNumber?: number;
    timeSpentSeconds?: number;
    studentName?: string;
  }): Promise<{
    isCorrect: boolean;
    status: 'correct' | 'incorrect';
    message: string;
    correctAnswer?: string;
    rememberNotes?: string[];
    detailedExplanation?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/exam/practice/check-answer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to validate practice answer');
    return await res.json();
  },

  async getPracticeSession(courseId = 'course-dha-rn', studentId?: string): Promise<ExamPracticeSessionData> {
    const q = new URLSearchParams({ courseId });
    if (studentId) q.set('studentId', studentId);
    const res = await fetch(`${API_BASE_URL}/api/exam/practice/session?${q.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load practice session');
    const json = await res.json();
    return json.data;
  },

  async savePracticeSession(data: {
    courseId: string;
    studentId?: string;
    studentName?: string;
    currentQuestionIndex: number;
    completedQuestionIds: string[];
    questionAttemptsState: Record<string, any>;
    totalTimeSpent: number;
  }): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/practice/session`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) console.warn('Failed to save practice session');
  },

  async restartPracticeSession(courseId = 'course-dha-rn', studentId?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/practice/session/restart`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ courseId, studentId }),
    });
    if (!res.ok) throw new Error('Failed to restart practice session');
  },

  // =========================================================================
  // 14. MOCK TEST SIMULATION ENGINE
  // =========================================================================
  async getMockTestForTaker(id: string): Promise<ExamMockTestPlatform> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mock-tests/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load mock exam');
    const json = await res.json();
    return json.data;
  },

  async submitMockTest(mockTestId: string, submission: {
    answers: Record<string, string>;
    studentName?: string;
    studentId?: string;
    timeTakenSeconds: number;
  }): Promise<ExamMockTestAttemptRecord> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mock-tests/${mockTestId}/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(submission),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Mock test submission failed' }));
      throw new Error(err.error || 'Mock test submission failed');
    }
    const json = await res.json();
    return json.data;
  },

  async getMockTestResults(): Promise<ExamMockTestAttemptRecord[]> {
    const res = await fetch(`${API_BASE_URL}/api/exam/mock-test-results`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load mock test results');
    const json = await res.json();
    return json.data || [];
  },

  // =========================================================================
  // 15. STUDY MATERIALS
  // =========================================================================
  async getPlatformStudyMaterials(params?: { courseId?: string; subjectId?: string }): Promise<ExamStudyMaterialPlatform[]> {
    const q = new URLSearchParams();
    if (params?.courseId && params.courseId !== 'all') q.set('courseId', params.courseId);
    if (params?.subjectId && params.subjectId !== 'all') q.set('subjectId', params.subjectId);
    const qs = q.toString();
    const url = `${API_BASE_URL}/api/exam/study-materials${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load study materials');
    const json = await res.json();
    return json.data || [];
  },

  async createPlatformStudyMaterial(data: Partial<ExamStudyMaterialPlatform>): Promise<ExamStudyMaterialPlatform> {
    const res = await fetch(`${API_BASE_URL}/api/exam/study-materials`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to upload material' }));
      throw new Error(err.error || 'Failed to upload material');
    }
    const json = await res.json();
    return json.data;
  },

  async deletePlatformStudyMaterial(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/study-materials/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete study material');
  },

  // =========================================================================
  // 16. EXAM GUIDELINES
  // =========================================================================
  async getExamGuidelines(courseId?: string): Promise<ExamGuidelinePlatform[]> {
    const q = new URLSearchParams();
    if (courseId && courseId !== 'all') q.set('courseId', courseId);
    const qs = q.toString();
    const url = `${API_BASE_URL}/api/exam/guidelines${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load exam guidelines');
    const json = await res.json();
    return json.data || [];
  },

  async createExamGuideline(data: Partial<ExamGuidelinePlatform>): Promise<ExamGuidelinePlatform> {
    const res = await fetch(`${API_BASE_URL}/api/exam/guidelines`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create guideline' }));
      throw new Error(err.error || 'Failed to create guideline');
    }
    const json = await res.json();
    return json.data;
  },

  async deleteExamGuideline(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/exam/guidelines/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete guideline');
  },

  // =========================================================================
  // 17. STUDENT PROGRESS & WEAK AREA ANALYTICS
  // =========================================================================
  async getStudentProgressAnalytics(studentId?: string, studentName?: string): Promise<StudentProgressAnalyticsData> {
    const q = new URLSearchParams();
    if (studentId) q.set('studentId', studentId);
    if (studentName) q.set('studentName', studentName);
    const qs = q.toString();
    const url = `${API_BASE_URL}/api/exam/analytics/student-progress${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load progress analytics');
    const json = await res.json();
    return json.data;
  }
};
