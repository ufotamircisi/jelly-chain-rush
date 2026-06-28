type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type VoiceCallout = 'nice' | 'great' | 'awesome' | 'fantastic' | 'incredible' | 'amazing' | 'legendary';

const VOLUME = {
  master: 0.72,
  voice: 0.72,
  ui: 0.035,
  invalid: 0.045,
  warning: 0.06,
  smallBlast: 0.095,
  mediumBlast: 0.12,
  bigBlast: 0.145,
  hugeBlast: 0.18,
  chain: 0.085,
  reward: 0.14,
  premium: 0.17,
  level: 0.14,
  drop: 0.055
} as const;

const VOICE_MODULES = import.meta.glob<string>('../assets/audio/voice/en/*.wav', {
  eager: true,
  import: 'default'
});

const VOICE_FILES: Record<VoiceCallout, string> = {
  nice: 'nice.wav',
  great: 'great.wav',
  awesome: 'awesome.wav',
  fantastic: 'fantastic.wav',
  incredible: 'incredible.wav',
  amazing: 'amazing.wav',
  legendary: 'legendary.wav'
};

const VOICE_PRIORITY: Record<VoiceCallout, number> = {
  nice: 1,
  great: 2,
  awesome: 3,
  amazing: 4,
  fantastic: 5,
  incredible: 6,
  legendary: 7
};

const VOICE_COOLDOWN_MS = 1750;
const HIGH_MULTIPLIER_CALLOUTS: Record<number, VoiceCallout> = {
  7: 'amazing',
  8: 'fantastic',
  9: 'incredible',
  10: 'legendary'
};

export class CandySfx {
  private context?: AudioContext;
  private master?: GainNode;
  private muted: boolean;
  private unlocked = false;
  private voices = new Map<VoiceCallout, HTMLAudioElement>();
  private lastVoiceAt = 0;
  private currentVoice?: HTMLAudioElement;

