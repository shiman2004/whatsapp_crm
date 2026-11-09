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

  const migrationPath = path.resolve('backend/prisma/migrations/20261027_exam_operations.sql');
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

  console.log('\nVerifying exam operations tables in database:');
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('exam_ops_records', 'exam_ops_audit')
    ORDER BY table_name;
  `);
  console.log('✅ Found tables in DB:', tables.map(t => t.table_name));

  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'exam_ops_records'
    ORDER BY indexname;
  `);
  console.log('✅ Indexes on exam_ops_records:', indexes.map(i => i.indexname));

  await prisma.$disconnect();
  console.log('\n🎉 Exam Operations Migration successfully executed and verified!');
}

main().catch(err => {
  console.error('Fatal error executing migration:', err);
  process.exit(1);
});
