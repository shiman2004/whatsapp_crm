/**
 * Sound Utility for WhatsApp CRM
 * Synthesizes an authentic WhatsApp Web notification chime using the Web Audio API.
 * Zero external audio dependencies, instant playback, zero network latency.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays the characteristic two-tone WhatsApp Web message chime (D5 -> A5)
 */
export function playWhatsAppChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master volume gain node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.connect(ctx.destination);

    // Tone 1: High tone (880 Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1175, now + 0.08); // Pitch sweep up

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2: Warm undertone (587.33 Hz - D5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(587.33, now + 0.04);

    gain2.gain.setValueAtTime(0, now + 0.04);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(now + 0.04);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.warn('[SoundUtils] Could not play notification chime:', err);
  }
}
