// Comprehensive Test Suite for Lead Company Switching & RBAC Permissions
import assert from 'assert';

console.log('🧪 Starting Company Switching RBAC Verification Suite...\n');

// 1. RBAC authorization logic simulation
function canUserChangeCompany(authUser) {
  if (!authUser || !authUser.role) return false;
  return authUser.role === 'super_admin' || authUser.role === 'leads_officer';
}

// 2. Cross-company coordinator and treatment reset simulation
function switchLeadCompany(targetLead, newCompany, authUser, allUsers = []) {
  if (!canUserChangeCompany(authUser)) {
    return {
      success: false,
      status: 403,
      error: 'Forbidden: Only Super Admin and Leads Officer can change the company affiliation.'
    };
  }

  const prevCompany = (targetLead.company || targetLead.source || 'RWC').toUpperCase();
  const isChangingCompany = prevCompany !== newCompany.toUpperCase();

  const updateData = {
    ...targetLead,
    company: newCompany,
    source: newCompany,
    whatsappSessionId: newCompany
  };

  if (isChangingCompany) {
    // Reset treatment/course type
    updateData.treatmentId = null;
    updateData.categoryId = null;
    updateData.serialNumber = null;

    // Check if current coordinator belongs to the opposite company
    const assignedCoord = allUsers.find(u => u.id === targetLead.assignedTo) || targetLead.assignedCoordinator;
    if (assignedCoord && assignedCoord.company && assignedCoord.company !== newCompany) {
      updateData.assignedTo = null;
      updateData.assignedCoordinator = null;
      updateData.assignedById = null;
      updateData.assignedByName = null;
      updateData.assignedAt = null;
      updateData.stage = 'new';
    }
  }

  return {
    success: true,
    status: 200,
    lead: updateData
  };
}

// Mock users
const superAdmin = { id: 'admin-1', fullName: 'Dr. Alpha Admin', role: 'super_admin' };
const leadsOfficer = { id: 'leads-off-1', fullName: 'Mohamed Leads', role: 'leads_officer' };
const rwcCoordinator = { id: 'coord-rwc', fullName: 'Sameera', role: 'coordinator', company: 'RWC' };
const crasCounsellor = { id: 'counsellor-cras', fullName: 'Rifdhy', role: 'coordinator', company: 'CRAS' };

const allStaff = [superAdmin, leadsOfficer, rwcCoordinator, crasCounsellor];

// Mock CRAS lead assigned to Rifdhy
const crasLead = {
  id: 'lead-araliya',
  displayName: 'Araliya',
  company: 'CRAS',
  source: 'CRAS',
  whatsappSessionId: 'CRAS',
  assignedTo: 'counsellor-cras',
  assignedCoordinator: crasCounsellor,
  treatmentId: 'crs-fam',
  categoryId: 'cat-cras-courses',
  serialNumber: 'FAM-001',
  stage: 'contacted'
};

// TEST GROUP 1: RBAC Permission Gates
console.log('--- Test Group 1: Role-Based Authorization ---');

// 1.1 Super Admin is allowed
assert.strictEqual(canUserChangeCompany(superAdmin), true, 'Super Admin must be authorized');
console.log('✅ Pass 1.1: Super Admin has permission to switch lead company.');

// 1.2 Leads Officer is allowed
assert.strictEqual(canUserChangeCompany(leadsOfficer), true, 'Leads Officer must be authorized');
console.log('✅ Pass 1.2: Leads Officer has permission to switch lead company.');

// 1.3 Coordinator is REJECTED
assert.strictEqual(canUserChangeCompany(rwcCoordinator), false, 'Coordinator must NOT be authorized');
assert.strictEqual(canUserChangeCompany(crasCounsellor), false, 'Counsellor must NOT be authorized');
const coordAttempt = switchLeadCompany(crasLead, 'RWC', rwcCoordinator, allStaff);
assert.strictEqual(coordAttempt.success, false);
assert.strictEqual(coordAttempt.status, 403);
console.log('✅ Pass 1.3: Coordinators are strictly rejected with 403 Forbidden.');

// TEST GROUP 2: CRAS to RWC Company Switching
console.log('\n--- Test Group 2: CRAS to RWC Workflow Integrity ---');
const crasToRwcResult = switchLeadCompany(crasLead, 'RWC', leadsOfficer, allStaff);
assert.strictEqual(crasToRwcResult.success, true);
const updatedLead = crasToRwcResult.lead;

// 2.1 Company and source updated to RWC
assert.strictEqual(updatedLead.company, 'RWC');
assert.strictEqual(updatedLead.source, 'RWC');
assert.strictEqual(updatedLead.whatsappSessionId, 'RWC');
console.log('✅ Pass 2.1: Lead company, source, and session updated to RWC.');

// 2.2 Course type reset to null
assert.strictEqual(updatedLead.treatmentId, null);
assert.strictEqual(updatedLead.categoryId, null);
assert.strictEqual(updatedLead.serialNumber, null);
console.log('✅ Pass 2.2: CRAS course type and serial number reset for RWC catalog selection.');

// 2.3 Cross-company coordinator unassigned & stage reset to new
assert.strictEqual(updatedLead.assignedTo, null);
assert.strictEqual(updatedLead.assignedCoordinator, null);
assert.strictEqual(updatedLead.stage, 'new');
console.log('✅ Pass 2.3: CRAS counsellor unassigned, lead marked new for RWC coordinator assignment.');

// TEST GROUP 3: RWC to CRAS Company Switching
console.log('\n--- Test Group 3: RWC to CRAS Workflow Integrity ---');
const rwcLead = {
  id: 'lead-rwc-101',
  displayName: 'David',
  company: 'RWC',
  source: 'RWC',
  assignedTo: 'coord-rwc',
  assignedCoordinator: rwcCoordinator,
  treatmentId: 'trt-hair-prp',
  categoryId: 'cat-hair-care',
  serialNumber: 'HPR-001',
  stage: 'in_progress'
};

const rwcToCrasResult = switchLeadCompany(rwcLead, 'CRAS', superAdmin, allStaff);
assert.strictEqual(rwcToCrasResult.success, true);
const updatedCrasLead = rwcToCrasResult.lead;

assert.strictEqual(updatedCrasLead.company, 'CRAS');
assert.strictEqual(updatedCrasLead.treatmentId, null);
assert.strictEqual(updatedCrasLead.assignedTo, null);
assert.strictEqual(updatedCrasLead.stage, 'new');
console.log('✅ Pass 3.1: RWC lead converted to CRAS, treatment cleared, coordinator unassigned.');

console.log('\n🎉 ALL COMPANY SWITCHING & RBAC TESTS PASSED SUCCESSFULLY!\n');
