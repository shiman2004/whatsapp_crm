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

  const migrationPath = path.resolve('backend/prisma/migrations/20261102_enterprise_rbac_models.sql');
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
  const roles = await prisma.role.findMany();
  console.log(`✅ Roles in DB (${roles.length}):`, roles.map(r => r.key));

  const permissions = await prisma.permission.findMany();
  console.log(`✅ Permissions in DB (${permissions.length})`);

  const memberships = await prisma.companyMembership.findMany();
  console.log(`✅ Company Memberships in DB (${memberships.length})`);

  const roleAssignments = await prisma.userRoleAssignment.findMany();
  console.log(`✅ User Role Assignments in DB (${roleAssignments.length})`);

  await prisma.$disconnect();
  console.log('\n🎉 Enterprise RBAC Migration successfully executed and verified!');
}

main().catch(err => {
  console.error('Fatal error executing migration:', err);
  process.exit(1);
});
