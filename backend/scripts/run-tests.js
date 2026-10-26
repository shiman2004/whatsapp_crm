/**
 * Isolated backend test runner.
 *
 * Every suite runs sequentially against the test database (or with no database at all,
 * for the pure-logic suites). Sequential execution is deliberate: several suites bind
 * fixed ports and create shared fixtures, so parallel runs would collide.
 *
 * The suites resolve their own database through `src/db.js`, which enforces the
 * isolated-test-database guard. This runner additionally refuses to start if
 * `backend/.env.test` is missing, so a missing test config can never silently fall
 * back to `backend/.env` (production).
 *
 * Usage: node scripts/run-tests.js [suite-name ...]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Suites are listed explicitly so a stray file is never picked up by accident.
// Ordering follows the previous package.json `test` script, plus the newer suites.
const ALL_SUITES = [
  'test-security-hardening.js',
  'test-meta-token-security.js',
  'test-bell-notification.js',
  'test-sender-audit.js',
  'test-auth-security.js',
  'test-login-security.js',
  'test-24h-window.js',
  'test-company-switching.js',
  'test-cras-contact-creation.js',
  'test-company-pipelines.js',
  'test-lead-assignment.js',
  'test-media-and-memory-security.js',
  'test-marketing-foundation.js',
  'test-pagination.js',
  'test-message-cursor.js',
  'test-super-admin-settings.js',
  'test-meta-message-status.js',
  'test-appointments.js',
  'test-phonetic-composer.js',
  'test-marketing-e2e.js',
  'test-consent-governance.js',
  'test-e2e-workflow-matrix.js',
];

if (!fs.existsSync(path.join(backendDir, '.env.test'))) {
  console.error('backend/.env.test is missing.');
  console.error('Copy backend/.env.test.example to backend/.env.test and point TEST_DATABASE_URL at a throwaway database.');
  process.exit(1);
}

// Validate the target here too, so we fail before spawning anything.
dotenv.config({ path: path.join(backendDir, '.env.test'), quiet: true, override: true });
const testUrl = process.env.TEST_DATABASE_URL || '';
if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set in backend/.env.test.');
  process.exit(1);
}
const parsed = new URL(testUrl);
const dbName = parsed.pathname.replace(/^\//, '');
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) && !/(^|[-_])test($|[-_])/.test(dbName)) {
  console.error(`Refusing to run: ${parsed.hostname}/${dbName} does not look like a test database.`);
  process.exit(1);
}
console.log(`Test database: ${parsed.hostname}:${parsed.port || 5432}/${dbName}\n`);

const requested = process.argv.slice(2);
const suites = requested.length ? requested : ALL_SUITES;
for (const s of suites) {
  if (!fs.existsSync(path.join(backendDir, s))) {
    console.error(`Unknown suite: ${s}`);
    process.exit(1);
  }
}

const results = [];
for (const suite of suites) {
  console.log(`${'='.repeat(70)}\n▶ ${suite}\n${'='.repeat(70)}`);
  const started = Date.now();
  // Piped stdio, re-emitted here. Handing the child the console handle directly
  // (`stdio: 'inherit'`) makes Node abort on exit with a libuv `UV_HANDLE_CLOSING`
  // assertion on Windows whenever a suite calls `process.exit()` while its HTTP
  // sockets are closing — a passing suite would be recorded as a failure.
  const res = await new Promise((resolve) => {
    const child = spawn(process.execPath, [suite], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Pin every child to the exact URL approved by the runner.  This avoids
      // inheriting DATABASE_URL or DIRECT_URL from a developer's `.env` file.
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DB_ENVIRONMENT: 'test',
        DATABASE_URL: testUrl,
        DIRECT_URL: testUrl,
        TEST_DATABASE_URL: testUrl,
      },
    });
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', (err) => resolve({ code: -1, signal: null, error: err }));
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  const ms = Date.now() - started;
  const status = res.code === 0 ? 'PASS' : 'FAIL';
  results.push({ suite, status, code: res.code, signal: res.signal, ms });
  console.log(`\n${status === 'PASS' ? '✅' : '❌'} ${suite} — ${status} (${(ms / 1000).toFixed(1)}s)\n`);
}

console.log(`\n${'='.repeat(70)}\nSUMMARY\n${'='.repeat(70)}`);
for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.suite.padEnd(38)} ${(r.ms / 1000).toFixed(1)}s`);
}
const failed = results.filter((r) => r.status === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} suites passed.`);
if (failed.length) {
  console.log(`Failed: ${failed.map((f) => f.suite).join(', ')}`);
}
process.exit(failed.length ? 1 : 0);
