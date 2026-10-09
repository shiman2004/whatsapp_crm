// @ts-ignore
import * as lamejsModule from 'lamejs';

export interface AudioRecordingResult {
  blob: Blob;
  dataUrl: string;
  durationSeconds: number;
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
        autoGainControl: true
      }
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.sampleRate = this.audioContext.sampleRate || 44100;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    // 4096 buffer size, 1 input channel (mono), 1 output channel
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
  }

  async stop(): Promise<AudioRecordingResult | null> {
    if (!this.isRecording) return null;
    this.isRecording = false;

    const durationSeconds = Math.max(0.5, (Date.now() - this.startTime) / 1000);

    // Disconnect and clean audio graph
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

    if (this.pcmChunks.length === 0) return null;

    // Flatten PCM samples
    const totalSamples = this.pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const flattenedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      flattenedPcm.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert Float32 to Int16 PCM
    const int16Samples = new Int16Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const s = Math.max(-1, Math.min(1, flattenedPcm[i]));
      int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Encode to Standard MP3 via lamejs
    const Lame = (lamejsModule as any).default || lamejsModule;
    const encoder = new Lame.Mp3Encoder(1, this.sampleRate, 128);
    const mp3Chunks: ArrayBuffer[] = [];

    const sampleBlockSize = 1152;
    for (let i = 0; i < totalSamples; i += sampleBlockSize) {
      const block = int16Samples.subarray(i, i + sampleBlockSize);
      const mp3buf = encoder.encodeBuffer(block);
      if (mp3buf.length > 0) {
        mp3Chunks.push(new Uint8Array(mp3buf).buffer);
      }
    }

    const endBuf = encoder.flush();
    if (endBuf.length > 0) {
      mp3Chunks.push(new Uint8Array(endBuf).buffer);
    }

    const blob = new Blob(mp3Chunks, { type: 'audio/mpeg' });

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return {
      blob,
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
