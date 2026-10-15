import { Lead, User } from '../types';

/**
 * Checks if a lead conversation is accessible to a given user based on their CRM role:
 * - Super Admin: Notifications from all companies and conversations.
 * - Admin: Notifications from authorized companies.
 * - Inquiry Assigning Officer: Notifications for all inquiries under their assigned companies.
 * - Sales Officer / Coordinator: Notifications only for assigned conversations.
 * - Department Manager: Notifications from their assigned department (treatmentCategoryId).
 */
export function isLeadAccessibleForUser(lead: Lead, user: User | null | undefined): boolean {
  if (!user) return false;

  const role = (user.role || '').toLowerCase();
  const roleTitle = (user.roleTitle || '').toLowerCase();

  // 1. Super Admin: full visibility into all companies and conversations
  if (role === 'super_admin' || roleTitle.includes('super admin')) {
    return true;
  }

  // Check company scope if user is tied to a specific company
  const userCompany = user.company;
  const isCrasLead = lead.company === 'CRAS' ||
    lead.source?.toUpperCase() === 'CRAS' ||
    lead.categoryId === 'cat-cras-courses' ||
    (lead as any).assignedCoordinator?.company === 'CRAS';
  const leadCompany = isCrasLead ? 'CRAS' : (lead.company || 'RWC');

  // If this lead is directly assigned to this staff member, always grant them access
  if (lead.assignedTo && lead.assignedTo === user.id) {
    return true;
  }

  if (userCompany && leadCompany && userCompany !== leadCompany) {
    return false;
  }

  // 2. Sales Officer / Coordinator / Education Counsellor: strictly only assigned conversations
  const isSalesOfficer = role === 'coordinator' ||
    roleTitle.includes('sales officer') ||
    roleTitle.includes('sales') ||
    roleTitle.includes('coordinator') ||
    roleTitle.includes('counsellor') ||
    roleTitle.includes('education');

  const isManagementOrAssigning = role === 'super_admin' || 
    role === 'leads_officer' || 
    roleTitle.includes('admin') || 
    roleTitle.includes('manager') || 
    roleTitle.includes('assigning');

  if (isSalesOfficer && !isManagementOrAssigning) {
    return lead.assignedTo === user.id;
  }

  // 3. Department Manager: restricted to their assigned department/category
  const isDeptManager = roleTitle.includes('department manager') || 
    roleTitle.includes('clinic manager') || 
    roleTitle.includes('department') ||
    roleTitle.includes('manager');

  if (isDeptManager && user.treatmentCategoryId) {
    if (lead.categoryId && lead.categoryId !== user.treatmentCategoryId) {
      return false;
    }
  }

  // 4. Inquiry Assigning Officer & Admin: all inquiries under their authorized companies
  return true;
}
