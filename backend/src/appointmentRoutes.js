/**
 * Appointment Booking & Room Scheduling REST Route Handlers
 * Alpha Health Group CRM Module
 */
import url from 'url';
import crypto from 'crypto';
import { getPrisma, getDbStatus } from './db.js';
import { validateAppointmentSlot } from './conflictEngine.js';
import { sendAppointmentNotification } from './whatsappNotifier.js';

// In-memory fallback stores when DB is operating offline
let MEMORY_BRANCHES = [
  { id: 'branch-colombo', name: 'Colombo (Head Office)', code: 'COLOMBO', address: 'Colombo, Sri Lanka', phone: '+94 70 639 3353', isActive: true },
  { id: 'branch-maruthamunai', name: 'Maruthamunai Branch', code: 'MARUTHAMUNAI', address: 'Maruthamunai, Sri Lanka', phone: '+94 70 637 3353', isActive: true }
];

let MEMORY_ROOMS = [
  { id: 'room-col-1', branchId: 'branch-colombo', name: 'Consultation Suite 1', roomNumber: 'R-101', description: 'Primary consultation and diagnosis', color: '#0d9488', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-hair-1', 't-skin-1', 't-iv-1'] },
  { id: 'room-col-2', branchId: 'branch-colombo', name: 'Laser & Skin Therapy Suite', roomNumber: 'R-102', description: 'Advanced laser treatments and dermatological procedures', color: '#6366f1', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-skin-1', 't-skin-2', 't-laser-1'] },
  { id: 'room-col-3', branchId: 'branch-colombo', name: 'IV Wellness & Recovery Lounge', roomNumber: 'R-103', description: 'IV vitamin therapy, hydration infusions', color: '#ec4899', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-iv-1', 't-iv-2'] },
  { id: 'room-col-4', branchId: 'branch-colombo', name: 'Hair Restoration Clinic', roomNumber: 'R-104', description: 'Hair PRP, scalp micro-pigmentation and care', color: '#f59e0b', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-hair-1', 't-hair-2'] },
  { id: 'room-mar-1', branchId: 'branch-maruthamunai', name: 'Consultation Room A', roomNumber: 'M-201', description: 'General aesthetics and initial assessment', color: '#0d9488', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-hair-1', 't-skin-1'] },
  { id: 'room-mar-2', branchId: 'branch-maruthamunai', name: 'Wellness & Therapy Suite B', roomNumber: 'M-202', description: 'Therapy and wellness infusions', color: '#6366f1', operatingStart: '08:00', operatingEnd: '20:00', isActive: true, treatmentIds: ['t-iv-1', 't-skin-1'] }
];

let MEMORY_APPOINTMENTS = [];
let MEMORY_STATUS_HISTORIES = [];
let MEMORY_AVAILABILITY_BLOCKS = [];

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
    req.on('data', chunk => { body += chunk; });
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

/**
 * Main Appointment Route Dispatcher
 * Returns true if the route was handled, false if it should fall through to subsequent handlers
 */
export async function handleAppointmentRoutes(req, res, pathname, authUser) {
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;
  const prisma = getPrisma();
  const dbOk = getDbStatus() && !!prisma;

  // ---------------------------------------------------------------------------
  // 1. GET /api/branches
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/branches') {
    if (dbOk) {
      try {
        const branches = await prisma.$queryRawUnsafe(`
          SELECT id, name, code, address, phone, is_active AS "isActive", created_at AS "createdAt"
          FROM public.branches
          WHERE is_active = TRUE
          ORDER BY name ASC;
        `);
        return sendJson(res, 200, branches);
      } catch (e) {
        console.warn('DB query branches fallback to memory:', e.message);
      }
    }
    return sendJson(res, 200, MEMORY_BRANCHES.filter(b => b.isActive));
  }

  // ---------------------------------------------------------------------------
  // 2. GET /api/rooms?branchId=...
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/rooms') {
    const branchId = query.branchId;
    if (dbOk) {
      try {
        const roomsQuery = branchId
          ? `SELECT id, branch_id AS "branchId", name, room_number AS "roomNumber", description, color, 
                    operating_start AS "operatingStart", operating_end AS "operatingEnd", is_active AS "isActive"
             FROM public.rooms
             WHERE branch_id = $1 AND is_active = TRUE
             ORDER BY room_number ASC;`
          : `SELECT id, branch_id AS "branchId", name, room_number AS "roomNumber", description, color, 
                    operating_start AS "operatingStart", operating_end AS "operatingEnd", is_active AS "isActive"
             FROM public.rooms
             WHERE is_active = TRUE
             ORDER BY branch_id, room_number ASC;`;
        
        const rooms = branchId 
          ? await prisma.$queryRawUnsafe(roomsQuery, branchId)
          : await prisma.$queryRawUnsafe(roomsQuery);

        // Fetch room treatments
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

    const filtered = branchId ? MEMORY_ROOMS.filter(r => r.branchId === branchId && r.isActive) : MEMORY_ROOMS.filter(r => r.isActive);
    return sendJson(res, 200, filtered);
  }

  // ---------------------------------------------------------------------------
  // 3. POST /api/rooms
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/rooms') {
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
    const roomId = pathname.split('/')[3];
    if (!roomId) return sendJson(res, 400, { success: false, error: 'Room ID required' });

    // Check future appointments in this room
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

        // Soft delete / deactivate
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
        error: `Cannot deactivate room: There are ${futureMem.length} upcoming active appointments booked in this room.`,
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
  // 6. GET /api/appointments?branchId=...&date=... (or startDate/endDate)
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/appointments') {
    const branchId = query.branchId;
    const dateStr = query.date;
    const startDateStr = query.startDate;
    const endDateStr = query.endDate;

    let rangeStart = null;
    let rangeEnd = null;

    if (dateStr) {
      rangeStart = new Date(`${dateStr}T00:00:00.000Z`);
      rangeEnd = new Date(`${dateStr}T23:59:59.999Z`);
    } else if (startDateStr && endDateStr) {
      rangeStart = new Date(startDateStr);
      rangeEnd = new Date(endDateStr);
    }

    if (dbOk) {
      try {
        let sql = `
          SELECT 
            a.id, a.branch_id AS "branchId", a.room_id AS "roomId", 
            a.patient_id AS "patientId", a.doctor_id AS "doctorId", a.treatment_id AS "treatmentId",
            a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.notes,
            a.cancellation_reason AS "cancellationReason", a.created_at AS "createdAt",
            c."displayName" AS "patientName", c."whatsappNumber" AS "patientPhone", c."avatarUrl" AS "patientAvatar",
            u."fullName" AS "doctorName", u."role" AS "doctorTitle",
            t.name AS "treatmentName", t."durationMinutes" AS "treatmentDuration", t."startingPrice" AS "treatmentPrice",
            r.name AS "roomName", r.room_number AS "roomNumber", r.color AS "roomColor"
          FROM public.appointments a
          LEFT JOIN public.customers c ON a.patient_id = c.id
          LEFT JOIN public.users u ON a.doctor_id = u.id
          LEFT JOIN public.treatments t ON a.treatment_id = t.id
          LEFT JOIN public.rooms r ON a.room_id = r.id
          WHERE 1=1
        `;
        const params = [];

        if (branchId) {
          params.push(branchId);
          sql += ` AND a.branch_id = $${params.length}`;
        }
        if (rangeStart && rangeEnd) {
          params.push(rangeStart);
          sql += ` AND a.end_time >= $${params.length}`;
          params.push(rangeEnd);
          sql += ` AND a.start_time <= $${params.length}`;
        }

        sql += ` ORDER BY a.start_time ASC;`;

        const rows = await prisma.$queryRawUnsafe(sql, ...params);
        return sendJson(res, 200, rows);
      } catch (e) {
        console.warn('DB query appointments fallback:', e.message);
      }
    }

    let results = MEMORY_APPOINTMENTS;
    if (branchId) results = results.filter(a => a.branchId === branchId);
    if (rangeStart && rangeEnd) {
      results = results.filter(a => {
        const s = new Date(a.startTime);
        const e = new Date(a.endTime);
        return e >= rangeStart && s <= rangeEnd;
      });
    }
    return sendJson(res, 200, results);
  }

  // ---------------------------------------------------------------------------
  // 7. POST /api/appointments (Transactional Conflict-Safe Booking)
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/appointments') {
    try {
      const payload = await parseJsonBody(req);
      const {
        branchId,
        roomId,
        doctorId,
        treatmentId,
        startTime,
        endTime,
        patientId,
        patientName,
        patientPhone,
        notes
      } = payload;

      if (!branchId || !roomId || !doctorId || !treatmentId || !startTime || !endTime) {
        return sendJson(res, 400, {
          success: false,
          error: 'Required fields missing: branchId, roomId, doctorId, treatmentId, startTime, and endTime are mandatory.'
        });
      }

      const reqStart = new Date(startTime);
      const reqEnd = new Date(endTime);

      if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime()) || reqStart >= reqEnd) {
        return sendJson(res, 400, { success: false, error: 'Invalid start time or end time specified.' });
      }

      let finalPatientId = patientId;

      // Concurrency & Overlap Conflict Verification
      if (dbOk) {
        try {
          // Transactional Row-Level Lock on Room to prevent race-condition double bookings
          const txResult = await prisma.$transaction(async (tx) => {
            // Lock room row for update
            const lockedRooms = await tx.$queryRawUnsafe(`SELECT id, branch_id, is_active FROM public.rooms WHERE id = $1 FOR UPDATE;`, roomId);
            if (!lockedRooms || lockedRooms.length === 0) {
              throw new Error('Selected room not found');
            }
            if (!lockedRooms[0].is_active) {
              throw new Error('Selected room is inactive');
            }

            // Check room overlap in active appointments
            const roomConflicts = await tx.$queryRawUnsafe(`
              SELECT a.id, a.start_time, a.end_time, c."displayName" AS "patientName"
              FROM public.appointments a
              LEFT JOIN public.customers c ON a.patient_id = c.id
              WHERE a.room_id = $1 
                AND a.status NOT IN ('cancelled', 'no_show')
                AND a.start_time < $2 
                AND a.end_time > $3
              LIMIT 1;
            `, roomId, reqEnd, reqStart);

            if (roomConflicts.length > 0) {
              const err = new Error(`Conflict: Room is already booked for this time window (${roomConflicts[0].patientName || 'Patient'})`);
              err.statusCode = 409;
              err.conflictType = 'room';
              throw err;
            }

            // Check doctor overlap
            const doctorConflicts = await tx.$queryRawUnsafe(`
              SELECT a.id, a.start_time, a.end_time, r.name AS "roomName"
              FROM public.appointments a
              LEFT JOIN public.rooms r ON a.room_id = r.id
              WHERE a.doctor_id = $1 
                AND a.status NOT IN ('cancelled', 'no_show')
                AND a.start_time < $2 
                AND a.end_time > $3
              LIMIT 1;
            `, doctorId, reqEnd, reqStart);

            if (doctorConflicts.length > 0) {
              const err = new Error(`Conflict: Doctor is already assigned to an appointment in ${doctorConflicts[0].roomName || 'another room'} at this time`);
              err.statusCode = 409;
              err.conflictType = 'doctor';
              throw err;
            }

            // Check availability blocks
            const blocks = await tx.$queryRawUnsafe(`
              SELECT id, reason, room_id, doctor_id
              FROM public.availability_blocks
              WHERE branch_id = $1
                AND (room_id = $2 OR doctor_id = $3)
                AND start_time < $4
                AND end_time > $5
              LIMIT 1;
            `, branchId, roomId, doctorId, reqEnd, reqStart);

            if (blocks.length > 0) {
              const err = new Error(`Conflict: Time slot is blocked due to ${blocks[0].reason}`);
              err.statusCode = 409;
              err.conflictType = 'block';
              throw err;
            }

            // Handle patient record (lookup or create)
            if (!finalPatientId) {
              if (!patientPhone) {
                throw new Error('Patient ID or patient phone number required');
              }
              const cleanDigits = String(patientPhone).replace(/[^0-9]/g, '');
              let existingCust = await tx.customer.findFirst({
                where: {
                  OR: [
                    { whatsappNumber: { contains: cleanDigits.slice(-9) } },
                    { phoneNumber: { contains: cleanDigits.slice(-9) } }
                  ]
                }
              });

              if (!existingCust) {
                existingCust = await tx.customer.create({
                  data: {
                    displayName: patientName || `Patient ${cleanDigits.slice(-4)}`,
                    whatsappNumber: cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`,
                    phoneNumber: patientPhone,
                    preferredLanguage: 'en'
                  }
                });
              }
              finalPatientId = existingCust.id;
            }

            // Generate UUID and insert Appointment
            const apptId = `appt-${crypto.randomUUID()}`;
            await tx.$executeRawUnsafe(`
              INSERT INTO public.appointments (
                id, branch_id, room_id, patient_id, doctor_id, treatment_id,
                start_time, end_time, status, notes, created_by_id, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9, $10, NOW(), NOW());
            `, apptId, branchId, roomId, finalPatientId, doctorId, treatmentId, reqStart, reqEnd, notes || null, authUser?.id || null);

            // Insert initial status history
            const histId = `hist-${crypto.randomUUID()}`;
            await tx.$executeRawUnsafe(`
              INSERT INTO public.appointment_status_history (
                id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
              ) VALUES ($1, $2, NULL, 'confirmed', $3, $4, 'Initial Booking Confirmation', NOW());
            `, histId, apptId, authUser?.id || null, authUser?.fullName || 'System');

            return { apptId, finalPatientId };
          });

          // Fetch complete enriched appointment
          const fullAppt = await prisma.$queryRawUnsafe(`
            SELECT 
              a.id, a.branch_id AS "branchId", a.room_id AS "roomId", 
              a.patient_id AS "patientId", a.doctor_id AS "doctorId", a.treatment_id AS "treatmentId",
              a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.notes,
              c."displayName" AS "patientName", c."whatsappNumber" AS "patientPhone",
              u."fullName" AS "doctorName",
              t.name AS "treatmentName",
              r.name AS "roomName", r.room_number AS "roomNumber", r.color AS "roomColor",
              b.name AS "branchName"
            FROM public.appointments a
            LEFT JOIN public.customers c ON a.patient_id = c.id
            LEFT JOIN public.users u ON a.doctor_id = u.id
            LEFT JOIN public.treatments t ON a.treatment_id = t.id
            LEFT JOIN public.rooms r ON a.room_id = r.id
            LEFT JOIN public.branches b ON a.branch_id = b.id
            WHERE a.id = $1;
          `, txResult.apptId);

          const apptRecord = fullAppt?.[0] || { id: txResult.apptId, status: 'confirmed' };

          // Asynchronous Non-blocking WhatsApp Notification
          sendAppointmentNotification({
            eventType: 'booking_confirmed',
            patientName: apptRecord.patientName,
            patientPhone: apptRecord.patientPhone || patientPhone,
            appointmentDate: reqStart.toISOString().split('T')[0],
            startTime: reqStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            endTime: reqEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            branchName: apptRecord.branchName,
            roomName: `${apptRecord.roomNumber} - ${apptRecord.roomName}`,
            treatmentName: apptRecord.treatmentName,
            doctorName: apptRecord.doctorName,
            prisma,
            customerId: txResult.finalPatientId
          }).catch(err => console.warn('Non-blocking WA error:', err.message));

          return sendJson(res, 201, { success: true, appointment: apptRecord });
        } catch (dbErr) {
          if (dbErr.statusCode === 409) {
            return sendJson(res, 409, { success: false, conflictType: dbErr.conflictType, error: dbErr.message });
          }
          console.warn('DB appointment creation error:', dbErr.message);
          return sendJson(res, 500, { success: false, error: dbErr.message });
        }
      }

      // In-Memory Fallback
      const memRoomConflict = MEMORY_APPOINTMENTS.find(a => 
        a.roomId === roomId &&
        !['cancelled', 'no_show'].includes(a.status) &&
        new Date(a.startTime) < reqEnd &&
        new Date(a.endTime) > reqStart
      );

      if (memRoomConflict) {
        return sendJson(res, 409, { success: false, conflictType: 'room', error: 'Room is already booked for this time interval.' });
      }

      if (doctorId) {
        const memDocConflict = MEMORY_APPOINTMENTS.find(a => 
          a.doctorId === doctorId &&
          !['cancelled', 'no_show'].includes(a.status) &&
          new Date(a.startTime) < reqEnd &&
          new Date(a.endTime) > reqStart
        );

        if (memDocConflict) {
          return sendJson(res, 409, { success: false, conflictType: 'doctor', error: 'Doctor is already assigned to another appointment during this time interval.' });
        }
      }

      const apptId = `appt-${Date.now()}`;
      const memoryAppt = {
        id: apptId,
        branchId,
        roomId,
        doctorId,
        treatmentId,
        startTime: reqStart.toISOString(),
        endTime: reqEnd.toISOString(),
        status: 'confirmed',
        notes,
        patientId: patientId || `cust-${Date.now()}`,
        patientName: patientName || 'Walk-in Patient',
        patientPhone: patientPhone || '+94770000000',
        createdAt: new Date().toISOString()
      };
      MEMORY_APPOINTMENTS.push(memoryAppt);
      return sendJson(res, 201, { success: true, appointment: memoryAppt });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 8. GET /api/appointments/:id
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname.startsWith('/api/appointments/') && pathname.split('/').length === 4) {
    const apptId = pathname.split('/')[3];
    if (dbOk) {
      try {
        const appts = await prisma.$queryRawUnsafe(`
          SELECT 
            a.id, a.branch_id AS "branchId", a.room_id AS "roomId", 
            a.patient_id AS "patientId", a.doctor_id AS "doctorId", a.treatment_id AS "treatmentId",
            a.start_time AS "startTime", a.end_time AS "endTime", a.status, a.notes,
            a.cancellation_reason AS "cancellationReason", a.created_at AS "createdAt",
            c."displayName" AS "patientName", c."whatsappNumber" AS "patientPhone", c."avatarUrl" AS "patientAvatar",
            u."fullName" AS "doctorName",
            t.name AS "treatmentName", t."durationMinutes" AS "treatmentDuration", t."startingPrice" AS "treatmentPrice",
            r.name AS "roomName", r.room_number AS "roomNumber", r.color AS "roomColor",
            b.name AS "branchName"
          FROM public.appointments a
          LEFT JOIN public.customers c ON a.patient_id = c.id
          LEFT JOIN public.users u ON a.doctor_id = u.id
          LEFT JOIN public.treatments t ON a.treatment_id = t.id
          LEFT JOIN public.rooms r ON a.room_id = r.id
          LEFT JOIN public.branches b ON a.branch_id = b.id
          WHERE a.id = $1;
        `, apptId);

        if (!appts || appts.length === 0) {
          return sendJson(res, 404, { success: false, error: 'Appointment not found' });
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
  // 9. POST /api/appointments/:id/reschedule
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname.startsWith('/api/appointments/') && pathname.endsWith('/reschedule')) {
    const parts = pathname.split('/');
    const apptId = parts[3];

    try {
      const payload = await parseJsonBody(req);
      const { newStartTime, newEndTime, newRoomId, reason } = payload;

      if (!newStartTime || !newEndTime) {
        return sendJson(res, 400, { success: false, error: 'newStartTime and newEndTime are required' });
      }

      const reqStart = new Date(newStartTime);
      const reqEnd = new Date(newEndTime);

      if (reqStart >= reqEnd) {
        return sendJson(res, 400, { success: false, error: 'Start time must be before end time' });
      }

      if (dbOk) {
        const appts = await prisma.$queryRawUnsafe(`SELECT * FROM public.appointments WHERE id = $1;`, apptId);
        if (!appts || appts.length === 0) return sendJson(res, 404, { success: false, error: 'Appointment not found' });

        const appt = appts[0];
        const targetRoomId = newRoomId || appt.room_id;

        // Check conflicts excluding this appointment
        const roomConflicts = await prisma.$queryRawUnsafe(`
          SELECT a.id, c."displayName" AS "patientName"
          FROM public.appointments a
          LEFT JOIN public.customers c ON a.patient_id = c.id
          WHERE a.room_id = $1
            AND a.id != $2
            AND a.status NOT IN ('cancelled', 'no_show')
            AND a.start_time < $3
            AND a.end_time > $4
          LIMIT 1;
        `, targetRoomId, apptId, reqEnd, reqStart);

        if (roomConflicts.length > 0) {
          return sendJson(res, 409, {
            success: false,
            error: `Target room is already booked for this interval (${roomConflicts[0].patientName || 'Patient'})`
          });
        }

        // Update appointment
        await prisma.$executeRawUnsafe(`
          UPDATE public.appointments
          SET room_id = $1, start_time = $2, end_time = $3, updated_at = NOW()
          WHERE id = $4;
        `, targetRoomId, reqStart, reqEnd, apptId);

        // Record history
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.appointment_status_history (
            id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
          ) VALUES ($1, $2, $3, $3, $4, $5, $6, NOW());
        `, `hist-${crypto.randomUUID()}`, apptId, appt.status, authUser?.id || null, authUser?.fullName || 'Staff', reason || 'Rescheduled appointment');

        // Trigger WhatsApp Notification
        const customer = await prisma.customer.findUnique({ where: { id: appt.patient_id } }).catch(() => null);
        const treatment = await prisma.treatment.findUnique({ where: { id: appt.treatment_id } }).catch(() => null);
        const doctor = await prisma.user.findUnique({ where: { id: appt.doctor_id } }).catch(() => null);

        sendAppointmentNotification({
          eventType: 'rescheduled',
          patientName: customer?.displayName,
          patientPhone: customer?.whatsappNumber,
          appointmentDate: reqStart.toISOString().split('T')[0],
          startTime: reqStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          endTime: reqEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          treatmentName: treatment?.name,
          doctorName: doctor?.fullName,
          prisma,
          customerId: appt.patient_id
        }).catch(() => null);

        return sendJson(res, 200, { success: true, message: 'Appointment rescheduled successfully.' });
      }

      const memIdx = MEMORY_APPOINTMENTS.findIndex(a => a.id === apptId);
      if (memIdx !== -1) {
        MEMORY_APPOINTMENTS[memIdx].startTime = reqStart.toISOString();
        MEMORY_APPOINTMENTS[memIdx].endTime = reqEnd.toISOString();
        if (newRoomId) MEMORY_APPOINTMENTS[memIdx].roomId = newRoomId;
        return sendJson(res, 200, { success: true, appointment: MEMORY_APPOINTMENTS[memIdx] });
      }
      return sendJson(res, 404, { success: false, error: 'Appointment not found' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ---------------------------------------------------------------------------
  // 10. POST /api/appointments/:id/cancel
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname.startsWith('/api/appointments/') && pathname.endsWith('/cancel')) {
    const parts = pathname.split('/');
    const apptId = parts[3];

    try {
      const payload = await parseJsonBody(req);
      const reason = payload.reason || 'Cancelled by patient or staff';

      if (dbOk) {
        const appts = await prisma.$queryRawUnsafe(`SELECT * FROM public.appointments WHERE id = $1;`, apptId);
        if (!appts || appts.length === 0) return sendJson(res, 404, { success: false, error: 'Appointment not found' });

        const appt = appts[0];
        const prevStatus = appt.status;

        await prisma.$executeRawUnsafe(`
          UPDATE public.appointments
          SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1, updated_at = NOW()
          WHERE id = $2;
        `, reason, apptId);

        await prisma.$executeRawUnsafe(`
          INSERT INTO public.appointment_status_history (
            id, appointment_id, previous_status, new_status, changed_by_id, changed_by_name, reason, changed_at
          ) VALUES ($1, $2, $3, 'cancelled', $4, $5, $6, NOW());
        `, `hist-${crypto.randomUUID()}`, apptId, prevStatus, authUser?.id || null, authUser?.fullName || 'Staff', reason);

        // Notify patient
        const customer = await prisma.customer.findUnique({ where: { id: appt.patient_id } }).catch(() => null);
        sendAppointmentNotification({
          eventType: 'cancelled',
          patientName: customer?.displayName,
          patientPhone: customer?.whatsappNumber,
          appointmentDate: new Date(appt.start_time).toISOString().split('T')[0],
          startTime: new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cancellationReason: reason,
          prisma,
          customerId: appt.patient_id
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
  // 11. PATCH /api/appointments/:id/status
  // ---------------------------------------------------------------------------
  if (req.method === 'PATCH' && pathname.startsWith('/api/appointments/') && pathname.endsWith('/status')) {
    const parts = pathname.split('/');
    const apptId = parts[3];

    try {
      const payload = await parseJsonBody(req);
      const newStatus = payload.status;
      const reason = payload.reason || `Status updated to ${newStatus}`;

      const validStatuses = ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];
      if (!validStatuses.includes(newStatus)) {
        return sendJson(res, 400, { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      if (dbOk) {
        const appts = await prisma.$queryRawUnsafe(`SELECT status FROM public.appointments WHERE id = $1;`, apptId);
        if (!appts || appts.length === 0) return sendJson(res, 404, { success: false, error: 'Appointment not found' });

        const prevStatus = appts[0].status;

        await prisma.$executeRawUnsafe(`
          UPDATE public.appointments
          SET status = $1, updated_at = NOW()
          WHERE id = $2;
        `, newStatus, apptId);

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
  // 12. GET /api/doctors?branchId=...
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/doctors') {
    const branchId = query.branchId;
    if (dbOk) {
      try {
        const users = await prisma.user.findMany({
          where: { active: true },
          select: {
            id: true,
            fullName: true,
            role: true,
            branch: true,
            treatmentCategoryId: true,
            phone: true,
            avatar: true
          }
        });
        return sendJson(res, 200, users);
      } catch (e) {
        console.warn('DB doctors query fallback:', e.message);
      }
    }
    return sendJson(res, 200, [
      { id: 'doc-1', fullName: 'Dr. Zeenath', role: 'coordinator', roleTitle: 'Cosmetic Physician', branch: 'Colombo' },
      { id: 'doc-2', fullName: 'Dr. Afrij', role: 'super_admin', roleTitle: 'Senior Dermatologist', branch: 'Colombo' },
      { id: 'doc-3', fullName: 'Dr. Baasith', role: 'leads_officer', roleTitle: 'Clinical Specialist', branch: 'Maruthamunai' }
    ]);
  }

  // ---------------------------------------------------------------------------
  // 13. GET /api/patients/search?q=...
  // ---------------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/patients/search') {
    const q = String(query.q || '').trim();
    if (!q) return sendJson(res, 200, []);

    if (dbOk) {
      try {
        const patients = await prisma.customer.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { whatsappNumber: { contains: q } },
              { phoneNumber: { contains: q } }
            ]
          },
          take: 10,
          select: {
            id: true,
            displayName: true,
            whatsappNumber: true,
            phoneNumber: true,
            avatarUrl: true
          }
        });
        return sendJson(res, 200, patients);
      } catch (e) {
        console.warn('DB patient search fallback:', e.message);
      }
    }
    return sendJson(res, 200, []);
  }

  // ---------------------------------------------------------------------------
  // 14. POST /api/patients/quick-register
  // ---------------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/patients/quick-register') {
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
          // Check existing
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
  // 15. GET & POST & DELETE /api/availability-blocks
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
          LEFT JOIN public.users u ON ab.doctor_id = u.id
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
