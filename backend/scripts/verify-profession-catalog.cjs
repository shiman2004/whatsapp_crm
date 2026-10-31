require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_by = 'profession-catalog-import')::int AS profession_catalog,
           COUNT(*) FILTER (WHERE created_by = 'profession-catalog-import' AND thumbnail <> '')::int AS illustrated
    FROM public.exam_courses
  `);
  console.log(JSON.stringify(result.rows[0]));
  await client.end();
})().catch((error) => { console.error('VERIFY_FAILED', error.message); process.exitCode = 1; });
