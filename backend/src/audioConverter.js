import fs from 'fs';
import path from 'path';
import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const execFileAsync = promisify(execFile);

let cachedFfmpegPath = null;

/**
 * Resolve the working ffmpeg binary (system ffmpeg or bundled @ffmpeg-installer binary)
 */
export function getFfmpegPath() {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  // 1. Check system PATH for ffmpeg
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
    cachedFfmpegPath = 'ffmpeg';
    return cachedFfmpegPath;
  } catch (e) {
    // System ffmpeg not available on PATH
  }

  // 2. Check bundled @ffmpeg-installer binary
  if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
    cachedFfmpegPath = ffmpegInstaller.path;
    try {
      // Ensure executable permissions on Linux / macOS
      fs.chmodSync(cachedFfmpegPath, 0o755);
    } catch {}
    try {
      execFileSync(cachedFfmpegPath, ['-version'], { stdio: 'pipe' });
      return cachedFfmpegPath;
    } catch (e) {
      console.warn('[AudioConverter] Bundled ffmpeg failed to execute:', e.message);
    }
  }

  return cachedFfmpegPath || ffmpegInstaller?.path || 'ffmpeg';
}

/**
 * Quick probe: Check if a buffer is already standard Ogg Opus audio
 */
export function isOggOpus(buffer) {
  if (!buffer || buffer.length < 36) return false;
  if (buffer.slice(0, 4).toString() !== 'OggS') return false;
  const headerSlice = buffer.slice(0, 128).toString('latin1');
  return headerSlice.includes('OpusHead');
}

/**
 * Quick probe: Check if a buffer is MP3 audio (ID3 header or MPEG sync word)
 */
export function isMp3(buffer) {
  if (!buffer || buffer.length < 4) return false;
  if (buffer.slice(0, 3).toString() === 'ID3') return true;
  return buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0;
}

/**
 * Quick probe: Check if a buffer is MP4 / M4A / AAC audio
 */
export function isMp4OrAac(buffer) {
  if (!buffer || buffer.length < 12) return false;
  const boxType = buffer.slice(4, 8).toString('latin1');
  if (boxType === 'ftyp') return true;
  return buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0;
}

/**
 * Quick probe: Check if a buffer is WebM (EBML header)
 */
export function isWebm(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
}

/**
 * Convert any audio buffer (WebM, WAV, MP4, AAC, MP3) into WhatsApp-compliant OGG Opus asynchronously.
 * Fully non-blocking: does not freeze the Node.js event loop during FFmpeg encoding.
 */
export async function convertAudioToWhatsAppOggOpusAsync(inputBuffer, inputExt = 'webm') {
  if (!inputBuffer || inputBuffer.length === 0) {
    return { success: false, buffer: inputBuffer, mimeType: 'audio/webm', isOggOpus: false };
  }

  const ffmpegBin = getFfmpegPath();
  const tmpDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(tmpDir)) {
    await fs.promises.mkdir(tmpDir, { recursive: true });
  }

  const cleanExt = (inputExt || 'webm').replace(/[^a-zA-Z0-9]/g, '') || 'webm';
  const tmpIn = path.join(tmpDir, `tmp_raw_${Date.now()}_${Math.random().toString(36).substring(7)}.${cleanExt}`);
  const tmpOut = path.join(tmpDir, `tmp_opus_${Date.now()}_${Math.random().toString(36).substring(7)}.ogg`);

  try {
    await fs.promises.writeFile(tmpIn, inputBuffer);
    console.log(`🎙️ [AudioConverter:Async] Transcoding audio (${cleanExt}, ${(inputBuffer.length / 1024).toFixed(1)} KB) to WhatsApp OGG Opus via ${path.basename(ffmpegBin)}...`);

    await execFileAsync(ffmpegBin, [
      '-y',
      '-i', tmpIn,
      '-vn',
      '-sn',
      '-dn',
      '-map', '0:a:0',
      '-map_metadata', '-1',
      '-af', 'asetpts=N/SR/TB',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vbr', 'on',
      '-compression_level', '10',
      '-application', 'voip',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      tmpOut
    ], { stdio: 'pipe' });

    try {
      const converted = await fs.promises.readFile(tmpOut);
      if (isOggOpus(converted)) {
        console.log(`✅ [AudioConverter:Async] Successfully generated WhatsApp OGG Opus (${(converted.length / 1024).toFixed(1)} KB, 48kHz mono voip, PTS normalized, clean metadata)`);
        return { success: true, buffer: converted, mimeType: 'audio/ogg; codecs=opus', isOggOpus: true };
      }
    } catch {}
  } catch (err) {
    console.warn(`⚠️ [AudioConverter:Async Warning] FFmpeg transcoding failed: ${err.message}.`);
  } finally {
    try { await fs.promises.unlink(tmpIn); } catch (e) {}
    try { await fs.promises.unlink(tmpOut); } catch (e) {}
  }

  // Fallback if FFmpeg failed: check if already Ogg Opus
  if (isOggOpus(inputBuffer)) {
    return { success: true, buffer: inputBuffer, mimeType: 'audio/ogg; codecs=opus', isOggOpus: true };
  }

  // If conversion failed, determine fallback mime
  let fallbackMime = 'audio/webm';
  if (isMp3(inputBuffer)) fallbackMime = 'audio/mpeg';
  else if (isMp4OrAac(inputBuffer)) fallbackMime = 'audio/mp4';

  return { success: false, buffer: inputBuffer, mimeType: fallbackMime, isOggOpus: false };
}

