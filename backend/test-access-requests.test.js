import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPrisma, checkDbConnection } from './src/db.js';
import {
  listAccessRequests,
  createAccessRequest,
  reviewAccessRequest,
  getUserMemberships,
  saveUserMemberships,
} from './src/securityStore.js';

test('Access Requests & Membership Lifecycle Suite', async (t) => {
  await checkDbConnection();
  const prisma = getPrisma();
  assert.ok(prisma, 'Prisma connected');

  // Find an existing user to test with
  const testUser = await prisma.user.findFirst({ where: { role: 'coordinator' } });
  assert.ok(testUser, 'Found test coordinator user');

  const adminUser = await prisma.user.findFirst({ where: { role: 'super_admin' } });
  assert.ok(adminUser, 'Found super admin user');

  // 1. Create Access Request
  const request = await createAccessRequest(prisma, {
    requesterId: testUser.id,
    targetCompany: 'CRAS',
    requestType: 'cross_company_access',
    reason: 'Temporary coverage for CRAS student admissions',
    durationHours: 48,
  });
  assert.ok(request.id, 'Request created');
  assert.equal(request.status, 'pending');

  // 2. List Access Requests
  const list = await listAccessRequests(prisma, { status: 'pending' });
  assert.ok(list.items.length >= 1, 'Listed pending requests');
  const found = list.items.find(r => r.id === request.id);
  assert.ok(found, 'Created request found in list');

  // 3. Approve Request
  const approved = await reviewAccessRequest(prisma, request.id, 'approve', adminUser.id, 'Approved for coverage');
  assert.equal(approved.status, 'approved');

  // Verify membership was provisioned
  const memberships = await getUserMemberships(prisma, testUser.id);
  const crasMembership = memberships.companies.find(c => c.company === 'CRAS');
  assert.ok(crasMembership, 'CRAS company membership automatically provisioned upon approval');

  // 4. Save User Memberships (Multi-Company support)
  const updatedMemberships = await saveUserMemberships(prisma, testUser.id, {
    companies: ['RWC', 'CRAS', 'AHC'],
    defaultCompany: 'CRAS',
  });
  const activeCompanies = updatedMemberships.companies.filter(c => c.active).map(c => c.company);
  assert.ok(activeCompanies.includes('RWC'));
  assert.ok(activeCompanies.includes('CRAS'));
  assert.ok(activeCompanies.includes('AHC'));

  // Clean up test request
  await prisma.accessRequest.delete({ where: { id: request.id } }).catch(() => null);
});
