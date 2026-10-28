require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

const questions = [
  {
    id: 'mock-rn-001',
    code: 'RN-MOCK-001',
    topic: 'Emergency Nursing',
    text: 'A client receiving a blood transfusion develops chills, flank pain, and a rising temperature. What is the nurse’s priority action?',
    a: 'Slow the transfusion and observe the client for 15 minutes',
    b: 'Stop the transfusion and keep the intravenous line open with normal saline using new tubing',
    c: 'Administer acetaminophen and continue the transfusion',
    d: 'Remove the intravenous catheter immediately',
    e: 'Ask the client to drink additional fluids',
    answer: 'B',
    note1: 'A suspected acute transfusion reaction requires the transfusion to be stopped immediately.',
    note2: 'Maintain venous access with normal saline and new tubing while the reaction is investigated.',
    note3: 'Notify the provider and blood bank and follow the facility transfusion-reaction protocol.',
    explanation: 'Stopping the transfusion prevents additional incompatible blood from entering the client. New tubing and normal saline preserve access without infusing more blood product.'
  },
  {
    id: 'mock-rn-002',
    code: 'RN-MOCK-002',
    topic: 'Medication Safety',
    text: 'Before administering digoxin to an adult client, which assessment finding requires the nurse to withhold the dose and notify the provider?',
    a: 'Apical pulse of 54 beats per minute',
    b: 'Respiratory rate of 18 breaths per minute',
    c: 'Blood pressure of 128/76 mmHg',
    d: 'Potassium level of 4.2 mEq/L',
    e: 'Oxygen saturation of 97% on room air',
    answer: 'A',
    note1: 'Count the apical pulse for a full minute before giving digoxin.',
    note2: 'Adult bradycardia is a safety warning and commonly requires withholding the dose and contacting the provider.',
    note3: 'Low potassium can also increase the risk of digoxin toxicity, so electrolyte results must be reviewed.',
    explanation: 'An apical pulse of 54 beats per minute indicates bradycardia. The nurse should withhold digoxin and notify the provider according to the medication and facility protocol.'
  }
];

(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const q of questions) {
      await client.query(`
        INSERT INTO public.exam_mcq_questions (
          id, course_id, question_code, topic, question_text,
          title, subject,
          option_a, option_b, option_c, option_d, option_e, correct_answer,
          remember_note_1, remember_note_2, remember_note_3, detailed_explanation,
          difficulty, question_type, status, is_active, display_order, created_at, updated_at
        ) VALUES (
          $1, 'course-dha-rn', $2, $3, $4,
          $5, 'Nursing',
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          'Medium', 'Mock Test', 'Draft', FALSE, $16, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          course_id = EXCLUDED.course_id,
          question_code = EXCLUDED.question_code,
          topic = EXCLUDED.topic,
          question_text = EXCLUDED.question_text,
          title = EXCLUDED.title,
          subject = EXCLUDED.subject,
          option_a = EXCLUDED.option_a,
          option_b = EXCLUDED.option_b,
          option_c = EXCLUDED.option_c,
          option_d = EXCLUDED.option_d,
          option_e = EXCLUDED.option_e,
          correct_answer = EXCLUDED.correct_answer,
          remember_note_1 = EXCLUDED.remember_note_1,
          remember_note_2 = EXCLUDED.remember_note_2,
          remember_note_3 = EXCLUDED.remember_note_3,
          detailed_explanation = EXCLUDED.detailed_explanation,
          difficulty = EXCLUDED.difficulty,
          question_type = EXCLUDED.question_type,
          status = 'Draft',
          is_active = FALSE,
          updated_at = NOW()
      `, [q.id, q.code, q.topic, q.text, `${q.topic} Mock Question`, q.a, q.b, q.c, q.d, q.e, q.answer, q.note1, q.note2, q.note3, q.explanation, 100 + questions.indexOf(q)]);
    }
    await client.query('COMMIT');
    const verify = await client.query(`
      SELECT id, question_code, question_type, status, is_active
      FROM public.exam_mcq_questions
      WHERE id IN ('mock-rn-001', 'mock-rn-002')
      ORDER BY question_code
    `);
    console.log(JSON.stringify(verify.rows));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('NURSE_MOCK_SEED_FAILED', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
