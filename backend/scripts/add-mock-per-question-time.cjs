require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  await client.query(`ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS per_question_seconds INTEGER`);
  const result = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_mock_tests' AND column_name = 'per_question_seconds'
  `);
  console.log(JSON.stringify(result.rows));
  await client.end();
})().catch((error) => { console.error('MOCK_TIME_MIGRATION_FAILED', error.message); process.exitCode = 1; });
