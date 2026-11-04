// Company & Branch Management API.
// Registered before settingsRoutes so `/api/companies/:id/settings` (localization)
// and `/api/companies/:id/settings/:section` never collide.

import { randomUUID } from 'node:crypto';
import { getPrisma, getDbStatus } from './db.js';
import { SettingsService, VersionConflictError } from './services/settingsService.js';
import { authorize, getActorCompanyMemberships } from './authorizationService.js';
import { ApiError, sendJson, sendError, readJsonBody, queryOf } from './apiErrors.js';

const COMPANY_CODES = ['RWC', 'CRAS', 'AHC'];
const COMPANY_NAMES = {
  RWC: 'Royal Wellness Center',
  CRAS: 'College of Royal Aesthetic of Sri Lanka',
  AHC: 'Alpha Health Consultancy',
};
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const BRANCH_STATUSES = ['active', 'inactive', 'archived'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const TIME_FORMATS = ['12h', '24h'];
const LANGUAGES = ['en', 'si', 'ta'];
const CURRENCY_RE = /^[A-Z]{3}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BRANCH_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;

function requireUser(user) {
  if (!user?.id || user.active === false) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in with an active staff account.');
  }
}

function normalizeCompany(value) {
  return String(value || '').trim().toUpperCase();
}

async function requireCompanyAccess(user, companyId, capability) {
  const company = normalizeCompany(companyId);
  if (!COMPANY_CODES.includes(company)) {
    throw new ApiError(404, 'COMPANY_NOT_FOUND', 'That company does not exist.');
  }
  const decision = await authorize(user, capability, null, { company });
  if (!decision.allowed) {
    throw new ApiError(
      decision.code === 'UNAUTHENTICATED' ? 401 : 403,
      decision.code,
      decision.message,
      { company }
    );
  }
  return company;
}

function asText(value, field, { required = false, min = 1, max = 255 } = {}) {
  if (value === undefined) {
    if (required) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required.`, { field });
    return undefined;
  }
  if (value === null) {
    if (required) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required.`, { field });
    return null;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be text.`, { field });
  }
  const text = value.trim();
  if (!text) {
    if (required) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required.`, { field });
    return '';
  }
  if (text.length < min) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be at least ${min} characters.`, { field });
  }
  if (text.length > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be at most ${max} characters.`, { field });
  }
  if (/[\u0000-\u001f\u007f<>]/.test(text)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} contains characters that are not allowed.`, { field });
  }
  return text;
}

function asEmail(value, field = 'email') {
  if (value === undefined) return undefined;
  if (value === null || value === '') return '';
  const text = asText(value, field, { max: 255 });
  if (!text) return '';
  if (!EMAIL_RE.test(text)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid email address.`, { field });
  }
  return text.toLowerCase();
}

function asPhone(value, field = 'phone') {
  if (value === undefined) return undefined;
  if (value === null || value === '') return '';
  const text = asText(value, field, { max: 30 });
  const digits = text.replace(/\D/g, '');
  if (!/^[+\d][\d\s()+-]*$/.test(text) || digits.length < 7 || digits.length > 20) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid phone number.`, { field });
  }
  return text;
}

function asEnum(value, field, allowed) {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be one of: ${allowed.join(', ')}.`, { field });
  }
  return value;
}

function asTimezone(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[A-Za-z]+\/[A-Za-z_]+$/.test(value) || value.length > 64) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'timezone must be a valid IANA time zone.', { field: 'timezone' });
  }
  return value;
}

function validateLegalName(value) {
  if (value === undefined) return undefined;
  if (value === null) return '';
  const text = asText(value, 'legalName', { max: 200 });
  if (text && text.length < 2) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'legalName must be at least 2 characters.', { field: 'legalName' });
  }
  return text;
}

