type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const VOLUME = {
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

export class CandySfx {
  private context?: AudioContext;
  private master?: GainNode;
  private muted: boolean;
  private unlocked = false;

  constructor(soundEnabled: boolean) {
    this.muted = !soundEnabled;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
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
    master.gain.setValueAtTime(0.72, audio.currentTime);
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
