/**
 * Explicit database-operation policy for scripts that can create, alter, seed,
 * or delete data. It intentionally fails closed: a URL alone never authorizes
 * a destructive utility.
 */
function target(url) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname.toLowerCase(), database: parsed.pathname.replace(/^\//, '').toLowerCase() };
  } catch {
    return null;
  }
}

function describe(url) {
  const value = target(url);
  return value ? `${value.host}/${value.database || '(none)'}` : '(unparseable database target)';
}

export class DatabasePolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabasePolicyError';
    this.code = 'DATABASE_POLICY_DENIED';
  }
}

/**
 * Validate a destructive database operation without logging credentials.
 * Production migrations are possible only through the explicitly approved mode.
 */
export function assertDatabaseOperationAllowed(operation, env = process.env) {
  const environment = String(env.DB_ENVIRONMENT || '').toLowerCase();
  const url = String(env.DATABASE_URL || '').trim();
  const current = target(url);
  if (!current || !environment) {
    throw new DatabasePolicyError('Database operation refused: DB_ENVIRONMENT and DATABASE_URL must be explicitly configured.');
  }

  const productionTarget = target(String(env.PRODUCTION_DATABASE_URL || '').trim());
  if (productionTarget && productionTarget.host === current.host && productionTarget.database === current.database && environment !== 'production') {
    throw new DatabasePolicyError(`Database operation refused: ${describe(url)} matches the protected production target.`);
  }

  if (operation === 'test') {
    const testUrl = String(env.TEST_DATABASE_URL || '').trim();
    if (environment !== 'test' || !testUrl || testUrl !== url) {
      throw new DatabasePolicyError('Test database access refused: set DB_ENVIRONMENT=test and make DATABASE_URL exactly equal TEST_DATABASE_URL.');
    }
    if (!/(^|[-_])test($|[-_])/.test(current.database)) {
      throw new DatabasePolicyError(`Test database access refused: ${describe(url)} is not an explicitly named test database.`);
    }
    return { environment, target: describe(url) };
  }

  if (operation === 'migration') {
    if (environment !== 'production' || env.APPROVED_PRODUCTION_MIGRATION !== 'true') {
      throw new DatabasePolicyError('Production migration refused: require DB_ENVIRONMENT=production and APPROVED_PRODUCTION_MIGRATION=true.');
    }
    return { environment, target: describe(url) };
  }

  if (environment !== 'development' || env.ALLOW_DESTRUCTIVE_DB_TOOLS !== 'true') {
    throw new DatabasePolicyError('Database utility refused: require DB_ENVIRONMENT=development and ALLOW_DESTRUCTIVE_DB_TOOLS=true.');
  }
  return { environment, target: describe(url) };
}