function normalizeBusinessHours(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_BUSINESS_HOURS', 'businessHours must be an object keyed by weekday.');
  }
  const result = {};
  for (const key of Object.keys(value)) {
    if (!WEEKDAYS.includes(key)) {
      throw new ApiError(400, 'INVALID_BUSINESS_HOURS', `Unknown weekday "${key}" in businessHours.`);
    }
  }
  for (const day of WEEKDAYS) {
    const entry = value[day];
    if (entry === undefined) continue;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError(400, 'INVALID_BUSINESS_HOURS', `businessHours.${day} must be an object.`);
    }
    if (entry.closed === true) {
      result[day] = { closed: true, open: null, close: null };
      continue;
    }
    if (!TIME_RE.test(String(entry.open || '')) || !TIME_RE.test(String(entry.close || ''))) {
      throw new ApiError(400, 'INVALID_BUSINESS_HOURS', `businessHours.${day} needs open/close times in HH:MM.`);
    }
    if (entry.open >= entry.close) {
      throw new ApiError(400, 'INVALID_BUSINESS_HOURS', `businessHours.${day} close time must be after open time.`);
    }
    result[day] = { closed: false, open: entry.open, close: entry.close };
  }
  return result;
}

function normalizeHolidayCalendar(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', 'holidayCalendar must be an array.');
  }
  if (value.length > 200) {
    throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', 'holidayCalendar cannot contain more than 200 entries.');
  }
  const seen = new Set();
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', 'Each holiday must be an object.');
    }
    if (!DATE_RE.test(String(item.date || '')) || Number.isNaN(new Date(item.date).getTime())) {
      throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', 'Holiday dates must use YYYY-MM-DD.');
    }
    if (seen.has(item.date)) {
      throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', `Duplicate holiday date ${item.date}.`);
    }
    seen.add(item.date);
    const name = asText(item.name, 'holiday name', { required: true, max: 120 });
    const closed = item.closed !== false;
    let open = null;
    let close = null;
    if (!closed) {
      if (!TIME_RE.test(String(item.open || '')) || !TIME_RE.test(String(item.close || ''))) {
        throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', 'Special opening hours need open/close times in HH:MM.');
      }
      if (item.open >= item.close) {
        throw new ApiError(400, 'INVALID_HOLIDAY_CALENDAR', 'Special closing time must be after opening time.');
      }
      open = item.open;
      close = item.close;
    }
    return { date: item.date, name, closed, open, close };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function branchWritableFields(body, { partial }) {
  const fields = {};
  const name = asText(body.name, 'name', { required: !partial, max: 120 });
  if (name !== undefined) fields.name = name;

  if (body.code !== undefined || !partial) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!BRANCH_CODE_RE.test(code)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'code must be 2–20 letters, numbers, dashes or underscores.', { field: 'code' });
    }
    fields.code = code;
  }

  const simple = {
    address: { max: 500 },
    city: { max: 120 },
    district: { max: 120 },
    province: { max: 120 },
    postalCode: { max: 30 },
  };
  for (const [field, options] of Object.entries(simple)) {
    const value = asText(body[field], field, options);
    if (value !== undefined) fields[field] = value;
  }

  if (body.phone !== undefined) fields.phone = asPhone(body.phone, 'phone');
  if (body.email !== undefined) fields.email = asEmail(body.email, 'email');

  const businessHours = normalizeBusinessHours(body.businessHours);
  if (businessHours !== undefined) fields.businessHours = businessHours;
  const holidayCalendar = normalizeHolidayCalendar(body.holidayCalendar);
  if (holidayCalendar !== undefined) fields.holidayCalendar = holidayCalendar;

  return fields;
}

