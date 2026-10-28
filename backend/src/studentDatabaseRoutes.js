import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../data/cras-course-inquiries.json');
const ALLOWED_ROLES = new Set([
  'super_admin',
  'coordinator',
  'leads_officer',
  'exam_department_manager',
  'exam_coordinator',
  'exam_providing_officer',
]);
const UPDATE_ROLES = new Set(ALLOWED_ROLES);
const MAX_BODY_BYTES = 100 * 1024;
let storePromise;
let writeQueue = Promise.resolve();

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function isAllowed(user, roles = ALLOWED_ROLES) {
  return Boolean(user?.id && user.active !== false && roles.has(user.role));
}

function clean(value, max = 500) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function contactDigits(value) {
  return clean(value, 80).replace(/\D/g, '');
}

function optionalDate(payload, field) {
  if (!(field in payload) || payload[field] === '' || payload[field] === null || payload[field] === undefined) return null;
  const value = parseDate(payload[field]);
  if (!value) throw new Error(`${field} must use YYYY-MM-DD format.`);
  return value;
}

function nextRecordId(records) {
  const max = records.reduce((highest, record) => {
    const number = Number.parseInt(String(record.id || '').replace(/^cras-/, ''), 10);
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `cras-${String(max + 1).padStart(6, '0')}`;
}

function buildRecord(payload, id, actorName) {
  const contactNumber = clean(payload.contactNumber, 80);
  const name = clean(payload.name, 180);
  if (!contactNumber && !name) throw new Error('Provide a student name or contact number.');
  return {
    id,
    contactNumber,
    contactDigits: contactDigits(contactNumber),
    receivedDate: optionalDate(payload, 'receivedDate'),
    courseType: clean(payload.courseType, 250),
    sourceAssignedTo: clean(payload.sourceAssignedTo, 160) || actorName || 'CRM',
    leadStatus: clean(payload.leadStatus, 160) || 'New inquiry',
    name,
    professional: clean(payload.professional, 180),
    place: clean(payload.place, 160),
    remark: clean(payload.remark, 1200),
    followUpDate: optionalDate(payload, 'followUpDate'),
    followUpStatus: clean(payload.followUpStatus, 160),
    followUpRemark: clean(payload.followUpRemark, 1200),
    sourceSheets: ['CRM'],
    coordinatorId: payload.coordinatorId ? clean(payload.coordinatorId, 120) : null,
    coordinatorName: payload.coordinatorName ? clean(payload.coordinatorName, 160) : null,
    coordinatorAssignedAt: payload.coordinatorId ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
}

async function loadStore() {
  if (!storePromise) {
    storePromise = fs.readFile(DATA_PATH, 'utf8').then(raw => {
      const value = JSON.parse(raw);
      if (!value || !Array.isArray(value.records)) throw new Error('Student database source is invalid.');
      return value;
    });
  }
  return storePromise;
}

function scheduleWrite(store) {
  const serialised = JSON.stringify({ ...store, importedAt: store.importedAt || new Date().toISOString(), updatedAt: new Date().toISOString() }, null, 2);
  writeQueue = writeQueue.then(async () => {
    const temporary = `${DATA_PATH}.${process.pid}.tmp`;
    await fs.writeFile(temporary, serialised, 'utf8');
    await fs.rename(temporary, DATA_PATH);
  });
  return writeQueue;
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('Request body too large.');
  }
  if (!body) return {};
  const value = JSON.parse(body);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('A JSON object is required.');
  return value;
}

function buildSummary(records) {
  const count = values => values.reduce((result, value) => {
    const key = clean(value) || 'Not recorded';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const assigned = records.filter(record => record.coordinatorId || record.coordinatorName).length;
  const followUp = records.filter(record => record.followUpDate || record.followUpStatus || record.followUpRemark).length;
  return {
    total: records.length,
    assigned,
    unassigned: records.length - assigned,
    withFollowUp: followUp,
    statuses: count(records.map(record => record.leadStatus)),
    courses: count(records.map(record => record.courseType)),
    coordinators: count(records.map(record => record.coordinatorName || record.sourceAssignedTo)),
  };
}

export async function handleStudentDatabaseRoutes(req, res, pathname, user) {
  if (!pathname.startsWith('/api/student-database')) return false;
  try {
    if (!isAllowed(user)) {
      json(res, 403, { success: false, error: 'Student database access is restricted to exam operations staff.' });
      return true;
    }
    const store = await loadStore();
    const url = new URL(req.url || '/', 'http://localhost');

    if (pathname === '/api/student-database/summary' && req.method === 'GET') {
      json(res, 200, { success: true, data: buildSummary(store.records) });
      return true;
    }

    if (pathname === '/api/student-database/coordinators' && req.method === 'GET') {
      const names = [...new Set(store.records.map(record => record.coordinatorName || record.sourceAssignedTo).map(clean).filter(Boolean))].sort();
      json(res, 200, { success: true, data: names });
      return true;
    }

    if (pathname === '/api/student-database/contacts' && req.method === 'POST') {
      if (!isAllowed(user, UPDATE_ROLES)) {
        json(res, 403, { success: false, error: 'You do not have permission to create student records.' });
        return true;
      }
      const payload = await readBody(req);
      const record = buildRecord(payload, nextRecordId(store.records), user.fullName || user.email || 'CRM');
      store.records.unshift(record);
      store.recordCount = store.records.length;
      await scheduleWrite(store);
      json(res, 201, { success: true, data: record });
      return true;
    }

    if (pathname === '/api/student-database/contacts' && req.method === 'GET') {
      const search = clean(url.searchParams.get('search'), 150).toLowerCase();
      const status = clean(url.searchParams.get('status'), 150).toLowerCase();
      const coordinator = clean(url.searchParams.get('coordinator'), 150).toLowerCase();
      const course = clean(url.searchParams.get('course'), 250).toLowerCase();
      const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const pageSize = Math.min(200, Math.max(10, Number.parseInt(url.searchParams.get('pageSize') || '50', 10) || 50));
      const filtered = store.records.filter(record => {
        const text = [record.name, record.contactNumber, record.courseType, record.professional, record.place, record.remark, record.followUpRemark].map(clean).join(' ').toLowerCase();
        const assigned = clean(record.coordinatorName || record.sourceAssignedTo).toLowerCase();
        return (!search || text.includes(search)) &&
          (!status || clean(record.leadStatus).toLowerCase() === status) &&
          (!coordinator || assigned === coordinator) &&
          (!course || clean(record.courseType).toLowerCase() === course);
      });
      const start = (page - 1) * pageSize;
      json(res, 200, {
        success: true,
        data: {
          items: filtered.slice(start, start + pageSize),
          total: filtered.length,
          page,
          pageSize,
          summary: buildSummary(store.records),
          sourceFile: store.sourceFile,
          importedAt: store.importedAt,
        },
      });
      return true;
    }

    const match = pathname.match(/^\/api\/student-database\/contacts\/([^/]+)$/);
    if (match && req.method === 'PATCH') {
      if (!isAllowed(user, UPDATE_ROLES)) {
        json(res, 403, { success: false, error: 'You do not have permission to update student records.' });
        return true;
      }
      const id = decodeURIComponent(match[1]);
      const record = store.records.find(item => item.id === id);
      if (!record) {
        json(res, 404, { success: false, error: 'Student record not found.' });
        return true;
      }
      const payload = await readBody(req);
      const previousCoordinatorId = record.coordinatorId;
      if ('receivedDate' in payload && payload.receivedDate) optionalDate(payload, 'receivedDate');
      const requestedFollowUpDate = 'followUpDate' in payload && payload.followUpDate ? parseDate(payload.followUpDate) : null;
      if ('followUpDate' in payload && payload.followUpDate && !requestedFollowUpDate) {
        json(res, 400, { success: false, error: 'Follow-up date must use YYYY-MM-DD format.' });
        return true;
      }
      if ('contactNumber' in payload) {
        record.contactNumber = clean(payload.contactNumber, 80);
        record.contactDigits = contactDigits(record.contactNumber);
      }
      if ('name' in payload) record.name = clean(payload.name, 180);
      if ('receivedDate' in payload) record.receivedDate = optionalDate(payload, 'receivedDate');
      if ('courseType' in payload) record.courseType = clean(payload.courseType, 250);
      if ('sourceAssignedTo' in payload) record.sourceAssignedTo = clean(payload.sourceAssignedTo, 160);
      if ('professional' in payload) record.professional = clean(payload.professional, 180);
      if ('place' in payload) record.place = clean(payload.place, 160);
      if ('remark' in payload) record.remark = clean(payload.remark, 1200);
      if ('coordinatorId' in payload) record.coordinatorId = payload.coordinatorId ? clean(payload.coordinatorId, 120) : null;
      if ('coordinatorName' in payload) record.coordinatorName = payload.coordinatorName ? clean(payload.coordinatorName, 160) : null;
      if ('coordinatorId' in payload && record.coordinatorId !== previousCoordinatorId) record.coordinatorAssignedAt = record.coordinatorId ? new Date().toISOString() : null;
      if ('followUpDate' in payload) record.followUpDate = requestedFollowUpDate;
      if ('followUpStatus' in payload) record.followUpStatus = clean(payload.followUpStatus, 160);
      if ('followUpRemark' in payload) record.followUpRemark = clean(payload.followUpRemark, 1000);
      if ('leadStatus' in payload) record.leadStatus = clean(payload.leadStatus, 160);
      if (!record.contactNumber && !record.name) {
        json(res, 400, { success: false, error: 'A student name or contact number is required.' });
        return true;
      }
      record.updatedAt = new Date().toISOString();
      await scheduleWrite(store);
      json(res, 200, { success: true, data: record });
      return true;
    }

    json(res, 404, { success: false, error: 'Student database route not found.' });
  } catch (error) {
    json(res, 400, { success: false, error: error?.message || 'Unable to load student database.' });
  }
  return true;
}
