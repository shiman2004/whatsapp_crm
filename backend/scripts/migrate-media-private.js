import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getPrisma, checkDbConnection } from '../src/db.js';
import { assertDatabaseOperationAllowed } from '../src/databasePolicy.js';

assertDatabaseOperationAllowed('utility');

const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'whatsapp-media';
const root = path.resolve(process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. No files were changed.');
}

await checkDbConnection();
const files = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isFile());
const results = [];
for (const entry of files) {
  const filePath = path.join(root, entry.name);
  const buffer = await fs.readFile(filePath);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(entry.name, buffer, {
    upsert: true,
    contentType: 'application/octet-stream'
  });
  if (uploadError) throw uploadError;
  const { data, error: verifyError } = await supabase.storage.from(bucket).download(entry.name);
  if (verifyError || !data || (data.size && data.size !== buffer.length)) {
    throw new Error(`Integrity verification failed for ${entry.name}`);
  }
  results.push({ file: entry.name, bytes: buffer.length, verified: true });
}

console.log(JSON.stringify({ bucket, source: root, migrated: results.length, results }, null, 2));
console.log('Original local files were retained. Review the verification output before removing any legacy files.');
