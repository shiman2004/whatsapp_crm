require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const updates = [
      ['mcq-sample-blood-transfusion', 'RN-001'],
      ['mcq-sample-digoxin-toxicity', 'RN-002'],
      ['mcq-sample-anaphylaxis-shock', 'RN-003'],
    ];
    for (const [id, code] of updates) {
      await client.query(`
        UPDATE public.exam_mcq_questions
        SET course_id = 'course-dha-rn', question_code = $2, updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE
      `, [id, code]);
    }
    await client.query('COMMIT');
    const verify = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM public.exam_mcq_questions
      WHERE course_id = 'course-dha-rn' AND is_active = TRUE
    `);
    console.log(JSON.stringify({ linkedToDhaRegisteredNurse: verify.rows[0].count }));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('MCQ_REPAIR_FAILED', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