/**
 * Convert any audio buffer (WebM, WAV, MP4, AAC, MP3) into WhatsApp-compliant OGG Opus
 * WhatsApp Voice Notes (PTT) strictly require:
 * - Container: OGG
 * - Codec: Opus
 * - Channels: 1 (mono)
 * - Sample rate: 48000 Hz
 * - MIME: audio/ogg; codecs=opus
 */
export function convertAudioToWhatsAppOggOpus(inputBuffer, inputExt = 'webm') {
  if (!inputBuffer || inputBuffer.length === 0) {
    return { success: false, buffer: inputBuffer, mimeType: 'audio/webm', isOggOpus: false };
  }

  const ffmpegBin = getFfmpegPath();
  const tmpDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const cleanExt = (inputExt || 'webm').replace(/[^a-zA-Z0-9]/g, '') || 'webm';
  const tmpIn = path.join(tmpDir, `tmp_raw_${Date.now()}_${Math.random().toString(36).substring(7)}.${cleanExt}`);
  const tmpOut = path.join(tmpDir, `tmp_opus_${Date.now()}_${Math.random().toString(36).substring(7)}.ogg`);

  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    console.log(`🎙️ [AudioConverter] Transcoding audio (${cleanExt}, ${(inputBuffer.length / 1024).toFixed(1)} KB) to WhatsApp OGG Opus via ${path.basename(ffmpegBin)}...`);
    
    // Strict WhatsApp Cloud API audio specification:
    // 1. -vn -sn -dn: Strip any video, subtitle, or data streams from container
    // 2. -map 0:a:0: Explicitly map only the primary audio stream
    // 3. -map_metadata -1: Wipe all corrupt/incompatible container metadata & ID3 tags
    // 4. -af asetpts=N/SR/TB: Reset PTS timestamps to start strictly at 0.000000 (prevents negative timestamp decoder crashes)
    // 5. -c:a libopus: Opus encoder
    // 6. -b:a 64k: 64 kbps standard voice note bitrate
    // 7. -vbr on: Variable bitrate for speech clarity
    // 8. -compression_level 10: Maximum compression efficiency
    // 9. -application voip: Speech/VOIP profile optimized for voice messages
    // 10. -ar 48000: 48 kHz sampling rate strictly required by Opus
    // 11. -ac 1: Mono channel strictly required by WhatsApp mobile decoders
    // 12. -f ogg: Enforce standard OGG container
    execFileSync(ffmpegBin, [
      '-y',
      '-i', tmpIn,
      '-vn',
      '-sn',
      '-dn',
      '-map', '0:a:0',
      '-map_metadata', '-1',
      '-af', 'asetpts=N/SR/TB',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-vbr', 'on',
      '-compression_level', '10',
      '-application', 'voip',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      tmpOut
    ], { stdio: 'pipe' });

    if (fs.existsSync(tmpOut)) {
      const converted = fs.readFileSync(tmpOut);
      if (isOggOpus(converted)) {
        console.log(`✅ [AudioConverter] Successfully generated WhatsApp OGG Opus (${(converted.length / 1024).toFixed(1)} KB, 48kHz mono voip, PTS normalized, clean metadata)`);
        return { success: true, buffer: converted, mimeType: 'audio/ogg; codecs=opus', isOggOpus: true };
      }
    }
  } catch (err) {
    console.warn(`⚠️ [AudioConverter Warning] FFmpeg transcoding failed: ${err.message}.`);
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
  }

  // Fallback if FFmpeg failed: check if already Ogg Opus
  if (isOggOpus(inputBuffer)) {
    return { success: true, buffer: inputBuffer, mimeType: 'audio/ogg; codecs=opus', isOggOpus: true };
  }

  // If conversion failed, determine fallback mime
  let fallbackMime = 'audio/webm';
  if (isMp3(inputBuffer)) fallbackMime = 'audio/mpeg';
  else if (isMp4OrAac(inputBuffer)) fallbackMime = 'audio/mp4';

  return { success: false, buffer: inputBuffer, mimeType: fallbackMime, isOggOpus: false };
}
