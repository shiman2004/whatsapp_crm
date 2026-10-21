/**
 * Test-environment guard.
 *
 * The backend suites are integration tests: they create, update and delete rows.
 * Running them against the production database is the most dangerous thing this
 * repository lets you do, so every suite goes through this module before touching the DB.
 *
 * IMPORTANT — why this does not rely on NODE_ENV:
 * ESM hoists static `import` statements. A suite that writes
 * `process.env.NODE_ENV = 'test'` on line 3 and then does
 * `import { ... } from './src/db.js'` on line 7 has `NODE_ENV === undefined` at the
 * moment `db.js` is evaluated. Detection therefore uses `process.argv[1]` (the entry
 * script path), which is always available, plus NODE_ENV as a secondary signal.
 *
 * Two conditions must hold for a suite to run against a database:
 *
 *   1. It is running as a test entry point (`test-*.js` / `*.test.js` on the command
 *      line, or NODE_ENV=test).
 *   2. The resolved DATABASE_URL is provably NOT production. That means either
 *      a) `TEST_DATABASE_URL` is set and differs from the production URL, or
 *      b) `DATABASE_URL` is a local host, or its database name carries a `test` marker.
 *
 * Anything else throws, so a misconfigured CI job fails loudly instead of mutating
 * customer records. Credentials are never logged: only host and database name.
 */

/** Redact everything except host and database name. */
function describeTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    const database = url.pathname.replace(/^\//, '') || '(none)';
    return `${url.hostname}/${database}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

function isLocalOrMarkedTest(connectionString) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname.toLowerCase();
    const database = url.pathname.replace(/^\//, '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    // A dedicated test database is conventionally suffixed `_test`.
    if (/(^|[-_])test($|[-_])/.test(database)) return true;
    return false;
  } catch {
    return false;
  }
}

/** True when this process was launched as a test suite. */
export function isTestRun() {
  if (process.env.NODE_ENV === 'test') return true;
  const entry = String(process.argv[1] || '').replace(/\\/g, '/');
  return /(^|\/)(test[-.][^/]*|[^/]*\.test)\.[cm]?js$/.test(entry);
}

export class ProductionDatabaseRefusedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductionDatabaseRefusedError';
    this.code = 'TEST_DB_GUARD';
  }
}

/**
 * Throws unless the current DATABASE_URL is a non-production target.
 * @returns {{ target: string, source: 'TEST_DATABASE_URL' | 'DATABASE_URL' }}
 */
export function assertIsolatedTestDatabase() {
  const productionUrl = String(process.env.DATABASE_URL || '').trim();
  const testUrl = String(process.env.TEST_DATABASE_URL || '').trim();

  if (testUrl) {
    // db.js promotes TEST_DATABASE_URL into DATABASE_URL, so an identity check here
    // only means "already promoted". The dangerous case — TEST_DATABASE_URL set to the
    // production URL — is caught by the isLocalOrMarkedTest check below, because a
    // production hostname never satisfies it.
    if (testUrl !== productionUrl) {
      process.env.DATABASE_URL = testUrl;
      if (process.env.DIRECT_URL) process.env.DIRECT_URL = testUrl;
    }
    if (!isLocalOrMarkedTest(testUrl)) {
      throw new ProductionDatabaseRefusedError(
        `Refusing to run tests against ${describeTarget(testUrl)}: TEST_DATABASE_URL does not look like ` +
        'a test database (expected a local host or a database name containing `test`). ' +
        'See backend/.env.test.example.'
      );
    }
    // The policy adds an explicit environment identity and exact URL binding;
    // name/host heuristics remain only a second safety check for legacy setups.
    const { assertDatabaseOperationAllowed } = awaitPolicy();
    assertDatabaseOperationAllowed('test');
    return { target: describeTarget(testUrl), source: 'TEST_DATABASE_URL' };
  }

  if (!productionUrl) {
    throw new ProductionDatabaseRefusedError(
      'Refusing to run tests: neither TEST_DATABASE_URL nor DATABASE_URL is configured, so a live ' +
      'connection cannot be excluded. Set TEST_DATABASE_URL (see backend/.env.test.example).'
    );
  }

  if (!isLocalOrMarkedTest(productionUrl)) {
    throw new ProductionDatabaseRefusedError(
      `Refusing to run tests against ${describeTarget(productionUrl)}: it is not recognisably a test ` +
      'database. Set TEST_DATABASE_URL to an isolated database, or set DATABASE_URL to a local/`test` ' +
      'database. See backend/.env.test.example.'
    );
  }

  return { target: describeTarget(productionUrl), source: 'DATABASE_URL' };
}

// Kept lazy to avoid a circular dependency for callers that only import isTestRun.
function awaitPolicy() {
  // databasePolicy has no imports, so CommonJS-style caching is unnecessary here.
  // ESM static import is used through this small indirection to preserve the existing API.
  return policyModule;
}
import * as policyModule from './databasePolicy.js';

/**
 * Human-readable banner for suite output. Never prints credentials.
 */
export function describeTestDatabase() {
  const { target, source } = assertIsolatedTestDatabase();
  return `isolated test database ${target} (from ${source})`;
}
