#!/usr/bin/env node

/**
 * Master Test Runner for Section 32 User Acceptance Testing (UAT 1 – 20)
 * and the 4-Tier Test Architecture (Tiers 1 – 4).
 *
 * Runs each test suite in deterministic isolation, capturing stdout/stderr,
 * timing metrics, and reporting a comprehensive summary table.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '../..');

const UAT_SUITES = [
  { id: 'UAT 01', name: 'Sales Inquiry Conversion & Exam Case Creation', file: 'tests/e2e/uat01-sales-handoff.test.js' },
  { id: 'UAT 02', name: 'Exam Manager Case Acceptance & Officer Assignment', file: 'tests/e2e/uat02-manager-accept-assign.test.js' },
  { id: 'UAT 03', name: 'Officer Requirement Acceptance & CRM Delivery', file: 'tests/e2e/uat03-officer-work-delivery.test.js' },
  { id: 'UAT 04', name: 'Case Reassignment & Return with Mandatory Reason', file: 'tests/e2e/uat04-reassign-return-reason.test.js' },
  { id: 'UAT 05', name: 'Student Account Provisioning & Secure Activation', file: 'tests/e2e/uat05-student-provisioning.test.js' },
  { id: 'UAT 06', name: 'Repeat Purchase Identity Linking Without Duplication', file: 'tests/e2e/uat06-repeat-purchase-linking.test.js' },
  { id: 'UAT 07', name: 'Two-Device Registration Gating (1 Mobile + 1 Computer)', file: 'tests/e2e/uat07-two-device-gating.test.js' },
  { id: 'UAT 08', name: 'Single Concurrent Session Enforcement Across Devices', file: 'tests/e2e/uat08-single-session-concurrency.test.js' },
  { id: 'UAT 09', name: 'Unregistered Third Device Block & Replacement Request', file: 'tests/e2e/uat09-third-device-replacement.test.js' },
  { id: 'UAT 10', name: 'Receipt Upload Leaves Materials Locked', file: 'tests/e2e/uat10-receipt-upload-gating.test.js' },
  { id: 'UAT 11', name: 'Independent Finance Officer Payment Verification', file: 'tests/e2e/uat11-finance-payment-verification.test.js' },
  { id: 'UAT 12', name: 'Maker-Checker Segregation & Self-Approval Prevention', file: 'tests/e2e/uat12-maker-checker-segregation.test.js' },
  { id: 'UAT 13', name: 'Final Manager Release Approval & Portal Activation', file: 'tests/e2e/uat13-manager-approval-activation.test.js' },
  { id: 'UAT 14', name: 'Dynamic Masters Management by Super Administrator', file: 'tests/e2e/uat14-dynamic-masters-management.test.js' },
  { id: 'UAT 15', name: 'Academic Content Draft & Multi-Stage RBAC Workflow', file: 'tests/e2e/uat15-academic-draft-rbac.test.js' },
  { id: 'UAT 16', name: 'Interactive MCQ Practice with Immediate Validation', file: 'tests/e2e/uat16-mcq-practice-validation.test.js' },
  { id: 'UAT 17', name: 'Timed Mock Examination Engine & Scoring Review', file: 'tests/e2e/uat17-timed-mock-exam-engine.test.js' },
  { id: 'UAT 18', name: 'Student Learning Portal Access & Dynamic Watermarking', file: 'tests/e2e/uat18-portal-pdf-watermarking.test.js' },
  { id: 'UAT 19', name: 'Immutable Audit Logging Across Operational Lifecycle', file: 'tests/e2e/uat19-immutable-audit-trail.test.js' },
  { id: 'UAT 20', name: 'Role-Based Perimeter & Capability Enforcement', file: 'tests/e2e/uat20-role-perimeter-security.test.js' },
];

const TIER_SUITES = [
  { id: 'TIER 1', name: 'Feature Coverage (>=5 per phase category)', file: 'tests/e2e/tier1-feature-coverage.test.js' },
  { id: 'TIER 2', name: 'Boundary & Corner Cases (>=5 per phase category)', file: 'tests/e2e/tier2-boundary-corner-cases.test.js' },
  { id: 'TIER 3', name: 'Cross-Feature Combinations & Multi-Module Flows', file: 'tests/e2e/tier3-cross-feature-combinations.test.js' },
  { id: 'TIER 4', name: 'Real-World Multi-Phase Application Scenarios', file: 'tests/e2e/tier4-real-world-e2e-scenarios.test.js' },
];

const ALL_TEST_SUITES = [...UAT_SUITES, ...TIER_SUITES];

async function runSuite(suite) {
  const started = Date.now();
  const filePath = path.resolve(backendDir, suite.file);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', filePath], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        EXAM_ALLOW_MEMORY_FIXTURES: 'true'
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('close', (code) => {
      const ms = Date.now() - started;
      const pass = code === 0;
      resolve({
        id: suite.id,
        name: suite.name,
        file: suite.file,
        pass,
        code,
        ms,
        stdout,
        stderr
      });
    });
  });
}

async function main() {
  console.log('\n' + '='.repeat(85));
  console.log('ALPHA HEALTH GROUP (AHG) CRM — SECTION 32 UAT & 4-TIER TEST RUNNER');
  console.log('='.repeat(85));
  console.log(`Node.js: ${process.version} | Platform: ${process.platform} | Time: ${new Date().toISOString()}\n`);

  const results = [];

  console.log('--- EXECUTING SECTION 32 UAT SCENARIOS (1 TO 20) ---');
  for (const suite of UAT_SUITES) {
    process.stdout.write(`  [RUNNING] ${suite.id.padEnd(8)}: ${suite.name.padEnd(55)} ... `);
    const res = await runSuite(suite);
    results.push(res);
    if (res.pass) {
      console.log(`\x1b[32mPASS\x1b[0m (${(res.ms / 1000).toFixed(2)}s)`);
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m (exit code ${res.code})`);
      if (res.stderr) console.error(res.stderr.trim());
    }
  }

  console.log('\n--- EXECUTING 4-TIER TEST ARCHITECTURE SUITES (TIERS 1 TO 4) ---');
  for (const suite of TIER_SUITES) {
    process.stdout.write(`  [RUNNING] ${suite.id.padEnd(8)}: ${suite.name.padEnd(55)} ... `);
    const res = await runSuite(suite);
    results.push(res);
    if (res.pass) {
      console.log(`\x1b[32mPASS\x1b[0m (${(res.ms / 1000).toFixed(2)}s)`);
    } else {
      console.log(`\x1b[31mFAIL\x1b[0m (exit code ${res.code})`);
      if (res.stderr) console.error(res.stderr.trim());
    }
  }

  console.log('\n' + '='.repeat(85));
  console.log('COMPREHENSIVE TEST SUITE EXECUTION SUMMARY');
  console.log('='.repeat(85));
  console.log(`| ${'ID'.padEnd(8)} | ${'Scenario / Suite Name'.padEnd(52)} | ${'Result'.padEnd(6)} | ${'Duration'.padEnd(8)} |`);
  console.log(`|${'-'.repeat(10)}|${'-'.repeat(54)}|${'-'.repeat(8)}|${'-'.repeat(10)}|`);

  for (const r of results) {
    const status = r.pass ? '\x1b[32mPASS\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m  ';
    const dur = `${(r.ms / 1000).toFixed(2)}s`.padStart(8);
    console.log(`| ${r.id.padEnd(8)} | ${r.name.padEnd(52)} | ${status} | ${dur} |`);
  }
  console.log('='.repeat(85));

  const totalPassed = results.filter(r => r.pass).length;
  const totalFailed = results.filter(r => !r.pass).length;
  const totalDuration = results.reduce((acc, r) => acc + r.ms, 0);

  console.log(`Total Suites: ${results.length} | Passed: \x1b[32m${totalPassed}\x1b[0m | Failed: \x1b[31m${totalFailed}\x1b[0m | Total Time: ${(totalDuration / 1000).toFixed(2)}s\n`);

  if (totalFailed > 0) {
    console.error(`❌ ${totalFailed} test suite(s) failed.`);
    process.exit(1);
  } else {
    console.log('✅ ALL SECTION 32 UAT SCENARIOS & 4-TIER TEST SUITES PASSED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error executing test runner:', err);
  process.exit(1);
});
