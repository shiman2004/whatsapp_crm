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
import { saveMediaToSupabase, getMediaFromSupabase } from './supabaseMedia.js';

const JWT_SECRET = process.env.JWT_SECRET || 'royal_wellness_crm_jwt_secret_key_2026_super_secure';

function signMediaFile(fileName) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`media:${fileName}`).digest('base64url');
}

function createPrivateMediaUrl(fileName) {
  const signature = signMediaFile(fileName);
  return `/uploads/${encodeURIComponent(fileName)}?sig=${signature}`;
}

function ensureSignedMediaUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return fileUrl || '';
  if (fileUrl.startsWith('/uploads/') && !fileUrl.includes('?sig=')) {
    const fName = path.basename(decodeURIComponent(fileUrl.split('?')[0]));
    if (fName) {
      return createPrivateMediaUrl(fName);
    }
  }
  return fileUrl;
}

// In-memory fallback stores when DB is operating offline
let MEMORY_CATEGORIES = [
  { id: 'cat-dha', name: 'DHA', code: 'DHA', description: 'Dubai Health Authority licensing exams for doctors, nurses, allied health', icon: 'Stethoscope', color: '#06b6d4', isActive: true, displayOrder: 1, materialCount: 0 },
  { id: 'cat-haad', name: 'HAAD', code: 'HAAD', description: 'Health Authority Abu Dhabi / DoH healthcare professional exams', icon: 'PlusCircle', color: '#10b981', isActive: true, displayOrder: 2, materialCount: 0 },
  { id: 'cat-moh', name: 'MOH', code: 'MOH', description: 'Ministry of Health UAE licensing exams and assessment modules', icon: 'Activity', color: '#8b5cf6', isActive: true, displayOrder: 3, materialCount: 0 },
  { id: 'cat-prometric', name: 'Prometric', code: 'PROMETRIC', description: 'Saudi Commission (SCFHS), Qatar (QCHP), Oman & Bahrain Prometric exams', icon: 'ClipboardCheck', color: '#f59e0b', isActive: true, displayOrder: 4, materialCount: 0 },
  { id: 'cat-nclex', name: 'NCLEX', code: 'NCLEX', description: 'National Council Licensure Examination for Registered Nurses (RN/PN)', icon: 'ShieldAlert', color: '#ef4444', isActive: true, displayOrder: 5, materialCount: 0 },
  { id: 'cat-other', name: 'Other Exams', code: 'OTHER', description: 'Specialized international board exams and nursing entrance credentials', icon: 'Globe', color: '#64748b', isActive: true, displayOrder: 6, materialCount: 0 }
];

let MEMORY_REQUESTS = [];
let MEMORY_MATERIALS = [];
let MEMORY_MOCK_TESTS = [];
let MEMORY_PROVISIONS = [];

