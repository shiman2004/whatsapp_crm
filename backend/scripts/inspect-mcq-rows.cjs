require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(`
    SELECT id, course_id, question_code, question_text, option_a, option_b, option_c, option_d, option_e,
           correct_answer, question_type, is_active
    FROM public.exam_mcq_questions ORDER BY created_at ASC
  `);
  console.log(JSON.stringify(result.rows));
  await client.end();
})().catch((error) => { console.error('MCQ_READ_FAILED', error.message); process.exitCode = 1; });
