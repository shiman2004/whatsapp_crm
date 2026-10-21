import assert from 'node:assert/strict';
import { CAPABILITIES, assertMarketingCapability, hasMarketingCapability } from './src/marketing/permissions.js';
import { handleMarketingRoutes } from './src/marketing/routes.js';

const staff = { id: 'staff-1', role: 'leads_officer', active: true, company: 'RWC' };
const officer = { id: 'officer-1', role: 'marketing_officer', active: true, company: 'RWC' };
const admin = { id: 'admin-1', role: 'marketing_admin', active: true, company: 'RWC' };
const superAdmin = { id: 'super-1', role: 'super_admin', active: true, company: 'RWC' };

assert.equal(hasMarketingCapability(staff, CAPABILITIES.collect), true);
assert.equal(hasMarketingCapability(staff, CAPABILITIES.assign), false);
assert.equal(hasMarketingCapability(officer, CAPABILITIES.updateAssignedTasks), true);
assert.equal(hasMarketingCapability(officer, CAPABILITIES.export), false);
assert.equal(hasMarketingCapability(admin, CAPABILITIES.manageCampaignDrafts), true);
assert.equal(hasMarketingCapability(admin, CAPABILITIES.assign), false);
assert.equal(hasMarketingCapability(superAdmin, CAPABILITIES.reassign), true);
assert.equal(assertMarketingCapability({ ...officer, active: false }, CAPABILITIES.dashboard)?.status, 403);

function responseStub() {
  return {
    status: null,
    body: null,
    writeHead(status) { this.status = status; },
    end(body) { this.body = JSON.parse(body); }
  };
}

const healthResponse = responseStub();
assert.equal(await handleMarketingRoutes({ method: 'GET' }, healthResponse, '/api/marketing/health', staff), undefined);
assert.equal(healthResponse.status, 200);
assert.equal(healthResponse.body.data.module, 'public-contact-marketing');

const forbiddenResponse = responseStub();
await handleMarketingRoutes({ method: 'GET' }, forbiddenResponse, '/api/marketing/health', { role: 'coordinator', active: true });
assert.equal(forbiddenResponse.status, 403);

console.log('Marketing foundation permission tests passed.');
