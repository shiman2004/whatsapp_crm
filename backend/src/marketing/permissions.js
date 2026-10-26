const CAPABILITIES = Object.freeze({
  dashboard: 'dashboard',
  collect: 'collect',
  viewOwnUploads: 'view_own_uploads',
  viewAssignedTasks: 'view_assigned_tasks',
  updateAssignedTasks: 'update_assigned_tasks',
  manageCampaignDrafts: 'manage_campaign_drafts',
  viewReports: 'view_reports',
  assign: 'assign',
  reassign: 'reassign',
  export: 'export',
  approveCampaigns: 'approve_campaigns',
  audit: 'audit',
  deleteContacts: 'delete_contacts',
});

const ROLE_CAPABILITIES = Object.freeze({
  leads_officer: new Set([CAPABILITIES.dashboard, CAPABILITIES.collect, CAPABILITIES.viewOwnUploads, CAPABILITIES.viewAssignedTasks, CAPABILITIES.updateAssignedTasks]),
  marketing_officer: new Set([CAPABILITIES.dashboard, CAPABILITIES.viewAssignedTasks, CAPABILITIES.updateAssignedTasks]),
  marketing_admin: new Set([CAPABILITIES.dashboard, CAPABILITIES.manageCampaignDrafts, CAPABILITIES.viewReports]),
  super_admin: new Set(Object.values(CAPABILITIES)),
  coordinator: new Set([CAPABILITIES.viewAssignedTasks, CAPABILITIES.updateAssignedTasks])
});

export { CAPABILITIES };

export function hasMarketingCapability(user, capability) {
  return Boolean(user?.active !== false && ROLE_CAPABILITIES[user?.role]?.has(capability));
}

export function assertMarketingCapability(user, capability) {
  if (hasMarketingCapability(user, capability)) return null;
  return { status: 403, code: 'MARKETING_FORBIDDEN', message: 'You are not authorized to perform this marketing operation.' };
}

export function marketingRoleSummary(user) {
  return {
    role: user?.role || null,
    capabilities: Array.from(ROLE_CAPABILITIES[user?.role] || [])
  };
}