function serializeBranch(branch) {
  return {
    id: branch.id,
    company: branch.company,
    name: branch.name,
    code: branch.code,
    address: branch.address || '',
    city: branch.city || '',
    district: branch.district || '',
    province: branch.province || '',
    postalCode: branch.postalCode || '',
    phone: branch.phone || '',
    email: branch.email || '',
    managerId: branch.managerId || null,
    managerName: branch.managerName || '',
    status: branch.status || (branch.isActive ? 'active' : 'inactive'),
    isActive: branch.isActive,
    businessHours: branch.businessHours || null,
    holidayCalendar: branch.holidayCalendar || null,
    archivedAt: branch.archivedAt,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

async function resolveManager(prisma, company, managerId) {
  if (managerId === undefined) return undefined;
  if (managerId === null || managerId === '') return { managerId: null, managerName: null };

  const manager = await prisma.user.findFirst({
    where: { id: String(managerId), active: true },
    select: { id: true, fullName: true, company: true, role: true },
  });
  if (!manager) {
    throw new ApiError(400, 'INVALID_MANAGER', 'The selected manager is not an active staff account.');
  }

  let eligible = manager.role === 'super_admin' || manager.company === company || manager.company === 'ALL';
  if (!eligible) {
    const membership = await prisma.companyMembership.count({
      where: { userId: manager.id, company, active: true },
    });
    eligible = membership > 0;
  }
  if (!eligible) {
    throw new ApiError(400, 'MANAGER_COMPANY_MISMATCH', 'The selected manager does not have access to this company.');
  }
  return { managerId: manager.id, managerName: manager.fullName };
}

async function writeAudit(prisma, { action, entityType, entityId, user, previous, next }) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      performedById: user?.id || null,
      performedByName: user?.fullName || 'Administrator',
      previousValue: previous ? JSON.stringify(previous) : null,
      newValue: next ? JSON.stringify(next) : null,
      timestamp: new Date(),
    },
  });
}

async function branchDependencies(prisma, company, branch) {
  const now = new Date();
  const activeStatuses = ['cancelled', 'completed', 'no_show'];

  const [appointmentCount, appointmentRows, staff, rooms] = await Promise.all([
    prisma.appointment.count({
      where: { branchId: branch.id, startTime: { gte: now }, status: { notIn: activeStatuses } },
    }),
    prisma.appointment.findMany({
      where: { branchId: branch.id, startTime: { gte: now }, status: { notIn: activeStatuses } },
      orderBy: { startTime: 'asc' },
      take: 25,
      include: {
        patient: { select: { displayName: true } },
        doctor: { select: { fullName: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        active: true,
        company,
        OR: [{ branch: branch.name }, { branch: branch.code }],
      },
      select: { id: true, fullName: true, role: true, branch: true },
    }),
    prisma.room.findMany({
      where: { branchId: branch.id, isActive: true },
      select: { id: true, name: true, roomNumber: true },
    }),
  ]);

  const appointments = appointmentRows.map((row) => ({
    id: row.id,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    patientName: row.patient?.displayName || 'Patient',
    doctorName: row.doctor?.fullName || 'Unassigned',
  }));

  const requiredActions = [];
  if (appointmentCount > 0) {
    requiredActions.push(`Reassign or cancel ${appointmentCount} future appointment${appointmentCount === 1 ? '' : 's'} before deactivation.`);
  }
  if (staff.length > 0) {
    requiredActions.push(`Reassign ${staff.length} staff member${staff.length === 1 ? '' : 's'} to another branch.`);
  }
  if (rooms.length > 0) {
    requiredActions.push(`Deactivate or move ${rooms.length} treatment room${rooms.length === 1 ? '' : 's'}.`);
  }

  return {
    appointments: { count: appointmentCount, items: appointments },
    staff: { count: staff.length, items: staff },
    rooms: { count: rooms.length, items: rooms },
    requiredActions,
  };
}

async function listAuditLogs(prisma, company, query) {
  const take = Math.min(Math.max(1, Number(query.limit) || 20), 100);
  const page = Math.max(1, Number(query.page) || 1);
  const skip = (page - 1) * take;

  const branchIds = (await prisma.branch.findMany({ where: { company }, select: { id: true } })).map((b) => b.id);
  const scopes = [{ entityType: 'SystemSetting', entityId: { startsWith: `${company}:settings:` } }];
  if (branchIds.length) scopes.push({ entityType: 'Branch', entityId: { in: branchIds } });

  const where = { OR: scopes };
  if (query.userId) where.performedById = query.userId;
  if (query.from || query.to) {
    where.timestamp = {};
    if (query.from) where.timestamp.gte = new Date(query.from);
    if (query.to) where.timestamp.lte = new Date(query.to);
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take }),
  ]);

  const parse = (value) => {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return value; }
  };

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      performedById: row.performedById,
      performedByName: row.performedByName,
      previousValue: parse(row.previousValue),
      newValue: parse(row.newValue),
      timestamp: row.timestamp,
    })),
    pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
  };
}