  constructor(soundEnabled: boolean) {
    this.muted = !soundEnabled;
    this.prepareVoices();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.currentVoice?.pause();
      this.currentVoice = undefined;
    }
  }

  unlock(): void {
    this.unlocked = true;
    void this.getContext();
  }

  playButtonTap(): void {
    this.safePlay(() => this.playTone(540, 0.045, VOLUME.ui, 0, 'sine', 820));
  }

  playStartChime(): void {
    this.safePlay(() => this.playChord([
      { frequency: 660, duration: 0.13, delay: 0, volume: 0.075 },
      { frequency: 880, duration: 0.15, delay: 0.075, volume: 0.07 },
      { frequency: 1320, duration: 0.11, delay: 0.15, volume: 0.045 }
    ]));
  }

  playLevelStart(): void {
    this.safePlay(() => {
      this.playChord([
        { frequency: 784, duration: 0.16, delay: 0, volume: 0.082 },
        { frequency: 988, duration: 0.16, delay: 0.18, volume: 0.076 },
        { frequency: 1318, duration: 0.2, delay: 0.36, volume: 0.06 }
      ]);
      this.playTone(1760, 0.16, 0.026, 0.54, 'sine', 2200);
      this.playNoise(0.42, 0.024, 1800, 6200, 0.45, 'bandpass');
    });
  }

  playShakeRattle(): void {
    this.safePlay(() => {
      this.playNoise(0.24, 0.072, 260, 1800, 0, 'bandpass');
      this.playNoise(0.16, 0.038, 1200, 3600, 0.11, 'bandpass');
      this.playSweep(210, 620, 0.18, 0.048, 0.03, 'triangle');
      this.playTone(980, 0.045, 0.022, 0.2, 'sine');
    });
  }

  playDropShimmer(): void {
    this.safePlay(() => {
      this.playNoise(0.42, VOLUME.drop, 1300, 3600, 0.02, 'bandpass');
      this.playTone(760, 0.08, 0.028, 0.06, 'sine', 1120);
      this.playTone(1040, 0.08, 0.024, 0.19, 'sine', 1460);
      this.playTone(1280, 0.07, 0.022, 0.33, 'sine', 1740);
    });
  }

  playBlast(groupSize: number, highestMultiplierIndex: number): void {
    this.safePlay(() => {
      if (highestMultiplierIndex >= 10) {
        this.playX1000();
        return;
      }

      if (highestMultiplierIndex >= 7) {
        this.playHighMultiplier(highestMultiplierIndex);
      }

      if (groupSize >= 10) {
        this.playHugeBlast();
      } else if (groupSize >= 5) {
        this.playBigBlast();
      } else if (groupSize >= 4) {
        this.playMediumBlast();
      } else {
        this.playSmallBlast();
      }
    });
  }

  playChain(cascadeIndex: number): void {
    this.safePlay(() => {
      const base = cascadeIndex >= 2 ? 720 : 620;
      const top = cascadeIndex >= 2 ? 1160 : 940;
      this.playSweep(base, top, 0.16, VOLUME.chain, 0, 'sine');
      this.playTone(top * 1.18, 0.07, VOLUME.chain * 0.72, 0.11, 'triangle');
    });
  }

  playInvalid(): void {
    this.safePlay(() => this.playSweep(230, 165, 0.13, VOLUME.invalid, 0, 'sine'));
  }

  playWarning(): void {
    this.safePlay(() => this.playChord([
      { frequency: 330, duration: 0.09, delay: 0, volume: VOLUME.warning },
      { frequency: 260, duration: 0.13, delay: 0.08, volume: VOLUME.warning * 0.78 }
    ]));
  }

  playCountdownTick(second: number): void {
    // Pitch rises slightly as countdown reaches 0 for urgency (600Hz at 10s → 1050Hz at 1s)
    this.safePlay(() => this.playTone(600 + (10 - second) * 50, 0.055, 0.038, 0, 'sine'));
  }

  playLevelComplete(): void {
    this.safePlay(() => this.playChord([
      { frequency: 660, duration: 0.12, delay: 0, volume: VOLUME.level },
      { frequency: 880, duration: 0.12, delay: 0.09, volume: VOLUME.level * 0.92 },
      { frequency: 1108, duration: 0.18, delay: 0.18, volume: VOLUME.level * 0.82 },
      { frequency: 1320, duration: 0.16, delay: 0.3, volume: VOLUME.level * 0.55 }
    ]));
  }

  playLevelFailed(): void {
    this.safePlay(() => this.playChord([
      { frequency: 260, duration: 0.15, delay: 0, volume: 0.065 },
      { frequency: 196, duration: 0.2, delay: 0.12, volume: 0.055 }
    ]));
  }

  playPurchaseSuccess(): void {
    this.safePlay(() => this.playChord([
      { frequency: 740, duration: 0.09, delay: 0, volume: 0.085 },
      { frequency: 988, duration: 0.12, delay: 0.08, volume: 0.078 },
      { frequency: 1480, duration: 0.08, delay: 0.17, volume: 0.045 }
    ]));
  }

  playMultiplierUpgrade(): void {
    this.safePlay(() => {
      this.playTone(880, 0.08, 0.062, 0, 'sine', 1320);
      this.playTone(1320, 0.1, 0.052, 0.08, 'sine', 1760);
      this.playTone(1980, 0.12, 0.038, 0.18, 'sine', 2480);
      this.playNoise(0.2, 0.026, 2200, 6500, 0.08, 'bandpass');
    });
  }

  playEnergyStar(): void {
    this.safePlay(() => {
      // Playful ascending arpeggio: dıt-dıı-rıt-dırıttt
      this.playTone(740, 0.065, VOLUME.reward, 0, 'sine', 880);
      this.playTone(1108, 0.085, VOLUME.reward * 0.88, 0.085, 'sine');
      this.playTone(1318, 0.075, VOLUME.reward * 0.78, 0.185, 'sine');
      this.playTone(1760, 0.14, VOLUME.reward * 0.64, 0.27, 'sine', 1980);
      this.playNoise(0.28, 0.022, 2000, 6000, 0.38, 'bandpass');
      this.playTone(2640, 0.09, 0.016, 0.46, 'sine', 1980);
    });
  }

  playColorBomb(): void {
    this.safePlay(() => {
      // Bigger, more premium: bass thump + ascending arpeggio + golden shimmer
      this.playTone(260, 0.14, 0.032, 0, 'sine', 200);
      this.playTone(620, 0.08, VOLUME.premium * 0.52, 0, 'sine', 740);
      this.playTone(880, 0.09, VOLUME.premium * 0.62, 0.08, 'sine');
      this.playTone(1108, 0.10, VOLUME.premium * 0.58, 0.18, 'sine');
      this.playTone(1480, 0.11, VOLUME.premium * 0.52, 0.29, 'sine');
      this.playTone(1980, 0.15, VOLUME.premium * 0.44, 0.41, 'sine', 2200);
      this.playNoise(0.38, 0.034, 1600, 5200, 0.06, 'bandpass');
      this.playTone(2640, 0.13, 0.024, 0.56, 'sine', 2200);
    });
  }

  playGameplayCallout(cascadeWaves: number, largestPop: number, newlyReachedMultiplierIndex = 0): void {
    const callout = this.getGameplayCallout(cascadeWaves, largestPop, newlyReachedMultiplierIndex);
    if (callout) {
      this.playVoice(callout);
    }
  }

  private playSmallBlast(): void {
    this.playSweep(390, 720, 0.075, VOLUME.smallBlast, 0, 'sine');
    this.playTone(1080, 0.055, 0.035, 0.045, 'sine');
  }

  private playMediumBlast(): void {
    this.playSweep(430, 850, 0.09, VOLUME.mediumBlast, 0, 'triangle');
    this.playTone(1240, 0.065, 0.045, 0.055, 'sine');
  }

  private playBigBlast(): void {
    this.playSweep(360, 900, 0.12, VOLUME.bigBlast, 0, 'triangle');
    this.playTone(1180, 0.07, 0.052, 0.055, 'sine');
    this.playTone(1560, 0.08, 0.038, 0.12, 'sine');
  }

  private playHugeBlast(): void {
    this.playSweep(300, 820, 0.15, VOLUME.hugeBlast, 0, 'triangle');
    this.playNoise(0.12, 0.055, 700, 2400, 0.02, 'bandpass');
    this.playTone(1040, 0.08, 0.064, 0.06, 'sine');
    this.playTone(1420, 0.09, 0.055, 0.14, 'sine');
    this.playTone(1880, 0.11, 0.038, 0.22, 'sine');
  }

  private playHighMultiplier(multiplierIndex: number): void {
    const premium = multiplierIndex >= 9;
    const base = premium ? 980 : multiplierIndex >= 8 ? 880 : 780;
    this.playTone(base, 0.07, premium ? VOLUME.premium * 0.62 : VOLUME.reward * 0.5, 0.03, 'sine');
    this.playTone(base * 1.5, 0.08, premium ? VOLUME.premium * 0.5 : VOLUME.reward * 0.42, 0.1, 'sine');
    this.playTone(base * 2, 0.08, premium ? VOLUME.premium * 0.36 : VOLUME.reward * 0.32, 0.17, 'sine');
  }

  private playX1000(): void {
    this.playChord([
      { frequency: 740, duration: 0.1, delay: 0, volume: VOLUME.premium * 0.72 },
      { frequency: 1110, duration: 0.13, delay: 0.09, volume: VOLUME.premium * 0.62 },
      { frequency: 1480, duration: 0.16, delay: 0.18, volume: VOLUME.premium * 0.5 },
      { frequency: 2220, duration: 0.14, delay: 0.28, volume: VOLUME.premium * 0.34 }
    ]);
    this.playNoise(0.22, 0.04, 1700, 5200, 0.06, 'bandpass');
  }

  private getGameplayCallout(cascadeWaves: number, largestPop: number, newlyReachedMultiplierIndex: number): VoiceCallout | undefined {
    const multiplierCallout = HIGH_MULTIPLIER_CALLOUTS[newlyReachedMultiplierIndex];
    if (multiplierCallout) return multiplierCallout;
    if (largestPop >= 10) return 'incredible';
    if (cascadeWaves >= 5) return 'fantastic';
    if (cascadeWaves === 4) return 'awesome';
    if (cascadeWaves === 3) return 'great';
    if (cascadeWaves === 2) return 'nice';
    return undefined;
  }

  private prepareVoices(): void {
    for (const [key, fileName] of Object.entries(VOICE_FILES) as [VoiceCallout, string][]) {
      const src = VOICE_MODULES[`../assets/audio/voice/en/${fileName}`];
      if (!src) continue;
      try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = VOLUME.voice;
        this.voices.set(key, audio);
      } catch {
        // Missing or blocked local audio should never block gameplay.
      }
    }
  }

  private playVoice(callout: VoiceCallout): void {
    if (this.muted || !this.unlocked) return;

    const now = window.performance.now();
    const currentKey = this.getCurrentVoiceKey();
    const currentPriority = currentKey ? VOICE_PRIORITY[currentKey] : 0;
    const nextPriority = VOICE_PRIORITY[callout];
    if (now - this.lastVoiceAt < VOICE_COOLDOWN_MS && nextPriority <= currentPriority) return;

    const voice = this.voices.get(callout);
    if (!voice) return;

    try {
      this.currentVoice?.pause();
      voice.currentTime = 0;
      voice.volume = VOLUME.voice;
      this.currentVoice = voice;
      this.lastVoiceAt = now;
      void voice.play().catch(() => undefined);
    } catch {
      // Voice callouts are optional local polish; never throw into gameplay.
    }
  }

  private getCurrentVoiceKey(): VoiceCallout | undefined {
    for (const [key, voice] of this.voices) {
      if (voice === this.currentVoice && !voice.paused && !voice.ended) return key;
    }
    return undefined;
  }

  private playChord(notes: { frequency: number; duration: number; delay: number; volume: number }[]): void {
    for (const note of notes) {
      this.playTone(note.frequency, note.duration, note.volume, note.delay, 'sine');
    }
  }

  private playSweep(
    fromFrequency: number,
    toFrequency: number,
    duration: number,
    volume: number,
    delay = 0,
    type: OscillatorType = 'sine'
  ): void {
    const audio = this.getContext();
    if (!audio || !this.master) return;

    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, toFrequency), start + duration);
    this.shapeGain(gain, start, duration, volume);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private playTone(
    frequency: number,
    duration: number,
    volume: number,
    delay = 0,
    type: OscillatorType = 'sine',
    endFrequency = frequency
  ): void {
    const audio = this.getContext();
    if (!audio || !this.master) return;

    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + duration);
    }
    this.shapeGain(gain, start, duration, volume);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private playNoise(
    duration: number,
    volume: number,
    lowFrequency: number,
    highFrequency: number,
    delay = 0,
    filterType: BiquadFilterType = 'lowpass'
  ): void {
    const audio = this.getContext();
    if (!audio || !this.master) return;

    const start = audio.currentTime + delay;
    const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = 1 - index / sampleCount;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(lowFrequency, start);
    filter.frequency.exponentialRampToValueAtTime(highFrequency, start + duration);
    filter.Q.setValueAtTime(0.7, start);
    this.shapeGain(gain, start, duration, volume);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  private shapeGain(gain: GainNode, start: number, duration: number, volume: number): void {
    const safeVolume = Math.min(volume, 0.2);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(safeVolume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  }

  private getContext(): AudioContext | undefined {
    if (this.muted || !this.unlocked) return undefined;

    try {
      const AudioContextClass = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
      if (!AudioContextClass) return undefined;

      this.context ??= new AudioContextClass();
      this.master ??= this.createMasterGain(this.context);
      if (this.context.state === 'suspended') {
        void this.context.resume().catch(() => undefined);
      }
      return this.context;
    } catch {
      return undefined;
    }
  }

  private createMasterGain(audio: AudioContext): GainNode {
    const master = audio.createGain();
    master.gain.setValueAtTime(VOLUME.master, audio.currentTime);
    master.connect(audio.destination);
    return master;
  }

  private safePlay(play: () => void): void {
    try {
      play();
    } catch {
      // SFX must never be able to break gameplay rendering.
    }
  }
}
