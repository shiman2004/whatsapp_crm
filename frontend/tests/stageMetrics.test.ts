import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLeadStage,
  getColomboDayString,
  isEligibleStaffForLeaderboard,
  resolveAssignedColomboDay,
  summarizeStageMetrics,
} from '../src/utils/stageMetrics.ts';

test('classifyLeadStage separates clinical milestones from business conversions', () => {
  assert.equal(classifyLeadStage('appointment_booked').isAppointmentMilestone, true);
  assert.equal(classifyLeadStage('appointment_booked').isBusinessConverted, false);
  assert.equal(classifyLeadStage('appointment_booked').isClinicalProgressed, true);

  assert.equal(classifyLeadStage('consultation__done').isConsultationMilestone, true);
  assert.equal(classifyLeadStage('consultation__done').isBusinessConverted, false);

  assert.equal(classifyLeadStage('treatment_completed').isTreatmentMilestone, true);
  assert.equal(classifyLeadStage('treatment_completed').isBusinessConverted, true);

  assert.equal(classifyLeadStage('payment_received').isPaymentMilestone, true);
  assert.equal(classifyLeadStage('payment_received').isBusinessConverted, true);

  assert.equal(classifyLeadStage('converted').isBusinessConverted, true);
  assert.equal(classifyLeadStage('converted').category, 'converted');

  assert.equal(classifyLeadStage('lost').isTerminalNegative, true);
  assert.equal(classifyLeadStage('not_eligible').isTerminalNegative, true);
  assert.equal(classifyLeadStage('not_relevant').isActiveOpen, false);

  assert.equal(classifyLeadStage('accepted').isActiveOpen, true);
  assert.equal(classifyLeadStage('accepted').isBusinessConverted, false);
});

test('isEligibleStaffForLeaderboard includes active coordinator and sales_coordinator only', () => {
  assert.equal(
    isEligibleStaffForLeaderboard({ id: '1', fullName: 'Coord A', email: 'a@x.com', role: 'coordinator', active: true }),
    true
  );
  assert.equal(
    isEligibleStaffForLeaderboard({ id: '2', fullName: 'Sales Coord', email: 's@x.com', role: 'sales_coordinator', active: true }),
    true
  );
  assert.equal(
    isEligibleStaffForLeaderboard({ id: '3', fullName: 'Inactive', email: 'i@x.com', role: 'coordinator', active: false }),
    false
  );
  assert.equal(
    isEligibleStaffForLeaderboard({ id: '4', fullName: 'Admin', email: 'ad@x.com', role: 'super_admin', active: true }),
    false
  );
});

test('resolveAssignedColomboDay uses Asia/Colombo date boundary and ignores mismatched history', () => {
  // 2026-11-10T18:45:00Z = 2026-11-11 00:15 +05:30 in Asia/Colombo!
  assert.equal(getColomboDayString('2026-11-10T18:45:00.000Z'), '2026-11-11');

  const leadWithVerifiedHistory = {
    id: 'l1',
    customerId: 'c1',
    stage: 'assigned',
    priority: 'medium',
    assignedTo: 'coord-1',
    createdAt: '2026-11-01T10:00:00.000Z',
    assignmentHistories: [
      { id: 'h-other', assignedToId: 'coord-2', assignedAt: '2026-11-10T10:00:00.000Z', assignedByName: 'Admin' },
      { id: 'h-match', assignedToId: 'coord-1', assignedAt: '2026-11-09T09:00:00.000Z', assignedByName: 'Admin' },
    ],
  };

  assert.equal(resolveAssignedColomboDay(leadWithVerifiedHistory as any, 'coord-1'), '2026-11-09');
  assert.equal(resolveAssignedColomboDay(leadWithVerifiedHistory as any, 'coord-2'), 'invalid');
});

test('summarizeStageMetrics reconciles KPI and Funnel totals accurately', () => {
  const sampleLeads = [
    { id: '1', customerId: 'c1', stage: 'new', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
    { id: '2', customerId: 'c2', stage: 'appointment_booked', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
    { id: '3', customerId: 'c3', stage: 'consultation__done', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
    { id: '4', customerId: 'c4', stage: 'payment_received', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
    { id: '5', customerId: 'c5', stage: 'treatment_completed', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
    { id: '6', customerId: 'c6', stage: 'converted', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
    { id: '7', customerId: 'c7', stage: 'lost', priority: 'medium', createdAt: '2026-11-10T01:00:00Z' },
  ] as any[];

  const summary = summarizeStageMetrics(sampleLeads, []);
  assert.equal(summary.total, 7);
  assert.equal(summary.appointmentBooked, 1);
  assert.equal(summary.consultationDone, 1);
  assert.equal(summary.paymentReceived, 1);
  assert.equal(summary.treatmentCompleted, 1);
  assert.equal(summary.closedWon, 1);
  assert.equal(summary.businessConverted, 3);
  assert.equal(summary.negativeLost, 1);
  assert.equal(summary.activeOpen, 3);
  assert.equal(summary.businessConverted + summary.negativeLost + summary.activeOpen, summary.total);
  assert.equal(summary.conversionRatePct, 43);
});
