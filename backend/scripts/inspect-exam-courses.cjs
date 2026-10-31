require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  const columns = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_courses'
    ORDER BY ordinal_position
  `);
  const rows = await client.query(`
    SELECT id, course_code, course_name, profession, thumbnail, status, access_type
    FROM public.exam_courses ORDER BY created_at ASC
  `);
  console.log(JSON.stringify({ columns: columns.rows, rows: rows.rows }));
  await client.end();
})().catch((error) => {
  console.error('DB_READ_FAILED', error.message);
  process.exitCode = 1;
});
