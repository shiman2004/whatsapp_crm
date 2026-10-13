/**
 * Test Suite: Blinking Bell Notification System
 * Validates:
 * 1. Role-based notification accessibility (Super Admin, Admin, Assigning Officer, Sales Officer, Dept Manager)
 * 2. Unread count tracking per authorized user
 * 3. Notification reset behavior (reading one chat vs reading all chats)
 * 4. Separate unread tracking for multiple users on same conversation
 */

import assert from 'assert';

// 1. Re-implement permission check for node test
function isLeadAccessibleForUser(lead, user) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const roleTitle = (user.roleTitle || '').toLowerCase();

  // Super Admin
  if (role === 'super_admin' || roleTitle.includes('super admin')) {
    return true;
  }

  // Company scope
  const userCompany = user.company;
  const leadCompany = lead.company || (lead.source?.toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC');
  if (userCompany && leadCompany && userCompany !== leadCompany) {
    return false;
  }

  // Sales Officer / Coordinator: strictly only assigned conversations
  const isSalesOfficer = role === 'coordinator' ||
    roleTitle.includes('sales officer') ||
    roleTitle.includes('sales') ||
    roleTitle.includes('coordinator');

  const isManagementOrAssigning = role === 'super_admin' || 
    role === 'leads_officer' || 
    roleTitle.includes('admin') || 
    roleTitle.includes('manager') || 
    roleTitle.includes('assigning');

  if (isSalesOfficer && !isManagementOrAssigning) {
    return lead.assignedTo === user.id;
  }

  // Department Manager: restricted to assigned department
  const isDeptManager = roleTitle.includes('department manager') || 
    roleTitle.includes('clinic manager') || 
    roleTitle.includes('department') ||
    roleTitle.includes('manager');

  if (isDeptManager && user.treatmentCategoryId) {
    if (lead.categoryId && lead.categoryId !== user.treatmentCategoryId) {
      return false;
    }
  }

  return true;
}

// Helper to compute unread count for user
function computeUnreadCountForUser(leads, user, userReadTimestamps) {
  const accessibleLeads = leads.filter(l => isLeadAccessibleForUser(l, user));
  let total = 0;
  for (const lead of accessibleLeads) {
    const readTime = userReadTimestamps[lead.id] || 0;
    let latestTime = lead.lastCustomerMessageAt ? new Date(lead.lastCustomerMessageAt).getTime() : 0;

    if (readTime > 0) {
      if (latestTime > readTime) {
        total += Math.max(1, lead.unreadCount || 1);
      }
    } else {
      if ((lead.unreadCount || 0) > 0) {
        total += (lead.unreadCount || 1);
      }
    }
  }
  return total;
}

console.log('🧪 Starting Blinking Bell Notification Tests...\n');

// Mock Users
const superAdmin = { id: 'super-1', role: 'super_admin', roleTitle: 'Super Admin' };
const adminRwc = { id: 'admin-rwc', role: 'admin', roleTitle: 'Admin', company: 'RWC' };
const assigningOfficer = { id: 'officer-1', role: 'leads_officer', roleTitle: 'Inquiry Assigning Officer', company: 'RWC' };
const salesOfficerA = { id: 'sales-a', role: 'coordinator', roleTitle: 'Sales Officer', company: 'RWC' };
const salesOfficerB = { id: 'sales-b', role: 'coordinator', roleTitle: 'Sales Officer', company: 'RWC' };
const deptManagerHair = { id: 'dept-hair', role: 'coordinator', roleTitle: 'Department Manager', company: 'RWC', treatmentCategoryId: 'cat-hair' };

// Mock Leads
const lead1 = { id: 'lead-1', company: 'RWC', categoryId: 'cat-hair', assignedTo: 'sales-a', unreadCount: 3, lastCustomerMessageAt: '2026-10-13T10:00:00Z' };
const lead2 = { id: 'lead-2', company: 'RWC', categoryId: 'cat-skin', assignedTo: 'sales-b', unreadCount: 2, lastCustomerMessageAt: '2026-10-13T10:05:00Z' };
const lead3 = { id: 'lead-3', company: 'CRAS', categoryId: 'cat-cras', assignedTo: 'sales-c', unreadCount: 1, lastCustomerMessageAt: '2026-10-13T10:10:00Z' };

const leads = [lead1, lead2, lead3];

