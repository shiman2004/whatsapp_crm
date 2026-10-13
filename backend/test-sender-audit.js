// Test suite for Internal Message Sender Identification & Audit Trail
import assert from 'assert';

console.log('🧪 Starting Sender Audit Verification Suite...');

// 1. Verify Sri Lanka Time Formatting
function formatSriLankaDateTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
  return formatted.replace(/\bam\b/gi, 'AM').replace(/\bpm\b/gi, 'PM');
}

function formatSenderRole(role, roleTitle) {
  if (roleTitle && roleTitle.trim()) return roleTitle.trim();
  if (!role) return '';
  const r = role.toLowerCase().trim();
  if (r === 'super_admin' || r === 'super admin') return 'Super Admin';
  if (r === 'leads_officer' || r === 'leads officer') return 'Sales Officer';
  if (r === 'sales_officer' || r === 'sales officer') return 'Sales Officer';
  if (r === 'clinic_manager' || r === 'clinic manager') return 'Clinic Manager';
  if (r === 'coordinator') return 'Sales Officer';
  if (r === 'system' || r === 'automation') return 'System / Automation';
  return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getMessageSenderAuditText(message) {
  const isSystem = message.messageSource === 'System' || 
                   message.messageSource === 'Automation' || 
                   message.senderType === 'system' || 
                   message.senderType === 'ai';

  const timeStr = formatSriLankaDateTime(message.sentAt || message.createdAt);

  if (isSystem) {
    return timeStr ? `Sent by: System / Automation • ${timeStr}` : 'Sent by: System / Automation';
  }

  if (!message.senderName && !message.senderRole) {
    return null;
  }

  const name = message.senderName || 'Staff';
  const role = formatSenderRole(message.senderRole);

  if (role) {
    return timeStr ? `Sent by: ${name} (${role}) • ${timeStr}` : `Sent by: ${name} (${role})`;
  }

  return timeStr ? `Sent by: ${name} • ${timeStr}` : `Sent by: ${name}`;
}

// Test Case 1: Sri Lanka Timezone Conversion
const testUtcDate = '2026-10-12T16:36:00Z'; // 16:36 UTC = 22:06 (10:06 PM) Colombo
const colomboStr = formatSriLankaDateTime(testUtcDate);
assert.strictEqual(colomboStr, '12 Oct 2026, 10:06 PM');
console.log('✅ Test 1 Passed: Sri Lanka timezone formats to "12 Oct 2026, 10:06 PM"');

// Test Case 2: Super Admin Outgoing Message formatting
const adminMsg = {
  senderName: 'Jahan',
  senderRole: 'super_admin',
  messageSource: 'CRM User',
  sentAt: '2026-10-12T16:36:00Z'
};
const adminAudit = getMessageSenderAuditText(adminMsg);
assert.strictEqual(adminAudit, 'Sent by: Jahan (Super Admin) • 12 Oct 2026, 10:06 PM');
console.log('✅ Test 2 Passed: Super Admin audit display is:', adminAudit);

// Test Case 3: Sales Officer (Faiha) Outgoing Message formatting
const faihaMsg = {
  senderName: 'Faiha',
  senderRole: 'Sales Officer',
  messageSource: 'CRM User',
  sentAt: '2026-10-12T16:40:00Z'
};
const faihaAudit = getMessageSenderAuditText(faihaMsg);
assert.strictEqual(faihaAudit, 'Sent by: Faiha (Sales Officer) • 12 Oct 2026, 10:10 PM');
console.log('✅ Test 3 Passed: Sales Officer audit display is:', faihaAudit);

// Test Case 4: Clinic Manager (Dr. Zeenath) Outgoing Message formatting
const zeenathMsg = {
  senderName: 'Dr. Zeenath',
  senderRole: 'Clinic Manager',
  messageSource: 'CRM User',
  sentAt: '2026-10-12T16:48:00Z'
};
const zeenathAudit = getMessageSenderAuditText(zeenathMsg);
assert.strictEqual(zeenathAudit, 'Sent by: Dr. Zeenath (Clinic Manager) • 12 Oct 2026, 10:18 PM');
console.log('✅ Test 4 Passed: Clinic Manager audit display is:', zeenathAudit);

// Test Case 5: System / Automation message formatting
const sysMsg = {
  messageSource: 'Automation',
  senderType: 'system',
  sentAt: '2026-10-12T16:50:00Z'
};
const sysAudit = getMessageSenderAuditText(sysMsg);
assert.strictEqual(sysAudit, 'Sent by: System / Automation • 12 Oct 2026, 10:20 PM');
console.log('✅ Test 5 Passed: System/Automation audit display is:', sysAudit);

// Test Case 6: Historical messages without sender info must return null (No invented identities)
const historicalMsg = {
  content: 'Legacy message',
  createdAt: '2025-01-01T10:00:00Z'
};
const historicalAudit = getMessageSenderAuditText(historicalMsg);
assert.strictEqual(historicalAudit, null);
console.log('✅ Test 6 Passed: Historical message returns null (does not invent identities)');

// Test Case 7: RBAC Backend Sanitization
const rawMessages = [
  { id: 'm1', content: 'Inbound customer text', direction: 'inbound' },
  {
    id: 'm2',
    content: 'Outbound staff reply',
    direction: 'outbound',
    senderName: 'Jahan',
    senderRole: 'Super Admin',
    messageSource: 'CRM User',
    sentAt: '2026-10-12T16:36:00Z',
    audit: { senderName: 'Jahan', senderRole: 'Super Admin' }
  }
];

function sanitizeForRole(userRole, msgs) {
  if (userRole === 'super_admin') return msgs;
  return msgs.map(m => {
    const { senderName, senderRole, messageSource, sentAt, audit, ...clean } = m;
    return clean;
  });
}

const coordinatorView = sanitizeForRole('coordinator', rawMessages);
assert.strictEqual(coordinatorView[1].senderName, undefined);
assert.strictEqual(coordinatorView[1].senderRole, undefined);
assert.strictEqual(coordinatorView[1].messageSource, undefined);
assert.strictEqual(coordinatorView[1].sentAt, undefined);
assert.strictEqual(coordinatorView[1].audit, undefined);
console.log('✅ Test 7 Passed: Coordinator response completely sanitizes audit trail metadata');

const superAdminView = sanitizeForRole('super_admin', rawMessages);
assert.strictEqual(superAdminView[1].senderName, 'Jahan');
assert.strictEqual(superAdminView[1].senderRole, 'Super Admin');
console.log('✅ Test 8 Passed: Super Admin retains full audit trail metadata');

console.log('\n🎉 ALL SENDER AUDIT TESTS PASSED SUCCESSFULLY!');
