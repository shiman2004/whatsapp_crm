/**
 * Appointment Booking, Doctor Scheduling & Room REST Route Handlers
 * Alpha Health Group CRM Module
 *
 * Doctor + branch + time are the authoritative scheduling constraints.
 * Physical rooms remain supported for historical records and optional allocation.
 */
import url from 'url';
import crypto from 'crypto';
import { getPrisma, getDbStatus } from './db.js';
import { validateAppointmentSlot } from './conflictEngine.js';
import { sendAppointmentNotification } from './whatsappNotifier.js';

const COLOMBO_TZ = 'Asia/Colombo';

// In-memory fallback stores when DB is operating offline
let MEMORY_BRANCHES = [
  { id: 'branch-colombo', company: 'RWC', name: 'Colombo (Head Office)', code: 'COLOMBO', address: 'Colombo, Sri Lanka', phone: '+94 70 639 3353', isActive: true },
  { id: 'branch-maruthamunai', company: 'RWC', name: 'Maruthamunai Branch', code: 'MARUTHAMUNAI', address: 'Maruthamunai, Sri Lanka', phone: '+94 70 637 3353', isActive: true }
];

let MEMORY_ROOMS = [
  { id: 'room-col-1', branchId: 'branch-colombo', name: 'Consultation Suite 1', roomNumber: 'R-101', description: 'Primary consultation and diagnosis', color: '#0d9488', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-hair-1', 't-skin-1', 't-iv-1'] },
  { id: 'room-col-2', branchId: 'branch-colombo', name: 'Laser & Skin Therapy Suite', roomNumber: 'R-102', description: 'Advanced laser treatments and dermatological procedures', color: '#6366f1', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-skin-1', 't-skin-2', 't-laser-1'] },
  { id: 'room-col-3', branchId: 'branch-colombo', name: 'IV Wellness & Recovery Lounge', roomNumber: 'R-103', description: 'IV vitamin therapy, hydration infusions', color: '#ec4899', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-iv-1', 't-iv-2'] },
  { id: 'room-col-4', branchId: 'branch-colombo', name: 'Hair Restoration Clinic', roomNumber: 'R-104', description: 'Hair PRP, scalp micro-pigmentation and care', color: '#f59e0b', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-hair-1', 't-hair-2'] },
  { id: 'room-mar-1', branchId: 'branch-maruthamunai', name: 'Consultation Room A', roomNumber: 'M-201', description: 'General aesthetics and initial assessment', color: '#0d9488', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-hair-1', 't-skin-1'] },
  { id: 'room-mar-2', branchId: 'branch-maruthamunai', name: 'Wellness & Therapy Suite B', roomNumber: 'M-202', description: 'Therapy and wellness infusions', color: '#6366f1', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-iv-1', 't-skin-1'] }
];

const MEMORY_DOCTORS = [
  { id: 'doc-1', fullName: 'Dr. Zeenath', role: 'coordinator', roleTitle: 'Cosmetic Physician', branch: 'Colombo' },
  { id: 'doc-2', fullName: 'Dr. Afrij', role: 'super_admin', roleTitle: 'Senior Dermatologist', branch: 'Colombo' },
  { id: 'doc-3', fullName: 'Dr. Baasith', role: 'leads_officer', roleTitle: 'Clinical Specialist', branch: 'Maruthamunai' }
];

let MEMORY_APPOINTMENTS = [];
let MEMORY_STATUS_HISTORIES = [];
let MEMORY_AVAILABILITY_BLOCKS = [];
let MEMORY_WEEKLY_SCHEDULES = [];
let MEMORY_SCHEDULE_EXCEPTIONS = [];

const MUTATION_ROLES = new Set([
  'super_admin', 'coordinator', 'sales_coordinator', 'leads_officer',
  'exam_department_manager', 'exam_coordinator', 'clinical_nurse', 'clinical_doctor',
  'marketing_officer', 'marketing_admin'
]);

const ACTIVE_STATUSES = new Set([
  'pending', 'booked', 'confirmed', 'arrived', 'paid', 'rescheduled',
  'checked_in', 'in_progress', 'no_answer', 'completed'
]);
const BLOCKING_STATUSES = `('cancelled', 'no_show')`;
const BOOKABLE_INITIAL_STATUSES = new Set(['pending', 'booked', 'confirmed']);

/**
 * Helper to write JSON HTTP response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Parses request JSON body
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > 2 * 1024 * 1024) req.destroy(new Error('Request body too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function httpError(statusCode, message, conflictType) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (conflictType) err.conflictType = conflictType;
  return err;
}

function isSuperAdmin(authUser) {
  return authUser?.role === 'super_admin';
}

function companyScope(authUser) {
  if (!authUser || isSuperAdmin(authUser)) return null;
  const code = String(authUser.company || 'RWC').toUpperCase();
  return code === 'ALL' ? null : code;
}

function canManageAppointments(authUser) {
  return Boolean(authUser && MUTATION_ROLES.has(authUser.role));
}

function denyWrite(res) {
  return sendJson(res, 403, { success: false, error: 'You do not have permission to change appointments.' });
}

function appendCompanyFilter(sql, params, scope, alias = 'b') {
  if (!scope) return sql;
  params.push(scope);
  return `${sql} AND ${alias}.company = $${params.length}`;
}

function timeToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isValidTime(value) {
  return timeToMinutes(value) !== null;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

const colomboFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: COLOMBO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function colomboParts(date) {
  const parts = Object.fromEntries(
    colomboFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const [year, month, day] = dateStr.split('-').map(Number);
  return {
    date: dateStr,
    time: `${hour}:${parts.minute}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function dateRangeForDay(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return null;
  return {
    start: new Date(`${dateStr}T00:00:00+05:30`),
    end: new Date(`${dateStr}T23:59:59.999+05:30`),
  };
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + days);
  return colomboParts(date).date;
}

function enrichedAppointmentSelect() {
  return `
    SELECT
      a.id, a.branch_id AS "branchId", a.room_id AS "roomId",
      a.patient_id AS "patientId", a.lead_id AS "leadId", a.coordinator_id AS "coordinatorId",
      a.doctor_id AS "doctorId", a.treatment_id AS "treatmentId",
      a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.notes,
      a.appointment_type AS "appointmentType", a.cancellation_reason AS "cancellationReason",
      a.created_by_id AS "createdById", a.created_at AS "createdAt", a.updated_at AS "updatedAt",
      uc."fullName" AS "createdByName",
      c."displayName" AS "patientName", c."whatsappNumber" AS "patientPhone", c."avatarUrl" AS "patientAvatar",
      u."fullName" AS "doctorName", u."title" AS "doctorTitle",
      t.name AS "treatmentName", t."durationMinutes" AS "treatmentDuration", t."startingPrice" AS "treatmentPrice",
      r.name AS "roomName", r.room_number AS "roomNumber", r.color AS "roomColor",
      b.name AS "branchName", b.company AS "company",
      l."serialNumber" AS "leadSerialNumber", l.stage AS "leadStage"
    FROM public.appointments a
    LEFT JOIN public.customers c ON a.patient_id = c.id
    LEFT JOIN public.doctors u ON a.doctor_id = u.id
    LEFT JOIN public.users uc ON a.created_by_id = uc.id
    LEFT JOIN public.treatments t ON a.treatment_id = t.id
    LEFT JOIN public.rooms r ON a.room_id = r.id
    LEFT JOIN public.branches b ON a.branch_id = b.id
    LEFT JOIN public.leads l ON a.lead_id = l.id
  `;
}

/**
 * Resolve the patient/lead pair and create a customer when the caller supplied only a phone.
 */
async function resolvePatient(tx, { patientId, leadId, patientName, patientPhone }) {
  let finalPatientId = patientId || null;
  let finalLeadId = leadId || null;

  if (!finalPatientId && finalLeadId) {
    const lead = await tx.$queryRawUnsafe(
      `SELECT "customerId" FROM public.leads WHERE id = $1 LIMIT 1;`,
      finalLeadId
    );
    if (lead?.length) finalPatientId = lead[0].customerId;
  }

  if (!finalPatientId) {
    if (!patientPhone) throw httpError(400, 'Patient ID, lead ID or patient phone number is required');
    const digits = String(patientPhone).replace(/[^0-9]/g, '');
    if (digits.length < 6) throw httpError(400, 'A valid patient phone number is required');
    const existing = await tx.$queryRawUnsafe(
      `SELECT id FROM public.customers
       WHERE "whatsappNumber" LIKE $1 OR "phoneNumber" LIKE $1
       ORDER BY "createdAt" DESC LIMIT 1;`,
      `%${digits.slice(-9)}`
    );
    if (existing?.length) {
      finalPatientId = existing[0].id;
    } else {
      finalPatientId = `cust-${crypto.randomUUID()}`;
      const canonical = digits.startsWith('+') ? digits : `+${digits}`;
      await tx.$executeRawUnsafe(
        `INSERT INTO public.customers (id, "whatsappNumber", "phoneNumber", "displayName", "preferredLanguage", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'en', NOW(), NOW());`,
        finalPatientId,
        canonical,
        patientPhone,
        patientName || `Patient ${digits.slice(-4)}`
      );
    }
  }

  return { patientId: finalPatientId, leadId: finalLeadId };
}

/**
 * Authoritative slot checks. Must run inside a transaction with the doctor row locked.
 */
async function assertSlotAvailable(tx, {
  doctorId, branchId, treatmentId, roomId, start, end, excludeAppointmentId = null, enforceSchedule = true,
}) {
  const doctors = await tx.$queryRawUnsafe(
    `SELECT id, is_active FROM public.doctors WHERE id = $1 FOR UPDATE;`,
    doctorId
  );
  if (!doctors?.length) throw httpError(400, 'Selected doctor was not found');
  if (doctors[0].is_active === false) throw httpError(409, 'Selected doctor is inactive', 'doctor');

  const branches = await tx.$queryRawUnsafe(
    `SELECT id, name, company, is_active FROM public.branches WHERE id = $1;`,
    branchId
  );
  if (!branches?.length) throw httpError(400, 'Selected branch was not found');
  if (branches[0].is_active === false) throw httpError(409, 'Selected branch is inactive', 'branch');

  if (treatmentId) {
    const treatments = await tx.$queryRawUnsafe(
      `SELECT id FROM public.treatments WHERE id = $1 LIMIT 1;`,
      treatmentId
    );
    if (!treatments?.length) throw httpError(400, 'Selected treatment was not found');
  }

  const parts = colomboParts(start);
  const endParts = colomboParts(end);
  if (parts.date !== endParts.date) {
    throw httpError(400, 'Appointments must start and end on the same day');
  }

  if (enforceSchedule) {
    const schedules = await tx.$queryRawUnsafe(
      `SELECT id, start_time AS "startTime", end_time AS "endTime"
       FROM public.doctor_weekly_schedules
       WHERE doctor_id = $1 AND branch_id = $2 AND day_of_week = $3 AND is_active = TRUE
       ORDER BY start_time;`,
      doctorId, branchId, parts.dayOfWeek
    );

    const allSchedules = await tx.$queryRawUnsafe(
      `SELECT id FROM public.doctor_weekly_schedules
       WHERE doctor_id = $1 AND is_active = TRUE LIMIT 1;`,
      doctorId
    );

    // A doctor without any configured roster keeps the legacy branch-hours behaviour.
    // Do not silently invent a schedule; the API reports scheduleConfigured=false.
    if (allSchedules?.length) {
      const withinWindow = (schedules || []).some((row) => {
        const windowStart = timeToMinutes(row.startTime);
        const windowEnd = timeToMinutes(row.endTime);
        return windowStart !== null && windowEnd !== null
          && parts.minutes >= windowStart && endParts.minutes <= windowEnd;
      });
      if (!withinWindow) {
        throw httpError(409, 'Selected time is outside the doctor\u2019s working hours for this branch.', 'schedule');
      }
    }

    const exceptions = await tx.$queryRawUnsafe(
      `SELECT id, exception_type AS "exceptionType", start_time AS "startTime", end_time AS "endTime", reason
       FROM public.doctor_schedule_exceptions
       WHERE doctor_id = $1 AND branch_id = $2
         AND start_date <= $3::date AND end_date >= $3::date;`,
      doctorId, branchId, parts.date
    );
    for (const exception of exceptions || []) {
      if (exception.exceptionType === 'leave' && !exception.startTime) {
        throw httpError(409, `Doctor is on leave${exception.reason ? `: ${exception.reason}` : ''}.`, 'schedule');
      }
      if (exception.startTime && exception.endTime) {
        const blockedStart = timeToMinutes(exception.startTime);
        const blockedEnd = timeToMinutes(exception.endTime);
        if (blockedStart !== null && blockedEnd !== null
          && rangesOverlap(blockedStart, blockedEnd, parts.minutes, endParts.minutes)) {
          throw httpError(409, `Doctor is unavailable during this time${exception.reason ? `: ${exception.reason}` : ''}.`, 'schedule');
        }
      }
    }
  }

  const doctorConflictParams = [doctorId, end, start];
  let doctorConflictSql = `
    SELECT a.id, a.start_time AS "startTime"
    FROM public.appointments a
    WHERE a.doctor_id = $1
      AND a.status NOT IN ${BLOCKING_STATUSES}
      AND a.start_time < $2
      AND a.end_time > $3
  `;
  if (excludeAppointmentId) {
    doctorConflictParams.push(excludeAppointmentId);
    doctorConflictSql += ` AND a.id <> $${doctorConflictParams.length}`;
  }
  doctorConflictSql += ' LIMIT 1;';
  const doctorConflicts = await tx.$queryRawUnsafe(doctorConflictSql, ...doctorConflictParams);
  if (doctorConflicts?.length) {
    throw httpError(409, 'Doctor is already assigned to another appointment during this time.', 'doctor');
  }

  if (roomId) {
    const rooms = await tx.$queryRawUnsafe(
      `SELECT id, branch_id AS "branchId", is_active FROM public.rooms WHERE id = $1 FOR UPDATE;`,
      roomId
    );
    if (!rooms?.length) throw httpError(400, 'Selected room was not found');
    if (rooms[0].branchId !== branchId) throw httpError(400, 'Selected room belongs to another branch');
    if (rooms[0].is_active === false) throw httpError(409, 'Selected room is inactive', 'room');

    const roomConflictParams = [roomId, end, start];
    let roomConflictSql = `
      SELECT a.id
      FROM public.appointments a
      WHERE a.room_id = $1
        AND a.status NOT IN ${BLOCKING_STATUSES}
        AND a.start_time < $2
        AND a.end_time > $3
    `;
    if (excludeAppointmentId) {
      roomConflictParams.push(excludeAppointmentId);
      roomConflictSql += ` AND a.id <> $${roomConflictParams.length}`;
    }
    roomConflictSql += ' LIMIT 1;';
    const roomConflicts = await tx.$queryRawUnsafe(roomConflictSql, ...roomConflictParams);
    if (roomConflicts?.length) {
      throw httpError(409, 'Room is already booked for this time window.', 'room');
    }
  }

  const blockParams = [branchId, doctorId, roomId || null, end, start];
  const blocks = await tx.$queryRawUnsafe(
    `SELECT id, reason
     FROM public.availability_blocks
     WHERE branch_id = $1
       AND (doctor_id = $2 OR (room_id IS NOT NULL AND room_id = $3))
       AND start_time < $4
       AND end_time > $5
     LIMIT 1;`,
    ...blockParams
  );
  if (blocks?.length) {
    throw httpError(409, `Time slot is blocked${blocks[0].reason ? `: ${blocks[0].reason}` : ''}.`, 'block');
  }

  return { branchName: branches[0].name };
}

function memoryScheduleConfigured(doctorId) {
  return MEMORY_WEEKLY_SCHEDULES.some((row) => row.doctorId === doctorId && row.isActive !== false);
}

function assertMemorySlotAvailable({
  doctorId, branchId, roomId, start, end, excludeAppointmentId = null, enforceSchedule = true,
}) {
  if (enforceSchedule && memoryScheduleConfigured(doctorId)) {
    const parts = colomboParts(start);
    const endParts = colomboParts(end);
    const windows = MEMORY_WEEKLY_SCHEDULES.filter((row) =>
      row.doctorId === doctorId && row.branchId === branchId && row.dayOfWeek === parts.dayOfWeek && row.isActive !== false
    );
    const withinWindow = windows.some((row) => {
      const windowStart = timeToMinutes(row.startTime);
      const windowEnd = timeToMinutes(row.endTime);
      return windowStart !== null && windowEnd !== null
        && parts.minutes >= windowStart && endParts.minutes <= windowEnd;
    });
    if (!withinWindow) throw httpError(409, 'Selected time is outside the doctor\u2019s working hours for this branch.', 'schedule');

    for (const exception of MEMORY_SCHEDULE_EXCEPTIONS) {
      if (exception.doctorId !== doctorId || exception.branchId !== branchId) continue;
      if (parts.date < exception.startDate || parts.date > exception.endDate) continue;
      if (exception.exceptionType === 'leave' && !exception.startTime) {
        throw httpError(409, `Doctor is on leave${exception.reason ? `: ${exception.reason}` : ''}.`, 'schedule');
      }
      if (exception.startTime && exception.endTime) {
        const blockedStart = timeToMinutes(exception.startTime);
        const blockedEnd = timeToMinutes(exception.endTime);
        if (blockedStart !== null && blockedEnd !== null
          && rangesOverlap(blockedStart, blockedEnd, parts.minutes, endParts.minutes)) {
          throw httpError(409, `Doctor is unavailable during this time${exception.reason ? `: ${exception.reason}` : ''}.`, 'schedule');
        }
      }
    }
  }

  const doctorConflict = MEMORY_APPOINTMENTS.find((appointment) =>
    appointment.doctorId === doctorId
    && appointment.id !== excludeAppointmentId
    && !['cancelled', 'no_show'].includes(appointment.status)
    && new Date(appointment.startTime) < end
    && new Date(appointment.endTime) > start
  );
  if (doctorConflict) throw httpError(409, 'Doctor is already assigned to another appointment during this time.', 'doctor');

  if (roomId) {
    const room = MEMORY_ROOMS.find((entry) => entry.id === roomId && entry.isActive !== false);
    if (!room) throw httpError(400, 'Selected room was not found');
    if (room.branchId !== branchId) throw httpError(400, 'Selected room belongs to another branch');
    const roomConflict = MEMORY_APPOINTMENTS.find((appointment) =>
      appointment.roomId === roomId
      && appointment.id !== excludeAppointmentId
      && !['cancelled', 'no_show'].includes(appointment.status)
      && new Date(appointment.startTime) < end
      && new Date(appointment.endTime) > start
    );
    if (roomConflict) throw httpError(409, 'Room is already booked for this time window.', 'room');
  }

  const blockConflict = MEMORY_AVAILABILITY_BLOCKS.find((block) =>
    block.branchId === branchId
    && (block.doctorId === doctorId || (block.roomId && block.roomId === roomId))
    && new Date(block.startTime) < end
    && new Date(block.endTime) > start
  );
  if (blockConflict) throw httpError(409, `Time slot is blocked${blockConflict.reason ? `: ${blockConflict.reason}` : ''}.`, 'block');
}

/**
 * Builds one doctor's day view: working windows, exceptions, appointments and 30-minute slots.
 */
function buildDoctorDay({ doctor, branchName, date, schedules, daySchedules, exceptions, appointments, blocks }) {
  const parts = { date };
  const dayMinutes = (() => {
    const parsed = new Date(`${date}T00:00:00+05:30`);
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  })();
  const scheduleConfigured = schedules.length > 0;
  const windows = scheduleConfigured
    ? daySchedules.map((row) => ({ startTime: row.startTime, endTime: row.endTime, source: 'schedule' }))
    : [{ startTime: '08:00', endTime: '20:00', source: 'branch_default' }];

  const slots = [];
  for (let minutes = 8 * 60; minutes < 20 * 60; minutes += 30) {
    const startTime = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const endMinutes = minutes + 30;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const withinWindow = windows.some((window) => {
      const windowStart = timeToMinutes(window.startTime);
      const windowEnd = timeToMinutes(window.endTime);
      return windowStart !== null && windowEnd !== null
        && minutes >= windowStart && endMinutes <= windowEnd;
    });

    let status = withinWindow ? 'available' : 'outside_hours';
    let appointmentId = null;

    for (const exception of exceptions) {
      if (exception.exceptionType === 'leave' && !exception.startTime) {
        status = 'blocked';
        break;
      }
      if (exception.startTime && exception.endTime) {
        const blockedStart = timeToMinutes(exception.startTime);
        const blockedEnd = timeToMinutes(exception.endTime);
        if (blockedStart !== null && blockedEnd !== null && rangesOverlap(blockedStart, blockedEnd, minutes, endMinutes)) {
          status = 'blocked';
          break;
        }
      }
    }

    if (status !== 'blocked') {
      const booked = appointments.find((appointment) => {
        const appointmentStart = colomboParts(new Date(appointment.startTime));
        const appointmentEnd = colomboParts(new Date(appointment.endTime));
        return rangesOverlap(minutes, endMinutes, appointmentStart.minutes, appointmentEnd.minutes);
      });
      if (booked) {
        status = 'booked';
        appointmentId = booked.id;
      }
    }

    if (status === 'available') {
      const block = blocks.find((entry) => {
        const blockStart = colomboParts(new Date(entry.startTime));
        const blockEnd = colomboParts(new Date(entry.endTime));
        return rangesOverlap(minutes, endMinutes, blockStart.minutes, blockEnd.minutes);
      });
      if (block) status = 'blocked';
    }

    slots.push({ startTime, endTime, status, appointmentId });
  }

  return {
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    doctorTitle: doctor.title || null,
    doctorBranch: doctor.branch || null,
    branchName,
    date,
    dayOfWeek: dayMinutes,
    scheduleConfigured,
    workingWindows: windows,
    exceptions,
    appointments,
    slots,
  };
}

/**
 * Main Appointment Route Dispatcher
 * Returns true if the route was handled, false if it should fall through to subsequent handlers
 */
export async function handleAppointmentRoutes(req, res, pathname, authUser) {
  const parsedReqUrl = new URL(req.url || '/', 'http://localhost');
  const query = Object.fromEntries(parsedReqUrl.searchParams.entries());
  const prisma = getPrisma();
  const dbOk = getDbStatus() && !!prisma;
  const scope = companyScope(authUser);

  // ---------------------------------------------------------------------------
  // 1. GET /api/branches
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/branches') {
    if (dbOk) {
      try {
        const branches = scope
          ? await prisma.$queryRawUnsafe(`
              SELECT id, company, name, code, address, phone, is_active AS "isActive",
                     created_at AS "createdAt"
              FROM public.branches
              WHERE is_active = TRUE AND company = $1
              ORDER BY name ASC;
            `, scope)
          : await prisma.$queryRawUnsafe(`
              SELECT id, company, name, code, address, phone, is_active AS "isActive",
                     created_at AS "createdAt"
              FROM public.branches
              WHERE is_active = TRUE
              ORDER BY name ASC;
            `);
        return sendJson(res, 200, branches);
      } catch (e) {
        console.warn('DB query branches fallback to memory:', e.message);
      }
    }
    const memory = MEMORY_BRANCHES.filter(b => b.isActive);
    return sendJson(res, 200, scope ? memory.filter(b => b.company === scope) : memory);
  }

  // ---------------------------------------------------------------------------
  // 2. GET /api/rooms?branchId=...
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/rooms') {
    const branchId = query.branchId;
    if (dbOk) {
      try {
        const roomsQuery = branchId
          ? `SELECT r.id, r.branch_id AS "branchId", r.name, r.room_number AS "roomNumber", r.description, r.color,
                    r.operating_start AS "operatingStart", r.operating_end AS "operatingEnd", r.is_active AS "isActive"
             FROM public.rooms r
             JOIN public.branches b ON r.branch_id = b.id
             WHERE r.branch_id = $1 AND r.is_active = TRUE ${scope ? 'AND b.company = $2' : ''}
             ORDER BY r.room_number ASC;`
          : `SELECT r.id, r.branch_id AS "branchId", r.name, r.room_number AS "roomNumber", r.description, r.color,
                    r.operating_start AS "operatingStart", r.operating_end AS "operatingEnd", r.is_active AS "isActive"
             FROM public.rooms r
             JOIN public.branches b ON r.branch_id = b.id
             WHERE r.is_active = TRUE ${scope ? 'AND b.company = $1' : ''}
             ORDER BY r.branch_id, r.room_number ASC;`;

        const rooms = branchId
          ? await prisma.$queryRawUnsafe(roomsQuery, ...(scope ? [branchId, scope] : [branchId]))
          : await prisma.$queryRawUnsafe(roomsQuery, ...(scope ? [scope] : []));

        const treatments = await prisma.$queryRawUnsafe(`
          SELECT rt.room_id AS "roomId", rt.treatment_id AS "treatmentId", t.name AS "treatmentName"
          FROM public.room_treatments rt
          LEFT JOIN public.treatments t ON rt.treatment_id = t.id;
        `).catch(() => []);

        const enriched = rooms.map(r => {
          const matched = treatments.filter(t => t.roomId === r.id);
          return {
            ...r,
            treatmentIds: matched.map(m => m.treatmentId),
            treatments: matched.map(m => ({ id: m.treatmentId, name: m.treatmentName }))
          };
        });

        return sendJson(res, 200, enriched);
      } catch (e) {
        console.warn('DB query rooms fallback to memory:', e.message);
      }
    }

    let filtered = branchId ? MEMORY_ROOMS.filter(r => r.branchId === branchId && r.isActive) : MEMORY_ROOMS.filter(r => r.isActive);
    if (scope) {
      const branchIds = new Set(MEMORY_BRANCHES.filter((branch) => branch.company === scope).map((branch) => branch.id));
      filtered = filtered.filter((room) => branchIds.has(room.branchId));
    }
    return sendJson(res, 200, filtered);
  }

  // ---------------------------------------------------------------------------
  // 3. POST /api/rooms
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/rooms') {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    try {
      const payload = await parseJsonBody(req);
      const name = String(payload.name || '').trim();
      const roomNumber = String(payload.roomNumber || '').trim();
      const branchId = String(payload.branchId || '').trim();
      const color = payload.color || '#0d9488';
      const description = payload.description || '';
      const operatingStart = payload.operatingStart || '08:00';
      const operatingEnd = payload.operatingEnd || '20:00';
      const treatmentIds = Array.isArray(payload.treatmentIds) ? payload.treatmentIds : [];

      if (!name || !roomNumber || !branchId) {
        return sendJson(res, 400, { success: false, error: 'Room name, room number, and branch are required' });
      }

      const newId = `room-${crypto.randomUUID()}`;

      if (dbOk) {
        try {
          if (scope) {
            const branches = await prisma.$queryRawUnsafe(`SELECT company FROM public.branches WHERE id = $1;`, branchId);
            if (!branches?.length || branches[0].company !== scope) {
              return sendJson(res, 403, { success: false, error: 'Branch is outside your company scope' });
            }
          }
          await prisma.$executeRawUnsafe(`
            INSERT INTO public.rooms (id, branch_id, name, room_number, description, color, operating_start, operating_end, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE);
          `, newId, branchId, name, roomNumber, description, color, operatingStart, operatingEnd);

          for (const tId of treatmentIds) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO public.room_treatments (room_id, treatment_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING;
            `, newId, tId).catch(() => null);
          }

          const created = { id: newId, branchId, name, roomNumber, description, color, operatingStart, operatingEnd, isActive: true, treatmentIds };
          return sendJson(res, 201, { success: true, room: created });
        } catch (e) {
          console.warn('DB create room fallback:', e.message);
        }
      }

      const memoryRoom = { id: newId, branchId, name, roomNumber, description, color, operatingStart, operatingEnd, isActive: true, treatmentIds };
      MEMORY_ROOMS.push(memoryRoom);
      return sendJson(res, 201, { success: true, room: memoryRoom });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. PATCH /api/rooms/:id
  // ---------------------------------------------------------------------------
  if (req.method === 'PATCH' && pathname.startsWith('/api/rooms/')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const roomId = pathname.split('/')[3];
    if (!roomId) return sendJson(res, 400, { success: false, error: 'Room ID required' });

    try {
      const payload = await parseJsonBody(req);
      const name = payload.name;
      const roomNumber = payload.roomNumber;
      const color = payload.color;
      const description = payload.description;
      const operatingStart = payload.operatingStart;
      const operatingEnd = payload.operatingEnd;
      const treatmentIds = payload.treatmentIds;

      if (dbOk) {
        try {
          await prisma.$executeRawUnsafe(`
            UPDATE public.rooms
            SET name = COALESCE($1, name),
                room_number = COALESCE($2, room_number),
                color = COALESCE($3, color),
                description = COALESCE($4, description),
                operating_start = COALESCE($5, operating_start),
                operating_end = COALESCE($6, operating_end),
                updated_at = NOW()
            WHERE id = $7;
          `, name ?? null, roomNumber ?? null, color ?? null, description ?? null, operatingStart ?? null, operatingEnd ?? null, roomId);

          if (Array.isArray(treatmentIds)) {
            await prisma.$executeRawUnsafe(`DELETE FROM public.room_treatments WHERE room_id = $1;`, roomId);
            for (const tId of treatmentIds) {
              await prisma.$executeRawUnsafe(`
                INSERT INTO public.room_treatments (room_id, treatment_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING;
              `, roomId, tId).catch(() => null);
            }
          }

          return sendJson(res, 200, { success: true, message: 'Room updated successfully' });
        } catch (e) {
          console.warn('DB update room fallback:', e.message);
        }
      }

      const idx = MEMORY_ROOMS.findIndex(r => r.id === roomId);
      if (idx !== -1) {
        MEMORY_ROOMS[idx] = { ...MEMORY_ROOMS[idx], ...payload };
        return sendJson(res, 200, { success: true, room: MEMORY_ROOMS[idx] });
      }
      return sendJson(res, 404, { success: false, error: 'Room not found' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. DELETE /api/rooms/:id (Safe deactivation with future booking check)
  // ---------------------------------------------------------------------------
  if (req.method === 'DELETE' && pathname.startsWith('/api/rooms/')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const roomId = pathname.split('/')[3];
    if (!roomId) return sendJson(res, 400, { success: false, error: 'Room ID required' });

    const now = new Date();
    if (dbOk) {
      try {
        const futureAppointments = await prisma.$queryRawUnsafe(`
          SELECT a.id, a.start_time AS "startTime", a.end_time AS "endTime", a.status,
                 c."displayName" AS "patientName"
          FROM public.appointments a
          LEFT JOIN public.customers c ON a.patient_id = c.id
          WHERE a.room_id = $1
            AND a.start_time > $2
            AND a.status NOT IN ('cancelled', 'no_show')
          ORDER BY a.start_time ASC
          LIMIT 5;
        `, roomId, now);

        if (futureAppointments && futureAppointments.length > 0) {
          return sendJson(res, 400, {
            success: false,
            error: `Cannot deactivate room: There are ${futureAppointments.length} upcoming active appointment(s) booked in this room. Please reschedule or cancel them first.`,
            futureAppointments
          });
        }

        await prisma.$executeRawUnsafe(`
          UPDATE public.rooms SET is_active = FALSE, updated_at = NOW() WHERE id = $1;
        `, roomId);

        return sendJson(res, 200, { success: true, message: 'Room deactivated safely.' });
      } catch (e) {
        console.warn('DB safe delete room fallback:', e.message);
      }
    }

    const futureMem = MEMORY_APPOINTMENTS.filter(a => a.roomId === roomId && new Date(a.startTime) > now && !['cancelled', 'no_show'].includes(a.status));
    if (futureMem.length > 0) {
      return sendJson(res, 400, {
        success: false,
        error: `Cannot deactivate room: There are ${futureMem.length} upcoming active appointment(s) booked in this room.`,
        futureAppointments: futureMem
      });
    }

    const idx = MEMORY_ROOMS.findIndex(r => r.id === roomId);
    if (idx !== -1) {
      MEMORY_ROOMS[idx].isActive = false;
      return sendJson(res, 200, { success: true, message: 'Room deactivated safely.' });
    }
    return sendJson(res, 404, { success: false, error: 'Room not found' });
  }

  // ---------------------------------------------------------------------------
  // 6. GET /api/appointments/stats
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/appointments/stats') {
    const { branchId, date, startDate, endDate } = query;
    const dayRange = date ? dateRangeForDay(date) : null;
    const rangeStart = dayRange?.start || (startDate ? new Date(`${startDate}T00:00:00+05:30`) : null);
    const rangeEnd = dayRange?.end || (endDate ? new Date(`${endDate}T23:59:59.999+05:30`) : null);

    if (dbOk) {
      try {
        const params = [];
        let sql = `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE a.status IN ('booked', 'confirmed'))::int AS confirmed,
            COUNT(*) FILTER (WHERE a.status = 'rescheduled')::int AS rescheduled,
            COUNT(*) FILTER (WHERE a.status = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE a.status IN ('completed', 'paid'))::int AS completed,
            COUNT(*) FILTER (WHERE a.status IN ('no_show', 'no_answer'))::int AS "noShow",
            COUNT(*) FILTER (WHERE a.status NOT IN ('cancelled', 'no_show', 'completed', 'paid'))::int AS active
          FROM public.appointments a
          LEFT JOIN public.branches b ON a.branch_id = b.id
          WHERE 1=1
        `;
        if (branchId) {
          params.push(branchId);
          sql += ` AND a.branch_id = $${params.length}`;
        }
        if (rangeStart && rangeEnd) {
          params.push(rangeStart);
          sql += ` AND a.start_time >= $${params.length}`;
          params.push(rangeEnd);
          sql += ` AND a.start_time <= $${params.length}`;
        }
        sql = appendCompanyFilter(sql, params, scope, 'b');
        const rows = await prisma.$queryRawUnsafe(sql, ...params);
        const row = rows?.[0] || {};
        return sendJson(res, 200, {
          total: row.total || 0,
          pending: row.pending || 0,
          confirmed: row.confirmed || 0,
          rescheduled: row.rescheduled || 0,
          cancelled: row.cancelled || 0,
          completed: row.completed || 0,
          noShow: row.noShow || 0,
          active: row.active || 0,
          cancellationRate: row.total ? Math.round(((row.cancelled || 0) / row.total) * 100) : 0,
        });
      } catch (e) {
        console.warn('DB appointment stats fallback:', e.message);
      }
    }

    let memory = MEMORY_APPOINTMENTS;
    if (branchId) memory = memory.filter((appointment) => appointment.branchId === branchId);
    if (rangeStart && rangeEnd) {
      memory = memory.filter((appointment) => {
        const start = new Date(appointment.startTime);
        return start >= rangeStart && start <= rangeEnd;
      });
    }
    const count = (predicate) => memory.filter(predicate).length;
    const total = memory.length;
    const cancelled = count((appointment) => appointment.status === 'cancelled');
    return sendJson(res, 200, {
      total,
      pending: count((appointment) => appointment.status === 'pending'),
      confirmed: count((appointment) => ['booked', 'confirmed'].includes(appointment.status)),
      rescheduled: count((appointment) => appointment.status === 'rescheduled'),
      cancelled,
      completed: count((appointment) => ['completed', 'paid'].includes(appointment.status)),
      noShow: count((appointment) => ['no_show', 'no_answer'].includes(appointment.status)),
      active: count((appointment) => !['cancelled', 'no_show', 'completed', 'paid'].includes(appointment.status)),
      cancellationRate: total ? Math.round((cancelled / total) * 100) : 0,
    });
  }

  // ---------------------------------------------------------------------------
  // 7. GET /api/appointments (filters: branch, date/range, doctor, status, lead, search)
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/appointments') {
    const { branchId, date: dateStr, startDate: startDateStr, endDate: endDateStr, patientId, leadId, doctorId, status, q } = query;
    const dayRange = dateStr ? dateRangeForDay(dateStr) : null;
    const rangeStart = dayRange?.start || (startDateStr ? new Date(`${startDateStr}T00:00:00+05:30`) : null);
    const rangeEnd = dayRange?.end || (endDateStr ? new Date(`${endDateStr}T23:59:59.999+05:30`) : null);
    const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 2000);

    if (dbOk) {
      try {
        const params = [];
        let sql = `${enrichedAppointmentSelect()} WHERE 1=1`;
        if (branchId) {
          params.push(branchId);
          sql += ` AND a.branch_id = $${params.length}`;
        }
        if (patientId) {
          params.push(patientId);
          sql += ` AND a.patient_id = $${params.length}`;
        }
        if (leadId) {
          params.push(leadId);
          sql += ` AND a.lead_id = $${params.length}`;
        }
        if (doctorId) {
          params.push(doctorId);
          sql += ` AND a.doctor_id = $${params.length}`;
        }
        if (status) {
          params.push(status);
          sql += ` AND a.status = $${params.length}`;
        }
        if (rangeStart && rangeEnd) {
          params.push(rangeStart);
          sql += ` AND a.end_time >= $${params.length}`;
          params.push(rangeEnd);
          sql += ` AND a.start_time <= $${params.length}`;
        }
        if (q) {
          params.push(`%${String(q).trim()}%`);
          sql += ` AND (c."displayName" ILIKE $${params.length} OR c."whatsappNumber" ILIKE $${params.length} OR l."serialNumber" ILIKE $${params.length})`;
        }
        sql = appendCompanyFilter(sql, params, scope, 'b');
        params.push(limit);
        sql += ` ORDER BY a.start_time ASC LIMIT $${params.length};`;

        const rows = await prisma.$queryRawUnsafe(sql, ...params);
        return sendJson(res, 200, rows);
      } catch (e) {
        console.warn('DB query appointments fallback:', e.message);
      }
    }

    let results = MEMORY_APPOINTMENTS;
    if (branchId) results = results.filter(a => a.branchId === branchId);
    if (patientId) results = results.filter(a => a.patientId === patientId);
    if (leadId) results = results.filter(a => a.leadId === leadId);
    if (doctorId) results = results.filter(a => a.doctorId === doctorId);
    if (status) results = results.filter(a => a.status === status);
    if (rangeStart && rangeEnd) {
      results = results.filter(a => {
        const s = new Date(a.startTime);
        const e = new Date(a.endTime);
        return e >= rangeStart && s <= rangeEnd;
      });
    }
    if (q) {
      const needle = String(q).toLowerCase();
      results = results.filter((appointment) =>
        String(appointment.patientName || '').toLowerCase().includes(needle)
        || String(appointment.patientPhone || '').includes(needle)
        || String(appointment.leadSerialNumber || '').toLowerCase().includes(needle)
      );
    }
    return sendJson(res, 200, results.slice(0, limit));
  }

  // ---------------------------------------------------------------------------
  // 8. GET /api/doctor-availability?branchId=...&date=YYYY-MM-DD
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/doctor-availability') {
    const branchId = query.branchId;
    const dateStr = query.date;
    const dayRange = dateRangeForDay(dateStr);
    if (!branchId || !dayRange) {
      return sendJson(res, 400, { success: false, error: 'branchId and date (YYYY-MM-DD) are required' });
    }

    const parts = colomboParts(dayRange.start);

    if (dbOk) {
      try {
        const branchRows = await prisma.$queryRawUnsafe(
          `SELECT id, name, company FROM public.branches WHERE id = $1;`,
          branchId
        );
        if (!branchRows?.length) return sendJson(res, 404, { success: false, error: 'Branch not found' });
        if (scope && branchRows[0].company !== scope) {
          return sendJson(res, 403, { success: false, error: 'Branch is outside your company scope' });
        }

        const [doctorRows, scheduleRows, exceptionRows, appointmentRows, blockRows] = await Promise.all([
          prisma.$queryRawUnsafe(`
            SELECT id, full_name AS "fullName", title, branch, phone, avatar
            FROM public.doctors WHERE is_active = TRUE ORDER BY full_name ASC;
          `),
          prisma.$queryRawUnsafe(`
            SELECT id, doctor_id AS "doctorId", branch_id AS "branchId", day_of_week AS "dayOfWeek",
                   start_time AS "startTime", end_time AS "endTime", is_active AS "isActive"
            FROM public.doctor_weekly_schedules
            WHERE is_active = TRUE ORDER BY start_time ASC;
          `),
          prisma.$queryRawUnsafe(`
            SELECT id, doctor_id AS "doctorId", branch_id AS "branchId", exception_type AS "exceptionType",
                   start_date AS "startDate", end_date AS "endDate", start_time AS "startTime",
                   end_time AS "endTime", reason
            FROM public.doctor_schedule_exceptions
            WHERE start_date <= $1::date AND end_date >= $1::date
            ORDER BY start_time NULLS FIRST;
          `, parts.date),
          prisma.$queryRawUnsafe(`
            SELECT ${enrichedAppointmentSelect().replace('FROM public.appointments a', 'FROM public.appointments a')}
            WHERE a.branch_id = $1
              AND a.status NOT IN ${BLOCKING_STATUSES}
              AND a.start_time < $2 AND a.end_time > $3
            ORDER BY a.start_time ASC;
          `, branchId, dayRange.end, dayRange.start),
          prisma.$queryRawUnsafe(`
            SELECT id, branch_id AS "branchId", room_id AS "roomId", doctor_id AS "doctorId",
                   start_time AS "startTime", end_time AS "endTime", reason
            FROM public.availability_blocks
            WHERE branch_id = $1 AND start_time < $2 AND end_time > $3;
          `, branchId, dayRange.end, dayRange.start),
        ]);

        const branchName = branchRows[0].name;
        const doctors = (doctorRows || [])
          .filter((doctor) => {
            const schedules = (scheduleRows || []).filter((row) => row.doctorId === doctor.id);
            if (!schedules.length) {
              // Legacy doctors without a roster are still shown for their text branch.
              return !doctor.branch || doctor.branch.toLowerCase().includes(branchName.toLowerCase());
            }
            return schedules.some((row) => row.branchId === branchId);
          })
          .map((doctor) => {
            const schedules = (scheduleRows || []).filter((row) => row.doctorId === doctor.id);
            const daySchedules = schedules.filter((row) => row.branchId === branchId && row.dayOfWeek === parts.dayOfWeek);
            const exceptions = (exceptionRows || []).filter((row) => row.doctorId === doctor.id && row.branchId === branchId);
            const appointments = (appointmentRows || []).filter((row) => row.doctorId === doctor.id);
            const blocks = (blockRows || []).filter((row) => row.doctorId === doctor.id);
            return buildDoctorDay({
              doctor, branchName, date: parts.date, schedules, daySchedules, exceptions, appointments, blocks,
            });
          });

        return sendJson(res, 200, { branchId, branchName, date: parts.date, doctors });
      } catch (e) {
        console.warn('DB doctor availability fallback:', e.message);
      }
    }

    const branch = MEMORY_BRANCHES.find((row) => row.id === branchId);
    if (!branch) return sendJson(res, 404, { success: false, error: 'Branch not found' });
    const doctors = MEMORY_DOCTORS.map((doctor) => {
      const schedules = MEMORY_WEEKLY_SCHEDULES.filter((row) => row.doctorId === doctor.id);
      const daySchedules = schedules.filter((row) => row.branchId === branchId && row.dayOfWeek === parts.dayOfWeek);
      const exceptions = MEMORY_SCHEDULE_EXCEPTIONS.filter((row) => row.doctorId === doctor.id && row.branchId === branchId
        && parts.date >= row.startDate && parts.date <= row.endDate);
      const appointments = MEMORY_APPOINTMENTS.filter((row) => row.doctorId === doctor.id && row.branchId === branchId
        && !['cancelled', 'no_show'].includes(row.status)
        && new Date(row.startTime) < dayRange.end && new Date(row.endTime) > dayRange.start);
      const blocks = MEMORY_AVAILABILITY_BLOCKS.filter((row) => row.doctorId === doctor.id && row.branchId === branchId
        && new Date(row.startTime) < dayRange.end && new Date(row.endTime) > dayRange.start);
      return buildDoctorDay({
        doctor: { ...doctor, title: doctor.roleTitle }, branchName: branch.name, date: parts.date,
        schedules, daySchedules, exceptions, appointments, blocks,
      });
    });
    return sendJson(res, 200, { branchId, branchName: branch.name, date: parts.date, doctors });
  }

  // ---------------------------------------------------------------------------
  // 9. GET /api/doctors/:id/schedule?branchId=...
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && /^\/api\/doctors\/[^/]+\/schedule$/.test(pathname)) {
    const doctorId = pathname.split('/')[3];
    const branchId = query.branchId;

    if (dbOk) {
      try {
        const doctors = await prisma.$queryRawUnsafe(
          `SELECT id, full_name AS "fullName", title, branch, phone, avatar, is_active AS "isActive"
           FROM public.doctors WHERE id = $1;`,
          doctorId
        );
        if (!doctors?.length) return sendJson(res, 404, { success: false, error: 'Doctor not found' });

        const weeklySchedules = await prisma.$queryRawUnsafe(
          `SELECT id, doctor_id AS "doctorId", branch_id AS "branchId", day_of_week AS "dayOfWeek",
                  start_time AS "startTime", end_time AS "endTime", is_active AS "isActive"
           FROM public.doctor_weekly_schedules
           WHERE doctor_id = $1 ${branchId ? 'AND branch_id = $2' : ''}
           ORDER BY day_of_week ASC, start_time ASC;`,
          ...(branchId ? [doctorId, branchId] : [doctorId])
        );

        const exceptions = await prisma.$queryRawUnsafe(
          `SELECT e.id, e.doctor_id AS "doctorId", e.branch_id AS "branchId", e.exception_type AS "exceptionType",
                  e.start_date AS "startDate", e.end_date AS "endDate", e.start_time AS "startTime",
                  e.end_time AS "endTime", e.reason
           FROM public.doctor_schedule_exceptions e
           WHERE e.doctor_id = $1 ${branchId ? 'AND e.branch_id = $2' : ''}
           ORDER BY e.start_date DESC;`,
          ...(branchId ? [doctorId, branchId] : [doctorId])
        );

        return sendJson(res, 200, {
          doctor: doctors[0],
          weeklySchedules,
          exceptions,
          branchIds: [...new Set(weeklySchedules.map((row) => row.branchId))],
        });
      } catch (e) {
        console.warn('DB doctor schedule fallback:', e.message);
      }
    }

    const doctor = MEMORY_DOCTORS.find((row) => row.id === doctorId);
    if (!doctor) return sendJson(res, 404, { success: false, error: 'Doctor not found' });
    const weeklySchedules = MEMORY_WEEKLY_SCHEDULES.filter((row) => row.doctorId === doctorId && (!branchId || row.branchId === branchId));
    const exceptions = MEMORY_SCHEDULE_EXCEPTIONS.filter((row) => row.doctorId === doctorId && (!branchId || row.branchId === branchId));
    return sendJson(res, 200, {
      doctor,
      weeklySchedules,
      exceptions,
      branchIds: [...new Set(weeklySchedules.map((row) => row.branchId))],
    });
  }

  // ---------------------------------------------------------------------------
  // 10. GET /api/doctor-schedules?branchId=&doctorId=
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/doctor-schedules') {
    const { branchId, doctorId } = query;
    if (dbOk) {
      try {
        const params = [];
        let sql = `
          SELECT ws.id, ws.doctor_id AS "doctorId", ws.branch_id AS "branchId",
                 ws.day_of_week AS "dayOfWeek", ws.start_time AS "startTime", ws.end_time AS "endTime",
                 ws.is_active AS "isActive", d.full_name AS "doctorName", d.title AS "doctorTitle",
                 b.name AS "branchName"
          FROM public.doctor_weekly_schedules ws
          LEFT JOIN public.doctors d ON ws.doctor_id = d.id
          LEFT JOIN public.branches b ON ws.branch_id = b.id
          WHERE 1=1
        `;
        if (branchId) {
          params.push(branchId);
          sql += ` AND ws.branch_id = $${params.length}`;
        }
        if (doctorId) {
          params.push(doctorId);
          sql += ` AND ws.doctor_id = $${params.length}`;
        }
        sql = appendCompanyFilter(sql, params, scope, 'b');
        sql += ' ORDER BY d.full_name ASC, ws.day_of_week ASC, ws.start_time ASC;';
        return sendJson(res, 200, await prisma.$queryRawUnsafe(sql, ...params));
      } catch (e) {
        console.warn('DB doctor schedules fallback:', e.message);
      }
    }
    let rows = MEMORY_WEEKLY_SCHEDULES;
    if (branchId) rows = rows.filter((row) => row.branchId === branchId);
    if (doctorId) rows = rows.filter((row) => row.doctorId === doctorId);
    return sendJson(res, 200, rows);
  }

  // ---------------------------------------------------------------------------
  // 11. POST /api/doctor-schedules
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/doctor-schedules') {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    try {
      const payload = await parseJsonBody(req);
      const doctorId = String(payload.doctorId || '').trim();
      const branchId = String(payload.branchId || '').trim();
      const dayOfWeek = Number(payload.dayOfWeek);
      const startTime = payload.startTime;
      const endTime = payload.endTime;
      if (!doctorId || !branchId) return sendJson(res, 400, { success: false, error: 'doctorId and branchId are required' });
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return sendJson(res, 400, { success: false, error: 'dayOfWeek must be 0 (Sunday) to 6 (Saturday)' });
      }
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        return sendJson(res, 400, { success: false, error: 'startTime and endTime must be valid HH:mm values with start before end' });
      }

      const id = `dws-${crypto.randomUUID()}`;
      if (dbOk) {
        try {
          const doctors = await prisma.$queryRawUnsafe(`SELECT id, is_active FROM public.doctors WHERE id = $1;`, doctorId);
          if (!doctors?.length) return sendJson(res, 404, { success: false, error: 'Doctor not found' });
          const branches = await prisma.$queryRawUnsafe(`SELECT id, company FROM public.branches WHERE id = $1;`, branchId);
          if (!branches?.length) return sendJson(res, 404, { success: false, error: 'Branch not found' });
          if (scope && branches[0].company !== scope) {
            return sendJson(res, 403, { success: false, error: 'Branch is outside your company scope' });
          }

          const existing = await prisma.$queryRawUnsafe(
            `SELECT id, start_time AS "startTime", end_time AS "endTime"
             FROM public.doctor_weekly_schedules
             WHERE doctor_id = $1 AND branch_id = $2 AND day_of_week = $3 AND is_active = TRUE;`,
            doctorId, branchId, dayOfWeek
          );
          if ((existing || []).some((row) => rangesOverlap(startMinutes, endMinutes, timeToMinutes(row.startTime), timeToMinutes(row.endTime)))) {
            return sendJson(res, 409, { success: false, error: 'This working window overlaps an existing schedule for the doctor.' });
          }

          await prisma.$executeRawUnsafe(
            `INSERT INTO public.doctor_weekly_schedules
             (id, doctor_id, branch_id, day_of_week, start_time, end_time, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW());`,
            id, doctorId, branchId, dayOfWeek, startTime, endTime, payload.isActive !== false
          );
          return sendJson(res, 201, {
            success: true,
            schedule: { id, doctorId, branchId, dayOfWeek, startTime, endTime, isActive: payload.isActive !== false },
          });
        } catch (e) {
          console.warn('DB create doctor schedule fallback:', e.message);
        }
      }

      const overlap = MEMORY_WEEKLY_SCHEDULES.some((row) =>
        row.doctorId === doctorId && row.branchId === branchId && row.dayOfWeek === dayOfWeek
        && row.isActive !== false
        && rangesOverlap(startMinutes, endMinutes, timeToMinutes(row.startTime), timeToMinutes(row.endTime))
      );
      if (overlap) return sendJson(res, 409, { success: false, error: 'This working window overlaps an existing schedule for the doctor.' });
      const schedule = { id, doctorId, branchId, dayOfWeek, startTime, endTime, isActive: payload.isActive !== false };
      MEMORY_WEEKLY_SCHEDULES.push(schedule);
      return sendJson(res, 201, { success: true, schedule });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 12. PATCH /api/doctor-schedules/:id
  // ---------------------------------------------------------------------------
  if (req.method === 'PATCH' && pathname.startsWith('/api/doctor-schedules/')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const scheduleId = pathname.split('/')[3];
    try {
      const payload = await parseJsonBody(req);
      if (dbOk) {
        try {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT id, doctor_id AS "doctorId", branch_id AS "branchId", day_of_week AS "dayOfWeek",
                    start_time AS "startTime", end_time AS "endTime", is_active AS "isActive"
             FROM public.doctor_weekly_schedules WHERE id = $1;`,
            scheduleId
          );
          if (!rows?.length) return sendJson(res, 404, { success: false, error: 'Schedule not found' });
          const current = rows[0];
          const next = {
            startTime: payload.startTime ?? current.startTime,
            endTime: payload.endTime ?? current.endTime,
            dayOfWeek: payload.dayOfWeek ?? current.dayOfWeek,
            isActive: payload.isActive ?? current.isActive,
          };
          const startMinutes = timeToMinutes(next.startTime);
          const endMinutes = timeToMinutes(next.endTime);
          if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
            return sendJson(res, 400, { success: false, error: 'startTime and endTime must be valid HH:mm values with start before end' });
          }
          if (next.isActive) {
            const others = await prisma.$queryRawUnsafe(
              `SELECT id, start_time AS "startTime", end_time AS "endTime"
               FROM public.doctor_weekly_schedules
               WHERE doctor_id = $1 AND branch_id = $2 AND day_of_week = $3 AND is_active = TRUE AND id <> $4;`,
              current.doctorId, current.branchId, next.dayOfWeek, scheduleId
            );
            if ((others || []).some((row) => rangesOverlap(startMinutes, endMinutes, timeToMinutes(row.startTime), timeToMinutes(row.endTime)))) {
              return sendJson(res, 409, { success: false, error: 'This working window overlaps an existing schedule for the doctor.' });
            }
          }
          await prisma.$executeRawUnsafe(
            `UPDATE public.doctor_weekly_schedules
             SET day_of_week = $1, start_time = $2, end_time = $3, is_active = $4, updated_at = NOW()
             WHERE id = $5;`,
            next.dayOfWeek, next.startTime, next.endTime, next.isActive, scheduleId
          );
          return sendJson(res, 200, { success: true, schedule: { ...current, ...next } });
        } catch (e) {
          console.warn('DB update doctor schedule fallback:', e.message);
        }
      }

      const index = MEMORY_WEEKLY_SCHEDULES.findIndex((row) => row.id === scheduleId);
      if (index === -1) return sendJson(res, 404, { success: false, error: 'Schedule not found' });
      MEMORY_WEEKLY_SCHEDULES[index] = { ...MEMORY_WEEKLY_SCHEDULES[index], ...payload };
      return sendJson(res, 200, { success: true, schedule: MEMORY_WEEKLY_SCHEDULES[index] });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 13. DELETE /api/doctor-schedules/:id
  // ---------------------------------------------------------------------------
  if (req.method === 'DELETE' && pathname.startsWith('/api/doctor-schedules/')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const scheduleId = pathname.split('/')[3];
    if (dbOk) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.doctor_weekly_schedules WHERE id = $1;`, scheduleId).catch(() => null);
      return sendJson(res, 200, { success: true });
    }
    MEMORY_WEEKLY_SCHEDULES = MEMORY_WEEKLY_SCHEDULES.filter((row) => row.id !== scheduleId);
    return sendJson(res, 200, { success: true });
  }

  // ---------------------------------------------------------------------------
  // 14. GET /api/doctor-schedule-exceptions?branchId=&doctorId=&from=&to=
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/doctor-schedule-exceptions') {
    const { branchId, doctorId, from, to } = query;
    if (dbOk) {
      try {
        const params = [];
        let sql = `
          SELECT e.id, e.doctor_id AS "doctorId", e.branch_id AS "branchId",
                 e.exception_type AS "exceptionType", e.start_date AS "startDate", e.end_date AS "endDate",
                 e.start_time AS "startTime", e.end_time AS "endTime", e.reason,
                 d.full_name AS "doctorName", b.name AS "branchName"
          FROM public.doctor_schedule_exceptions e
          LEFT JOIN public.doctors d ON e.doctor_id = d.id
          LEFT JOIN public.branches b ON e.branch_id = b.id
          WHERE 1=1
        `;
        if (branchId) {
          params.push(branchId);
          sql += ` AND e.branch_id = $${params.length}`;
        }
        if (doctorId) {
          params.push(doctorId);
          sql += ` AND e.doctor_id = $${params.length}`;
        }
        if (from) {
          params.push(from);
          sql += ` AND e.end_date >= $${params.length}::date`;
        }
        if (to) {
          params.push(to);
          sql += ` AND e.start_date <= $${params.length}::date`;
        }
        sql = appendCompanyFilter(sql, params, scope, 'b');
        sql += ' ORDER BY e.start_date ASC, e.start_time ASC NULLS FIRST;';
        return sendJson(res, 200, await prisma.$queryRawUnsafe(sql, ...params));
      } catch (e) {
        console.warn('DB doctor exceptions fallback:', e.message);
      }
    }
    let rows = MEMORY_SCHEDULE_EXCEPTIONS;
    if (branchId) rows = rows.filter((row) => row.branchId === branchId);
    if (doctorId) rows = rows.filter((row) => row.doctorId === doctorId);
    return sendJson(res, 200, rows);
  }

  // ---------------------------------------------------------------------------
  // 15. POST /api/doctor-schedule-exceptions
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/doctor-schedule-exceptions') {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    try {
      const payload = await parseJsonBody(req);
      const doctorId = String(payload.doctorId || '').trim();
      const branchId = String(payload.branchId || '').trim();
      const exceptionType = ['leave', 'break', 'unavailable'].includes(payload.exceptionType) ? payload.exceptionType : 'leave';
      const startDate = String(payload.startDate || '').slice(0, 10);
      const endDate = String(payload.endDate || startDate).slice(0, 10);
      const startTime = payload.startTime || null;
      const endTime = payload.endTime || null;
      const reason = payload.reason ? String(payload.reason).slice(0, 255) : null;

      if (!doctorId || !branchId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return sendJson(res, 400, { success: false, error: 'doctorId, branchId, startDate and endDate are required' });
      }
      if (endDate < startDate) return sendJson(res, 400, { success: false, error: 'endDate must be on or after startDate' });
      if ((startTime && !endTime) || (!startTime && endTime)) {
        return sendJson(res, 400, { success: false, error: 'Provide both startTime and endTime, or neither for a full day' });
      }
      if (startTime && endTime && timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        return sendJson(res, 400, { success: false, error: 'startTime must be before endTime' });
      }

      const id = `dse-${crypto.randomUUID()}`;
      if (dbOk) {
        try {
          const doctors = await prisma.$queryRawUnsafe(`SELECT id FROM public.doctors WHERE id = $1;`, doctorId);
          if (!doctors?.length) return sendJson(res, 404, { success: false, error: 'Doctor not found' });
          const branches = await prisma.$queryRawUnsafe(`SELECT id, company FROM public.branches WHERE id = $1;`, branchId);
          if (!branches?.length) return sendJson(res, 404, { success: false, error: 'Branch not found' });
          if (scope && branches[0].company !== scope) {
            return sendJson(res, 403, { success: false, error: 'Branch is outside your company scope' });
          }
          await prisma.$executeRawUnsafe(
            `INSERT INTO public.doctor_schedule_exceptions
             (id, doctor_id, branch_id, exception_type, start_date, end_date, start_time, end_time, reason, created_by_id, created_at)
             VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10, NOW());`,
            id, doctorId, branchId, exceptionType, startDate, endDate, startTime, endTime, reason, authUser?.id || null
          );
          return sendJson(res, 201, {
            success: true,
            exception: { id, doctorId, branchId, exceptionType, startDate, endDate, startTime, endTime, reason },
          });
        } catch (e) {
          console.warn('DB create doctor exception fallback:', e.message);
        }
      }

      const exception = { id, doctorId, branchId, exceptionType, startDate, endDate, startTime, endTime, reason };
      MEMORY_SCHEDULE_EXCEPTIONS.push(exception);
      return sendJson(res, 201, { success: true, exception });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 16. DELETE /api/doctor-schedule-exceptions/:id
  // ---------------------------------------------------------------------------
  if (req.method === 'DELETE' && pathname.startsWith('/api/doctor-schedule-exceptions/')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const exceptionId = pathname.split('/')[3];
    if (dbOk) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.doctor_schedule_exceptions WHERE id = $1;`, exceptionId).catch(() => null);
      return sendJson(res, 200, { success: true });
    }
    MEMORY_SCHEDULE_EXCEPTIONS = MEMORY_SCHEDULE_EXCEPTIONS.filter((row) => row.id !== exceptionId);
    return sendJson(res, 200, { success: true });
  }

  // ---------------------------------------------------------------------------
  // 17. POST /api/appointments (transaction-safe doctor-centric booking)
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/appointments') {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    try {
      const payload = await parseJsonBody(req);
      const {
        branchId, roomId, doctorId, treatmentId, startTime, endTime,
        patientId, patientName, patientPhone, notes,
        leadId, coordinatorId, appointmentType, idempotencyKey,
      } = payload;

      if (!branchId || !doctorId || !treatmentId || !startTime || !endTime) {
        return sendJson(res, 400, {
          success: false,
          error: 'Required fields missing: branchId, doctorId, treatmentId, startTime and endTime are mandatory.',
        });
      }

      const reqStart = new Date(startTime);
      const reqEnd = new Date(endTime);
      if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime()) || reqStart >= reqEnd) {
        return sendJson(res, 400, { success: false, error: 'Invalid start time or end time specified.' });
      }

      const initialStatus = BOOKABLE_INITIAL_STATUSES.has(payload.status) ? payload.status : 'pending';
      const finalAppointmentType = appointmentType || 'consultation';
      const finalIdempotencyKey = idempotencyKey ? String(idempotencyKey).slice(0, 120) : null;

      if (dbOk) {
        try {
          if (finalIdempotencyKey) {
            const existing = await prisma.$queryRawUnsafe(
              `${enrichedAppointmentSelect()} WHERE a.idempotency_key = $1 LIMIT 1;`,
              finalIdempotencyKey
            );
            if (existing?.length) {
              return sendJson(res, 200, { success: true, idempotent: true, appointment: existing[0] });
            }
          }

          const txResult = await prisma.$transaction(async (tx) => {
            const resolved = await resolvePatient(tx, { patientId, leadId, patientName, patientPhone });
            await assertSlotAvailable(tx, {
              doctorId, branchId, treatmentId, roomId: roomId || null, start: reqStart, end: reqEnd,
            });

            const apptId = `appt-${crypto.randomUUID()}`;
            await tx.$executeRawUnsafe(`
              INSERT INTO public.appointments (
                id, branch_id, room_id, patient_id, lead_id, coordinator_id, doctor_id, treatment_id,
                start_time, end_time, status, notes, appointment_type, idempotency_key,
                created_by_id, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW());
            `, apptId, branchId, roomId || null, resolved.patientId, resolved.leadId, coordinatorId || null,
            doctorId, treatmentId, reqStart, reqEnd, initialStatus, notes || null, finalAppointmentType,
            finalIdempotencyKey, authUser?.id || null);

            await tx.$executeRawUnsafe(`
              INSERT INTO public.appointment_status_history (
                id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
              ) VALUES ($1, $2, NULL, $3, $4, $5, $6, NOW());
            `, `hist-${crypto.randomUUID()}`, apptId, initialStatus, authUser?.id || null,
            authUser?.fullName || 'System', 'Appointment successfully booked');

            return { apptId, resolved };
          });

          const fullAppt = await prisma.$queryRawUnsafe(
            `${enrichedAppointmentSelect()} WHERE a.id = $1;`,
            txResult.apptId
          );
          const apptRecord = fullAppt?.[0] || { id: txResult.apptId, status: initialStatus };

          if (['booked', 'confirmed'].includes(initialStatus)) {
            sendAppointmentNotification({
              eventType: 'booking_confirmed',
              patientName: apptRecord.patientName,
              patientPhone: apptRecord.patientPhone || patientPhone,
              appointmentDate: colomboParts(reqStart).date,
              startTime: colomboParts(reqStart).time,
              endTime: colomboParts(reqEnd).time,
              branchName: apptRecord.branchName,
              roomName: apptRecord.roomNumber ? `${apptRecord.roomNumber} - ${apptRecord.roomName}` : undefined,
              treatmentName: apptRecord.treatmentName,
              doctorName: apptRecord.doctorName,
              prisma,
              customerId: txResult.resolved.patientId,
            }).catch(err => console.warn('Non-blocking WA error:', err.message));
          }

          return sendJson(res, 201, { success: true, appointment: apptRecord });
        } catch (dbErr) {
          if (dbErr.statusCode === 409) {
            return sendJson(res, 409, { success: false, conflictType: dbErr.conflictType, error: dbErr.message });
          }
          if (finalIdempotencyKey && /unique|duplicate/i.test(String(dbErr.message))) {
            const existing = await prisma.$queryRawUnsafe(
              `${enrichedAppointmentSelect()} WHERE a.idempotency_key = $1 LIMIT 1;`,
              finalIdempotencyKey
            ).catch(() => []);
            if (existing?.length) {
              return sendJson(res, 200, { success: true, idempotent: true, appointment: existing[0] });
            }
          }
          console.warn('DB appointment creation error:', dbErr.message);
          return sendJson(res, dbErr.statusCode || 500, { success: false, error: dbErr.message });
        }
      }

      // In-Memory Fallback
      assertMemorySlotAvailable({
        doctorId, branchId, roomId: roomId || null, start: reqStart, end: reqEnd,
      });

      const apptId = `appt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const memoryAppt = {
        id: apptId,
        branchId,
        roomId: roomId || null,
        doctorId,
        treatmentId,
        leadId: leadId || null,
        coordinatorId: coordinatorId || null,
        appointmentType: finalAppointmentType,
        idempotencyKey: finalIdempotencyKey,
        startTime: reqStart.toISOString(),
        endTime: reqEnd.toISOString(),
        status: initialStatus,
        notes,
        patientId: patientId || `cust-${Date.now()}`,
        patientName: patientName || 'Walk-in Patient',
        patientPhone: patientPhone || '+94770000000',
        createdAt: new Date().toISOString(),
      };
      MEMORY_APPOINTMENTS.push(memoryAppt);
      return sendJson(res, 201, { success: true, appointment: memoryAppt });
    } catch (e) {
      return sendJson(res, e.statusCode || 500, { success: false, conflictType: e.conflictType, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 18. GET /api/appointments/:id
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname.startsWith('/api/appointments/') && pathname.split('/').length === 4) {
    const apptId = pathname.split('/')[3];
    if (dbOk) {
      try {
        const appts = await prisma.$queryRawUnsafe(`${enrichedAppointmentSelect()} WHERE a.id = $1;`, apptId);
        if (!appts || appts.length === 0) {
          return sendJson(res, 404, { success: false, error: 'Appointment not found' });
        }
        if (scope && appts[0].company && appts[0].company !== scope) {
          return sendJson(res, 403, { success: false, error: 'Appointment is outside your company scope' });
        }

        const history = await prisma.$queryRawUnsafe(`
          SELECT id, previous_status AS "previousStatus", new_status AS "newStatus",
                 changed_by_name AS "changedByName", reason, changed_at AS "changedAt"
          FROM public.appointment_status_history
          WHERE appointment_id = $1
          ORDER BY changed_at ASC;
        `, apptId);

        return sendJson(res, 200, { ...appts[0], statusHistory: history });
      } catch (e) {
        console.warn('DB get appointment details fallback:', e.message);
      }
    }

    const mem = MEMORY_APPOINTMENTS.find(a => a.id === apptId);
    if (mem) return sendJson(res, 200, mem);
    return sendJson(res, 404, { success: false, error: 'Appointment not found' });
  }

  // ---------------------------------------------------------------------------
  // 19. PATCH /api/appointments/:id (metadata or conflict-safe edit)
  // ---------------------------------------------------------------------------
  if (req.method === 'PATCH' && pathname.startsWith('/api/appointments/') && pathname.split('/').length === 4) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const apptId = pathname.split('/')[3];
    try {
      const payload = await parseJsonBody(req);
      if (dbOk) {
        try {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT * FROM public.appointments WHERE id = $1;`,
            apptId
          );
          if (!rows?.length) return sendJson(res, 404, { success: false, error: 'Appointment not found' });
          const current = rows[0];

          const nextStart = payload.startTime ? new Date(payload.startTime) : new Date(current.start_time);
          const nextEnd = payload.endTime ? new Date(payload.endTime) : new Date(current.end_time);
          if (isNaN(nextStart.getTime()) || isNaN(nextEnd.getTime()) || nextStart >= nextEnd) {
            return sendJson(res, 400, { success: false, error: 'Invalid start time or end time specified.' });
          }

          const schedulingChanged = Boolean(payload.startTime || payload.endTime || payload.doctorId || payload.branchId
            || payload.roomId !== undefined || payload.treatmentId);

          const updateSql = `
            UPDATE public.appointments
            SET branch_id = COALESCE($1, branch_id),
                room_id = $2,
                doctor_id = COALESCE($3, doctor_id),
                treatment_id = COALESCE($4, treatment_id),
                start_time = COALESCE($5, start_time),
                end_time = COALESCE($6, end_time),
                notes = COALESCE($7, notes),
                appointment_type = COALESCE($8, appointment_type),
                lead_id = $9,
                coordinator_id = $10,
                updated_by_id = $11,
                updated_at = NOW()
            WHERE id = $12;
          `;
          const updateParams = [
            payload.branchId || null,
            payload.roomId !== undefined ? (payload.roomId || null) : current.room_id,
            payload.doctorId || null, payload.treatmentId || null,
            payload.startTime ? nextStart : null, payload.endTime ? nextEnd : null,
            payload.notes !== undefined ? payload.notes : null,
            payload.appointmentType || null,
            payload.leadId !== undefined ? payload.leadId : current.lead_id,
            payload.coordinatorId !== undefined ? payload.coordinatorId : current.coordinator_id,
            authUser?.id || null, apptId,
          ];

          if (schedulingChanged) {
            await prisma.$transaction(async (tx) => {
              await assertSlotAvailable(tx, {
                doctorId: payload.doctorId || current.doctor_id,
                branchId: payload.branchId || current.branch_id,
                treatmentId: payload.treatmentId || current.treatment_id,
                roomId: payload.roomId !== undefined ? payload.roomId : current.room_id,
                start: nextStart,
                end: nextEnd,
                excludeAppointmentId: apptId,
              });
              await tx.$executeRawUnsafe(updateSql, ...updateParams);
            });
          } else {
            await prisma.$executeRawUnsafe(updateSql, ...updateParams);
          }

          const fullAppt = await prisma.$queryRawUnsafe(`${enrichedAppointmentSelect()} WHERE a.id = $1;`, apptId);
          return sendJson(res, 200, { success: true, appointment: fullAppt?.[0] || null });
        } catch (e) {
          if (e.statusCode === 409) {
            return sendJson(res, 409, { success: false, conflictType: e.conflictType, error: e.message });
          }
          console.warn('DB update appointment fallback:', e.message);
          return sendJson(res, e.statusCode || 500, { success: false, error: e.message });
        }
      }

      const index = MEMORY_APPOINTMENTS.findIndex((row) => row.id === apptId);
      if (index === -1) return sendJson(res, 404, { success: false, error: 'Appointment not found' });
      const nextStart = payload.startTime ? new Date(payload.startTime) : new Date(MEMORY_APPOINTMENTS[index].startTime);
      const nextEnd = payload.endTime ? new Date(payload.endTime) : new Date(MEMORY_APPOINTMENTS[index].endTime);
      if (payload.startTime || payload.endTime || payload.doctorId || payload.roomId !== undefined) {
        assertMemorySlotAvailable({
          doctorId: payload.doctorId || MEMORY_APPOINTMENTS[index].doctorId,
          branchId: payload.branchId || MEMORY_APPOINTMENTS[index].branchId,
          roomId: payload.roomId !== undefined ? payload.roomId : MEMORY_APPOINTMENTS[index].roomId,
          start: nextStart,
          end: nextEnd,
          excludeAppointmentId: apptId,
        });
      }
      MEMORY_APPOINTMENTS[index] = {
        ...MEMORY_APPOINTMENTS[index],
        ...payload,
        startTime: nextStart.toISOString(),
        endTime: nextEnd.toISOString(),
      };
      return sendJson(res, 200, { success: true, appointment: MEMORY_APPOINTMENTS[index] });
    } catch (e) {
      return sendJson(res, e.statusCode || 500, { success: false, conflictType: e.conflictType, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 20. POST /api/appointments/:id/reschedule
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname.startsWith('/api/appointments/') && pathname.endsWith('/reschedule')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const apptId = pathname.split('/')[3];

    try {
      const payload = await parseJsonBody(req);
      const { newStartTime, newEndTime, newRoomId, newDoctorId, newBranchId, newTreatmentId, reason } = payload;

      if (!newStartTime || !newEndTime) {
        return sendJson(res, 400, { success: false, error: 'newStartTime and newEndTime are required' });
      }

      const reqStart = new Date(newStartTime);
      const reqEnd = new Date(newEndTime);
      if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime()) || reqStart >= reqEnd) {
        return sendJson(res, 400, { success: false, error: 'Start time must be before end time' });
      }

      if (dbOk) {
        try {
          const appts = await prisma.$queryRawUnsafe(`SELECT * FROM public.appointments WHERE id = $1;`, apptId);
          if (!appts || appts.length === 0) return sendJson(res, 404, { success: false, error: 'Appointment not found' });

          const appt = appts[0];
          const targetRoomId = newRoomId !== undefined ? (newRoomId || null) : appt.room_id;
          const targetDoctorId = newDoctorId || appt.doctor_id;
          const targetBranchId = newBranchId || appt.branch_id;
          const targetTreatmentId = newTreatmentId || appt.treatment_id;

          await prisma.$transaction(async (tx) => {
            await assertSlotAvailable(tx, {
              doctorId: targetDoctorId,
              branchId: targetBranchId,
              treatmentId: targetTreatmentId,
              roomId: targetRoomId,
              start: reqStart,
              end: reqEnd,
              excludeAppointmentId: apptId,
            });

            await tx.$executeRawUnsafe(`
              UPDATE public.appointments
              SET branch_id = $1, room_id = $2, doctor_id = $3, treatment_id = $4,
                  start_time = $5, end_time = $6, status = 'rescheduled', updated_by_id = $7, updated_at = NOW()
              WHERE id = $8;
            `, targetBranchId, targetRoomId, targetDoctorId, targetTreatmentId, reqStart, reqEnd, authUser?.id || null, apptId);

            await tx.$executeRawUnsafe(`
              INSERT INTO public.appointment_status_history (
                id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
              ) VALUES ($1, $2, $3, 'rescheduled', $4, $5, $6, NOW());
            `, `hist-${crypto.randomUUID()}`, apptId, appt.status, authUser?.id || null,
            authUser?.fullName || 'Staff', reason || 'Appointment moved to another date or time');
          });

          const customer = await prisma.customer.findUnique({ where: { id: appt.patient_id } }).catch(() => null);
          const treatment = await prisma.treatment.findUnique({ where: { id: targetTreatmentId } }).catch(() => null);
          const doctor = await prisma.doctor.findUnique({ where: { id: targetDoctorId } }).catch(() => null);

          sendAppointmentNotification({
            eventType: 'rescheduled',
            patientName: customer?.displayName,
            patientPhone: customer?.whatsappNumber,
            appointmentDate: colomboParts(reqStart).date,
            startTime: colomboParts(reqStart).time,
            endTime: colomboParts(reqEnd).time,
            treatmentName: treatment?.name,
            doctorName: doctor?.fullName,
            prisma,
            customerId: appt.patient_id,
          }).catch(() => null);

          const fullAppt = await prisma.$queryRawUnsafe(`${enrichedAppointmentSelect()} WHERE a.id = $1;`, apptId);
          return sendJson(res, 200, { success: true, appointment: fullAppt?.[0] || null });
        } catch (e) {
          if (e.statusCode === 409) {
            return sendJson(res, 409, { success: false, conflictType: e.conflictType, error: e.message });
          }
          return sendJson(res, e.statusCode || 500, { success: false, error: e.message });
        }
      }

      const memIdx = MEMORY_APPOINTMENTS.findIndex(a => a.id === apptId);
      if (memIdx !== -1) {
        const current = MEMORY_APPOINTMENTS[memIdx];
        const targetRoomId = newRoomId !== undefined ? (newRoomId || null) : current.roomId;
        const targetDoctorId = newDoctorId || current.doctorId;
        const targetBranchId = newBranchId || current.branchId;
        assertMemorySlotAvailable({
          doctorId: targetDoctorId, branchId: targetBranchId, roomId: targetRoomId,
          start: reqStart, end: reqEnd, excludeAppointmentId: apptId,
        });
        MEMORY_APPOINTMENTS[memIdx] = {
          ...current,
          branchId: targetBranchId,
          roomId: targetRoomId,
          doctorId: targetDoctorId,
          treatmentId: newTreatmentId || current.treatmentId,
          startTime: reqStart.toISOString(),
          endTime: reqEnd.toISOString(),
          status: 'rescheduled',
        };
        return sendJson(res, 200, { success: true, appointment: MEMORY_APPOINTMENTS[memIdx] });
      }
      return sendJson(res, 404, { success: false, error: 'Appointment not found' });
    } catch (e) {
      return sendJson(res, e.statusCode || 500, { success: false, conflictType: e.conflictType, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 21. POST /api/appointments/:id/cancel
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname.startsWith('/api/appointments/') && pathname.endsWith('/cancel')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const apptId = pathname.split('/')[3];

    try {
      const payload = await parseJsonBody(req);
      const reason = payload.reason || 'Cancelled by patient or staff';

      if (dbOk) {
        const appts = await prisma.$queryRawUnsafe(`SELECT * FROM public.appointments WHERE id = $1;`, apptId);
        if (!appts || appts.length === 0) return sendJson(res, 404, { success: false, error: 'Appointment not found' });

        const appt = appts[0];
        const prevStatus = appt.status;
        if (prevStatus === 'cancelled') {
          return sendJson(res, 200, { success: true, message: 'Appointment is already cancelled' });
        }

        await prisma.$executeRawUnsafe(`
          UPDATE public.appointments
          SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1, updated_by_id = $2, updated_at = NOW()
          WHERE id = $3;
        `, reason, authUser?.id || null, apptId);

        await prisma.$executeRawUnsafe(`
          INSERT INTO public.appointment_status_history (
            id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
          ) VALUES ($1, $2, $3, 'cancelled', $4, $5, $6, NOW());
        `, `hist-${crypto.randomUUID()}`, apptId, prevStatus, authUser?.id || null, authUser?.fullName || 'Staff', reason);

        const customer = await prisma.customer.findUnique({ where: { id: appt.patient_id } }).catch(() => null);
        sendAppointmentNotification({
          eventType: 'cancelled',
          patientName: customer?.displayName,
          patientPhone: customer?.whatsappNumber,
          appointmentDate: colomboParts(new Date(appt.start_time)).date,
          startTime: colomboParts(new Date(appt.start_time)).time,
          cancellationReason: reason,
          prisma,
          customerId: appt.patient_id,
        }).catch(() => null);

        return sendJson(res, 200, { success: true, message: 'Appointment cancelled successfully' });
      }

      const mem = MEMORY_APPOINTMENTS.find(a => a.id === apptId);
      if (mem) {
        mem.status = 'cancelled';
        mem.cancellationReason = reason;
        return sendJson(res, 200, { success: true, message: 'Appointment cancelled' });
      }
      return sendJson(res, 404, { success: false, error: 'Appointment not found' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 22. PATCH /api/appointments/:id/status
  // ---------------------------------------------------------------------------
  if (req.method === 'PATCH' && pathname.startsWith('/api/appointments/') && pathname.endsWith('/status')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const apptId = pathname.split('/')[3];

    try {
      const payload = await parseJsonBody(req);
      const newStatus = payload.status;
      const reason = payload.reason || `Status updated to ${newStatus}`;

      const validStatuses = [
        'booked', 'confirmed', 'arrived', 'paid', 'rescheduled', 'cancelled', 'no_answer',
        'pending', 'checked_in', 'in_progress', 'completed', 'no_show'
      ];
      if (!validStatuses.includes(newStatus)) {
        return sendJson(res, 400, { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      if (dbOk) {
        const appts = await prisma.$queryRawUnsafe(`SELECT status FROM public.appointments WHERE id = $1;`, apptId);
        if (!appts || appts.length === 0) return sendJson(res, 404, { success: false, error: 'Appointment not found' });

        const prevStatus = appts[0].status;

        await prisma.$executeRawUnsafe(`
          UPDATE public.appointments
          SET status = $1, updated_by_id = $2, updated_at = NOW()
          WHERE id = $3;
        `, newStatus, authUser?.id || null, apptId);

        await prisma.$executeRawUnsafe(`
          INSERT INTO public.appointment_status_history (
            id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
        `, `hist-${crypto.randomUUID()}`, apptId, prevStatus, newStatus, authUser?.id || null, authUser?.fullName || 'Staff', reason);

        return sendJson(res, 200, { success: true, newStatus });
      }

      const mem = MEMORY_APPOINTMENTS.find(a => a.id === apptId);
      if (mem) {
        mem.status = newStatus;
        return sendJson(res, 200, { success: true, newStatus });
      }
      return sendJson(res, 404, { success: false, error: 'Appointment not found' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 23. GET /api/doctors?branchId=...
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/doctors') {
    const branchId = query.branchId;
    if (dbOk) {
      try {
        const doctors = await prisma.doctor.findMany({
          where: { isActive: true },
          select: {
            id: true,
            fullName: true,
            title: true,
            branch: true,
            phone: true,
            avatar: true
          },
          orderBy: { fullName: 'asc' }
        });
        const schedules = await prisma.$queryRawUnsafe(
          `SELECT doctor_id AS "doctorId", branch_id AS "branchId"
           FROM public.doctor_weekly_schedules WHERE is_active = TRUE;`
        ).catch(() => []);

        let branchName = null;
        if (branchId) {
          const branch = await prisma.$queryRawUnsafe(`SELECT name FROM public.branches WHERE id = $1;`, branchId);
          branchName = branch?.[0]?.name || null;
        }

        const enriched = doctors
          .map((doctor) => ({
            ...doctor,
            role: 'doctor',
            roleTitle: doctor.title,
            branchIds: [...new Set(schedules.filter((row) => row.doctorId === doctor.id).map((row) => row.branchId))],
            scheduleConfigured: schedules.some((row) => row.doctorId === doctor.id),
          }))
          .filter((doctor) => {
            if (!branchId) return true;
            if (doctor.branchIds.includes(branchId)) return true;
            if (doctor.scheduleConfigured) return false;
            return !doctor.branch || !branchName || doctor.branch.toLowerCase().includes(branchName.toLowerCase());
          });

        return sendJson(res, 200, enriched);
      } catch (e) {
        console.warn('DB doctors query fallback:', e.message);
      }
    }
    let fallback = MEMORY_DOCTORS;
    if (branchId) {
      const branch = MEMORY_BRANCHES.find((row) => row.id === branchId);
      fallback = fallback.filter((doctor) => !branch || !doctor.branch || doctor.branch.toLowerCase().includes(branch.name.toLowerCase()));
    }
    return sendJson(res, 200, fallback);
  }

  // ---------------------------------------------------------------------------
  // 24. GET /api/patients/search?q=... (patients + leads)
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/patients/search') {
    const q = String(query.q || '').trim();
    if (!q) return sendJson(res, 200, []);

    if (dbOk) {
      try {
        const rows = await prisma.$queryRawUnsafe(`
          SELECT * FROM (
            SELECT DISTINCT ON (c.id)
              c.id AS "patientId", c.id, c."displayName", c."whatsappNumber", c."phoneNumber", c."avatarUrl",
              l.id AS "leadId", l."serialNumber", l.stage, l.source, l.company
            FROM public.customers c
            LEFT JOIN public.leads l ON l."customerId" = c.id
            WHERE c."displayName" ILIKE $1
               OR c."whatsappNumber" ILIKE $1
               OR c."phoneNumber" ILIKE $1
               OR l."serialNumber" ILIKE $1
            ORDER BY c.id, l."createdAt" DESC NULLS LAST
          ) matches
          ORDER BY "displayName" ASC
          LIMIT 12;
        `, `%${q}%`);
        return sendJson(res, 200, rows);
      } catch (e) {
        console.warn('DB patient search fallback:', e.message);
      }
    }
    return sendJson(res, 200, []);
  }

  // ---------------------------------------------------------------------------
  // 25. POST /api/patients/quick-register
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/patients/quick-register') {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    try {
      const payload = await parseJsonBody(req);
      const name = String(payload.name || payload.displayName || '').trim();
      const phone = String(payload.phone || payload.whatsappNumber || '').trim();

      if (!name || !phone) {
        return sendJson(res, 400, { success: false, error: 'Patient name and phone number are required' });
      }

      const cleanDigits = phone.replace(/[^0-9]/g, '');
      const canonical = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`;

      if (dbOk) {
        try {
          let existing = await prisma.customer.findFirst({
            where: {
              OR: [
                { whatsappNumber: { contains: cleanDigits.slice(-9) } },
                { phoneNumber: { contains: cleanDigits.slice(-9) } }
              ]
            }
          });

          if (!existing) {
            existing = await prisma.customer.create({
              data: {
                displayName: name,
                whatsappNumber: canonical,
                phoneNumber: phone,
                preferredLanguage: 'en'
              }
            });
          }

          return sendJson(res, 201, { success: true, patient: existing });
        } catch (e) {
          console.warn('DB quick register patient fallback:', e.message);
        }
      }

      const memPatient = {
        id: `cust-${Date.now()}`,
        displayName: name,
        whatsappNumber: canonical,
        phoneNumber: phone
      };
      return sendJson(res, 201, { success: true, patient: memPatient });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 26. GET & POST & DELETE /api/availability-blocks
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/availability-blocks') {
    const branchId = query.branchId;
    if (dbOk) {
      try {
        const blocks = await prisma.$queryRawUnsafe(`
          SELECT
            ab.id, ab.branch_id AS "branchId", ab.room_id AS "roomId",
            ab.doctor_id AS "doctorId", ab.start_time AS "startTime",
            ab.end_time AS "endTime", ab.reason, ab.created_at AS "createdAt",
            r.name AS "roomName", u."fullName" AS "doctorName"
          FROM public.availability_blocks ab
          LEFT JOIN public.rooms r ON ab.room_id = r.id
          LEFT JOIN public.doctors u ON ab.doctor_id = u.id
          WHERE ab.branch_id = $1
          ORDER BY ab.start_time ASC;
        `, branchId || 'branch-colombo');
        return sendJson(res, 200, blocks);
      } catch (e) {
        console.warn('DB query availability blocks fallback:', e.message);
      }
    }
    return sendJson(res, 200, MEMORY_AVAILABILITY_BLOCKS);
  }

  if (req.method === 'POST' && pathname === '/api/availability-blocks') {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    try {
      const payload = await parseJsonBody(req);
      const { branchId, roomId, doctorId, startTime, endTime, reason } = payload;

      if (!branchId || !startTime || !endTime || !reason) {
        return sendJson(res, 400, { success: false, error: 'branchId, startTime, endTime, and reason are required' });
      }

      const blockId = `block-${crypto.randomUUID()}`;
      if (dbOk) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.availability_blocks (id, branch_id, room_id, doctor_id, start_time, end_time, reason, created_by_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `, blockId, branchId, roomId || null, doctorId || null, new Date(startTime), new Date(endTime), reason, authUser?.id || null);

        return sendJson(res, 201, { success: true, blockId });
      }

      const memBlock = { id: blockId, branchId, roomId, doctorId, startTime, endTime, reason };
      MEMORY_AVAILABILITY_BLOCKS.push(memBlock);
      return sendJson(res, 201, { success: true, block: memBlock });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/availability-blocks/')) {
    if (!canManageAppointments(authUser)) return denyWrite(res);
    const blockId = pathname.split('/')[3];
    if (dbOk) {
      await prisma.$executeRawUnsafe(`DELETE FROM public.availability_blocks WHERE id = $1;`, blockId).catch(() => null);
      return sendJson(res, 200, { success: true });
    }
    MEMORY_AVAILABILITY_BLOCKS = MEMORY_AVAILABILITY_BLOCKS.filter(b => b.id !== blockId);
    return sendJson(res, 200, { success: true });
  }

  // Not handled by appointment router
  return false;
}
