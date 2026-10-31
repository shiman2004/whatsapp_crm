import { checkDbConnection, getPrisma } from '../../backend/src/db.js';

async function test() {
  const res = await checkDbConnection();
  console.log('checkDbConnection:', res);
  if (res.connected) {
    const prisma = getPrisma();
    const count = await prisma.$queryRawUnsafe("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'");
    console.log('Public tables count:', count);
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } }).catch(e => ({ error: e.message }));
    console.log('Users in DB:', users);
    await prisma.$disconnect();
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
