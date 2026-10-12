import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

let cachedFfmpegPath = null;

/**
 * Resolve the working ffmpeg binary (system ffmpeg or bundled @ffmpeg-installer binary)
 */
export function getFfmpegPath() {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    cachedFfmpegPath = 'ffmpeg';
    return cachedFfmpegPath;
  } catch (e) {
    if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
      cachedFfmpegPath = ffmpegInstaller.path;
      return cachedFfmpegPath;
    }
  }

  return ffmpegInstaller?.path || 'ffmpeg';
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
 * Convert any audio buffer (WebM, WAV, MP4, AAC, MP3) into WhatsApp-compliant OGG Opus
 * WhatsApp Voice Notes (PTT) strictly require:
 * - Container: OGG
 * - Codec: Opus
 * - Channels: 1 (mono)
 * - Sample rate: 48000 Hz
 * - MIME: audio/ogg; codecs=opus
 */
export function convertAudioToWhatsAppOggOpus(inputBuffer, inputExt = 'webm') {
  if (!inputBuffer || inputBuffer.length === 0) return inputBuffer;

  // Skip conversion if already valid OGG Opus
  if (isOggOpus(inputBuffer)) {
    console.log('🎵 [AudioConverter] Audio is already verified Ogg Opus. Skipping re-encode.');
    return inputBuffer;
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
    
    execSync(`"${ffmpegBin}" -y -i "${tmpIn}" -c:a libopus -b:a 32k -ar 48000 -ac 1 "${tmpOut}"`, { stdio: 'pipe' });

    if (fs.existsSync(tmpOut)) {
      const converted = fs.readFileSync(tmpOut);
      console.log(`✅ [AudioConverter] Successfully generated WhatsApp OGG Opus (${(converted.length / 1024).toFixed(1)} KB)`);
      return converted;
    }
  } catch (err) {
    console.warn(`⚠️ [AudioConverter Warning] FFmpeg transcoding failed: ${err.message}. Preserving original buffer.`);
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
  }

  return inputBuffer;
}
