// Authoritative capability registry for Security & Access.
//
// A capability exists here only when a server policy enforces it. Modules that
// still own their checks in code (CRM, Clinical, Marketing) are marked
// `roleEditable: false` so the administration UI can display the enforced policy
// without pretending it can rewrite it. Exam capabilities are the editable set
// and are resolved through resolvePermission by the exam draft endpoints.
//
// Route-level ownership, consent, tenant and department checks remain mandatory.

export const SCOPES = Object.freeze(['own', 'assigned', 'department', 'all']);

const SCOPE_RANK = Object.freeze({ own: 0, assigned: 1, department: 2, all: 3 });

const capability = (moduleId, key, action, label, description, scope, options = {}) =>
  Object.freeze({
    key,
    module: moduleId,
    action,
    label,
    description,
    scope,
    scopes: options.scopes || ['own', 'assigned', 'department', 'all'].filter(value => SCOPE_RANK[value] >= SCOPE_RANK[scope]),
    immutable: options.immutable === true,
    delegatable: options.delegatable === true,
    roleEditable: options.roleEditable === true,
  });

const CAPABILITIES = Object.freeze([
  // CRM — enforced by the existing role gates in legacyServer.js.
  capability('crm', 'crm.contact.view', 'View', 'CRM: View', 'Enter and read permitted contacts and leads.', 'assigned'),
  capability('crm', 'crm.contact.create', 'Create', 'CRM: Create', 'Create new contacts and leads.', 'assigned'),
  capability('crm', 'crm.contact.update', 'Update', 'CRM: Update', 'Modify authorized contacts and leads.', 'assigned'),
  capability('crm', 'crm.contact.assign', 'Assign', 'CRM: Assign', 'Assign records to staff.', 'assigned'),
  capability('crm', 'crm.contact.reassign', 'Reassign', 'CRM: Reassign', 'Transfer assigned records between staff.', 'assigned'),
  capability('crm', 'crm.contact.export', 'Export', 'CRM: Export', 'Export permitted CRM data.', 'assigned'),
  capability('crm', 'crm.contact.delete', 'Delete', 'CRM: Delete', 'Delete records when explicitly authorized.', 'all', { immutable: true }),

  // Exam Department — enforced by examPolicy + the exam draft endpoints.
  capability('exam', 'exam.operations.view', 'View', 'Exam Operations: View', 'View assigned exam operations and handoffs.', 'own', { roleEditable: true }),
  capability('exam', 'exam.operations.submit', 'Submit', 'Exam Operations: Submit', 'Submit exam requirements and sales handoffs.', 'own', { roleEditable: true }),
  capability('exam', 'exam.operations.manage', 'Manage', 'Exam Operations: Manage', 'Accept, assign and administer exam operations.', 'department', { immutable: true }),
  capability('exam', 'exam.academic.view', 'View', 'Academic Content: View', 'View authorized academic modules.', 'department', { roleEditable: true }),
  capability('exam', 'exam.course.create_draft', 'Create', 'Course: Create draft', 'Create permitted course drafts.', 'own', { delegatable: true, roleEditable: true }),
  capability('exam', 'exam.material.create_draft', 'Create', 'Study Material: Create draft', 'Create study material drafts.', 'own', { delegatable: true, roleEditable: true }),
  capability('exam', 'exam.question.create_draft', 'Create', 'Question Bank: Create draft', 'Create question drafts.', 'own', { delegatable: true, roleEditable: true }),
  capability('exam', 'exam.mock_test.create_draft', 'Create', 'Mock Test: Create draft', 'Create mock test drafts.', 'own', { delegatable: true, roleEditable: true }),
  capability('exam', 'exam.draft.edit_own', 'Update', 'Academic Drafts: Edit own', 'Edit own unpublished drafts.', 'own', { roleEditable: true }),
  capability('exam', 'exam.draft.submit', 'Submit', 'Academic Drafts: Submit', 'Submit own drafts for review.', 'own', { roleEditable: true }),
  capability('exam', 'exam.content.review', 'Approve', 'Academic Content: Review', 'Review drafts and request changes.', 'department', { immutable: true }),
  capability('exam', 'exam.content.publish', 'Publish', 'Academic Content: Publish', 'Publish authorized academic content.', 'department', { immutable: true }),
  capability('exam', 'exam.content.delete', 'Delete', 'Academic Content: Delete', 'Delete published academic content.', 'department', { immutable: true }),
  capability('exam', 'exam.finance.verify', 'Approve', 'Payment: Verify', 'Verify bank and transaction payments independently.', 'all', { immutable: true }),

  // Clinical — enforced by clinicalPolicy.js and clinicalRoutes.js.
  capability('clinical', 'clinical.assessment.view_own', 'View', 'Assessments: View own', 'View own patient assessments.', 'own', { scopes: ['own'] }),
  capability('clinical', 'clinical.assessment.create', 'Create', 'Assessments: Create', 'Create own patient assessments.', 'own', { scopes: ['own'] }),
  capability('clinical', 'clinical.assessment.update_own', 'Update', 'Assessments: Edit own', 'Edit own permitted assessments.', 'own', { scopes: ['own'] }),
  capability('clinical', 'clinical.assessment.submit', 'Submit', 'Assessments: Submit', 'Submit assessments to doctors.', 'own', { scopes: ['own'] }),
  capability('clinical', 'clinical.assessment.view_assigned', 'View', 'Assessments: View assigned', 'View assessments assigned to you.', 'assigned', { scopes: ['assigned'] }),
  capability('clinical', 'clinical.assessment.review', 'Update', 'Assessments: Review', 'Record doctor review decisions.', 'assigned', { scopes: ['assigned'] }),
  capability('clinical', 'clinical.assessment.approve', 'Approve', 'Assessments: Approve', 'Approve clinical results.', 'assigned', { scopes: ['assigned'], immutable: true }),
  capability('clinical', 'clinical.report.view_assigned', 'View', 'Clinical Reports: View', 'View the assigned clinical report queue.', 'assigned', { scopes: ['assigned'] }),
  capability('clinical', 'clinical.report.draft', 'Create', 'Clinical Reports: Draft', 'Prepare clinical report drafts.', 'assigned', { scopes: ['assigned'] }),

  // Public Contact Marketing — enforced by marketing/permissions.js.
  capability('marketing', 'marketing.dashboard', 'View', 'Marketing: Dashboard', 'Open the marketing dashboard.', 'department', { scopes: ['assigned', 'department'] }),
  capability('marketing', 'marketing.collect', 'Create', 'Marketing: Collect contacts', 'Collect and upload marketing contacts.', 'own', { scopes: ['own'] }),
  capability('marketing', 'marketing.view_own_uploads', 'View', 'Marketing: View own uploads', 'View your own collected contacts.', 'own', { scopes: ['own'] }),
  capability('marketing', 'marketing.view_assigned_tasks', 'View', 'Marketing: View assigned tasks', 'View assigned marketing follow-up tasks.', 'assigned', { scopes: ['assigned'] }),
  capability('marketing', 'marketing.update_assigned_tasks', 'Update', 'Marketing: Update assigned tasks', 'Update assigned marketing follow-up tasks.', 'assigned', { scopes: ['assigned'] }),
  capability('marketing', 'marketing.manage_campaign_drafts', 'Manage', 'Marketing: Manage campaign drafts', 'Manage campaign drafts.', 'department', { scopes: ['assigned', 'department'] }),
  capability('marketing', 'marketing.view_reports', 'View', 'Marketing: View reports', 'View marketing reports.', 'department', { scopes: ['assigned', 'department'] }),
  capability('marketing', 'marketing.assign', 'Assign', 'Marketing: Assign contacts', 'Assign marketing contacts to officers.', 'department', { scopes: ['department'] }),
  capability('marketing', 'marketing.reassign', 'Reassign', 'Marketing: Reassign contacts', 'Reassign marketing contacts between officers.', 'department', { scopes: ['department'] }),
  capability('marketing', 'marketing.export', 'Export', 'Marketing: Export', 'Export marketing contacts.', 'department', { scopes: ['department'] }),
  capability('marketing', 'marketing.approve_campaigns', 'Approve', 'Marketing: Approve campaigns', 'Approve marketing campaigns.', 'department', { scopes: ['department'], immutable: true }),
  capability('marketing', 'marketing.audit', 'View', 'Marketing: Audit trail', 'View marketing audit events.', 'department', { scopes: ['department'] }),
  capability('marketing', 'marketing.delete_contacts', 'Delete', 'Marketing: Delete contacts', 'Delete marketing contacts.', 'department', { scopes: ['department'], immutable: true }),

  // Reports — the Analytics workspace is Super Admin only today.
  capability('reports', 'reports.view', 'View', 'Reports: View', 'View analytics dashboards.', 'all', { scopes: ['all'] }),
  capability('reports', 'reports.export', 'Export', 'Reports: Export', 'Export report data.', 'all', { scopes: ['all'] }),

  // User & Staff Management.
  capability('staff', 'staff.view', 'View', 'Staff: View directory', 'View the staff directory.', 'all', { scopes: ['all'] }),
  capability('staff', 'staff.manage', 'Manage', 'Staff: Manage accounts', 'Create, edit and deactivate staff accounts.', 'all', { scopes: ['all'], immutable: true }),
  capability('staff', 'audit.view', 'View', 'Staff: Audit trail', 'View security and system audit trails.', 'all', { scopes: ['all'], immutable: true }),
  capability('staff', 'security.manage', 'Manage', 'Staff: Security administration', 'Manage roles, permissions and security policy.', 'all', { scopes: ['all'], immutable: true }),

  // System Settings.
  capability('system', 'system.settings.manage', 'Manage', 'System: Settings', 'Manage system configuration.', 'all', { scopes: ['all'], immutable: true }),
  capability('system', 'system.integrations.manage', 'Manage', 'System: Integrations', 'Manage API and webhook integrations.', 'all', { scopes: ['all'], immutable: true }),
]);