async function companySummary(prisma, company) {
  const grouped = await prisma.branch.groupBy({
    by: ['status'],
    where: { company },
    _count: { _all: true },
  });
  const counts = { total: 0, active: 0, inactive: 0, archived: 0 };
  for (const row of grouped) {
    const count = row._count._all;
    counts.total += count;
    if (BRANCH_STATUSES.includes(row.status)) counts[row.status] += count;
  }
  return counts;
}

async function updatedByName(prisma, userId) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    return user?.fullName || null;
  } catch {
    return null;
  }
}

async function listCompanies(prisma, user) {
  const memberships = user.role === 'super_admin'
    ? COMPANY_CODES
    : (await getActorCompanyMemberships(user.id, user.role)).map(normalizeCompany);
  const codes = COMPANY_CODES.filter((code) => memberships.includes(code));

  if (codes.length === 0) return [];

  const [grouped, settings] = await Promise.all([
    prisma.branch.groupBy({
      by: ['company', 'status'],
      where: { company: { in: codes } },
      _count: { _all: true },
    }),
    prisma.systemSetting.findMany({
      where: { section: 'company', scope: 'company', scopeId: { in: codes } },
      select: { scopeId: true, payload: true },
    }),
  ]);

  const counts = Object.fromEntries(codes.map((code) => [code, { total: 0, active: 0 }]));
  for (const row of grouped) {
    const bucket = counts[row.company];
    if (!bucket) continue;
    bucket.total += row._count._all;
    if (row.status === 'active') bucket.active += row._count._all;
  }

  return codes.map((code) => {
    const setting = settings.find((row) => row.scopeId === code);
    const payload = setting?.payload && typeof setting.payload === 'object' ? setting.payload : {};
    return {
      code,
      name: payload.displayName || COMPANY_NAMES[code],
      legalName: payload.legalName || '',
      status: payload.status || 'active',
      branchCount: counts[code].total,
      activeBranches: counts[code].active,
    };
  });
}

