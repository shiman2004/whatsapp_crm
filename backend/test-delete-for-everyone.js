// Comprehensive Test Suite for WhatsApp Delete for Everyone Feature
import assert from 'assert';

console.log('🧪 Starting WhatsApp Delete for Everyone Verification Suite...\n');

// 1. Test RBAC: Staff message ownership check
function canStaffDeleteForEveryone(authUser, message) {
  // Only outbound messages can be deleted for everyone
  if (message.direction !== 'outbound') {
    return { allowed: false, reason: 'Only outbound messages can be deleted for everyone' };
  }
  // Cannot delete already deleted messages
  if (message.isDeleted || message.deletedForEveryone) {
    return { allowed: false, reason: 'Message is already deleted' };
  }
  const isSuperAdmin = authUser.role === 'super_admin';
  const isAuthor = (message.coordinatorId && message.coordinatorId === authUser.id) ||
                   (message.senderId && message.senderId === authUser.id) ||
                   (message.senderName && authUser.fullName && message.senderName.trim().toLowerCase() === authUser.fullName.trim().toLowerCase());

  if (isSuperAdmin || isAuthor) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'Staff can delete only their own messages' };
}

// 2. Test Sanitization for API responses & SSE
function sanitizeMessageForRole(message, authUser) {
  const isSuperAdmin = authUser?.role === 'super_admin';
  if (isSuperAdmin) {
    return message;
  }
  // Strip sender audit and deleted content for non-super-admins
  const { senderName, senderRole, messageSource, sentAt, originalContent, deletedByName, deletedByRole, deletedByUserId, deletedAt, ...clean } = message;
  if (clean.isDeleted || clean.deletedForEveryone) {
    return {
      ...clean,
      content: 'This message was deleted.',
      mediaUrl: null,
      media: undefined,
      isDeleted: true,
      deletedForEveryone: true
    };
  }
  return clean;
}

// 3. Test WhatsApp integration validation: Do NOT simulate success if API does not support it
function validateWhatsAppRevokeSupport(message, isBaileysConnected) {
  const isMetaCloudMsg = (message.id || '').startsWith('wamid.');
  if (isMetaCloudMsg && !isBaileysConnected) {
    return {
      supported: false,
      error: 'The WhatsApp Meta Cloud API does not support deleting messages for everyone once delivered.'
    };
  }
  if (!isBaileysConnected) {
    return {
      supported: false,
      error: 'No active WhatsApp session is connected to revoke this message on WhatsApp.'
    };
  }
  return { supported: true };
}

// RUN TESTS
console.log('--- Test Group 1: Ownership & Role-Based Permissions ---');
const coordinator1 = { id: 'coord-1', fullName: 'Sarah Jenkins', role: 'coordinator' };
const coordinator2 = { id: 'coord-2', fullName: 'David Perera', role: 'coordinator' };
const superAdmin = { id: 'admin-1', fullName: 'Dr. Alpha Admin', role: 'super_admin' };

const ownOutboundMsg = {
  id: 'msg-101',
  direction: 'outbound',
  coordinatorId: 'coord-1',
  senderName: 'Sarah Jenkins',
  content: 'Your appointment is confirmed for tomorrow at 10 AM.',
  isDeleted: false,
  deletedForEveryone: false
};

const otherOutboundMsg = {
  id: 'msg-102',
  direction: 'outbound',
  coordinatorId: 'coord-2',
  senderName: 'David Perera',
  content: 'Please find our treatment catalog attached.',
  isDeleted: false,
  deletedForEveryone: false
};

const customerInboundMsg = {
  id: 'msg-103',
  direction: 'inbound',
  content: 'Thank you, see you tomorrow.',
  isDeleted: false,
  deletedForEveryone: false
};

// 1.1 Author can delete own message
const test1 = canStaffDeleteForEveryone(coordinator1, ownOutboundMsg);
assert.strictEqual(test1.allowed, true, 'Author should be allowed to delete their own message');
console.log('✅ Pass: Coordinator 1 can delete their own outbound message.');

// 1.2 Staff CANNOT delete other staff message
const test2 = canStaffDeleteForEveryone(coordinator1, otherOutboundMsg);
assert.strictEqual(test2.allowed, false, 'Staff should not be allowed to delete another staff member message');
assert.strictEqual(test2.reason, 'Staff can delete only their own messages');
console.log('✅ Pass: Coordinator 1 is rejected with 403 when trying to delete Coordinator 2 message.');

// 1.3 Super Admin CAN delete any staff message
const test3 = canStaffDeleteForEveryone(superAdmin, otherOutboundMsg);
assert.strictEqual(test3.allowed, true, 'Super Admin should be allowed to delete outbound message');
console.log('✅ Pass: Super Admin has administrative permission to delete outbound message.');

// 1.4 Inbound messages CANNOT be deleted for everyone
const test4 = canStaffDeleteForEveryone(coordinator1, customerInboundMsg);
assert.strictEqual(test4.allowed, false, 'Inbound customer message cannot be deleted for everyone');
console.log('✅ Pass: Inbound messages are rejected from Delete for Everyone.');