export const CAPABILITY_KEYS = Object.freeze(CAPABILITIES.map(item => item.key));
const CAPABILITY_BY_KEY = new Map(CAPABILITIES.map(item => [item.key, item]));

export const MODULES = Object.freeze([
  { id: 'crm', label: 'CRM', description: 'Contacts, leads and pipeline ownership.', category: 'Operations' },
  { id: 'exam', label: 'Exam Department', description: 'Academic content, drafts and exam operations.', category: 'Departments' },
  { id: 'clinical', label: 'Clinical', description: 'Patient assessments and clinical reports.', category: 'Departments' },
  { id: 'marketing', label: 'Public Contact Marketing', description: 'Contact collection, campaigns and consent governance.', category: 'Departments' },
  { id: 'reports', label: 'Reports', description: 'Analytics and report exports.', category: 'Operations' },
  { id: 'staff', label: 'User & Staff Management', description: 'Staff accounts and security administration.', category: 'Administration' },
  { id: 'system', label: 'System Settings', description: 'System configuration and integrations.', category: 'Administration' },
]);

const ROLE_DEFINITIONS = Object.freeze({
  super_admin: { label: 'Super Admin', category: 'Administration', maxScope: 'all', capabilities: ['*'] },
  leads_officer: {
    label: 'Leads / Sales Officer', category: 'Operations', maxScope: 'department',
    capabilities: ['crm.contact.view', 'crm.contact.create', 'crm.contact.update', 'crm.contact.assign', 'crm.contact.reassign', 'crm.contact.export',
      'exam.operations.view', 'exam.operations.submit',
      'marketing.dashboard', 'marketing.collect', 'marketing.view_own_uploads', 'marketing.view_assigned_tasks', 'marketing.update_assigned_tasks'],
  },
  sales_coordinator: {
    label: 'Sales Coordinator', category: 'Operations', maxScope: 'assigned',
    capabilities: ['crm.contact.view', 'crm.contact.update', 'exam.operations.view', 'exam.operations.submit'],
  },
  coordinator: {
    label: 'Patient / Education Coordinator', category: 'Operations', maxScope: 'assigned',
    capabilities: ['crm.contact.view', 'crm.contact.update', 'exam.operations.view', 'exam.operations.submit',
      'marketing.view_assigned_tasks', 'marketing.update_assigned_tasks'],
  },
  marketing_officer: {
    label: 'Marketing Officer', category: 'Departments', maxScope: 'assigned',
    capabilities: ['marketing.dashboard', 'marketing.view_assigned_tasks', 'marketing.update_assigned_tasks'],
  },
  marketing_admin: {
    label: 'Marketing Administrator', category: 'Departments', maxScope: 'department',
    capabilities: ['marketing.dashboard', 'marketing.manage_campaign_drafts', 'marketing.view_reports'],
  },
  exam_department_manager: {
    label: 'Head of Exam Department', category: 'Departments', maxScope: 'department',
    capabilities: ['exam.operations.view', 'exam.operations.submit', 'exam.operations.manage', 'exam.academic.view',
      'exam.course.create_draft', 'exam.material.create_draft', 'exam.question.create_draft', 'exam.mock_test.create_draft',
      'exam.draft.edit_own', 'exam.draft.submit', 'exam.content.review', 'exam.content.publish', 'exam.content.delete'],
  },
  exam_coordinator: {
    label: 'Exam Coordinator', category: 'Departments', maxScope: 'department',
    capabilities: ['exam.operations.view', 'exam.academic.view', 'exam.course.create_draft', 'exam.material.create_draft',
      'exam.question.create_draft', 'exam.mock_test.create_draft', 'exam.draft.edit_own', 'exam.draft.submit'],
  },
  exam_providing_officer: {
    label: 'Exam Providing Officer', category: 'Departments', maxScope: 'department',
    capabilities: ['exam.operations.view', 'exam.academic.view', 'exam.material.create_draft',
      'exam.question.create_draft', 'exam.mock_test.create_draft', 'exam.draft.edit_own', 'exam.draft.submit'],
  },
  clinical_nurse: {
    label: 'Clinical Nurse', category: 'Departments', maxScope: 'own',
    capabilities: ['clinical.assessment.view_own', 'clinical.assessment.create', 'clinical.assessment.update_own', 'clinical.assessment.submit'],
  },
  clinical_doctor: {
    label: 'Clinical Doctor', category: 'Departments', maxScope: 'assigned',
    capabilities: ['clinical.assessment.view_assigned', 'clinical.assessment.review', 'clinical.assessment.approve', 'clinical.report.view_assigned'],
  },
  report_analyst: {
    label: 'Report Analyst', category: 'Departments', maxScope: 'assigned',
    capabilities: ['clinical.report.view_assigned', 'clinical.report.draft'],
  },
  finance_officer: {
    label: 'Finance Officer', category: 'Operations', maxScope: 'all',
    capabilities: ['crm.contact.view', 'exam.operations.view', 'exam.finance.verify'],
  },
});

