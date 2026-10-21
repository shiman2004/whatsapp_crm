import assert from 'node:assert/strict';
import { assertDatabaseOperationAllowed, DatabasePolicyError } from './src/databasePolicy.js';

const production = 'postgresql://user:secret@production.example.com:5432/royal_crm';
const test = 'postgresql://tester:secret@test.example.com:5432/royal_crm_test';
const testEnv = { DB_ENVIRONMENT: 'test', DATABASE_URL: test, TEST_DATABASE_URL: test, PRODUCTION_DATABASE_URL: production };

assert.doesNotThrow(() => assertDatabaseOperationAllowed('test', testEnv));
assert.throws(() => assertDatabaseOperationAllowed('test', { ...testEnv, DATABASE_URL: production }), DatabasePolicyError);
assert.throws(() => assertDatabaseOperationAllowed('test', { ...testEnv, DB_ENVIRONMENT: 'development' }), DatabasePolicyError);
assert.throws(() => assertDatabaseOperationAllowed('utility', { DB_ENVIRONMENT: 'development', DATABASE_URL: production, PRODUCTION_DATABASE_URL: production, ALLOW_DESTRUCTIVE_DB_TOOLS: 'true' }), DatabasePolicyError);
assert.throws(() => assertDatabaseOperationAllowed('utility', { DB_ENVIRONMENT: 'development', DATABASE_URL: test }), DatabasePolicyError);
assert.doesNotThrow(() => assertDatabaseOperationAllowed('utility', { DB_ENVIRONMENT: 'development', DATABASE_URL: test, ALLOW_DESTRUCTIVE_DB_TOOLS: 'true', PRODUCTION_DATABASE_URL: production }));
assert.throws(() => assertDatabaseOperationAllowed('migration', { DB_ENVIRONMENT: 'production', DATABASE_URL: production }), DatabasePolicyError);
assert.doesNotThrow(() => assertDatabaseOperationAllowed('migration', { DB_ENVIRONMENT: 'production', DATABASE_URL: production, APPROVED_PRODUCTION_MIGRATION: 'true' }));
console.log('Database policy tests passed.');