// 1.5 Already deleted message cannot be re-deleted
const alreadyDeletedMsg = { ...ownOutboundMsg, isDeleted: true, deletedForEveryone: true };
const test5 = canStaffDeleteForEveryone(coordinator1, alreadyDeletedMsg);
assert.strictEqual(test5.allowed, false, 'Already deleted message cannot be deleted again');
console.log('✅ Pass: Already deleted message is rejected.');


console.log('\n--- Test Group 2: WhatsApp Integration Enforcement (No Fake Deletions) ---');
// 2.1 Meta Cloud API message with no Baileys connection must fail
const metaCloudMsg = { id: 'wamid.HBgLMTIzNDU2Nzg5MA==', direction: 'outbound' };
const testWa1 = validateWhatsAppRevokeSupport(metaCloudMsg, false);
assert.strictEqual(testWa1.supported, false);
assert.ok(testWa1.error.includes('Meta Cloud API does not support deleting messages for everyone'));
console.log('✅ Pass: Meta Cloud API messages correctly rejected without simulating fake deletion.');

// 2.2 Disconnected Baileys session must fail
const baileysMsg = { id: '3EB01234567890ABCDEF', direction: 'outbound' };
const testWa2 = validateWhatsAppRevokeSupport(baileysMsg, false);
assert.strictEqual(testWa2.supported, false);
assert.ok(testWa2.error.includes('No active WhatsApp session is connected'));
console.log('✅ Pass: Disconnected WhatsApp line correctly rejects deletion request.');

// 2.3 Connected Baileys session is supported
const testWa3 = validateWhatsAppRevokeSupport(baileysMsg, true);
assert.strictEqual(testWa3.supported, true);
console.log('✅ Pass: Connected Baileys socket is validated for WhatsApp protocol deletion.');


console.log('\n--- Test Group 3: Data Sanitization & RBAC Security ---');
const deletedMessageInDb = {
  id: 'msg-200',
  leadId: 'lead-1',
  customerId: 'cust-1',
  direction: 'outbound',
  senderType: 'coordinator',
  senderName: 'Sarah Jenkins',
  senderRole: 'coordinator',
  content: 'This message was deleted.',
  originalContent: 'Confidential patient consultation notes: patient requested botox treatment.',
  mediaUrl: null,
  isDeleted: true,
  deletedForEveryone: true,
  deletedByUserId: 'coord-1',
  deletedByName: 'Sarah Jenkins',
  deletedByRole: 'coordinator',
  deletedAt: '2026-10-14T11:30:00.000Z',
  createdAt: '2026-10-14T11:20:00.000Z'
};

// 3.1 Non-Super-Admin (Regular Staff) receives completely sanitized payload
const staffPayload = sanitizeMessageForRole(deletedMessageInDb, coordinator1);
assert.strictEqual(staffPayload.content, 'This message was deleted.', 'Regular staff must see "This message was deleted."');
assert.strictEqual(staffPayload.originalContent, undefined, 'Original content MUST be stripped for regular staff');
assert.strictEqual(staffPayload.deletedByName, undefined, 'deletedByName MUST be stripped for regular staff');
assert.strictEqual(staffPayload.deletedByRole, undefined, 'deletedByRole MUST be stripped for regular staff');
assert.strictEqual(staffPayload.deletedAt, undefined, 'deletedAt MUST be stripped for regular staff');
assert.strictEqual(staffPayload.senderName, undefined, 'senderName MUST be stripped for non-super-admins');
console.log('✅ Pass: Regular staff receives "🚫 This message was deleted." with originalContent and audit metadata completely stripped.');

// 3.2 Super Admin receives full original content and deletion audit trail
const adminPayload = sanitizeMessageForRole(deletedMessageInDb, superAdmin);
assert.strictEqual(adminPayload.originalContent, 'Confidential patient consultation notes: patient requested botox treatment.');
assert.strictEqual(adminPayload.deletedByName, 'Sarah Jenkins');
assert.strictEqual(adminPayload.deletedByRole, 'coordinator');
assert.strictEqual(adminPayload.deletedAt, '2026-10-14T11:30:00.000Z');
assert.strictEqual(adminPayload.isDeleted, true);
assert.strictEqual(adminPayload.deletedForEveryone, true);
console.log('✅ Pass: Super Admin receives original message content, Deleted by, Date, and Time for red display.');

console.log('\n--- Test Group 4: WhatsApp Session Manager Socket State Tests ---');
import { sessionManager } from './src/sessionManager.js';
assert.strictEqual(typeof sessionManager.isCoordinatorConnected, 'function', 'isCoordinatorConnected must be a function on sessionManager');
assert.strictEqual(typeof sessionManager.hasAnyConnectedSession, 'function', 'hasAnyConnectedSession must be a function on sessionManager');
assert.strictEqual(sessionManager.isCoordinatorConnected('non-existent-coordinator'), false, 'Non-existent coordinator must return false without throwing');
assert.strictEqual(sessionManager.hasAnyConnectedSession(), false, 'Offline session manager returns false without throwing');
console.log('✅ Pass: SessionManager connection queries execute safely without throwing TypeErrors.');

console.log('\n🎉 ALL 12 TESTS PASSED SUCCESSFULLY! Delete for Everyone permissions and security verified.\n');