export const ROLES = Object.freeze(Object.keys(ROLE_DEFINITIONS));
export const IMMUTABLE_CAPABILITIES = Object.freeze(CAPABILITIES.filter(item => item.immutable).map(item => item.key));
const IMMUTABLE = new Set(IMMUTABLE_CAPABILITIES);
const DELEGATABLE = new Set(CAPABILITIES.filter(item => item.delegatable).map(item => item.key));

export const isImmutableCapability = key => IMMUTABLE.has(key);
export const isDelegatableCapability = key => DELEGATABLE.has(key);
export const getCapability = key => CAPABILITY_BY_KEY.get(key) || null;

export function roleLabel(role) {
  return ROLE_DEFINITIONS[role]?.label || role;
}

export function roleCapabilities(role) {
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) return [];
  return definition.capabilities.includes('*') ? [...CAPABILITY_KEYS] : [...definition.capabilities];
}

export function roleMaxScope(role) {
  return ROLE_DEFINITIONS[role]?.maxScope || 'own';
}

export function roleRegistry() {
  return ROLES.map(role => ({
    role,
    label: ROLE_DEFINITIONS[role].label,
    category: ROLE_DEFINITIONS[role].category,
    maxScope: ROLE_DEFINITIONS[role].maxScope,
    capabilities: roleCapabilities(role),
  }));
}

