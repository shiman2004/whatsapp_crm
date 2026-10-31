require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(`
    SELECT id, title, category_id, category_name, target_profession, total_questions,
           duration_minutes, passing_score, difficulty, is_active
    FROM public.exam_mock_tests ORDER BY created_at ASC
  `);
  console.log(JSON.stringify(result.rows));
  await client.end();
})().catch((error) => { console.error('MOCK_READ_FAILED', error.message); process.exitCode = 1; });
