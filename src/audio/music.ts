type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const BPM = 90;
const BEAT = 60 / BPM;         // ~0.667 s per beat
const LOOP_BEATS = 8;
const LOOKAHEAD = 0.22;         // 220 ms lookahead
const TICK_MS = 95;             // scheduler interval
const FADE_TIME = 0.80;         // fade in/out duration (s)

const F = {
  C3: 130.81, G3: 196.00, A3: 220.00,
  C4: 261.63, E4: 329.63, G4: 392.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 784.00, A5: 880.00,
  C6: 1046.50, E6: 1318.51
} as const;

interface NoteEvent {
  beat: number;
  freq: number;
  durBeats: number;
  vol: number;
  wave: OscillatorType;
  offset?: number; // fractional beat offset within the beat
}

// 8-beat loop in C major pentatonic (C D E G A).
// Melody: E5→G5→A5→G5→E5→D5→C5 with grace pickup.
// Bass: C3/G3 every 2 beats (I-V alternation).
// Pad: soft harmony changing on beats 0 and 4.
// Bell shimmer: gentle high C6/E6 accents.
const PATTERN: NoteEvent[] = [
  // ── Melody ──────────────────────────────────────────────────
  { beat: 0, freq: F.E5, durBeats: 0.62, vol: 0.036, wave: 'sine' },
  { beat: 1, freq: F.G5, durBeats: 0.55, vol: 0.034, wave: 'sine' },
  { beat: 2, freq: F.A5, durBeats: 0.50, vol: 0.032, wave: 'sine' },
  { beat: 3, freq: F.G5, durBeats: 0.55, vol: 0.032, wave: 'sine' },
  { beat: 4, freq: F.E5, durBeats: 0.62, vol: 0.036, wave: 'sine' },
  { beat: 5, freq: F.D5, durBeats: 0.55, vol: 0.034, wave: 'sine' },
  { beat: 6, freq: F.C5, durBeats: 0.78, vol: 0.036, wave: 'sine' },
  { beat: 7, freq: F.E5, durBeats: 0.28, vol: 0.018, wave: 'sine', offset: 0.52 },

  // ── Bass ─────────────────────────────────────────────────────
  { beat: 0, freq: F.C3, durBeats: 0.85, vol: 0.019, wave: 'triangle' },
  { beat: 2, freq: F.G3, durBeats: 0.85, vol: 0.018, wave: 'triangle' },
  { beat: 4, freq: F.C3, durBeats: 0.85, vol: 0.019, wave: 'triangle' },
  { beat: 6, freq: F.G3, durBeats: 0.85, vol: 0.018, wave: 'triangle' },

  // ── Pad (soft harmony) ────────────────────────────────────────
  { beat: 0, freq: F.C4, durBeats: 1.88, vol: 0.012, wave: 'sine' },
  { beat: 0, freq: F.G4, durBeats: 1.88, vol: 0.010, wave: 'sine' },
  { beat: 4, freq: F.A3, durBeats: 1.88, vol: 0.011, wave: 'sine' },
  { beat: 4, freq: F.E4, durBeats: 1.88, vol: 0.010, wave: 'sine' },

  // ── Bell shimmer ──────────────────────────────────────────────
  { beat: 0, freq: F.C6, durBeats: 0.32, vol: 0.008, wave: 'sine' },
  { beat: 4, freq: F.E6, durBeats: 0.28, vol: 0.007, wave: 'sine' },
];

export class CandyMusic {
  private ctx?: AudioContext;
  private masterGain?: GainNode;
  private tickerId?: ReturnType<typeof setInterval>;
  private nextBeatTime = 0;
  private currentBeat = 0;
  private started = false;
  private enabled: boolean;
  private unlocked = false;

  constructor(musicEnabled: boolean) {
    this.enabled = musicEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.fadeOut();
    } else if (this.unlocked) {
      this.fadeIn();
    }
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.enabled) {
      this.start();
    }
  }

  handleVisibility(visible: boolean): void {
    if (!this.unlocked) return;
    if (!visible) {
      this.stopTicker();
      if (this.ctx) void this.ctx.suspend().catch(() => undefined);
    } else if (this.enabled) {
      if (this.ctx) void this.ctx.resume().catch(() => undefined);
      if (this.started) this.startTicker();
      else this.start();
    }
  }

  private start(): void {
    if (this.started) return;
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    this.started = true;
    const now = ctx.currentTime;
    this.nextBeatTime = now + 0.06;
    this.currentBeat = 0;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.linearRampToValueAtTime(1.0, now + FADE_TIME);
    this.startTicker();
  }

  private fadeOut(): void {
    this.stopTicker();
    this.started = false;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + FADE_TIME);
    }
  }

  private fadeIn(): void {
    if (this.started) return;
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain) return;
    this.started = true;
    const now = ctx.currentTime;
    this.nextBeatTime = now + 0.06;
    this.currentBeat = 0;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.linearRampToValueAtTime(1.0, now + FADE_TIME);
    this.startTicker();
  }

  private startTicker(): void {
    if (this.tickerId !== undefined) return;
    this.tickerId = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicker(): void {
    if (this.tickerId !== undefined) {
      clearInterval(this.tickerId);
      this.tickerId = undefined;
    }
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
      return;
    }
    // After a long pause/suspension, skip past beats to avoid scheduling in the past.
    if (this.nextBeatTime < ctx.currentTime - BEAT) {
      this.nextBeatTime = ctx.currentTime + 0.06;
      this.currentBeat = 0;
    }
    const until = ctx.currentTime + LOOKAHEAD;
    while (this.nextBeatTime < until) {
      this.scheduleBeat(this.currentBeat, this.nextBeatTime);
      this.nextBeatTime += BEAT;
      this.currentBeat = (this.currentBeat + 1) % LOOP_BEATS;
    }
  }

  private scheduleBeat(beat: number, beatTime: number): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;

    for (const ev of PATTERN) {
      if (ev.beat !== beat) continue;
      const t0 = beatTime + (ev.offset ?? 0) * BEAT;
      const t1 = t0 + ev.durBeats * BEAT;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = ev.wave;
      osc.frequency.setValueAtTime(ev.freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(ev.vol, t0 + 0.015);
      gain.gain.setValueAtTime(ev.vol, Math.max(t0 + 0.02, t1 - 0.06));
      gain.gain.linearRampToValueAtTime(0.0001, t1);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }

  private getOrCreateContext(): AudioContext | undefined {
    try {
      const AC = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
      if (!AC) return undefined;
      if (!this.ctx) {
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined);
      }
      return this.ctx;
    } catch {
      return undefined;
    }
  }
}