export function moduleRegistry() {
  return MODULES.map(module => ({
    ...module,
    capabilities: CAPABILITIES.filter(item => item.module === module.id),
  }));
}

function roleModuleIds(role) {
  return new Set(roleCapabilities(role).map(key => CAPABILITY_BY_KEY.get(key)?.module).filter(Boolean));
}

/**
 * Permission rows the Super Admin may edit for a role: the editable capabilities
 * of the modules that role already works in. Cross-module grants are never possible.
 */
export function editableRoleCapabilities(role) {
  const modules = roleModuleIds(role);
  return CAPABILITIES
    .filter(item => item.roleEditable && !item.immutable && modules.has(item.module))
    .map(item => item.key);
}

function normalizeOverrides(overrides) {
  const result = {};
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return result;
  for (const [key, value] of Object.entries(overrides)) {
    if (!CAPABILITY_BY_KEY.has(key)) continue;
    const effect = typeof value === 'string' ? value : value?.effect;
    if (effect === 'allow' || effect === 'deny') result[key] = { effect };
  }
  return result;
}

export function narrowScope(...candidates) {
  const ranked = candidates.filter(value => SCOPE_RANK[value] !== undefined);
  if (!ranked.length) return 'own';
  return ranked.reduce((lowest, value) => (SCOPE_RANK[value] < SCOPE_RANK[lowest] ? value : lowest));
}

