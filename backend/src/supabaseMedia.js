import { getPrisma } from './db.js';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const storageBucket = process.env.SUPABASE_MEDIA_BUCKET || 'whatsapp-media';
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

/**
 * Persist media file directly into Supabase PostgreSQL (public.media_files)
 * This guarantees media is never lost even when Render containers restart/idle.
 */
export async function saveMediaToSupabase(fileName, mimeType, buffer) {
  if (!fileName || !buffer) return false;
  try {
    const prisma = getPrisma();
    if (!prisma) {
      console.warn('⚠️ [SupabaseMedia] Prisma client unavailable, skipped DB persistence');
      return false;
    }

    const cleanFileName = path.basename(fileName);
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const mime = mimeType || 'application/octet-stream';

    if (supabase) {
      const { error } = await supabase.storage.from(storageBucket).upload(cleanFileName, buf, {
        contentType: mime,
        upsert: true,
        cacheControl: '3600'
      });
      if (error) throw error;
      return true;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.media_files (id, file_name, mime_type, data, size, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (file_name) 
      DO UPDATE SET data = EXCLUDED.data, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type;
    `, mediaId, cleanFileName, mime, buf, buf.length);

    console.log(`☁️ [SupabaseMedia] Persisted ${cleanFileName} (${(buf.length / 1024).toFixed(1)} KB) into Supabase PostgreSQL`);
    return true;
  } catch (err) {
    console.error(`❌ [SupabaseMedia] Error saving ${fileName} to Supabase:`, err.message);
    return false;
  }
}

/**
 * Retrieve media file from Supabase PostgreSQL
 */
export async function getMediaFromSupabase(fileName) {
  if (!fileName) return null;
  try {
    if (supabase) {
      const { data, error } = await supabase.storage.from(storageBucket).download(path.basename(fileName));
      if (!error && data) {
        return {
          fileName: path.basename(fileName),
          mimeType: data.type || 'application/octet-stream',
          buffer: Buffer.from(await data.arrayBuffer()),
          size: data.size || 0
        };
      }
    }
    const prisma = getPrisma();
    if (!prisma) return null;

    const cleanFileName = path.basename(fileName);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT file_name, mime_type, data, size 
      FROM public.media_files 
      WHERE file_name = $1 
      LIMIT 1;
    `, cleanFileName);

    if (!rows || rows.length === 0 || !rows[0].data) {
      return null;
    }

    const row = rows[0];
    const buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    return {
      fileName: row.file_name,
      mimeType: row.mime_type || 'application/octet-stream',
      buffer,
      size: row.size || buffer.length
    };
  } catch (err) {
    console.error(`❌ [SupabaseMedia] Error fetching ${fileName} from Supabase:`, err.message);
    return null;
  }
}

/**
 * Delete media file from Supabase PostgreSQL
 */
export async function deleteMediaFromSupabase(fileName) {
  if (!fileName) return false;
  try {
    if (supabase) {
      const { error } = await supabase.storage.from(storageBucket).remove([path.basename(fileName)]);
      return !error;
    }
    const prisma = getPrisma();
    if (!prisma) return false;

    const cleanFileName = path.basename(fileName);
    await prisma.$executeRawUnsafe(`
      DELETE FROM public.media_files WHERE file_name = $1;
    `, cleanFileName);

    console.log(`🗑️ [SupabaseMedia] Deleted ${cleanFileName} from Supabase`);
    return true;
  } catch (err) {
    console.warn(`⚠️ [SupabaseMedia] Error deleting ${fileName} from Supabase:`, err.message);
    return false;
  }
}

/**
 * Batch delete media files from Supabase PostgreSQL
 */
export async function deleteMediaBatchFromSupabase(fileNames) {
  if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) return false;
  try {
    const prisma = getPrisma();
    if (!prisma) return false;

    const cleanNames = fileNames.map(f => path.basename(f)).filter(Boolean);
    if (cleanNames.length === 0) return false;

    for (const name of cleanNames) {
      await deleteMediaFromSupabase(name);
    }
    return true;
  } catch (err) {
    console.warn('⚠️ [SupabaseMedia] Error batch deleting media files:', err.message);
    return false;
  }
}
