import crypto from 'node:crypto';

/**
 * Valid sample payload factories for Section 32 UAT testing.
 */
export function createSalesHandoffInput(overrides = {}) {
  const leadId = overrides.leadId || `lead-${crypto.randomUUID().slice(0, 8)}`;
  return {
    leadId,
    leadName: 'Dr. Fatima Al-Zahra',
    requirementType: 'country_specific',
    examCountry: 'UAE',
    examTitle: 'DHA General Practitioner Licensing',
    authority: 'Dubai Health Authority (DHA)',
    priority: 'urgent',
    services: ['exam_material', 'mock_test'],
    quotationNumber: 'QT-2026-8891',
    clientName: 'Dr. Fatima Al-Zahra',
    clientEmail: 'fatima.zahra@example.com',
    contactNumber: '+971501234567',
    paymentReceiptUrl: '/uploads/receipt-fatima.pdf?sig=valid123abc',
    paymentReceiptFileName: 'receipt-fatima.pdf',
    receiptVoucherUrl: '/uploads/voucher-fatima.pdf?sig=valid456def',
    receiptVoucherFileName: 'voucher-fatima.pdf',
    receiptVoucherNo: 'RV-9901',
    company: 'CRAS',
    source: 'Sales Pipeline',
    notes: 'Urgent exam preparation required for DHA GP prometric sitting next month.',
    ...overrides
  };
}

export function createOrderRequirementInput(overrides = {}) {
  return {
    orderId: overrides.orderId || crypto.randomUUID(),
    studentName: 'Dr. Fatima Al-Zahra',
    email: 'fatima.zahra@example.com',
    phone: '+971501234567',
    country: 'UAE',
    timeZone: 'Asia/Dubai',
    profession: 'General Practitioner',
    authority: 'Dubai Health Authority (DHA)',
    examName: 'DHA GP Licensing',
    packageId: 'DHA-GP-PRO',
    packageVersion: '1',
    currency: 'USD',
    amountMinor: 129000,
    durationDays: 90,
    attemptAllowance: 5,
    startTrigger: 'activation',
    services: ['exam_material', 'mock_test'],
    ...overrides
  };
}

export function createSampleMcqQuestion(overrides = {}) {
  const id = overrides.id || `mcq-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    questionCode: overrides.questionCode || 'RN-001',
    title: 'Question 1 — Blood Transfusion Reaction Protocol',
    questionText: 'Fifteen minutes after starting a packed red blood cell transfusion, the patient develops fever, chills, dyspnea, and acute lumbar back pain. What is the priority nursing action?',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    subject: 'Nursing / Clinical Procedures',
    optionA: 'Slow the transfusion rate and check vital signs again in 10 minutes',
    optionB: 'Administer oral acetaminophen and continue the transfusion with close monitoring',
    optionC: 'Stop the transfusion immediately and maintain IV patency with 0.9% normal saline using new tubing',
    optionD: 'Contact the blood transfusion center before discontinuing the infusion bag',
    optionE: 'Increase intravenous infusion flow rate to elevate blood pressure',
    correctAnswer: 'C',
    rememberNote1: 'Suspected acute hemolytic transfusion reaction: Immediately STOP the blood transfusion without delay.',
    rememberNote2: 'Preserve intravenous access by hanging 0.9% Normal Saline with completely new infusion tubing at the catheter hub.',
    rememberNote3: 'Notify the physician and blood bank, send remaining blood product and tubing for laboratory analysis, and monitor renal output.',
    detailedExplanation: 'An acute hemolytic transfusion reaction is a life-threatening medical emergency. Stopping the transfusion immediately minimizes exposure to incompatible donor erythrocytes. Venous access must be preserved using fresh tubing to avoid flushing residual blood from the line.',
    difficulty: 'Medium',
    status: 'Active',
    ...overrides
  };
}

export function createSampleMockTest(overrides = {}) {
  const id = overrides.id || `mock-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    courseId: 'course-dha-rn',
    mockTestName: 'DHA Registered Nurse — Full Licensing Simulation Exam',
    targetProfession: 'Registered Nurse',
    durationMinutes: 60,
    totalQuestions: 50,
    passingScore: 70,
    difficulty: 'Medium',
    status: 'Published',
    ...overrides
  };
}