/**
 * Deterministic resolution.
 * identity -> role default -> role override -> user override -> immutable boundary -> scope clamp -> default deny.
 */
export function resolvePermission(user, capabilityKey, context = {}) {
  // Legacy callers passed a flat array of user overrides as the third argument.
  if (Array.isArray(context)) {
    const overrides = {};
    for (const entry of context) {
      if (entry?.capability && (entry.effect === 'allow' || entry.effect === 'deny')) {
        overrides[entry.capability] = { effect: entry.effect };
      }
    }
    context = { userOverrides: overrides };
  }
  const meta = CAPABILITY_BY_KEY.get(capabilityKey);
  if (!meta) return { capability: capabilityKey, allowed: false, source: 'unknown_capability', reason: 'Unknown capability.', scope: null };
  if (!user?.id || user.active === false) {
    return { capability: capabilityKey, allowed: false, source: 'identity', reason: 'The authenticated account is missing or disabled.', scope: null };
  }

  const role = user.role;
  const roleDefault = roleCapabilities(role).includes(capabilityKey);
  const roleOverrides = normalizeOverrides(context.roleOverrides);
  const userOverrides = normalizeOverrides(context.userOverrides);

  let allowed = roleDefault;
  let source = 'role';
  let reason = roleDefault ? `Granted by the ${roleLabel(role)} role.` : `Not granted to the ${roleLabel(role)} role.`;

  if (meta.immutable) {
    return {
      capability: capabilityKey,
      allowed,
      source: 'immutable_policy',
      reason: `Immutable security policy. ${allowed ? 'Granted to this role and not overridable.' : 'Only the authorized role can hold this capability.'}`,
      scope: allowed ? narrowScope(meta.scope, roleMaxScope(role)) : null,
    };
  }

  const roleOverride = roleOverrides[capabilityKey];
  if (roleOverride) {
    allowed = roleOverride.effect === 'allow';
    source = 'role_override';
    reason = `Role policy ${roleOverride.effect === 'allow' ? 'grants' : 'denies'} this capability.`;
  }

  const userOverride = userOverrides[capabilityKey];
  if (userOverride) {
    if (userOverride.effect === 'deny') {
      allowed = false;
      source = 'user_override';
      reason = 'Explicitly denied for this user.';
    } else if (DELEGATABLE.has(capabilityKey)) {
      allowed = true;
      source = 'user_override';
      reason = 'Explicitly granted to this user as a delegated capability.';
    } else {
      allowed = false;
      source = 'user_override';
      reason = 'This capability cannot be delegated by a user override.';
    }
  }

  const scope = allowed
    ? narrowScope(meta.scope, roleMaxScope(role), context.scope)
    : null;

  return { capability: capabilityKey, allowed, source, reason, scope };
}

