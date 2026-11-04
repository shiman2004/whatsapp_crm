import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getPrisma, checkDbConnection } from '../src/db.js';
import { assertDatabaseOperationAllowed } from '../src/databasePolicy.js';

// Ensure backend .env is loaded
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config();

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;

  if (isApply) {
    assertDatabaseOperationAllowed('utility');
  }

  const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'whatsapp-media';
  const resolvedDir = process.env.MEDIA_UPLOAD_DIR
    ? path.resolve(process.env.MEDIA_UPLOAD_DIR)
    : existsSync(path.join(process.cwd(), 'backend', 'public', 'uploads'))
      ? path.resolve(process.cwd(), 'backend', 'public', 'uploads')
      : path.resolve(process.cwd(), 'public', 'uploads');

  const root = resolvedDir;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. No files were changed.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  await checkDbConnection();

  // Verify bucket exists and is private
  const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError || !bucketInfo) {
    throw new Error(`Failed to access storage bucket "${bucket}": ${bucketError?.message || 'Bucket not found'}`);
  }

  if (bucketInfo.public) {
    throw new Error(`Security violation: Storage bucket "${bucket}" is public. It must be configured as private.`);
  }

  console.log(`🔒 [Bucket Security] Storage bucket "${bucket}" is verified PRIVATE.`);

  const files = existsSync(root)
    ? (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isFile())
    : [];

  console.log(`📂 [Source Directory] Found ${files.length} files in ${root}`);

  if (isDryRun) {
    console.log(`\n⚙️ [Media Migration] Running in DRY-RUN mode...`);

    // Fetch existing objects in the bucket
    const { data: remoteObjects, error: listError } = await supabase.storage.from(bucket).list();
    const remoteNames = new Set((remoteObjects || []).map(o => o.name));

    const plan = [];
    let totalBytes = 0;

    for (const entry of files) {
      const filePath = path.join(root, entry.name);
      const stat = await fs.stat(filePath);
      totalBytes += stat.size;
      const alreadyInBucket = remoteNames.has(entry.name);

      plan.push({
        file: entry.name,
        sizeBytes: stat.size,
        alreadyInBucket,
        action: alreadyInBucket ? 'overwrite/verify' : 'upload'
      });
    }

    const dryRunReport = {
      mode: 'dry-run',
      bucket,
      bucketPrivate: true,
      source: root,
      totalFiles: files.length,
      totalBytes,
      alreadyInBucketCount: plan.filter(p => p.alreadyInBucket).length,
      toUploadCount: plan.filter(p => !p.alreadyInBucket).length,
      plan
    };

    console.log('\n--- Dry-Run Migration Plan ---');
    console.log(JSON.stringify(dryRunReport, null, 2));
    console.log('\n✅ Dry run completed successfully. No files were uploaded or modified in Supabase Storage.');
    console.log('To execute the live migration, run with: node backend/scripts/migrate-media-private.js --apply');
    const prisma = getPrisma();
    if (prisma) await prisma.$disconnect();
    return;
  }

  // Live migration execution (--apply)
  console.log(`\n🚀 [Media Migration] Executing LIVE migration...`);
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
  const prisma = getPrisma();
  if (prisma) await prisma.$disconnect();
}

run().catch(err => {
  console.error('\n❌ Media migration error:', err.message);
  process.exit(1);
});
