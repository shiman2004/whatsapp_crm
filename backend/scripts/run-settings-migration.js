import fs from 'node:fs';
import path from 'node:path';
import { getPrisma, checkDbConnection } from '../src/db.js';

async function main() {
  console.log('Connecting to database...');
  await checkDbConnection();
  const prisma = getPrisma();
  if (!prisma) {
    console.error('Prisma unavailable');
    process.exit(1);
  }

  const migrationPath = path.resolve('backend/prisma/migrations/20261103_enterprise_system_settings.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Strip line comments
  const noComments = sql.replace(/--.*$/gm, '');

  // Split on semicolons
  const statements = noComments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute.`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await prisma.$executeRawUnsafe(stmt);
      const firstLine = stmt.split('\n')[0].slice(0, 70);
      console.log(`  [${i + 1}/${statements.length}] ✅ ${firstLine}`);
    } catch (err) {
      console.error(`  [${i + 1}/${statements.length}] ❌ Statement failed:\n${stmt}\nError: ${err.message}`);
      throw err;
    }
  }

  console.log('\nVerifying new models in database:');
  const count = await prisma.$queryRawUnsafe('SELECT count(*)::int FROM public.enterprise_system_settings');
  console.log('✅ enterprise_system_settings table verified, row count:', count);

  const customFieldsCount = await prisma.$queryRawUnsafe('SELECT count(*)::int FROM public.custom_field_definitions');
  console.log('✅ custom_field_definitions table verified, row count:', customFieldsCount);

  const automationCount = await prisma.$queryRawUnsafe('SELECT count(*)::int FROM public.automation_rules');
  console.log('✅ automation_rules table verified, row count:', automationCount);

  const apiKeysCount = await prisma.$queryRawUnsafe('SELECT count(*)::int FROM public.api_keys');
  console.log('✅ api_keys table verified, row count:', apiKeysCount);

  const webhooksCount = await prisma.$queryRawUnsafe('SELECT count(*)::int FROM public.webhook_endpoints');
  console.log('✅ webhook_endpoints table verified, row count:', webhooksCount);

  await prisma.$disconnect();
  console.log('\n🎉 Enterprise System Settings Migration successfully executed and verified!');
}

main().catch(err => {
  console.error('Fatal error executing migration:', err);
  process.exit(1);
});
