// @ts-ignore
import * as lamejsModule from 'lamejs';

export interface AudioRecordingResult {
  blob: Blob;
  dataUrl: string;
  durationSeconds: number;
}

function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono (1 channel)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export class WhatsAppVoiceRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private sampleRate: number = 44100;
  private startTime: number = 0;
  private isRecording: boolean = false;

  async start(): Promise<void> {
    if (this.isRecording) return;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.audioContext = new AudioContextClass({ sampleRate: 44100 });
    } catch (e) {
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sampleRate = this.audioContext.sampleRate || 44100;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    // 4096 buffer size, 1 channel mono input, 1 channel output
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.pcmChunks = [];
    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputBuffer = e.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(inputBuffer));
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);

    this.isRecording = true;
    this.startTime = Date.now();
    console.log('🎤 [VoiceRecorder] Started recording at sample rate:', this.sampleRate);
  }

  async stop(): Promise<AudioRecordingResult | null> {
    if (!this.isRecording) return null;
    this.isRecording = false;

    const durationSeconds = Math.max(0.5, (Date.now() - this.startTime) / 1000);

    // Disconnect and cleanup audio nodes
    if (this.scriptProcessor && this.sourceNode) {
      try {
        this.scriptProcessor.disconnect();
        this.sourceNode.disconnect();
      } catch (e) {}
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.pcmChunks.length === 0) {
      console.warn('⚠️ [VoiceRecorder] No audio chunks captured.');
      return null;
    }

    // Flatten PCM samples
    const totalSamples = this.pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const flattenedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      flattenedPcm.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`🎙️ [VoiceRecorder] Captured ${totalSamples} samples (${durationSeconds.toFixed(1)}s)`);

    let finalBlob: Blob | null = null;

    // Try MP3 encoding via lamejs
    try {
      const Lame = (lamejsModule as any).Mp3Encoder 
        ? lamejsModule 
        : ((lamejsModule as any).default || lamejsModule);
      const Mp3Encoder = Lame.Mp3Encoder || (lamejsModule as any).Mp3Encoder;

      if (typeof Mp3Encoder === 'function') {
        const encoder = new Mp3Encoder(1, this.sampleRate, 128);
        const int16Samples = new Int16Array(totalSamples);
        for (let i = 0; i < totalSamples; i++) {
          const s = Math.max(-1, Math.min(1, flattenedPcm[i]));
          int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const mp3Chunks: ArrayBuffer[] = [];
        const sampleBlockSize = 1152;
        for (let i = 0; i < totalSamples; i += sampleBlockSize) {
          const block = int16Samples.subarray(i, i + sampleBlockSize);
          const mp3buf = encoder.encodeBuffer(block);
          if (mp3buf && mp3buf.length > 0) {
            mp3Chunks.push(new Uint8Array(mp3buf).buffer);
          }
        }

        const endBuf = encoder.flush();
        if (endBuf && endBuf.length > 0) {
          mp3Chunks.push(new Uint8Array(endBuf).buffer);
        }

        if (mp3Chunks.length > 0) {
          finalBlob = new Blob(mp3Chunks, { type: 'audio/mpeg' });
          console.log(`🎵 [VoiceRecorder] Encoded MP3 (${(finalBlob.size / 1024).toFixed(1)} KB)`);
        }
      }
    } catch (mp3Err: any) {
      console.warn('⚠️ [VoiceRecorder] MP3 encoder fallback to WAV:', mp3Err.message);
    }

    // Fallback to standard 16-bit PCM WAV if MP3 is unavailable
    if (!finalBlob) {
      finalBlob = encodeWavBlob(flattenedPcm, this.sampleRate);
      console.log(`🔊 [VoiceRecorder] Generated WAV (${(finalBlob.size / 1024).toFixed(1)} KB)`);
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(finalBlob);
    });

    return {
      blob: finalBlob,
      dataUrl,
      durationSeconds
    };
  }

  cancel(): void {
    this.isRecording = false;
    if (this.scriptProcessor && this.sourceNode) {
      try {
        this.scriptProcessor.disconnect();
        this.sourceNode.disconnect();
      } catch (e) {}
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.pcmChunks = [];
  }
}