let MEMORY_MCQ_QUESTIONS = [
  {
    id: 'mcq-sample-blood-transfusion',
    title: 'Question 1 — Blood Transfusion Reaction',
    questionText: 'Fifteen minutes after starting a blood transfusion, a patient develops chills, shortness of breath, and lower back pain. What should the nurse do FIRST?',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    subject: 'Nursing / Clinical Procedures',
    imageUrl: '',
    optionA: 'Slow the transfusion and reassess after 10 minutes',
    optionB: 'Administer an antipyretic and continue the transfusion',
    optionC: 'Stop the transfusion immediately and maintain IV access with normal saline using new tubing',
    optionD: 'Notify the blood bank before stopping the transfusion',
    optionE: 'Increase the IV flow rate to maintain blood pressure',
    correctAnswer: 'C',
    rememberNote1: 'Suspected acute transfusion reaction → STOP the blood transfusion immediately.',
    rememberNote2: 'Maintain IV access with 0.9% normal saline using new tubing.',
    rememberNote3: 'Assess the patient, monitor vital signs, and notify the physician/provider and blood bank according to protocol.',
    explanation: 'An acute hemolytic or febrile transfusion reaction is a medical emergency. The priority action is to immediately stop the infusion to prevent further exposure to incompatible blood while preserving venous access using fresh IV tubing and 0.9% normal saline.',
    difficulty: 'Medium',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mcq-sample-digoxin-toxicity',
    title: 'Question 2 — Digoxin Toxicity and Hypokalemia',
    questionText: 'A patient with heart failure is receiving Digoxin 0.25 mg daily and Furosemide 40 mg daily. Which clinical finding should alert the nurse to potential digoxin toxicity?',
    categoryId: 'cat-nclex',
    categoryName: 'NCLEX',
    subject: 'Pharmacology & Cardiovascular',
    imageUrl: '',
    optionA: 'Heart rate of 88 beats/min and mild ankle edema',
    optionB: 'Visual disturbances with yellow-green halos and nausea',
    optionC: 'Serum potassium level of 4.8 mEq/L',
    optionD: 'Increased appetite and weight gain of 1 lb in 3 days',
    optionE: 'Blood pressure of 134/82 mmHg',
    correctAnswer: 'B',
    rememberNote1: 'Classic signs of digoxin toxicity: GI distress (nausea/vomiting/anorexia), bradycardia/dysrhythmias, and visual changes (yellow-green halos/blurred vision).',
    rememberNote2: 'Hypokalemia (low potassium, commonly from loop diuretics like furosemide) significantly increases digoxin binding and potentiates toxicity.',
    rememberNote3: 'Always assess the apical pulse for 1 full minute prior to administration; withhold and notify provider if apical pulse is < 60 bpm in adults.',
    explanation: 'Digoxin has a narrow therapeutic range (0.8–2.0 ng/mL). Hypokalemia caused by loop diuretics heightens myocardial sensitivity to digoxin, leading to visual disturbances, gastrointestinal upset, and fatal dysrhythmias.',
    difficulty: 'Medium',
    displayOrder: 2,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mcq-sample-anaphylaxis-shock',
    title: 'Question 3 — Emergency Management of Anaphylaxis',
    questionText: 'A client with an acute severe allergic reaction develops stridor, facial angioedema, and a systolic blood pressure drop to 80 mmHg. What is the immediate first-line pharmacological treatment?',
    categoryId: 'cat-prometric',
    categoryName: 'Prometric',
    subject: 'Emergency Care / Immunology',
    imageUrl: '',
    optionA: 'Oral diphenhydramine 50 mg',
    optionB: 'Intravenous hydrocortisone 200 mg',
    optionC: 'Intramuscular Epinephrine (1:1,000) administered into the anterolateral thigh',
    optionD: 'Inhaled albuterol nebulizer monotherapy',
    optionE: 'Subcutaneous Epinephrine (1:10,000) in the deltoid muscle',
    correctAnswer: 'C',
    rememberNote1: 'Intramuscular (IM) Epinephrine 1:1,000 in the mid-anterolateral thigh is the first-line, life-saving drug of choice in anaphylaxis.',
    rememberNote2: 'Do not delay epinephrine administration to give antihistamines or corticosteroids, which are secondary second-line treatments.',
    rememberNote3: 'Place patient in recumbent position with lower extremities elevated, administer high-flow oxygen, and establish large-bore IV access for isotonic fluid resuscitation.',
    explanation: 'Epinephrine stimulates alpha-1, beta-1, and beta-2 adrenergic receptors, reversing peripheral vasodilation, reducing mucosal edema, and opening bronchial airways. IM injection in the vastus lateralis achieves prompt peak plasma concentrations.',
    difficulty: 'Hard',
    displayOrder: 3,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

let MEMORY_MCQ_ATTEMPTS = [];

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
      let pendingRequestsCount = 0;
      let totalExamsProvidedCount = 0;
      let totalStudyMaterialsCount = 0;
      let totalMockTestsCount = 0;
      let categoryCounts = {
        'cat-dha': 0,
        'cat-haad': 0,
        'cat-moh': 0,
        'cat-prometric': 0,
        'cat-nclex': 0,
        'cat-other': 0
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
          if (provCountRes && provCountRes[0]) {
            totalExamsProvidedCount = provCountRes[0].count;
          }

          const matCountRes = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as count FROM public.exam_materials WHERE type != 'Mock Test';
          `);
          if (matCountRes && matCountRes[0]) {
            totalStudyMaterialsCount = matCountRes[0].count;
          }

          const mockCountRes = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int as count FROM public.exam_mock_tests;
          `);
          if (mockCountRes && mockCountRes[0]) {
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
      } else {
        recentRequests = MEMORY_REQUESTS.slice(0, 5);
        pendingRequestsCount = MEMORY_REQUESTS.filter(r => r.status === 'Pending').length;
        totalExamsProvidedCount = MEMORY_PROVISIONS.length;
        totalStudyMaterialsCount = MEMORY_MATERIALS.filter(m => m.type !== 'Mock Test').length;
        totalMockTestsCount = MEMORY_MOCK_TESTS.length;
        MEMORY_MATERIALS.forEach(m => {
          if (m.categoryId) {
            categoryCounts[m.categoryId] = (categoryCounts[m.categoryId] || 0) + 1;
          }
        });
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
                materialCount: Number(r.material_count || 0)
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
                fileUrl: ensureSignedMediaUrl(r.file_url),
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
          fileUrl: ensureSignedMediaUrl(body.fileUrl || ''),
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

    // Material detail / delete / download count / direct file stream
    if (pathname.startsWith('/api/exam/materials/')) {
      const parts = pathname.split('/');
      const matId = parts[4];
      const action = parts[5];

      if (req.method === 'GET' && action === 'download') {
        let material = null;
        if (prisma) {
          try {
            const rows = await prisma.$queryRawUnsafe(`SELECT * FROM public.exam_materials WHERE id = $1 LIMIT 1;`, matId);
            if (rows && rows.length > 0) material = rows[0];
          } catch (e) {}
        }
        if (!material) {
          material = MEMORY_MATERIALS.find(m => m.id === matId);
        }
        if (!material) {
          sendJson(res, 404, { success: false, error: 'Material not found' });
          return true;
        }

        // Increment download count asynchronously
        if (prisma) {
          prisma.$executeRawUnsafe(`UPDATE public.exam_materials SET download_count = download_count + 1 WHERE id = $1;`, matId).catch(() => null);
        }
        const memItem = MEMORY_MATERIALS.find(m => m.id === matId);
        if (memItem) memItem.downloadCount = (memItem.downloadCount || 0) + 1;

        // If external link, redirect
        const extUrl = material.external_url || material.externalUrl;
        if (extUrl) {
          res.writeHead(302, { Location: extUrl });
          res.end();
          return true;
        }

        const rawFileUrl = material.file_url || material.fileUrl || '';
        const rawFileName = material.file_name || material.fileName || 'exam_material.pdf';
        const fileType = material.file_type || material.fileType || 'application/pdf';

        const cleanName = path.basename(decodeURIComponent(rawFileUrl.split('?')[0])) || rawFileName;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        const localPath = path.join(uploadDir, cleanName);

        if (fs.existsSync(localPath)) {
          const stat = fs.statSync(localPath);
          res.writeHead(200, {
            'Content-Type': fileType,
            'Content-Length': stat.size,
            'Content-Disposition': `inline; filename="${encodeURIComponent(rawFileName)}"`,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
          });
          fs.createReadStream(localPath).pipe(res);
          return true;
        }

        // Fallback to Supabase cloud storage
        try {
          const media = await getMediaFromSupabase(cleanName);
          if (media && media.buffer) {
            res.writeHead(200, {
              'Content-Type': media.mimeType || fileType,
              'Content-Length': media.buffer.length,
              'Content-Disposition': `inline; filename="${encodeURIComponent(rawFileName)}"`,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=86400'
            });
            res.end(media.buffer);
            return true;
          }
        } catch (sErr) {}

        sendJson(res, 404, { success: false, error: 'File content not found on server' });
        return true;
      }

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

        const publicUrl = createPrivateMediaUrl(cleanName);
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
    // 8. INTERACTIVE MCQ PRACTICE MODULE: /api/exam/mcq/*
    // -------------------------------------------------------------------------

    // Helper: auto-seed sample questions into database if table is empty
    async function ensureSeedMcqQuestions(prisma) {
      if (!prisma) return;
      try {
        const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_mcq_questions;`);
        const count = countRes?.[0]?.count || 0;
        if (count === 0) {
          for (const q of MEMORY_MCQ_QUESTIONS) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_mcq_questions (
                id, title, question_text, category_id, category_name, subject, image_url,
                option_a, option_b, option_c, option_d, option_e, correct_answer,
                remember_note_1, remember_note_2, remember_note_3, explanation,
                difficulty, display_order, is_active, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, TRUE, NOW(), NOW()
              ) ON CONFLICT (id) DO NOTHING;
            `,
              q.id, q.title, q.questionText, q.categoryId, q.categoryName, q.subject, q.imageUrl || '',
              q.optionA, q.optionB, q.optionC, q.optionD, q.optionE, q.correctAnswer,
              q.rememberNote1, q.rememberNote2, q.rememberNote3, q.explanation || '',
              q.difficulty || 'Medium', q.displayOrder || 1
            );
          }
        }
      } catch (seedErr) {
        console.warn('⚠️ [ExamRoutes] Seed MCQ questions error:', seedErr.message);
      }
    }

    // 8.1 GET /api/exam/mcq/questions & POST /api/exam/mcq/questions
    if (pathname === '/api/exam/mcq/questions') {
      if (req.method === 'GET') {
        let questions = MEMORY_MCQ_QUESTIONS;
        if (prisma) {
          try {
            await ensureSeedMcqQuestions(prisma);
            const catFilter = query.categoryId && query.categoryId !== 'all' ? query.categoryId : null;
            const searchFilter = query.search ? `%${query.search.toLowerCase()}%` : null;

            let queryStr = `SELECT * FROM public.exam_mcq_questions WHERE is_active = TRUE`;
            const params = [];
            if (catFilter) {
              params.push(catFilter);
              queryStr += ` AND category_id = $${params.length}`;
            }
            if (searchFilter) {
              params.push(searchFilter);
              queryStr += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(question_text) LIKE $${params.length} OR LOWER(subject) LIKE $${params.length})`;
            }
            queryStr += ` ORDER BY display_order ASC, created_at DESC;`;

            const rows = await prisma.$queryRawUnsafe(queryStr, ...params);
            if (rows && rows.length > 0) {
              questions = rows.map(r => ({
                id: r.id,
                title: r.title,
                questionText: r.question_text,
                categoryId: r.category_id,
                categoryName: r.category_name,
                subject: r.subject,
                imageUrl: ensureSignedMediaUrl(r.image_url),
                optionA: r.option_a,
                optionB: r.option_b,
                optionC: r.option_c,
                optionD: r.option_d,
                optionE: r.option_e,
                correctAnswer: r.correct_answer,
                rememberNote1: r.remember_note_1,
                rememberNote2: r.remember_note_2,
                rememberNote3: r.remember_note_3,
                explanation: r.explanation,
                difficulty: r.difficulty,
                displayOrder: r.display_order,
                isActive: r.is_active,
                createdAt: r.created_at
              }));
            }
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] MCQ questions DB fallback:', err.message);
          }
        }

        // Apply client query filters on in-memory if needed
        if (query.categoryId && query.categoryId !== 'all') {
          questions = questions.filter(q => q.categoryId === query.categoryId);
        }
        if (query.search) {
          const s = query.search.toLowerCase();
          questions = questions.filter(q =>
            (q.title && q.title.toLowerCase().includes(s)) ||
            (q.questionText && q.questionText.toLowerCase().includes(s)) ||
            (q.subject && q.subject.toLowerCase().includes(s))
          );
        }

        sendJson(res, 200, { success: true, data: questions });
        return true;
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.title || !body.questionText) {
          sendJson(res, 400, { success: false, error: 'Question title and question text are required' });
          return true;
        }
        if (!body.optionA || !body.optionB || !body.optionC || !body.optionD || !body.optionE) {
          sendJson(res, 400, { success: false, error: 'All 5 options (A, B, C, D, E) are required' });
          return true;
        }
        const correct = String(body.correctAnswer || 'A').toUpperCase().trim();
        if (!['A', 'B', 'C', 'D', 'E'].includes(correct)) {
          sendJson(res, 400, { success: false, error: 'Correct answer must be one of: A, B, C, D, E' });
          return true;
        }
        if (!body.rememberNote1 || !body.rememberNote2 || !body.rememberNote3) {
          sendJson(res, 400, { success: false, error: 'All 3 Remember Notes are required for correct answer guidance' });
          return true;
        }

        const newId = `mcq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const qRecord = {
          id: newId,
          title: body.title.trim(),
          questionText: body.questionText.trim(),
          categoryId: body.categoryId || 'cat-dha',
          categoryName: body.categoryName || 'DHA',
          subject: body.subject?.trim() || 'General Health Sciences',
          imageUrl: body.imageUrl?.trim() || '',
          optionA: body.optionA.trim(),
          optionB: body.optionB.trim(),
          optionC: body.optionC.trim(),
          optionD: body.optionD.trim(),
          optionE: body.optionE.trim(),
          correctAnswer: correct,
          rememberNote1: body.rememberNote1.trim(),
          rememberNote2: body.rememberNote2.trim(),
          rememberNote3: body.rememberNote3.trim(),
          explanation: body.explanation?.trim() || '',
          difficulty: body.difficulty || 'Medium',
          displayOrder: Number(body.displayOrder) || MEMORY_MCQ_QUESTIONS.length + 1,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.exam_mcq_questions (
                id, title, question_text, category_id, category_name, subject, image_url,
                option_a, option_b, option_c, option_d, option_e, correct_answer,
                remember_note_1, remember_note_2, remember_note_3, explanation,
                difficulty, display_order, is_active, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, TRUE, NOW(), NOW()
              );
            `,
              qRecord.id, qRecord.title, qRecord.questionText, qRecord.categoryId, qRecord.categoryName,
              qRecord.subject, qRecord.imageUrl, qRecord.optionA, qRecord.optionB, qRecord.optionC,
              qRecord.optionD, qRecord.optionE, qRecord.correctAnswer, qRecord.rememberNote1,
              qRecord.rememberNote2, qRecord.rememberNote3, qRecord.explanation,
              qRecord.difficulty, qRecord.displayOrder
            );
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] MCQ insert DB error:', err.message);
          }
        }

        MEMORY_MCQ_QUESTIONS.unshift(qRecord);
        sendJson(res, 201, { success: true, data: qRecord, message: 'MCQ question created successfully' });
        return true;
      }
    }

    // 8.2 PUT & DELETE /api/exam/mcq/questions/:id
    if (pathname.startsWith('/api/exam/mcq/questions/')) {
      const qId = pathname.replace('/api/exam/mcq/questions/', '');
      
      if (req.method === 'PUT') {
        const body = await parseJsonBody(req);
        const correct = body.correctAnswer ? String(body.correctAnswer).toUpperCase().trim() : undefined;

        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`
              UPDATE public.exam_mcq_questions SET
                title = COALESCE($2, title),
                question_text = COALESCE($3, question_text),
                category_id = COALESCE($4, category_id),
                category_name = COALESCE($5, category_name),
                subject = COALESCE($6, subject),
                image_url = COALESCE($7, image_url),
                option_a = COALESCE($8, option_a),
                option_b = COALESCE($9, option_b),
                option_c = COALESCE($10, option_c),
                option_d = COALESCE($11, option_d),
                option_e = COALESCE($12, option_e),
                correct_answer = COALESCE($13, correct_answer),
                remember_note_1 = COALESCE($14, remember_note_1),
                remember_note_2 = COALESCE($15, remember_note_2),
                remember_note_3 = COALESCE($16, remember_note_3),
                explanation = COALESCE($17, explanation),
                difficulty = COALESCE($18, difficulty),
                display_order = COALESCE($19, display_order),
                updated_at = NOW()
              WHERE id = $1;
            `,
              qId, body.title, body.questionText, body.categoryId, body.categoryName,
              body.subject, body.imageUrl, body.optionA, body.optionB, body.optionC,
              body.optionD, body.optionE, correct, body.rememberNote1,
              body.rememberNote2, body.rememberNote3, body.explanation,
              body.difficulty, body.displayOrder
            );
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] MCQ update DB error:', err.message);
          }
        }

        const memIndex = MEMORY_MCQ_QUESTIONS.findIndex(q => q.id === qId);
        if (memIndex !== -1) {
          MEMORY_MCQ_QUESTIONS[memIndex] = {
            ...MEMORY_MCQ_QUESTIONS[memIndex],
            ...body,
            id: qId,
            correctAnswer: correct || MEMORY_MCQ_QUESTIONS[memIndex].correctAnswer
          };
        }

        sendJson(res, 200, { success: true, message: 'Question updated successfully' });
        return true;
      }

      if (req.method === 'DELETE') {
        if (prisma) {
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM public.exam_mcq_questions WHERE id = $1;`, qId);
          } catch (err) {
            console.warn('⚠️ [ExamRoutes] MCQ delete DB error:', err.message);
          }
        }
        MEMORY_MCQ_QUESTIONS = MEMORY_MCQ_QUESTIONS.filter(q => q.id !== qId);
        sendJson(res, 200, { success: true, message: 'Question deleted successfully' });
        return true;
      }
    }

    // 8.3 POST /api/exam/mcq/record-attempt (Student Practice Session Attempt Logging)
    if (pathname === '/api/exam/mcq/record-attempt' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.questionId || !body.firstSelectedAnswer || !body.finalCorrectAnswer) {
        sendJson(res, 400, { success: false, error: 'Question ID, first answer, and final answer are required' });
        return true;
      }

      const attemptId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const attemptRecord = {
        id: attemptId,
        sessionId: body.sessionId || `session-${Date.now()}`,
        studentId: body.studentId || authUser?.id || 'candidate-student',
        studentName: body.studentName || authUser?.fullName || 'Candidate Student',
        studentIdentifier: body.studentIdentifier || authUser?.email || '',
        examTitle: body.examTitle || 'Interactive MCQ Practice',
        categoryId: body.categoryId || 'cat-dha',
        questionId: body.questionId,
        questionTitle: body.questionTitle || 'Exam Practice Question',
        firstSelectedAnswer: String(body.firstSelectedAnswer).toUpperCase().trim(),
        numberOfAttempts: Number(body.numberOfAttempts) || 1,
        attemptsHistory: Array.isArray(body.attemptsHistory) ? body.attemptsHistory : [body.firstSelectedAnswer],
        finalCorrectAnswer: String(body.finalCorrectAnswer).toUpperCase().trim(),
        isCorrectFirstTry: Boolean(body.isCorrectFirstTry || body.numberOfAttempts === 1),
        timeSpentSeconds: Number(body.timeSpentSeconds) || 0,
        createdAt: new Date().toISOString()
      };

      if (prisma) {
        try {
          await prisma.$executeRawUnsafe(`
            INSERT INTO public.exam_mcq_practice_attempts (
              id, session_id, student_id, student_name, student_identifier, exam_title,
              category_id, question_id, question_title, first_selected_answer,
              number_of_attempts, attempts_history, final_correct_answer,
              is_correct_first_try, time_spent_seconds, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10,
              $11, $12::jsonb, $13,
              $14, $15, NOW()
            );
          `,
            attemptRecord.id, attemptRecord.sessionId, attemptRecord.studentId, attemptRecord.studentName,
            attemptRecord.studentIdentifier, attemptRecord.examTitle, attemptRecord.categoryId,
            attemptRecord.questionId, attemptRecord.questionTitle, attemptRecord.firstSelectedAnswer,
            attemptRecord.numberOfAttempts, JSON.stringify(attemptRecord.attemptsHistory),
            attemptRecord.finalCorrectAnswer, attemptRecord.isCorrectFirstTry, attemptRecord.timeSpentSeconds
          );
        } catch (err) {
          console.warn('⚠️ [ExamRoutes] Attempt insert DB error:', err.message);
        }
      }

      MEMORY_MCQ_ATTEMPTS.unshift(attemptRecord);
      sendJson(res, 201, { success: true, data: attemptRecord, message: 'Practice attempt recorded successfully' });
      return true;
    }

    // 8.4 GET /api/exam/mcq/attempts (Audit & Practice History)
    if (pathname === '/api/exam/mcq/attempts' && req.method === 'GET') {
      let attempts = MEMORY_MCQ_ATTEMPTS;
      if (prisma) {
        try {
          const limit = Math.min(Number(query.limit) || 100, 500);
          const studentFilter = query.studentId || null;
          let queryStr = `SELECT * FROM public.exam_mcq_practice_attempts`;
          const params = [];
          if (studentFilter) {
            params.push(studentFilter);
            queryStr += ` WHERE student_id = $1`;
          }
          queryStr += ` ORDER BY created_at DESC LIMIT ${limit};`;

          const rows = await prisma.$queryRawUnsafe(queryStr, ...params);
          if (rows && rows.length > 0) {
            attempts = rows.map(r => ({
              id: r.id,
              sessionId: r.session_id,
              studentId: r.student_id,
              studentName: r.student_name,
              studentIdentifier: r.student_identifier,
              examTitle: r.exam_title,
              categoryId: r.category_id,
              questionId: r.question_id,
              questionTitle: r.question_title,
              firstSelectedAnswer: r.first_selected_answer,
              numberOfAttempts: r.number_of_attempts,
              attemptsHistory: r.attempts_history || [],
              finalCorrectAnswer: r.final_correct_answer,
              isCorrectFirstTry: r.is_correct_first_try,
              timeSpentSeconds: r.time_spent_seconds,
              createdAt: r.created_at
            }));
          }
        } catch (err) {
          console.warn('⚠️ [ExamRoutes] Attempts DB fallback:', err.message);
        }
      }

      sendJson(res, 200, { success: true, data: attempts });
      return true;
    }

    // 8.5 GET /api/exam/mcq/stats (Analytics overview)
    if (pathname === '/api/exam/mcq/stats' && req.method === 'GET') {
      let totalQuestions = MEMORY_MCQ_QUESTIONS.length;
      let totalAttempts = MEMORY_MCQ_ATTEMPTS.length;
      let firstTryCorrect = MEMORY_MCQ_ATTEMPTS.filter(a => a.isCorrectFirstTry).length;
      let uniqueStudents = new Set(MEMORY_MCQ_ATTEMPTS.map(a => a.studentName)).size;

      if (prisma) {
        try {
          const [qCount, aCount, fCount, sCount] = await Promise.all([
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_mcq_questions WHERE is_active = TRUE;`),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_mcq_practice_attempts;`),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_mcq_practice_attempts WHERE is_correct_first_try = TRUE;`),
            prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT student_name)::int as count FROM public.exam_mcq_practice_attempts;`)
          ]);

          if (qCount?.[0]) totalQuestions = qCount[0].count;
          if (aCount?.[0]) totalAttempts = aCount[0].count;
          if (fCount?.[0]) firstTryCorrect = fCount[0].count;
          if (sCount?.[0]) uniqueStudents = sCount[0].count;
        } catch (err) {
          console.warn('⚠️ [ExamRoutes] MCQ stats DB error:', err.message);
        }
      }

      const firstTryAccuracy = totalAttempts > 0 ? Math.round((firstTryCorrect / totalAttempts) * 100) : 0;

      sendJson(res, 200, {
        success: true,
        data: {
          totalQuestions,
          totalAttempts,
          firstTryCorrect,
          firstTryAccuracy,
          uniqueStudents
        }
      });
      return true;
    }

    // -------------------------------------------------------------------------
    // 9. REPORTS: /api/exam/reports
    // -------------------------------------------------------------------------
    if (pathname === '/api/exam/reports' && req.method === 'GET') {
      let totalRequests = 0;
      let approvedRequests = 0;
      let pendingRequests = 0;
      let inProgressRequests = 0;
      let totalMaterials = 0;
      let totalMockTests = 0;
      let totalProvisions = 0;
      let categoryBreakdown = [];
      let recentProvisions = [];

      if (prisma) {
        try {
          const [reqsStats, matCount, mockCount, provCount, catStats, provs] = await Promise.all([
            prisma.$queryRawUnsafe(`
              SELECT 
                COUNT(*)::int as total,
                COUNT(CASE WHEN status = 'Approved' THEN 1 END)::int as approved,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END)::int as pending,
                COUNT(CASE WHEN status = 'In Progress' THEN 1 END)::int as in_progress
              FROM public.exam_material_requests;
            `),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_materials;`),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_mock_tests;`),
            prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_provisions;`),
            prisma.$queryRawUnsafe(`
              SELECT c.name as category, COUNT(m.id)::int as count
              FROM public.exam_categories c
              LEFT JOIN public.exam_materials m ON m.category_id = c.id
              GROUP BY c.name, c.display_order
              ORDER BY c.display_order ASC;
            `),
            prisma.$queryRawUnsafe(`
              SELECT * FROM public.exam_provisions 
              ORDER BY provision_date DESC 
              LIMIT 5;
            `)
          ]);

          if (reqsStats && reqsStats[0]) {
            totalRequests = reqsStats[0].total || 0;
            approvedRequests = reqsStats[0].approved || 0;
            pendingRequests = reqsStats[0].pending || 0;
            inProgressRequests = reqsStats[0].in_progress || 0;
          }
          if (matCount && matCount[0]) totalMaterials = matCount[0].count || 0;
          if (mockCount && mockCount[0]) totalMockTests = mockCount[0].count || 0;
          if (provCount && provCount[0]) totalProvisions = provCount[0].count || 0;

          if (catStats && catStats.length > 0) {
            categoryBreakdown = catStats.map(r => ({
              category: r.category,
              count: Number(r.count || 0),
              percentage: totalMaterials > 0 ? Math.round((Number(r.count || 0) / totalMaterials) * 100) : 0
            }));
          }

          if (provs && provs.length > 0) {
            recentProvisions = provs.map(p => ({
              id: p.id,
              candidateName: p.candidate_name,
              candidatePhone: p.candidate_phone,
              candidateEmail: p.candidate_email,
              categoryId: p.category_id,
              categoryName: p.category_name,
              packageName: p.package_name,
              provisionDate: p.provision_date,
              validUntil: p.valid_until,
              accessStatus: p.access_status,
              materialsIncluded: p.materials_included || [],
              providedBy: p.provided_by,
              notes: p.notes
            }));
          }
        } catch (dbErr) {
          console.warn('⚠️ [ExamRoutes] Reports DB query error:', dbErr.message);
        }
      } else {
        totalRequests = MEMORY_REQUESTS.length;
        approvedRequests = MEMORY_REQUESTS.filter(r => r.status === 'Approved').length;
        pendingRequests = MEMORY_REQUESTS.filter(r => r.status === 'Pending').length;
        inProgressRequests = MEMORY_REQUESTS.filter(r => r.status === 'In Progress').length;
        totalMaterials = MEMORY_MATERIALS.length;
        totalMockTests = MEMORY_MOCK_TESTS.length;
        totalProvisions = MEMORY_PROVISIONS.length;
        categoryBreakdown = MEMORY_CATEGORIES.map(c => {
          const count = MEMORY_MATERIALS.filter(m => m.categoryId === c.id).length;
          return {
            category: c.name,
            count,
            percentage: totalMaterials > 0 ? Math.round((count / totalMaterials) * 100) : 0
          };
        });
        recentProvisions = MEMORY_PROVISIONS.slice(0, 5);
      }

      sendJson(res, 200, {
        success: true,
        data: {
          totalRequests,
          approvedRequests,
          pendingRequests,
          inProgressRequests,
          totalMaterials,
          totalMockTests,
          totalProvisions,
          categoryBreakdown,
          recentProvisions
        }
      });
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
