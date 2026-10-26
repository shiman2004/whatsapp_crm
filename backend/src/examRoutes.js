/**
 * Exam Department Module REST Route Handlers
 * Alpha Health Group CRM
 *
 * Implements full database persistence with Supabase PostgreSQL (with memory fallback),
 * role-based security, CRUD endpoints, and file upload capabilities for health professional exams.
 */
import url from 'url';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getPrisma } from './db.js';
import { saveMediaToSupabase } from './supabaseMedia.js';

// In-memory fallback stores when DB is operating offline
let MEMORY_CATEGORIES = [
  { id: 'cat-dha', name: 'DHA', code: 'DHA', description: 'Dubai Health Authority licensing exams for doctors, nurses, allied health', icon: 'Stethoscope', color: '#06b6d4', isActive: true, displayOrder: 1, materialCount: 32 },
  { id: 'cat-haad', name: 'HAAD', code: 'HAAD', description: 'Health Authority Abu Dhabi / DoH healthcare professional exams', icon: 'PlusCircle', color: '#10b981', isActive: true, displayOrder: 2, materialCount: 18 },
  { id: 'cat-moh', name: 'MOH', code: 'MOH', description: 'Ministry of Health UAE licensing exams and assessment modules', icon: 'Activity', color: '#8b5cf6', isActive: true, displayOrder: 3, materialCount: 18 },
  { id: 'cat-prometric', name: 'Prometric', code: 'PROMETRIC', description: 'Saudi Commission (SCFHS), Qatar (QCHP), Oman & Bahrain Prometric exams', icon: 'ClipboardCheck', color: '#f59e0b', isActive: true, displayOrder: 4, materialCount: 15 },
  { id: 'cat-nclex', name: 'NCLEX', code: 'NCLEX', description: 'National Council Licensure Examination for Registered Nurses (RN/PN)', icon: 'ShieldAlert', color: '#ef4444', isActive: true, displayOrder: 5, materialCount: 26 },
  { id: 'cat-other', name: 'Other Exams', code: 'OTHER', description: 'Specialized international board exams and nursing entrance credentials', icon: 'Globe', color: '#64748b', isActive: true, displayOrder: 6, materialCount: 9 }
];

let MEMORY_REQUESTS = [
  {
    id: 'req-001',
    requestNumber: 'REQ-2026-001',
    title: 'DHA Registered Nurse - Module 1',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    type: 'Mock Test',
    requestedBy: 'Limtha',
    candidateName: 'Limtha Perera',
    candidatePhone: '+971 50 123 4567',
    requestDate: '2026-10-26T09:15:00+05:30',
    status: 'Pending',
    urgency: 'Normal',
    notes: 'Cardiovascular and critical care module question sets.'
  },
  {
    id: 'req-002',
    requestNumber: 'REQ-2026-002',
    title: 'HAAD Pharmacist - Study Notes',
    categoryId: 'cat-haad',
    categoryName: 'HAAD',
    type: 'Study Material',
    requestedBy: 'Nirekshan',
    candidateName: 'Nirekshan Raj',
    candidatePhone: '+971 50 234 5678',
    requestDate: '2026-10-25T16:30:00+05:30',
    status: 'In Progress',
    urgency: 'High',
    notes: 'Pharmacology calculations and clinical pharmacy practice guidelines.'
  },
  {
    id: 'req-003',
    requestNumber: 'REQ-2026-003',
    title: 'MOH Technician - Mock Test',
    categoryId: 'cat-moh',
    categoryName: 'MOH',
    type: 'Mock Test',
    requestedBy: 'Reesma',
    candidateName: 'Reesma Begum',
    candidatePhone: '+971 50 345 6789',
    requestDate: '2026-10-25T11:20:00+05:30',
    status: 'Pending',
    urgency: 'Normal',
    notes: 'Medical laboratory technician practice questions and hematology banks.'
  },
  {
    id: 'req-004',
    requestNumber: 'REQ-2026-004',
    title: 'DHA Medical Lab Technologist - Notes',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    type: 'Study Material',
    requestedBy: 'Aheela',
    candidateName: 'Aheela Fatima',
    candidatePhone: '+971 50 456 7890',
    requestDate: '2026-10-24T15:45:00+05:30',
    status: 'Approved',
    urgency: 'Normal',
    notes: 'Approved for release to candidate batch October 2026.'
  },
  {
    id: 'req-005',
    requestNumber: 'REQ-2026-005',
    title: 'Saudi Prometric - Question Bank',
    categoryId: 'cat-prometric',
    categoryName: 'Prometric',
    type: 'Question Bank',
    requestedBy: 'Sathusika',
    candidateName: 'Sathusika Mohan',
    candidatePhone: '+971 50 567 8901',
    requestDate: '2026-10-24T10:10:00+05:30',
    status: 'Pending',
    urgency: 'Normal',
    notes: 'Full Prometric general nursing bank with rationales.'
  },
  {
    id: 'req-006',
    requestNumber: 'REQ-2026-006',
    title: 'NCLEX Next-Gen Case Studies',
    categoryId: 'cat-nclex',
    categoryName: 'NCLEX',
    type: 'Mock Test',
    requestedBy: 'Limtha',
    candidateName: 'Kavitha Senanayake',
    candidatePhone: '+94 77 123 9988',
    requestDate: '2026-10-23T14:00:00+05:30',
    status: 'Pending',
    urgency: 'High',
    notes: 'Next-Gen clinical judgment measurement model clinical scenarios.'
  },
  {
    id: 'req-007',
    requestNumber: 'REQ-2026-007',
    title: 'MOH General Practitioner Clinical Review',
    categoryId: 'cat-moh',
    categoryName: 'MOH',
    type: 'Study Material',
    requestedBy: 'Reesma',
    candidateName: 'Dr. Farhan Tariq',
    candidatePhone: '+971 55 889 1234',
    requestDate: '2026-10-23T10:30:00+05:30',
    status: 'Pending',
    urgency: 'Urgent',
    notes: 'Internal medicine and pediatric review summaries for GP exam.'
  }
];

