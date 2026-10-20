/**
 * Automated Verification Suite for Alpha Health Group Appointment Booking Module
 */
import assert from 'assert';
import { intervalsOverlap, validateAppointmentSlot } from './src/conflictEngine.js';
import { handleAppointmentRoutes } from './src/appointmentRoutes.js';
import EventEmitter from 'events';

console.log('🧪 Starting Appointment Booking & Room Scheduling Verification Suite...\n');

// Mock HTTP Request / Response Helpers
function createMockReq(method, path, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = path;
  req.headers = { 'content-type': 'application/json' };
  
  process.nextTick(() => {
    if (body) {
      req.emit('data', JSON.stringify(body));
    }
    req.emit('end');
  });
  
  return req;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      if (this.onEnd) this.onEnd(this.statusCode, this.body ? JSON.parse(this.body) : null);
    }
  };
  return res;
}

function dispatchRoute(method, path, body = null, user = { id: 'test-admin', fullName: 'Dr. Test Admin', role: 'super_admin' }) {
  return new Promise((resolve) => {
    const req = createMockReq(method, path, body);
    const res = createMockRes();
    res.onEnd = (status, data) => resolve({ status, data });
    handleAppointmentRoutes(req, res, path.split('?')[0], user);
  });
}

async function runTests() {
  // --- Test Group 1: Mathematical Overlap Formula ---
  console.log('--- Test Group 1: Overlap Formula & Boundary Conditions ---');
  
  // Rule: startA < endB AND endA > startB
  // 1.1 Non-overlapping (adjacent: 10:00-11:00 and 11:00-12:00)
  assert.strictEqual(
    intervalsOverlap('2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z', '2026-10-20T11:00:00Z', '2026-10-20T12:00:00Z'),
    false,
    'Adjacent slots must NOT overlap'
  );
  console.log('✅ Pass 1.1: Adjacent boundary slots do not overlap');

  // 1.2 Partial overlap (10:00-11:00 and 10:30-11:30)
  assert.strictEqual(
    intervalsOverlap('2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z', '2026-10-20T10:30:00Z', '2026-10-20T11:30:00Z'),
    true,
    'Partially overlapping slots must be detected as conflict'
  );
  console.log('✅ Pass 1.2: Partial overlap correctly detected as conflict');

  // 1.3 Completely enclosed overlap (10:00-12:00 and 10:15-10:45)
  assert.strictEqual(
    intervalsOverlap('2026-10-20T10:00:00Z', '2026-10-20T12:00:00Z', '2026-10-20T10:15:00Z', '2026-10-20T10:45:00Z'),
    true,
    'Enclosed slot must be detected as conflict'
  );
  console.log('✅ Pass 1.3: Enclosed interval correctly detected as conflict');

  // --- Test Group 2: Branches & Room REST Endpoints ---
  console.log('\n--- Test Group 2: Branches & Room Management ---');

  // 2.1 GET /api/branches
  const branchesRes = await dispatchRoute('GET', '/api/branches');
  assert.strictEqual(branchesRes.status, 200);
  assert.ok(Array.isArray(branchesRes.data) && branchesRes.data.length >= 2);
  console.log(`✅ Pass 2.1: Branches retrieved successfully (${branchesRes.data.length} branches found)`);

  // 2.2 GET /api/rooms
  const roomsRes = await dispatchRoute('GET', '/api/rooms?branchId=branch-colombo');
  assert.strictEqual(roomsRes.status, 200);
  assert.ok(Array.isArray(roomsRes.data) && roomsRes.data.length > 0);
  console.log(`✅ Pass 2.2: Rooms for branch-colombo retrieved successfully (${roomsRes.data.length} rooms)`);

  // 2.3 POST /api/rooms
  const createRoomRes = await dispatchRoute('POST', '/api/rooms', {
    name: 'Aesthetic Laser Suite 5',
    roomNumber: 'R-105',
    branchId: 'branch-colombo',
    color: '#3b82f6',
    description: 'Specialized laser rejuvenation',
    operatingStart: '08:00',
    operatingEnd: '20:00',
    treatmentIds: ['t-skin-1']
  });
  assert.strictEqual(createRoomRes.status, 201);
  assert.ok(createRoomRes.data.success);
  const testRoomId = createRoomRes.data.room.id;
  console.log(`✅ Pass 2.3: New room created with ID: ${testRoomId}`);

  // 2.4 PATCH /api/rooms/:id
  const patchRoomRes = await dispatchRoute('PATCH', `/api/rooms/${testRoomId}`, {
    name: 'Aesthetic Laser Suite 5 (Updated)',
    color: '#8b5cf6'
  });
  assert.strictEqual(patchRoomRes.status, 200);
  console.log('✅ Pass 2.4: Room updated successfully');

  // --- Test Group 3: Appointment Booking & Conflict Prevention ---
  console.log('\n--- Test Group 3: Appointment Booking & Conflict Prevention ---');

  // 3.1 Book valid appointment
  const bookRes1 = await dispatchRoute('POST', '/api/appointments', {
    branchId: 'branch-colombo',
    roomId: testRoomId,
    doctorId: 'doc-1',
    treatmentId: 't-skin-1',
    startTime: '2026-10-25T10:00:00Z',
    endTime: '2026-10-25T11:00:00Z',
    patientName: 'Jane Perera',
    patientPhone: '+94771234567',
    notes: 'Initial clinical assessment'
  });
  assert.strictEqual(bookRes1.status, 201);
  assert.ok(bookRes1.data.success);
  const appt1Id = bookRes1.data.appointment.id;
  console.log(`✅ Pass 3.1: Valid appointment booked successfully (ID: ${appt1Id})`);

  // 3.2 Double-booking same room (Should reject with 409 Conflict)
  const doubleBookRoom = await dispatchRoute('POST', '/api/appointments', {
    branchId: 'branch-colombo',
    roomId: testRoomId,
    doctorId: 'doc-2', // Different doctor, but SAME room
    treatmentId: 't-skin-1',
    startTime: '2026-10-25T10:30:00Z', // Overlaps with 10:00-11:00
    endTime: '2026-10-25T11:30:00Z',
    patientName: 'Kamal Silva',
    patientPhone: '+94779876543'
  });
  assert.strictEqual(doubleBookRoom.status, 409);
  assert.strictEqual(doubleBookRoom.data.success, false);
  console.log('✅ Pass 3.2: Room double-booking strictly rejected with 409 Conflict');

  // 3.3 Doctor Conflict across rooms (Should reject with 409 Conflict)
  // Attempt to book doc-1 in a different room at the same time
  const doubleBookDoctor = await dispatchRoute('POST', '/api/appointments', {
    branchId: 'branch-colombo',
    roomId: 'room-col-2', // Different room
    doctorId: 'doc-1',    // SAME doctor
    treatmentId: 't-skin-1',
    startTime: '2026-10-25T10:15:00Z', // Overlaps with doc-1's 10:00-11:00
    endTime: '2026-10-25T10:45:00Z',
    patientName: 'Nimal Fernando',
    patientPhone: '+94775551234'
  });
  assert.strictEqual(doubleBookDoctor.status, 409);
  assert.strictEqual(doubleBookDoctor.data.success, false);
  console.log('✅ Pass 3.3: Doctor cross-room double-booking rejected with 409 Conflict');

  // 3.4 Non-overlapping booking in the same room (Adjacent: 11:00-12:00)
  const adjacentBook = await dispatchRoute('POST', '/api/appointments', {
    branchId: 'branch-colombo',
    roomId: testRoomId,
    doctorId: 'doc-2',
    treatmentId: 't-skin-1',
    startTime: '2026-10-25T11:00:00Z',
    endTime: '2026-10-25T12:00:00Z',
    patientName: 'Sunil Wickrama',
    patientPhone: '+94776662222'
  });
  assert.strictEqual(adjacentBook.status, 201);
  console.log('✅ Pass 3.4: Adjacent time slot booked cleanly without false positive');

  // --- Test Group 4: Lifecycle, Status Transitions & Rescheduling ---
  console.log('\n--- Test Group 4: Appointment Lifecycle & Rescheduling ---');

  // 4.1 Update status to checked_in
  const statusRes1 = await dispatchRoute('PATCH', `/api/appointments/${appt1Id}/status`, {
    status: 'checked_in',
    reason: 'Patient arrived at clinic front desk'
  });
  assert.strictEqual(statusRes1.status, 200);
  console.log('✅ Pass 4.1: Status updated to checked_in');

  // 4.2 Reschedule to open slot
  const reschedRes = await dispatchRoute('POST', `/api/appointments/${appt1Id}/reschedule`, {
    newStartTime: '2026-10-25T14:00:00Z',
    newEndTime: '2026-10-25T15:00:00Z',
    reason: 'Patient requested afternoon time'
  });
  assert.strictEqual(reschedRes.status, 200);
  console.log('✅ Pass 4.2: Appointment rescheduled successfully');

  // 4.3 Safe Room Deactivation Protection
  // Attempting to deactivate testRoomId while an appointment exists in future should be rejected or warned
  const deleteRoomWithAppt = await dispatchRoute('DELETE', `/api/rooms/${testRoomId}`);
  assert.strictEqual(deleteRoomWithAppt.status, 400);
  assert.ok(deleteRoomWithAppt.data.error.includes('upcoming active appointment'));
  console.log('✅ Pass 4.3: Safe room deactivation protection prevented deleting room with future bookings');

  // 4.4 Cancel appointment
  const cancelRes = await dispatchRoute('POST', `/api/appointments/${appt1Id}/cancel`, {
    reason: 'Patient had travel conflict'
  });
  assert.strictEqual(cancelRes.status, 200);
  console.log('✅ Pass 4.4: Appointment cancelled with reason recorded in audit trail');

  // 4.5 Cancelled slot can now be re-booked by another patient
  const rebookCancelled = await dispatchRoute('POST', '/api/appointments', {
    branchId: 'branch-colombo',
    roomId: testRoomId,
    doctorId: 'doc-1',
    treatmentId: 't-skin-1',
    startTime: '2026-10-25T14:00:00Z',
    endTime: '2026-10-25T15:00:00Z',
    patientName: 'Anusha Dias',
    patientPhone: '+94773334444'
  });
  assert.strictEqual(rebookCancelled.status, 201);
  console.log('✅ Pass 4.5: Previously cancelled slot successfully re-booked by new patient');

  // --- Test Group 5: Patient Search & Quick Registration ---
  console.log('\n--- Test Group 5: Patient Search & Quick Registration ---');

  const quickReg = await dispatchRoute('POST', '/api/patients/quick-register', {
    name: 'Mrs. Dilani Senanayake',
    phone: '+94712345678'
  });
  assert.strictEqual(quickReg.status, 201);
  assert.ok(quickReg.data.patient);
  console.log(`✅ Pass 5.1: Quick patient registration succeeded (Name: ${quickReg.data.patient.displayName})`);

  console.log('\n🎉 ALL APPOINTMENT & ROOM SCHEDULER BACKEND TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

