export interface AudioRecordingResult {
  blob: Blob;
  dataUrl: string;
  durationSeconds: number;
  mimeType: string;
  extension: string;
}

export class WhatsAppVoiceRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private selectedMimeType: string = '';
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

    // Detect browser-supported audio mime type (preferred: ogg opus -> webm opus -> webm -> mp4)
    const candidateTypes = [
      'audio/ogg; codecs=opus',
      'audio/webm; codecs=opus',
      'audio/webm',
      'audio/mp4'
    ];

    this.selectedMimeType = '';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      for (const type of candidateTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          this.selectedMimeType = type;
          break;
        }
      }
    }

    this.audioChunks = [];
    const options: MediaRecorderOptions = {};
    if (this.selectedMimeType) {
      options.mimeType = this.selectedMimeType;
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
    this.selectedMimeType = this.mediaRecorder.mimeType || this.selectedMimeType || 'audio/webm';

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    // Request data every 250ms for reliable chunk collection
    this.mediaRecorder.start(250);
    this.isRecording = true;
    this.startTime = Date.now();
    console.log(`🎤 [VoiceRecorder] MediaRecorder started with MIME: ${this.selectedMimeType}`);
  }

  async stop(): Promise<AudioRecordingResult | null> {
    if (!this.isRecording || !this.mediaRecorder) return null;
    this.isRecording = false;

    const durationSeconds = Math.max(0.5, (Date.now() - this.startTime) / 1000);

    return new Promise<AudioRecordingResult | null>((resolve) => {
      const recorder = this.mediaRecorder;
      if (!recorder) {
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        // Stop all audio tracks
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(t => t.stop());
          this.mediaStream = null;
        }
        this.mediaRecorder = null;

        if (this.audioChunks.length === 0) {
          console.warn('⚠️ [VoiceRecorder] No audio chunks captured.');
          resolve(null);
          return;
        }

        const effectiveMime = this.selectedMimeType || 'audio/webm';
        const finalBlob = new Blob(this.audioChunks, { type: effectiveMime });

        let extension = 'webm';
        if (effectiveMime.includes('ogg')) extension = 'ogg';
        else if (effectiveMime.includes('mp4') || effectiveMime.includes('m4a')) extension = 'mp4';

        console.log(`🎙️ [VoiceRecorder] Captured audio blob: ${(finalBlob.size / 1024).toFixed(1)} KB, MIME: ${effectiveMime}, Duration: ${durationSeconds.toFixed(1)}s`);

        const dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(finalBlob);
        });

        resolve({
          blob: finalBlob,
          dataUrl,
          durationSeconds,
          mimeType: effectiveMime,
          extension
        });
      };

      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
        resolve(null);
      }
    });
  }

  cancel(): void {
    this.isRecording = false;
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    this.audioChunks = [];
  }
}