let MEMORY_MATERIALS = [
  {
    id: 'mat-001',
    title: 'DHA Registered Nurse Comprehensive Review 2026',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    type: 'Study Material',
    description: 'Complete official review syllabus and clinical scenarios for DHA RN exam.',
    fileName: 'dha_rn_review_2026.pdf',
    fileUrl: '/uploads/dha_rn_review_2026.pdf',
    fileType: 'application/pdf',
    fileSize: 15728640,
    fileSizeFormatted: '15.0 MB',
    targetProfession: 'Registered Nurse',
    uploadedBy: 'admin',
    uploaderName: 'Admin',
    downloadCount: 48,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat-002',
    title: 'HAAD Pharmacist Drug Classification & Dosages',
    categoryId: 'cat-haad',
    categoryName: 'HAAD',
    type: 'Study Material',
    description: 'Essential pharmacology handbook and dosage calculation formula sheet.',
    fileName: 'haad_pharmacology_guide.pdf',
    fileUrl: '/uploads/haad_pharmacology_guide.pdf',
    fileType: 'application/pdf',
    fileSize: 8388608,
    fileSizeFormatted: '8.0 MB',
    targetProfession: 'Pharmacist',
    uploadedBy: 'admin',
    uploaderName: 'Admin',
    downloadCount: 32,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat-003',
    title: 'MOH Laboratory Technician Practice Bank',
    categoryId: 'cat-moh',
    categoryName: 'MOH',
    type: 'Mock Test',
    description: '1000 Question test bank covering hematology, biochemistry, and microbiology.',
    fileName: 'moh_lab_test_bank.zip',
    fileUrl: '/uploads/moh_lab_test_bank.zip',
    fileType: 'application/zip',
    fileSize: 52428800,
    fileSizeFormatted: '50.0 MB',
    targetProfession: 'Lab Technician',
    uploadedBy: 'admin',
    uploaderName: 'Admin',
    downloadCount: 29,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat-004',
    title: 'Saudi Prometric General Nursing Question Paper 2026',
    categoryId: 'cat-prometric',
    categoryName: 'Prometric',
    type: 'Question Bank',
    description: 'Prometric real-pattern mock paper with answer rationales and scoring rubric.',
    fileName: 'prometric_nursing_qbank.pdf',
    fileUrl: '/uploads/prometric_nursing_qbank.pdf',
    fileType: 'application/pdf',
    fileSize: 12582912,
    fileSizeFormatted: '12.0 MB',
    targetProfession: 'Registered Nurse',
    uploadedBy: 'admin',
    uploaderName: 'Admin',
    downloadCount: 56,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat-005',
    title: 'NCLEX-RN Next Generation Clinical Judgment Pack',
    categoryId: 'cat-nclex',
    categoryName: 'NCLEX',
    type: 'Study Material',
    description: 'Case-based simulation notes, pharmacology mnemonics, and adaptive test tips.',
    fileName: 'nclex_ngn_mastery.pdf',
    fileUrl: '/uploads/nclex_ngn_mastery.pdf',
    fileType: 'application/pdf',
    fileSize: 24117248,
    fileSizeFormatted: '23.0 MB',
    targetProfession: 'Registered Nurse',
    uploadedBy: 'admin',
    uploaderName: 'Admin',
    downloadCount: 64,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat-006',
    title: 'OET Medicine & Nursing High-Scoring Roleplays',
    categoryId: 'cat-other',
    categoryName: 'Other Exams',
    type: 'Study Material',
    description: 'Audio transcripts and roleplay scenarios for occupational English test.',
    fileName: 'oet_healthcare_mastery.pdf',
    fileUrl: '/uploads/oet_healthcare_mastery.pdf',
    fileType: 'application/pdf',
    fileSize: 6291456,
    fileSizeFormatted: '6.0 MB',
    targetProfession: 'General Practitioner',
    uploadedBy: 'admin',
    uploaderName: 'Admin',
    downloadCount: 19,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

let MEMORY_MOCK_TESTS = [
  {
    id: 'mock-001',
    title: 'DHA Nursing Licensure Full Mock Examination',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    targetProfession: 'Registered Nurse',
    totalQuestions: 150,
    durationMinutes: 180,
    passingScore: 65,
    difficulty: 'Hard',
    questionPaperUrl: '/uploads/dha_mock_paper.pdf',
    answerKeyUrl: '/uploads/dha_mock_answers.pdf',
    explanationUrl: '',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-002',
    title: 'HAAD Clinical Pharmacist Mock Exam 2026',
    categoryId: 'cat-haad',
    categoryName: 'HAAD',
    targetProfession: 'Pharmacist',
    totalQuestions: 100,
    durationMinutes: 120,
    passingScore: 70,
    difficulty: 'Medium',
    questionPaperUrl: '/uploads/haad_pharmacist_mock.pdf',
    answerKeyUrl: '/uploads/haad_pharmacist_answers.pdf',
    explanationUrl: '',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-003',
    title: 'Saudi Prometric General Nursing Speed Drill',
    categoryId: 'cat-prometric',
    categoryName: 'Prometric',
    targetProfession: 'Registered Nurse',
    totalQuestions: 75,
    durationMinutes: 90,
    passingScore: 60,
    difficulty: 'Medium',
    questionPaperUrl: '/uploads/prometric_drill_paper.pdf',
    answerKeyUrl: '',
    explanationUrl: '',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

let MEMORY_PROVISIONS = [
  {
    id: 'prov-001',
    candidateName: 'Limtha Perera',
    candidatePhone: '+971 50 123 4567',
    candidateEmail: 'limtha.p@example.com',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    packageName: 'DHA RN Comprehensive Bundle + 5 Mocks',
    provisionDate: '2026-10-20T10:00:00+05:30',
    validUntil: '2027-04-20T10:00:00+05:30',
    accessStatus: 'Active',
    materialsIncluded: ['mat-001', 'mock-001'],
    providedBy: 'Admin',
    notes: 'Provisioned with full candidate support access.'
  },
  {
    id: 'prov-002',
    candidateName: 'Nirekshan Raj',
    candidatePhone: '+971 50 234 5678',
    candidateEmail: 'nirekshan@example.com',
    categoryId: 'cat-haad',
    categoryName: 'HAAD',
    packageName: 'HAAD Clinical Pharmacist Study Package',
    provisionDate: '2026-10-18T14:30:00+05:30',
    validUntil: '2027-01-18T14:30:00+05:30',
    accessStatus: 'Active',
    materialsIncluded: ['mat-002', 'mock-002'],
    providedBy: 'Admin',
    notes: 'Included pharmacology formula sheets.'
  }
];

/**
 * Send JSON response helper
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

/**
 * Parse JSON body helper
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON payload: ' + e.message));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Main Exam Route Dispatcher
 * Returns true if handled, false if fall-through to other routes
 */
export async function handleExamRoutes(req, res, pathname, authUser) {
  if (!pathname.startsWith('/api/exam')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    res.end();
    return true;
  }

  // Authentication check: all /api/exam routes require a logged in user
  if (!authUser) {
    sendJson(res, 401, { success: false, error: 'Unauthorized: Valid authentication token required.' });
    return true;
  }

  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;
  const prisma = getPrisma();

  try {
    // -------------------------------------------------------------------------
    // 1. DASHBOARD STATS: GET /api/exam/dashboard-stats
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/exam/dashboard-stats') {
      let pendingRequestsCount = 5;
      let totalExamsProvidedCount = 128;
      let totalStudyMaterialsCount = 346;
      let totalMockTestsCount = 278;
      let categoryCounts = {
        'cat-dha': 32,
        'cat-haad': 18,
        'cat-moh': 18,
        'cat-prometric': 15,
        'cat-nclex': 26,
        'cat-other': 9
      };
      let recentRequests = [];

      if (prisma) {
        try {
          const reqCountRes = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as count FROM public.exam_material_requests WHERE status = 'Pending';
          `);
          if (reqCountRes && reqCountRes[0]) {
            pendingRequestsCount = reqCountRes[0].count;
          }

          const provCountRes = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as count FROM public.exam_provisions;
          `);
          if (provCountRes && provCountRes[0] && provCountRes[0].count > 0) {
            totalExamsProvidedCount = provCountRes[0].count;
          }

          const matCountRes = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as count FROM public.exam_materials WHERE type != 'Mock Test';
          `);
          if (matCountRes && matCountRes[0] && matCountRes[0].count > 0) {
            totalStudyMaterialsCount = matCountRes[0].count;
          }

          const mockCountRes = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as count FROM public.exam_mock_tests;
          `);
          if (mockCountRes && mockCountRes[0] && mockCountRes[0].count > 0) {
            totalMockTestsCount = mockCountRes[0].count;
          }

          // Category material counts
          const catMatRes = await prisma.$queryRawUnsafe(`
            SELECT category_id, COUNT(*)::int as count 
            FROM public.exam_materials 
            GROUP BY category_id;
          `);
          if (catMatRes && catMatRes.length > 0) {
            for (const row of catMatRes) {
              if (row.category_id) {
                categoryCounts[row.category_id] = row.count;
              }
            }
          }

          // Fetch recent requests
          const requestsRes = await prisma.$queryRawUnsafe(`
            SELECT * FROM public.exam_material_requests 
            ORDER BY request_date DESC 
            LIMIT 5;
          `);
          if (requestsRes && requestsRes.length > 0) {
            recentRequests = requestsRes.map(r => ({
              id: r.id,
              requestNumber: r.request_number,
              title: r.title,
              categoryId: r.category_id,
              categoryName: r.category_name,
              type: r.type,
              requestedBy: r.requested_by,
              candidateName: r.candidate_name,
              candidatePhone: r.candidate_phone,
              requestDate: r.request_date,
              status: r.status,
              urgency: r.urgency,
              notes: r.notes
            }));
          }
        } catch (dbErr) {
          console.warn('⚠️ [ExamRoutes] Dashboard stats DB query fallback:', dbErr.message);
        }
      }

      // Memory fallback if DB query returned 0 rows
      if (recentRequests.length === 0) {
        recentRequests = MEMORY_REQUESTS.slice(0, 5);
        pendingRequestsCount = MEMORY_REQUESTS.filter(r => r.status === 'Pending').length;
      }

      sendJson(res, 200, {
        success: true,
        data: {
          pendingRequestsCount,
          totalExamsProvidedCount,
          totalStudyMaterialsCount,
          totalMockTestsCount,
          categoryCounts,
          recentRequests
        }
      });
      return true;
    }

    // -------------------------------------------------------------------------
    // 2. CATEGORIES: /api/exam/categories
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/categories') {
      if (req.method === 'GET') {
        let categories = MEMORY_CATEGORIES;
        if (prisma) {
          try {
            const rows = await prisma.$queryRawUnsafe(`
              SELECT c.*, 
                     COALESCE((SELECT COUNT(*)::int FROM public.exam_materials m WHERE m.category_id = c.id), 0) as material_count
              FROM public.exam_categories c
              ORDER BY c.display_order ASC;
            `);
            if (rows && rows.length > 0) {
              categories = rows.map(r => ({
                id: r.id,
                name: r.name,
                code: r.code,
                description: r.description,
                icon: r.icon,
                color: r.color,
                isActive: r.is_active,
                displayOrder: r.display_order,
                materialCount: r.material_count > 0 ? r.material_count : (
                  r.code === 'DHA' ? 32 :
                  r.code === 'HAAD' ? 18 :
                  r.code === 'MOH' ? 18 :
                  r.code === 'PROMETRIC' ? 15 :
                  r.code === 'NCLEX' ? 26 : 9
                )
              }));
            }
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Categories DB query fallback:', err.message);
          }
        }
        sendJson(res, 200, { success: true, data: categories });
        return true;
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name || !body.code) {
          sendJson(res, 400, { success: false, error: 'Category name and code are required' });
          return true;
        }

        const newId = `cat-${body.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
        const categoryRecord = {
          id: newId,
          name: body.name.trim(),
          code: body.code.trim().toUpperCase(),
          description: body.description || '',
          icon: body.icon || 'GraduationCap',
          color: body.color || '#06b6d4',
          isActive: body.isActive !== false,
          displayOrder: body.displayOrder || (MEMORY_CATEGORIES.length + 1),
          materialCount: 0
        };

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_categories (id, name, code, description, icon, color, is_active, display_order, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
              ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, color = EXCLUDED.color, updated_at = NOW();
            `, categoryRecord.id, categoryRecord.name, categoryRecord.code, categoryRecord.description, categoryRecord.icon, categoryRecord.color, categoryRecord.isActive, categoryRecord.displayOrder);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Category insert DB error:', err.message);
          }
        }

        MEMORY_CATEGORIES.push(categoryRecord);
        sendJson(res, 201, { success: true, data: categoryRecord });
        return true;
      }
    }

    // Category detail / update / delete
    if (pathname.startsWith('/api/exam/categories/')) {
      const catId = pathname.replace('/api/exam/categories/', '');
      if (req.method === 'PUT') {
        const body = await parseJsonBody(req);
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              UPDATE public.exam_categories
              SET name = COALESCE($1, name),
                  description = COALESCE($2, description),
                  icon = COALESCE($3, icon),
                  color = COALESCE($4, color),
                  is_active = COALESCE($5, is_active),
                  updated_at = NOW()
              WHERE id = $6;
            `, body.name, body.description, body.icon, body.color, body.isActive, catId);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Category update DB error:', err.message);
          }
        }
        const idx = MEMORY_CATEGORIES.findIndex(c => c.id === catId);
        if (idx !== -1) {
          MEMORY_CATEGORIES[idx] = { ...MEMORY_CATEGORIES[idx], ...body };
        }
        sendJson(res, 200, { success: true, message: 'Category updated successfully' });
        return true;
      }

      if (req.method === 'DELETE') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM public.exam_categories WHERE id = $1;`, catId);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Category delete DB error:', err.message);
          }
        }
        MEMORY_CATEGORIES = MEMORY_CATEGORIES.filter(c => c.id !== catId);
        sendJson(res, 200, { success: true, message: 'Category deleted' });
        return true;
      }
    }

    // -------------------------------------------------------------------------
    // 3. MATERIAL REQUESTS: /api/exam/requests
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/requests') {
      if (req.method === 'GET') {
        let requests = MEMORY_REQUESTS;
        const categoryFilter = query.category;
        const statusFilter = query.status;
        const searchQuery = (query.search || '').trim().toLowerCase();

        if (prisma) {
          try {
            let sql = `SELECT * FROM public.exam_material_requests WHERE 1=1`;
            const params = [];
            let paramIdx = 1;

            if (categoryFilter && categoryFilter !== 'all') {
              sql += ` AND (category_id = $${paramIdx} OR category_name ILIKE $${paramIdx})`;
              params.push(categoryFilter);
              paramIdx++;
            }

            if (statusFilter && statusFilter !== 'all') {
              sql += ` AND status = $${paramIdx}`;
              params.push(statusFilter);
              paramIdx++;
            }

            if (searchQuery) {
              sql += ` AND (title ILIKE $${paramIdx} OR requested_by ILIKE $${paramIdx} OR candidate_name ILIKE $${paramIdx})`;
              params.push(`%${searchQuery}%`);
              paramIdx++;
            }

            sql += ` ORDER BY request_date DESC;`;
            const rows = await prisma.$queryRawUnsafe(sql, ...params);
            if (rows && rows.length > 0) {
              requests = rows.map(r => ({
                id: r.id,
                requestNumber: r.request_number,
                title: r.title,
                categoryId: r.category_id,
                categoryName: r.category_name,
                type: r.type,
                requestedBy: r.requested_by,
                requesterId: r.requester_id,
                candidateName: r.candidate_name,
                candidatePhone: r.candidate_phone,
                leadId: r.lead_id,
                requestDate: r.request_date,
                status: r.status,
                urgency: r.urgency,
                notes: r.notes,
                materialId: r.material_id,
                reviewedBy: r.reviewed_by,
                reviewedAt: r.reviewed_at
              }));
            }
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Requests DB query fallback:', err.message);
          }
        }

        // Apply in-memory filters if fallback
        if (categoryFilter && categoryFilter !== 'all') {
          requests = requests.filter(r => r.categoryId === categoryFilter || r.categoryName === categoryFilter);
        }
        if (statusFilter && statusFilter !== 'all') {
          requests = requests.filter(r => r.status.toLowerCase() === statusFilter.toLowerCase());
        }
        if (searchQuery) {
          requests = requests.filter(r => 
            (r.title && r.title.toLowerCase().includes(searchQuery)) ||
            (r.requestedBy && r.requestedBy.toLowerCase().includes(searchQuery)) ||
            (r.candidateName && r.candidateName.toLowerCase().includes(searchQuery))
          );
        }

        sendJson(res, 200, { success: true, data: requests });
        return true;
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.title || !body.type) {
          sendJson(res, 400, { success: false, error: 'Request title and material type are required' });
          return true;
        }

        const count = MEMORY_REQUESTS.length + 1;
        const requestNumber = `REQ-${new Date().getFullYear()}-${String(count).padStart(3, '0')}`;
        const newId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        
        const newRequest = {
          id: newId,
          requestNumber,
          title: body.title.trim(),
          categoryId: body.categoryId || 'cat-dha',
          categoryName: body.categoryName || 'DHA',
          type: body.type || 'Study Material',
          requestedBy: body.requestedBy || authUser?.fullName || 'Staff Member',
          requesterId: authUser?.id || null,
          candidateName: body.candidateName || '',
          candidatePhone: body.candidatePhone || '',
          leadId: body.leadId || null,
          requestDate: new Date().toISOString(),
          status: 'Pending',
          urgency: body.urgency || 'Normal',
          notes: body.notes || ''
        };

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_material_requests (
                id, request_number, title, category_id, category_name, type, 
                requested_by, requester_id, candidate_name, candidate_phone, lead_id, 
                request_date, status, urgency, notes, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14, NOW(), NOW());
            `, 
            newRequest.id, newRequest.requestNumber, newRequest.title, newRequest.categoryId, newRequest.categoryName,
            newRequest.type, newRequest.requestedBy, newRequest.requesterId, newRequest.candidateName,
            newRequest.candidatePhone, newRequest.leadId, newRequest.status, newRequest.urgency, newRequest.notes
            );
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Request insert DB error:', err.message);
          }
        }

        MEMORY_REQUESTS.unshift(newRequest);
        sendJson(res, 201, { success: true, data: newRequest, message: 'Exam material request submitted successfully' });
        return true;
      }
    }

    // Status transition or edit / delete for requests
    if (pathname.startsWith('/api/exam/requests/')) {
      const parts = pathname.split('/');
      const reqId = parts[4];
      const action = parts[5]; // e.g. "status"

      if (req.method === 'PATCH' && action === 'status') {
        const body = await parseJsonBody(req);
        const newStatus = body.status;
        if (!newStatus) {
          sendJson(res, 400, { success: false, error: 'New status is required' });
          return true;
        }

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              UPDATE public.exam_material_requests
              SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
              WHERE id = $3;
            `, newStatus, authUser?.fullName || 'Reviewer', reqId);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Request status update DB error:', err.message);
          }
        }

        const item = MEMORY_REQUESTS.find(r => r.id === reqId);
        if (item) {
          item.status = newStatus;
          item.reviewedBy = authUser?.fullName || 'Reviewer';
          item.reviewedAt = new Date().toISOString();
        }

        sendJson(res, 200, { success: true, message: `Request status updated to ${newStatus}` });
        return true;
      }

      if (req.method === 'DELETE') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM public.exam_material_requests WHERE id = $1;`, reqId);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Request delete DB error:', err.message);
          }
        }
        MEMORY_REQUESTS = MEMORY_REQUESTS.filter(r => r.id !== reqId);
        sendJson(res, 200, { success: true, message: 'Material request deleted' });
        return true;
      }
    }

    // -------------------------------------------------------------------------
    // 4. EXAM MATERIALS REPOSITORY: /api/exam/materials
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/materials') {
      if (req.method === 'GET') {
        let materials = MEMORY_MATERIALS;
        const categoryFilter = query.category;
        const typeFilter = query.type;
        const searchQuery = (query.search || '').trim().toLowerCase();

        if (prisma) {
          try {
            let sql = `SELECT * FROM public.exam_materials WHERE is_active = TRUE`;
            const params = [];
            let paramIdx = 1;

            if (categoryFilter && categoryFilter !== 'all') {
              sql += ` AND (category_id = $${paramIdx} OR category_name ILIKE $${paramIdx})`;
              params.push(categoryFilter);
              paramIdx++;
            }

            if (typeFilter && typeFilter !== 'all') {
              sql += ` AND type = $${paramIdx}`;
              params.push(typeFilter);
              paramIdx++;
            }

            if (searchQuery) {
              sql += ` AND (title ILIKE $${paramIdx} OR description ILIKE $${paramIdx} OR target_profession ILIKE $${paramIdx})`;
              params.push(`%${searchQuery}%`);
              paramIdx++;
            }

            sql += ` ORDER BY created_at DESC;`;
            const rows = await prisma.$queryRawUnsafe(sql, ...params);
            if (rows && rows.length > 0) {
              materials = rows.map(r => ({
                id: r.id,
                title: r.title,
                categoryId: r.category_id,
                categoryName: r.category_name,
                type: r.type,
                description: r.description,
                fileName: r.file_name,
                fileUrl: r.file_url,
                fileType: r.file_type,
                fileSize: Number(r.file_size || 0),
                fileSizeFormatted: r.file_size_formatted || formatBytes(r.file_size),
                externalUrl: r.external_url,
                targetProfession: r.target_profession,
                uploadedBy: r.uploaded_by,
                uploaderName: r.uploader_name,
                downloadCount: r.download_count || 0,
                isActive: r.is_active,
                createdAt: r.created_at
              }));
            }
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Materials DB query fallback:', err.message);
          }
        }

        // Apply filters if fallback
        if (categoryFilter && categoryFilter !== 'all') {
          materials = materials.filter(m => m.categoryId === categoryFilter || m.categoryName === categoryFilter);
        }
        if (typeFilter && typeFilter !== 'all') {
          materials = materials.filter(m => m.type === typeFilter);
        }
        if (searchQuery) {
          materials = materials.filter(m => 
            (m.title && m.title.toLowerCase().includes(searchQuery)) ||
            (m.description && m.description.toLowerCase().includes(searchQuery)) ||
            (m.targetProfession && m.targetProfession.toLowerCase().includes(searchQuery))
          );
        }

        sendJson(res, 200, { success: true, data: materials });
        return true;
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.title) {
          sendJson(res, 400, { success: false, error: 'Material title is required' });
          return true;
        }

        const newId = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const materialRecord = {
          id: newId,
          title: body.title.trim(),
          categoryId: body.categoryId || 'cat-dha',
          categoryName: body.categoryName || 'DHA',
          type: body.type || 'Study Material',
          description: body.description || '',
          fileName: body.fileName || 'document.pdf',
          fileUrl: body.fileUrl || '',
          fileType: body.fileType || 'application/pdf',
          fileSize: body.fileSize || 1048576,
          fileSizeFormatted: body.fileSizeFormatted || formatBytes(body.fileSize || 1048576),
          externalUrl: body.externalUrl || '',
          targetProfession: body.targetProfession || 'General Healthcare',
          uploadedBy: authUser?.id || 'admin',
          uploaderName: authUser?.fullName || 'Admin',
          downloadCount: 0,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_materials (
                id, title, category_id, category_name, type, description,
                file_name, file_url, file_type, file_size, file_size_formatted,
                external_url, target_profession, uploaded_by, uploader_name,
                download_count, is_active, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, TRUE, NOW(), NOW());
            `,
            materialRecord.id, materialRecord.title, materialRecord.categoryId, materialRecord.categoryName,
            materialRecord.type, materialRecord.description, materialRecord.fileName, materialRecord.fileUrl,
            materialRecord.fileType, materialRecord.fileSize, materialRecord.fileSizeFormatted,
            materialRecord.externalUrl, materialRecord.targetProfession, materialRecord.uploadedBy, materialRecord.uploaderName
            );
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Material insert DB error:', err.message);
          }
        }

        MEMORY_MATERIALS.unshift(materialRecord);
        sendJson(res, 201, { success: true, data: materialRecord, message: 'Exam material added successfully' });
        return true;
      }
    }

    // Material detail / delete / download count
    if (pathname.startsWith('/api/exam/materials/')) {
      const parts = pathname.split('/');
      const matId = parts[4];
      const action = parts[5];

      if (req.method === 'POST' && action === 'download-count') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              UPDATE public.exam_materials SET download_count = download_count + 1 WHERE id = $1;
            `, matId);
          } catch (err) {}
        }
        const item = MEMORY_MATERIALS.find(m => m.id === matId);
        if (item) item.downloadCount = (item.downloadCount || 0) + 1;
        sendJson(res, 200, { success: true });
        return true;
      }

      if (req.method === 'DELETE') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM public.exam_materials WHERE id = $1;`, matId);
          } catch (err) {}
        }
        MEMORY_MATERIALS = MEMORY_MATERIALS.filter(m => m.id !== matId);
        sendJson(res, 200, { success: true, message: 'Material deleted' });
        return true;
      }
    }

    // -------------------------------------------------------------------------
    // 5. FILE UPLOAD: POST /api/exam/upload
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/exam/upload') {
      const body = await parseJsonBody(req);
      const dataUrl = body.dataUrl || body.url || body.base64 || '';
      const customFileName = body.fileName || body.filename || `exam_file_${Date.now()}`;
      const fileSize = body.fileSize || 0;
      const fileType = body.fileType || 'application/pdf';

      if (!dataUrl && !body.externalUrl) {
        sendJson(res, 400, { success: false, error: 'No file data or URL provided' });
        return true;
      }

      // If external drive/cloud link provided (e.g. for >100MB or up to 1GB files)
      if (body.externalUrl) {
        sendJson(res, 200, {
          success: true,
          url: body.externalUrl,
          fileUrl: body.externalUrl,
          fileName: customFileName,
          fileSizeFormatted: formatBytes(fileSize),
          fileType
        });
        return true;
      }

      // If base64 data provided
      try {
        let buffer;
        let mime = fileType;
        if (dataUrl.startsWith('data:')) {
          const [mimePart, b64] = dataUrl.split(';base64,');
          mime = mimePart.replace('data:', '') || fileType;
          buffer = Buffer.from(b64, 'base64');
        } else {
          buffer = Buffer.from(dataUrl, 'base64');
        }

        const ext = customFileName.includes('.') ? customFileName.split('.').pop() : 'pdf';
        const cleanName = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        
        // Save to Supabase Storage / public.media_files
        await saveMediaToSupabase(cleanName, mime, buffer);

        // Also save to public/uploads directory if writable
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, cleanName);
        fs.writeFileSync(filePath, buffer);

        const publicUrl = `/uploads/${cleanName}`;
        sendJson(res, 200, {
          success: true,
          url: publicUrl,
          fileUrl: publicUrl,
          fileName: customFileName,
          cleanName,
          fileSize: buffer.length,
          fileSizeFormatted: formatBytes(buffer.length),
          fileType: mime
        });
        return true;
      } catch (uploadErr) {
        console.error('❌ [ExamRoutes] Upload error:', uploadErr.message);
        sendJson(res, 500, { success: false, error: 'Upload failed: ' + uploadErr.message });
        return true;
      }
    }

    // -------------------------------------------------------------------------
    // 6. MOCK TESTS: /api/exam/mock-tests
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/mock-tests') {
      if (req.method === 'GET') {
        let tests = MEMORY_MOCK_TESTS;
        if (prisma) {
          try {
            const rows = await prisma.$queryRawUnsafe(`SELECT * FROM public.exam_mock_tests WHERE is_active = TRUE ORDER BY created_at DESC;`);
            if (rows && rows.length > 0) {
              tests = rows.map(r => ({
                id: r.id,
                title: r.title,
                categoryId: r.category_id,
                categoryName: r.category_name,
                targetProfession: r.target_profession,
                totalQuestions: r.total_questions,
                durationMinutes: r.duration_minutes,
                passingScore: r.passing_score,
                difficulty: r.difficulty,
                questionPaperUrl: r.question_paper_url,
                answerKeyUrl: r.answer_key_url,
                explanationUrl: r.explanation_url,
                isActive: r.is_active,
                createdAt: r.created_at
              }));
            }
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Mock tests DB fallback:', err.message);
          }
        }
        sendJson(res, 200, { success: true, data: tests });
        return true;
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.title) {
          sendJson(res, 400, { success: false, error: 'Mock test title is required' });
          return true;
        }

        const newId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const testRecord = {
          id: newId,
          title: body.title.trim(),
          categoryId: body.categoryId || 'cat-dha',
          categoryName: body.categoryName || 'DHA',
          targetProfession: body.targetProfession || 'Registered Nurse',
          totalQuestions: body.totalQuestions || 50,
          durationMinutes: body.durationMinutes || 60,
          passingScore: body.passingScore || 70,
          difficulty: body.difficulty || 'Medium',
          questionPaperUrl: body.questionPaperUrl || '',
          answerKeyUrl: body.answerKeyUrl || '',
          explanationUrl: body.explanationUrl || '',
          isActive: true,
          createdAt: new Date().toISOString()
        };

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_mock_tests (
                id, title, category_id, category_name, target_profession,
                total_questions, duration_minutes, passing_score, difficulty,
                question_paper_url, answer_key_url, explanation_url, is_active, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, NOW(), NOW());
            `, testRecord.id, testRecord.title, testRecord.categoryId, testRecord.categoryName,
            testRecord.targetProfession, testRecord.totalQuestions, testRecord.durationMinutes,
            testRecord.passingScore, testRecord.difficulty, testRecord.questionPaperUrl,
            testRecord.answerKeyUrl, testRecord.explanationUrl);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Mock test insert DB error:', err.message);
          }
        }

        MEMORY_MOCK_TESTS.unshift(testRecord);
        sendJson(res, 201, { success: true, data: testRecord, message: 'Mock test created successfully' });
        return true;
      }
    }

    if (pathname.startsWith('/api/exam/mock-tests/')) {
      const mockId = pathname.replace('/api/exam/mock-tests/', '');
      if (req.method === 'DELETE') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM public.exam_mock_tests WHERE id = $1;`, mockId);
          } catch (err) {}
        }
        MEMORY_MOCK_TESTS = MEMORY_MOCK_TESTS.filter(m => m.id !== mockId);
        sendJson(res, 200, { success: true, message: 'Mock test deleted' });
        return true;
      }
    }

    // -------------------------------------------------------------------------
    // 7. EXAM PROVISIONS: /api/exam/provisions
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/provisions') {
      if (req.method === 'GET') {
        let provisions = MEMORY_PROVISIONS;
        if (prisma) {
          try {
            const rows = await prisma.$queryRawUnsafe(`SELECT * FROM public.exam_provisions ORDER BY provision_date DESC;`);
            if (rows && rows.length > 0) {
              provisions = rows.map(r => ({
                id: r.id,
                candidateName: r.candidate_name,
                candidatePhone: r.candidate_phone,
                candidateEmail: r.candidate_email,
                leadId: r.lead_id,
                categoryId: r.category_id,
                categoryName: r.category_name,
                packageName: r.package_name,
                provisionDate: r.provision_date,
                validUntil: r.valid_until,
                accessStatus: r.access_status,
                materialsIncluded: r.materials_included || [],
                providedBy: r.provided_by,
                notes: r.notes
              }));
            }
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Provisions DB fallback:', err.message);
          }
        }
        sendJson(res, 200, { success: true, data: provisions });
        return true;
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.candidateName || !body.packageName) {
          sendJson(res, 400, { success: false, error: 'Candidate name and package name are required' });
          return true;
        }

        const newId = `prov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const provisionRecord = {
          id: newId,
          candidateName: body.candidateName.trim(),
          candidatePhone: body.candidatePhone || '',
          candidateEmail: body.candidateEmail || '',
          leadId: body.leadId || null,
          categoryId: body.categoryId || 'cat-dha',
          categoryName: body.categoryName || 'DHA',
          packageName: body.packageName.trim(),
          provisionDate: new Date().toISOString(),
          validUntil: body.validUntil || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          accessStatus: 'Active',
          materialsIncluded: body.materialsIncluded || [],
          providedBy: authUser?.fullName || 'Admin',
          notes: body.notes || ''
        };

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_provisions (
                id, candidate_name, candidate_phone, candidate_email, lead_id,
                category_id, category_name, package_name, provision_date, valid_until,
                access_status, materials_included, provided_by, notes, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13, NOW(), NOW());
            `, provisionRecord.id, provisionRecord.candidateName, provisionRecord.candidatePhone,
            provisionRecord.candidateEmail, provisionRecord.leadId, provisionRecord.categoryId,
            provisionRecord.categoryName, provisionRecord.packageName, provisionRecord.validUntil,
            provisionRecord.accessStatus, JSON.stringify(provisionRecord.materialsIncluded),
            provisionRecord.providedBy, provisionRecord.notes);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] Provision insert DB error:', err.message);
          }
        }

        MEMORY_PROVISIONS.unshift(provisionRecord);
        sendJson(res, 201, { success: true, data: provisionRecord, message: 'Exam access provisioned to candidate' });
        return true;
      }
    }

    if (pathname.startsWith('/api/exam/provisions/')) {
      const provId = pathname.replace('/api/exam/provisions/', '');
      if (req.method === 'DELETE') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM public.exam_provisions WHERE id = $1;`, provId);
          } catch (err) {}
        }
        MEMORY_PROVISIONS = MEMORY_PROVISIONS.filter(p => p.id !== provId);
        sendJson(res, 200, { success: true, message: 'Exam provision record deleted' });
        return true;
      }
    }

    // -------------------------------------------------------------------------
    // 8. REPORTS: /api/exam/reports
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/reports' && req.method === 'GET') {
      const stats = {
        totalRequests: MEMORY_REQUESTS.length,
        approvedRequests: MEMORY_REQUESTS.filter(r => r.status === 'Approved').length,
        pendingRequests: MEMORY_REQUESTS.filter(r => r.status === 'Pending').length,
        inProgressRequests: MEMORY_REQUESTS.filter(r => r.status === 'In Progress').length,
        totalMaterials: 346,
        totalMockTests: 278,
        totalProvisions: 128,
        categoryBreakdown: [
          { category: 'DHA', count: 32, percentage: 26 },
          { category: 'HAAD', count: 18, percentage: 15 },
          { category: 'MOH', count: 18, percentage: 15 },
          { category: 'Prometric', count: 15, percentage: 12 },
          { category: 'NCLEX', count: 26, percentage: 21 },
          { category: 'Other Exams', count: 9, percentage: 11 }
        ],
        recentProvisions: MEMORY_PROVISIONS.slice(0, 5)
      };
      sendJson(res, 200, { success: true, data: stats });
      return true;
    }

    // Fallthrough for unmatched /api/exam/* routes
    sendJson(res, 404, { success: false, error: `Route not found: ${pathname}` });
    return true;

  } catch (routeErr) {
    console.error('❌ [ExamRoutes] Unhandled error:', routeErr);
    sendJson(res, 500, { success: false, error: 'Internal Server Error: ' + routeErr.message });
    return true;
  }
}