export async function handleCompanyRoutes(req, res, pathname, user, correlationId) {
  if (!pathname.startsWith('/api/companies')) return false;

  // Delegate /api/companies/:companyId/settings/:section (e.g. /settings/company, /settings/sales)
  // to handleSettingsRoutes, unless it's /settings/audit-logs which is handled here
  if (/^\/api\/companies\/[^/]+\/settings\/[^/]+$/.test(pathname) && !pathname.endsWith('/settings/audit-logs')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  try {
    requireUser(user);

    const prisma = getPrisma();
    if (!prisma || !getDbStatus()) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Company management requires database storage.');
    }

    const query = queryOf(req);

    // ------------------------------------------------------------ Company directory
    if (pathname === '/api/companies') {
      if (req.method !== 'GET') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET for the company directory.');
      }
      const companies = await listCompanies(prisma, user);
      sendJson(res, 200, { success: true, companies });
      return true;
    }

    // ------------------------------------------------------------ Branch managers
    const managersMatch = pathname.match(/^\/api\/companies\/([^/]+)\/branch-managers$/);
    if (managersMatch) {
      if (req.method !== 'GET') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET to list eligible branch managers.');
      }
      const company = await requireCompanyAccess(user, managersMatch[1], 'staff.view');
      const search = String(query.search || '').trim();
      const managers = await prisma.user.findMany({
        where: {
          active: true,
          OR: [
            { company: { in: [company, 'ALL'] } },
            { companyMemberships: { some: { company, active: true } } },
          ],
          ...(search
            ? {
                AND: [{
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                }],
              }
            : {}),
        },
        select: { id: true, fullName: true, email: true, role: true, branch: true, company: true },
        orderBy: { fullName: 'asc' },
        take: 50,
      });
      sendJson(res, 200, { success: true, managers });
      return true;
    }

    // ------------------------------------------------------------ Audit history
    const auditMatch = pathname.match(/^\/api\/companies\/([^/]+)\/settings\/audit-logs$/);
    if (auditMatch) {
      if (req.method !== 'GET') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET to read change history.');
      }
      const company = await requireCompanyAccess(user, auditMatch[1], 'staff.audit.view');
      const result = await listAuditLogs(prisma, company, query);
      sendJson(res, 200, { success: true, ...result });
      return true;
    }

    // ------------------------------------------------------------ Localization & fiscal
    const settingsMatch = pathname.match(/^\/api\/companies\/([^/]+)\/settings$/);
    if (settingsMatch) {
      const company = await requireCompanyAccess(
        user,
        settingsMatch[1],
        req.method === 'GET' ? 'staff.view' : 'system.settings.manage'
      );

      if (req.method === 'GET') {
        const setting = await SettingsService.getSetting('company_localization', 'company', company);
        const actor = await updatedByName(prisma, setting.updatedById);
        sendJson(res, 200, { success: true, ...setting, updatedByName: actor });
        return true;
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await readJsonBody(req);
        const current = await SettingsService.getSetting('company_localization', 'company', company);
        const input = body.data && typeof body.data === 'object' ? body.data : body;

        const next = { ...current.data };
        const fields = {
          currency: input.currency === undefined ? undefined : String(input.currency).toUpperCase(),
          timezone: asTimezone(input.timezone),
          dateFormat: asEnum(input.dateFormat, 'dateFormat', DATE_FORMATS),
          timeFormat: asEnum(input.timeFormat, 'timeFormat', TIME_FORMATS),
          language: asEnum(input.language, 'language', LANGUAGES),
          fiscalYearStart: input.fiscalYearStart === undefined
            ? undefined
            : (MONTH_DAY_RE.test(String(input.fiscalYearStart)) ? input.fiscalYearStart : null),
          holidayCalendarRef: asText(input.holidayCalendarRef, 'holidayCalendarRef', { max: 20 }),
        };

        if (fields.currency !== undefined) {
          if (!CURRENCY_RE.test(fields.currency)) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'currency must be a 3-letter ISO code.', { field: 'currency' });
          }
          next.currency = fields.currency;
        }
        if (fields.fiscalYearStart === null) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'fiscalYearStart must use MM-DD.', { field: 'fiscalYearStart' });
        }
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && key !== 'currency' && key !== 'fiscalYearStart') next[key] = value;
        }
        if (fields.fiscalYearStart !== undefined) next.fiscalYearStart = fields.fiscalYearStart;

        if (input.workingWeek !== undefined) {
          if (!Array.isArray(input.workingWeek) || input.workingWeek.length > 7) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'workingWeek must be an array of weekdays (0–6).', { field: 'workingWeek' });
          }
          const days = input.workingWeek.map(Number);
          if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(days).size !== days.length) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'workingWeek must contain unique weekdays from 0 to 6.', { field: 'workingWeek' });
          }
          next.workingWeek = days;
        }

        const result = await SettingsService.updateSetting({
          section: 'company_localization',
          scope: 'company',
          scopeId: company,
          version: body.version ?? current.version,
          data: next,
          user,
          correlationId,
        });
        sendJson(res, 200, {
          success: true,
          ...result,
          updatedByName: user.fullName || null,
          // Localization applies from now on; existing appointments and records keep their stored values.
          effectiveFrom: new Date().toISOString(),
        });
        return true;
      }

      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET or PATCH for localization settings.');
    }

    // ------------------------------------------------------------ Branch collection
    const branchesMatch = pathname.match(/^\/api\/companies\/([^/]+)\/branches$/);
    if (branchesMatch) {
      const company = await requireCompanyAccess(
        user,
        branchesMatch[1],
        req.method === 'GET' ? 'staff.view' : 'system.settings.manage'
      );

      if (req.method === 'GET') {
        const take = Math.min(Math.max(1, Number(query.limit) || 20), 100);
        const page = Math.max(1, Number(query.page) || 1);
        const skip = (page - 1) * take;
        const status = String(query.status || '').trim().toLowerCase();
        const city = String(query.city || '').trim();
        const search = String(query.search || '').trim();

        const where = { company };
        if (status && status !== 'all') {
          if (!BRANCH_STATUSES.includes(status)) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'status must be active, inactive or archived.', { field: 'status' });
          }
          where.status = status;
        }
        if (city && city.toLowerCase() !== 'all') where.city = city;
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { managerName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [total, rows, cities] = await Promise.all([
          prisma.branch.count({ where }),
          prisma.branch.findMany({ where, orderBy: [{ status: 'asc' }, { name: 'asc' }], skip, take }),
          prisma.branch.findMany({
            where: { company, NOT: [{ city: null }, { city: '' }] },
            distinct: ['city'],
            select: { city: true },
            orderBy: { city: 'asc' },
          }),
        ]);

        sendJson(res, 200, {
          success: true,
          items: rows.map(serializeBranch),
          pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
          counts: await companySummary(prisma, company),
          cities: cities.map((row) => row.city).filter(Boolean),
        });
        return true;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const fields = branchWritableFields(body, { partial: false });
        const manager = await resolveManager(prisma, company, body.managerId);
        const status = body.status === undefined
          ? 'active'
          : asEnum(body.status, 'status', BRANCH_STATUSES);

        const duplicate = await prisma.branch.findFirst({
          where: { company, code: fields.code },
          select: { id: true },
        });
        if (duplicate) {
          throw new ApiError(409, 'BRANCH_CODE_CONFLICT', `Branch code ${fields.code} already exists in ${company}.`, {
            field: 'code',
          });
        }

        const created = await prisma.branch.create({
          data: {
            id: `branch-${randomUUID()}`,
            company,
            ...fields,
            ...(manager || {}),
            status,
            isActive: status === 'active',
          },
        });

        await writeAudit(prisma, {
          action: 'branch.create',
          entityType: 'Branch',
          entityId: created.id,
          user,
          next: serializeBranch(created),
        });

        sendJson(res, 201, { success: true, branch: serializeBranch(created) });
        return true;
      }

      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST for branches.');
    }

    // ------------------------------------------------------------ Branch actions
    const actionMatch = pathname.match(
      /^\/api\/companies\/([^/]+)\/branches\/([^/]+)\/(deactivate|reactivate|archive|dependencies)$/
    );
    if (actionMatch) {
      const company = await requireCompanyAccess(
        user,
        actionMatch[1],
        actionMatch[3] === 'dependencies' ? 'staff.view' : 'system.settings.manage'
      );
      const branchId = decodeURIComponent(actionMatch[2]);
      const branch = await prisma.branch.findFirst({ where: { id: branchId, company } });
      if (!branch) throw new ApiError(404, 'BRANCH_NOT_FOUND', 'That branch does not exist in this company.');

      if (actionMatch[3] === 'dependencies') {
        if (req.method !== 'GET') {
          throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET to inspect branch dependencies.');
        }
        const dependencies = await branchDependencies(prisma, company, branch);
        sendJson(res, 200, { success: true, branch: serializeBranch(branch), dependencies });
        return true;
      }

      if (req.method !== 'POST') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST for branch status changes.');
      }

      if (actionMatch[3] === 'deactivate') {
        const dependencies = await branchDependencies(prisma, company, branch);
        if (dependencies.appointments.count > 0) {
          throw new ApiError(
            409,
            'BRANCH_HAS_DEPENDENCIES',
            `This branch still has ${dependencies.appointments.count} future appointment(s). Reassign or cancel them first.`,
            { dependencies }
          );
        }
        if (branch.status === 'inactive') {
          sendJson(res, 200, { success: true, branch: serializeBranch(branch), message: 'Branch is already inactive.' });
          return true;
        }
        const updated = await prisma.branch.update({
          where: { id: branch.id },
          data: { status: 'inactive', isActive: false },
        });
        await writeAudit(prisma, {
          action: 'branch.deactivate',
          entityType: 'Branch',
          entityId: branch.id,
          user,
          previous: serializeBranch(branch),
          next: serializeBranch(updated),
        });
        sendJson(res, 200, { success: true, branch: serializeBranch(updated) });
        return true;
      }

      if (actionMatch[3] === 'reactivate') {
        const updated = await prisma.branch.update({
          where: { id: branch.id },
          data: { status: 'active', isActive: true, archivedAt: null },
        });
        await writeAudit(prisma, {
          action: 'branch.reactivate',
          entityType: 'Branch',
          entityId: branch.id,
          user,
          previous: serializeBranch(branch),
          next: serializeBranch(updated),
        });
        sendJson(res, 200, { success: true, branch: serializeBranch(updated) });
        return true;
      }

      // archive — soft delete only. Appointments and history are preserved.
      const updated = await prisma.branch.update({
        where: { id: branch.id },
        data: { status: 'archived', isActive: false, archivedAt: new Date() },
      });
      await writeAudit(prisma, {
        action: 'branch.archive',
        entityType: 'Branch',
        entityId: branch.id,
        user,
        previous: serializeBranch(branch),
        next: serializeBranch(updated),
      });
      sendJson(res, 200, {
        success: true,
        branch: serializeBranch(updated),
        message: 'Branch archived. Historical appointments and audit records were preserved.',
      });
      return true;
    }

    // ------------------------------------------------------------ Branch detail
    const branchMatch = pathname.match(/^\/api\/companies\/([^/]+)\/branches\/([^/]+)$/);
    if (branchMatch) {
      const company = await requireCompanyAccess(
        user,
        branchMatch[1],
        req.method === 'GET' ? 'staff.view' : 'system.settings.manage'
      );
      const branchId = decodeURIComponent(branchMatch[2]);
      const branch = await prisma.branch.findFirst({ where: { id: branchId, company } });
      if (!branch) throw new ApiError(404, 'BRANCH_NOT_FOUND', 'That branch does not exist in this company.');

      if (req.method === 'GET') {
        sendJson(res, 200, { success: true, branch: serializeBranch(branch) });
        return true;
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await readJsonBody(req);
        const fields = branchWritableFields(body, { partial: true });
        const manager = await resolveManager(prisma, company, body.managerId);

        if (body.status !== undefined) {
          throw new ApiError(
            400,
            'USE_STATUS_ENDPOINT',
            'Change branch status through the deactivate, reactivate or archive endpoints.'
          );
        }

        if (fields.code && fields.code !== branch.code) {
          const duplicate = await prisma.branch.findFirst({
            where: { company, code: fields.code, NOT: { id: branch.id } },
            select: { id: true },
          });
          if (duplicate) {
            throw new ApiError(409, 'BRANCH_CODE_CONFLICT', `Branch code ${fields.code} already exists in ${company}.`, {
              field: 'code',
            });
          }
        }

        const updated = await prisma.branch.update({
          where: { id: branch.id },
          data: { ...fields, ...(manager || {}) },
        });

        await writeAudit(prisma, {
          action: 'branch.update',
          entityType: 'Branch',
          entityId: branch.id,
          user,
          previous: serializeBranch(branch),
          next: serializeBranch(updated),
        });

        sendJson(res, 200, { success: true, branch: serializeBranch(updated) });
        return true;
      }

      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET or PATCH for a branch.');
    }

    // ------------------------------------------------------------ Company profile
    const companyMatch = pathname.match(/^\/api\/companies\/([^/]+)$/);
    if (companyMatch) {
      const company = await requireCompanyAccess(
        user,
        companyMatch[1],
        req.method === 'GET' ? 'staff.view' : 'system.settings.manage'
      );

      if (req.method === 'GET') {
        const [profile, localization, summary] = await Promise.all([
          SettingsService.getSetting('company', 'company', company),
          SettingsService.getSetting('company_localization', 'company', company),
          companySummary(prisma, company),
        ]);
        const actor = await updatedByName(prisma, profile.updatedById);
        const data = profile.data || {};
        sendJson(res, 200, {
          success: true,
          code: company,
          name: data.displayName || data.name || COMPANY_NAMES[company],
          profile: data,
          version: profile.version,
          updatedAt: profile.updatedAt,
          updatedById: profile.updatedById,
          updatedByName: actor,
          localization: {
            data: localization.data,
            version: localization.version,
            updatedAt: localization.updatedAt,
            updatedByName: await updatedByName(prisma, localization.updatedById),
          },
          summary,
        });
        return true;
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await readJsonBody(req);
        const input = body.data && typeof body.data === 'object' ? body.data : body;
        const current = await SettingsService.getSetting('company', 'company', company);
        const next = { ...current.data, code: company };

        if (input.displayName !== undefined) {
          next.displayName = asText(input.displayName, 'displayName', { required: true, min: 2, max: 120 });
        }
        if (input.legalName !== undefined) next.legalName = validateLegalName(input.legalName);
        if (input.registrationNumber !== undefined) {
          next.registrationNumber = asText(input.registrationNumber, 'registrationNumber', { max: 80 });
        }
        if (input.email !== undefined) next.email = asEmail(input.email, 'email');
        if (input.phone !== undefined) next.phone = asPhone(input.phone, 'phone');
        if (input.address !== undefined) next.address = asText(input.address, 'address', { max: 500 });
        if (input.country !== undefined) next.country = asText(input.country, 'country', { max: 120 });
        if (input.logoUrl !== undefined) {
          if (typeof input.logoUrl === 'string' && input.logoUrl.startsWith('data:image/')) {
            next.logoUrl = input.logoUrl;
          } else {
            const logo = asText(input.logoUrl, 'logoUrl', { max: 1000 });
            if (logo && !/^(https?:\/\/|\/uploads\/)/i.test(logo)) {
              throw new ApiError(400, 'VALIDATION_ERROR', 'logoUrl must be an image data URL, https URL, or an /uploads/ path.', { field: 'logoUrl' });
            }
            next.logoUrl = logo;
          }
        }
        if (input.description !== undefined) next.description = asText(input.description, 'description', { max: 1000 });
        if (input.status !== undefined) next.status = asEnum(input.status, 'status', ['active', 'inactive']);

        // Legal identity changes are high-risk: require an explicit confirmation
        // once a value already exists. A blank legal name is never auto-filled.
        const identityFields = ['legalName', 'registrationNumber'];
        const changedIdentity = identityFields.filter(
          (field) => current.data?.[field] && next[field] !== current.data[field]
        );
        if (changedIdentity.length && body.confirmIdentityChange !== true) {
          throw new ApiError(
            400,
            'IDENTITY_CHANGE_CONFIRMATION_REQUIRED',
            `Confirm the change to ${changedIdentity.join(' and ')}.`,
            { fields: changedIdentity }
          );
        }

        const result = await SettingsService.updateSetting({
          section: 'company',
          scope: 'company',
          scopeId: company,
          version: body.version ?? current.version,
          data: next,
          user,
          correlationId,
        });

        sendJson(res, 200, {
          success: true,
          code: company,
          profile: result.data,
          version: result.version,
          updatedAt: result.updatedAt,
          updatedByName: user.fullName || null,
        });
        return true;
      }

      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use GET or PATCH for a company profile.');
    }

    throw new ApiError(404, 'NOT_FOUND', 'Company endpoint not found.');
  } catch (error) {
    if (error instanceof VersionConflictError) {
      sendJson(res, 409, {
        success: false,
        error: error.code,
        message: error.message,
        ...error.details,
      });
      return true;
    }
    sendError(res, error, correlationId);
    return true;
  }
}