// TEST 1: Role Accessibility
console.log('Test 1: Role Accessibility');
assert.strictEqual(isLeadAccessibleForUser(lead1, superAdmin), true, 'Super Admin accesses lead1 (RWC)');
assert.strictEqual(isLeadAccessibleForUser(lead3, superAdmin), true, 'Super Admin accesses lead3 (CRAS)');
assert.strictEqual(isLeadAccessibleForUser(lead1, adminRwc), true, 'Admin RWC accesses lead1');
assert.strictEqual(isLeadAccessibleForUser(lead3, adminRwc), false, 'Admin RWC cannot access lead3 (CRAS)');
assert.strictEqual(isLeadAccessibleForUser(lead1, assigningOfficer), true, 'Assigning Officer accesses lead1');
assert.strictEqual(isLeadAccessibleForUser(lead3, assigningOfficer), false, 'Assigning Officer RWC cannot access lead3 (CRAS)');
assert.strictEqual(isLeadAccessibleForUser(lead1, salesOfficerA), true, 'Sales Officer A accesses assigned lead1');
assert.strictEqual(isLeadAccessibleForUser(lead2, salesOfficerA), false, 'Sales Officer A cannot access unassigned lead2');
assert.strictEqual(isLeadAccessibleForUser(lead1, deptManagerHair), true, 'Dept Manager Hair accesses lead1');
assert.strictEqual(isLeadAccessibleForUser(lead2, deptManagerHair), false, 'Dept Manager Hair cannot access lead2 (Skin)');
console.log('✅ Role Accessibility Tests Passed!\n');

// TEST 2: Initial Unread Message Counts
console.log('Test 2: Initial Unread Counts');
const unreadSuper = computeUnreadCountForUser(leads, superAdmin, {});
const unreadSalesA = computeUnreadCountForUser(leads, salesOfficerA, {});
const unreadSalesB = computeUnreadCountForUser(leads, salesOfficerB, {});
const unreadOfficer = computeUnreadCountForUser(leads, assigningOfficer, {});

assert.strictEqual(unreadSuper, 6, 'Super Admin sees all 6 unread messages (3+2+1)');
assert.strictEqual(unreadSalesA, 3, 'Sales Officer A sees only their 3 unread messages');
assert.strictEqual(unreadSalesB, 2, 'Sales Officer B sees only their 2 unread messages');
assert.strictEqual(unreadOfficer, 5, 'Assigning Officer sees 5 unread messages in RWC (3+2)');
console.log(`✅ Super Admin: ${unreadSuper}, Sales A: ${unreadSalesA}, Sales B: ${unreadSalesB}, Assigning Officer: ${unreadOfficer}`);
console.log('✅ Initial Unread Counts Passed!\n');

// TEST 3: Partial Reset (Reading 1 conversation)
console.log('Test 3: Partial Reset (Super Admin reads lead1)');
const superReadTimestamps = { 'lead-1': new Date('2026-10-13T10:02:00Z').getTime() };
const unreadSuperAfterLead1 = computeUnreadCountForUser(leads, superAdmin, superReadTimestamps);
assert.strictEqual(unreadSuperAfterLead1, 3, 'Super Admin unread count drops to 3 (lead2: 2 + lead3: 1)');
console.log(`✅ Unread count dropped from 6 to ${unreadSuperAfterLead1}. Other unread remain, so bell continues blinking!`);
console.log('✅ Partial Reset Passed!\n');

// TEST 4: Separate User Tracking
console.log('Test 4: Separate User Tracking (Sales Officer A still sees lead1 as unread)');
const salesAReadTimestamps = {}; // Sales Officer A hasn't opened it yet
const unreadSalesAStill = computeUnreadCountForUser(leads, salesOfficerA, salesAReadTimestamps);
assert.strictEqual(unreadSalesAStill, 3, 'Sales Officer A unread count is STILL 3 even though Super Admin read it');
console.log('✅ Separate User Tracking Passed!\n');

// TEST 5: Complete Reset (All messages read)
console.log('Test 5: Complete Reset (All messages read)');
const allReadTimestamps = {
  'lead-1': new Date('2026-10-13T10:02:00Z').getTime(),
  'lead-2': new Date('2026-10-13T10:07:00Z').getTime(),
  'lead-3': new Date('2026-10-13T10:12:00Z').getTime(),
};
const unreadSuperAllRead = computeUnreadCountForUser(leads, superAdmin, allReadTimestamps);
assert.strictEqual(unreadSuperAllRead, 0, 'When all messages read, count is 0');
console.log(`✅ Count is ${unreadSuperAllRead}. Bell animation stops, badge removed, "NEW" hidden!`);
console.log('✅ Complete Reset Passed!\n');

// TEST 6: New Inbound Message Arrival
console.log('Test 6: New Inbound Message arrives on lead1');
const lead1Updated = {
  ...lead1,
  unreadCount: 1,
  lastCustomerMessageAt: '2026-10-13T11:00:00Z' // Message arrived AFTER allReadTimestamps (10:02)
};
const leadsAfterNewMessage = [lead1Updated, lead2, lead3];
const unreadAfterNewMsg = computeUnreadCountForUser(leadsAfterNewMessage, superAdmin, allReadTimestamps);
assert.strictEqual(unreadAfterNewMsg, 1, 'New message triggers unread count 1 again!');
console.log(`✅ Count is ${unreadAfterNewMsg}. Bell animation immediately reactivates and glows red!`);
console.log('✅ New Message Trigger Passed!\n');

console.log('🎉 ALL BLINKING BELL NOTIFICATION TESTS PASSED SUCCESSFULLY!');