export function effectivePolicy(user, context = {}) {
  const capabilities = {};
  for (const key of CAPABILITY_KEYS) {
    capabilities[key] = resolvePermission(user, key, context);
  }
  return {
    role: user?.role || null,
    maxScope: roleMaxScope(user?.role),
    scope: narrowScope(roleMaxScope(user?.role), context.scope),
    active: user?.active !== false,
    capabilities,
  };
}

export function diffPolicy(before, after) {
  const changes = [];
  for (const key of CAPABILITY_KEYS) {
    const from = before?.capabilities?.[key] || { allowed: false, source: 'role', scope: null };
    const to = after?.capabilities?.[key] || { allowed: false, source: 'role', scope: null };
    if (from.allowed !== to.allowed || from.scope !== to.scope) {
      changes.push({
        capability: key,
        module: CAPABILITY_BY_KEY.get(key)?.module || null,
        label: CAPABILITY_BY_KEY.get(key)?.label || key,
        action: CAPABILITY_BY_KEY.get(key)?.action || null,
        from: { allowed: from.allowed, scope: from.scope },
        to: { allowed: to.allowed, scope: to.scope },
        risk: !from.allowed && to.allowed ? 'elevation' : from.allowed && !to.allowed ? 'reduction' : 'scope',
      });
    }
  }
  return changes;
}

export class PermissionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function assert(condition, code, message, status = 400) {
  if (!condition) throw new PermissionError(status, code, message);
}

/**
 * Validates a proposed override set for a role or user before it is stored.
 * Returns the sanitized override object; throws PermissionError otherwise.
 */
export function validateOverrides(subjectType, subjectRole, proposed) {
  assert(subjectType === 'role' || subjectType === 'user', 'INVALID_SUBJECT', 'Unknown permission subject.');
  assert(proposed && typeof proposed === 'object' && !Array.isArray(proposed), 'INVALID_OVERRIDES', 'Permission overrides must be an object.');
  const entries = Object.entries(proposed);
  assert(entries.length <= CAPABILITIES.length, 'INVALID_OVERRIDES', 'Too many permission overrides.');

  const sanitized = {};
  for (const [key, value] of entries) {
    const meta = CAPABILITY_BY_KEY.get(key);
    assert(meta, 'UNKNOWN_CAPABILITY', `Unknown capability: ${String(key).slice(0, 80)}`);
    const effect = typeof value === 'string' ? value : value?.effect;
    assert(effect === 'allow' || effect === 'deny', 'INVALID_EFFECT', `Effect must be allow or deny for ${key}.`);
    assert(!meta.immutable, 'IMMUTABLE_CAPABILITY', `${key} is protected by immutable security policy.`, 403);

    if (subjectType === 'role') {
      assert(meta.roleEditable, 'NOT_ROLE_EDITABLE', `${key} is enforced by module code and cannot be edited as a role permission.`, 403);
      assert(roleModuleIds(subjectRole).has(meta.module), 'OUTSIDE_ROLE', `${key} belongs to a module the ${subjectRole} role does not work in.`, 403);
    } else {
      if (effect === 'allow') {
        assert(meta.delegatable, 'NOT_DELEGATABLE', `${key} cannot be delegated to an individual user.`, 403);
        assert(roleModuleIds(subjectRole).has(meta.module), 'OUTSIDE_ROLE', `${key} belongs to a module this user's role does not work in.`, 403);
      }
    }
    sanitized[key] = { effect };
  }
  return sanitized;
}

export function validateScope(subjectRole, scope) {
  if (scope === undefined || scope === null || scope === '') return null;
  assert(SCOPES.includes(scope), 'INVALID_SCOPE', 'Unknown record scope.');
  assert(SCOPE_RANK[scope] <= SCOPE_RANK[roleMaxScope(subjectRole)], 'SCOPE_EXCEEDS_ROLE', `This role cannot be given a scope wider than ${roleMaxScope(subjectRole)}.`, 403);
  return scope;
}
