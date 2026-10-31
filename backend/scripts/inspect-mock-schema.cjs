require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_mock_tests'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(result.rows));
  await client.end();
})().catch((error) => { console.error('MOCK_SCHEMA_FAILED', error.message); process.exitCode = 1; });
