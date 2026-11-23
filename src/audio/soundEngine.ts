import { MusicThemeId } from '../game/types';

interface ThemeProfile {
  tempoMs: number;
  wave: OscillatorType;
  bassWave: OscillatorType;
  rootHz: number;
  intervals: number[]; // semitones
  bassIntervals: number[];
  padGain: number;
  leadGain: number;
  filterHz: number;
}

const THEME_PROFILES: Record<MusicThemeId, ThemeProfile> = {
  title: {
    tempoMs: 680,
    wave: 'triangle',
    bassWave: 'sine',
    rootHz: 146.83, // D3
    intervals: [0, 3, 7, 10, 12, 10, 7, 5],
    bassIntervals: [0, 0, -5, -5, -2, -2, 0, -5],
    padGain: 0.09,
    leadGain: 0.08,
    filterHz: 1100,
  },
  peaceful: {
    tempoMs: 740,
    wave: 'sine',
    bassWave: 'sine',
    rootHz: 196.0, // G3
    intervals: [0, 4, 7, 11, 12, 9, 7, 4],
    bassIntervals: [0, 0, 5, 5, 7, 7, 0, 0],
    padGain: 0.075,
    leadGain: 0.065,
    filterHz: 950,
  },
  exploration: {
    tempoMs: 560,
    wave: 'triangle',
    bassWave: 'sine',
    rootHz: 164.81, // E3
    intervals: [0, 2, 7, 9, 12, 14, 12, 7],
    bassIntervals: [0, 0, 7, 7, 5, 5, 0, 7],
    padGain: 0.08,
    leadGain: 0.075,
    filterHz: 1350,
  },
  wreck: {
    tempoMs: 820,
    wave: 'sine',
    bassWave: 'triangle',
    rootHz: 130.81, // C3
    intervals: [0, 3, 6, 7, 10, 7, 6, 3],
    bassIntervals: [0, 0, -6, -6, -2, -2, 0, -5],
    padGain: 0.08,
    leadGain: 0.06,
    filterHz: 780,
  },
  storm: {
    tempoMs: 410,
    wave: 'sawtooth',
    bassWave: 'triangle',
    rootHz: 110.0, // A2
    intervals: [0, 1, 5, 7, 8, 7, 3, 0],
    bassIntervals: [0, 0, -4, -4, 1, 1, -2, 0],
    padGain: 0.09,
    leadGain: 0.075,
    filterHz: 880,
  },
  pirate_encounter: {
    tempoMs: 460,
    wave: 'sawtooth',
    bassWave: 'triangle',
    rootHz: 146.83, // D3
    intervals: [0, 3, 7, 8, 7, 3, 5, 2],
    bassIntervals: [0, 0, 3, 3, 5, 5, 2, 0],
    padGain: 0.085,
    leadGain: 0.08,
    filterHz: 1200,
  },
  combat: {
    tempoMs: 320,
    wave: 'sawtooth',
    bassWave: 'sawtooth',
    rootHz: 130.81, // C3
    intervals: [0, 3, 7, 12, 10, 7, 8, 5],
    bassIntervals: [0, 0, 0, 3, 5, 5, 7, 3],
    padGain: 0.09,
    leadGain: 0.095,
    filterHz: 1550,
  },
  victory: {
    tempoMs: 420,
    wave: 'triangle',
    bassWave: 'triangle',
    rootHz: 196.0, // G3
    intervals: [0, 4, 7, 12, 16, 12, 14, 19],
    bassIntervals: [0, 7, 4, 7, 12, 7, 5, 0],
    padGain: 0.1,
    leadGain: 0.1,
    filterHz: 1850,
  },
  defeat: {
    tempoMs: 920,
    wave: 'sine',
    bassWave: 'triangle',
    rootHz: 110.0, // A2
    intervals: [0, 3, 2, 0, -2, -4, -5, -7],
    bassIntervals: [0, 0, -4, -4, -5, -5, -9, -12],
    padGain: 0.08,
    leadGain: 0.065,
    filterHz: 620,
  },
  trading: {
    tempoMs: 520,
    wave: 'triangle',
    bassWave: 'sine',
    rootHz: 220.0, // A3
    intervals: [0, 4, 7, 9, 12, 9, 7, 4],
    bassIntervals: [0, 7, 5, 7, 0, 4, 5, 7],
    padGain: 0.07,
    leadGain: 0.075,
    filterHz: 1450,
  },
  night: {
    tempoMs: 880,
    wave: 'sine',
    bassWave: 'sine',
    rootHz: 164.81, // E3
    intervals: [0, 7, 11, 14, 12, 7, 3, 0],
    bassIntervals: [0, 0, -5, -5, -2, -2, 0, 0],
    padGain: 0.075,
    leadGain: 0.055,
    filterHz: 750,
  },
  piracy: {
    tempoMs: 440,
    wave: 'sawtooth',
    bassWave: 'triangle',
    rootHz: 123.47, // B2
    intervals: [0, 2, 3, 7, 10, 7, 6, 3],
    bassIntervals: [0, 0, 5, 5, 7, 6, 3, 0],
    padGain: 0.085,
    leadGain: 0.08,
    filterHz: 1320,
  },
  monster: {
    tempoMs: 500,
    wave: 'sawtooth',
    bassWave: 'sawtooth',
    rootHz: 98.0, // G2
    intervals: [0, 1, 6, 7, 11, 6, 1, 0],
    bassIntervals: [0, -1, 0, -6, 0, 1, -1, -12],
    padGain: 0.095,
    leadGain: 0.085,
    filterHz: 980,
  },
  boss: {
    tempoMs: 290,
    wave: 'sawtooth',
    bassWave: 'sawtooth',
    rootHz: 110.0, // A2
    intervals: [0, 3, 6, 7, 12, 13, 12, 7],
    bassIntervals: [0, 0, 3, 5, 6, 5, 3, 0],
    padGain: 0.1,
    leadGain: 0.105,
    filterHz: 1750,
  },
  fleet_battle: {
    tempoMs: 340,
    wave: 'triangle',
    bassWave: 'sawtooth',
    rootHz: 146.83, // D3
    intervals: [0, 5, 7, 12, 15, 14, 12, 7],
    bassIntervals: [0, 0, 7, 7, 5, 5, 10, 7],
    padGain: 0.095,
    leadGain: 0.095,
    filterHz: 1650,
  },
};

function semiToHz(root: number, semi: number): number {
  return root * Math.pow(2, semi / 12);
}

/**
 * Procedural Web Audio API sound & dynamic 15-theme music engine for Oceanbound.
 */
export class NauticalSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicBusGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private oceanFilter: BiquadFilterNode | null = null;
  private oceanGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private masterVolume = 0.72;
  private musicVolume = 0.65;
  private sfxVolume = 0.8;
  private musicEnabled = true;
  private muted = false;
  private initialized = false;

  private creakTimer = 6;
  private currentTheme: MusicThemeId = 'peaceful';
  private noteStep = 0;
  private nextNoteTimer = 0;
  private padTimer = 0;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.masterVolume;
      master.connect(ctx.destination);
      this.masterGain = master;

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = this.sfxVolume;
      sfxGain.connect(master);
      this.sfxGain = sfxGain;

      const musicBus = ctx.createGain();
      musicBus.gain.value = this.musicEnabled ? this.musicVolume : 0;
      const musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 1200;
      musicFilter.connect(musicBus);
      musicBus.connect(master);
      this.musicBusGain = musicBus;
      this.musicFilter = musicFilter;

      // 3-second looping pink-ish noise buffer
      const length = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 0.55;
      }
      this.noiseBuffer = buf;

      // Ocean surf bed (routed through sfxGain)
      const oceanSrc = ctx.createBufferSource();
      oceanSrc.buffer = buf;
      oceanSrc.loop = true;
      const oceanFilter = ctx.createBiquadFilter();
      oceanFilter.type = 'lowpass';
      oceanFilter.frequency.value = 260;
      const oceanGain = ctx.createGain();
      oceanGain.gain.value = 0.15;
      oceanSrc.connect(oceanFilter);
      oceanFilter.connect(oceanGain);
      oceanGain.connect(sfxGain);
      oceanSrc.start();
      this.oceanFilter = oceanFilter;
      this.oceanGain = oceanGain;

      // Sail wind bed
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 2.6;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.04;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(sfxGain);
      windSrc.start();
      this.windFilter = windFilter;
      this.windGain = windGain;

      // Rain patter bed
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = buf;
      rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 1800;
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(sfxGain);
      rainSrc.start();
      this.rainGain = rainGain;

      this.initialized = true;
    } catch {
      // Ignore audio init errors in restricted environments
    }
  }

  public setAudioSettings(opts: {
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
    musicEnabled?: boolean;
  }): void {
    if (typeof opts.masterVolume === 'number') {
      this.masterVolume = Math.max(0, Math.min(1, opts.masterVolume));
    }
    if (typeof opts.musicVolume === 'number') {
      this.musicVolume = Math.max(0, Math.min(1, opts.musicVolume));
    }
    if (typeof opts.sfxVolume === 'number') {
      this.sfxVolume = Math.max(0, Math.min(1, opts.sfxVolume));
    }
    if (typeof opts.musicEnabled === 'boolean') {
      this.musicEnabled = opts.musicEnabled;
    }
    this.syncGains();
  }

  public setVolume(v: number): void {
    this.setAudioSettings({ masterVolume: v });
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    this.syncGains();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getCurrentTheme(): MusicThemeId {
    return this.currentTheme;
  }

  public setMusicTheme(theme: MusicThemeId): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.noteStep = 0;
    if (this.ctx && this.musicBusGain && this.musicFilter) {
      const t = this.ctx.currentTime;
      const profile = THEME_PROFILES[theme];
      // Gentle crossfade dip + filter glide
      const targetGain = this.musicEnabled ? this.musicVolume : 0;
      this.musicBusGain.gain.setTargetAtTime(targetGain * 0.25, t, 0.22);
      this.musicBusGain.gain.setTargetAtTime(targetGain, t + 0.35, 0.45);
      this.musicFilter.frequency.setTargetAtTime(profile.filterHz, t, 0.6);
      this.padTimer = 0;
      this.nextNoteTimer = 0.08;
    }
  }

  private syncGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, t, 0.08);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, t, 0.08);
    }
    if (this.musicBusGain) {
      this.musicBusGain.gain.setTargetAtTime(
        this.musicEnabled && !this.muted ? this.musicVolume : 0,
        t,
        0.12
      );
    }
  }

  public updateAmbience(
    dt: number,
    time: number,
    waveIntensity: number,
    windSpeed: number,
    rainIntensity: number,
    boatSpeed: number,
    paused: boolean,
    hailIntensity = 0
  ): void {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;

    if (this.oceanGain && this.oceanFilter && this.windGain && this.windFilter && this.rainGain) {
      if (paused) {
        this.oceanGain.gain.setTargetAtTime(0.02, t, 0.15);
        this.windGain.gain.setTargetAtTime(0, t, 0.15);
        this.rainGain.gain.setTargetAtTime(0, t, 0.15);
      } else {
        const swell = 0.5 + 0.5 * Math.sin(time * 0.65);
        const surfGain = Math.min(0.4, 0.1 + waveIntensity * 0.075 + boatSpeed * 0.011 + swell * 0.055);
        this.oceanGain.gain.setTargetAtTime(surfGain, t, 0.25);
        this.oceanFilter.frequency.setTargetAtTime(210 + waveIntensity * 140 + swell * 125, t, 0.25);

        const wGain = Math.min(0.28, (windSpeed / 45) * 0.22);
        this.windGain.gain.setTargetAtTime(wGain, t, 0.3);
        this.windFilter.frequency.setTargetAtTime(320 + windSpeed * 11, t, 0.3);

        const precipGain = Math.min(0.18, rainIntensity * 0.13 + hailIntensity * 0.09);
        this.rainGain.gain.setTargetAtTime(precipGain, t, 0.35);

        this.creakTimer -= dt;
        if (this.creakTimer <= 0) {
          this.creakTimer = 5.5 + (Math.random() * 9) / Math.max(0.6, waveIntensity);
          this.playWoodCreak(0.035 + Math.min(0.075, waveIntensity * 0.028));
        }
      }
    }

    // Dynamic 15-theme procedural score sequencer
    if (!this.musicEnabled || this.muted || this.musicVolume <= 0.01) return;
    if (paused && this.currentTheme !== 'title') return;

    const profile = THEME_PROFILES[this.currentTheme];
    this.nextNoteTimer -= dt;
    this.padTimer -= dt;

    if (this.padTimer <= 0) {
      this.padTimer = Math.max(2.4, (profile.tempoMs / 1000) * 6);
      this.playThemePad(profile);
    }

    if (this.nextNoteTimer <= 0) {
      this.nextNoteTimer = profile.tempoMs / 1000;
      this.playThemeStep(profile);
      this.noteStep = (this.noteStep + 1) % profile.intervals.length;
    }
  }

  private playThemePad(profile: ThemeProfile): void {
    if (!this.ctx || !this.musicFilter) return;
    const t = this.ctx.currentTime;
    const dur = Math.max(2.6, (profile.tempoMs / 1000) * 6.5);
    const chordSemis = [0, 7, profile.intervals[1] ?? 4];

    for (const s of chordSemis) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(semiToHz(profile.rootHz, s), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(profile.padGain * 0.38, t + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.musicFilter);
      osc.start(t);
      osc.stop(t + dur + 0.08);
    }
  }

  private playThemeStep(profile: ThemeProfile): void {
    if (!this.ctx || !this.musicFilter) return;
    const t = this.ctx.currentTime;
    const step = this.noteStep;
    const semi = profile.intervals[step] ?? 0;
    const bassSemi = profile.bassIntervals[step] ?? 0;
    const dur = (profile.tempoMs / 1000) * 0.92;

    // Lead voice (skip occasional beat for airy phrasing in peaceful/night)
    const sparse = this.currentTheme === 'peaceful' || this.currentTheme === 'night' || this.currentTheme === 'wreck';
    if (!sparse || step % 2 === 0 || Math.random() < 0.55) {
      const lead = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lead.type = profile.wave;
      lead.frequency.setValueAtTime(semiToHz(profile.rootHz * 2, semi), t);
      lg.gain.setValueAtTime(0.0001, t);
      lg.gain.linearRampToValueAtTime(profile.leadGain, t + 0.03);
      lg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.15);
      lead.connect(lg);
      lg.connect(this.musicFilter);
      lead.start(t);
      lead.stop(t + dur * 1.2 + 0.05);
    }

    // Bass pulse on downbeats
    if (step % 2 === 0) {
      const bass = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      bass.type = profile.bassWave;
      bass.frequency.setValueAtTime(semiToHz(profile.rootHz * 0.5, bassSemi), t);
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(profile.leadGain * 0.85, t + 0.025);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.6);
      bass.connect(bg);
      bg.connect(this.musicFilter);
      bass.start(t);
      bass.stop(t + dur * 1.7 + 0.05);
    }
  }

  public playWoodCreak(gainLevel = 0.06): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const base = 75 + Math.random() * 38;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.68, t + 0.42);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 6;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainLevel, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  public playCannonFire(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115 + Math.random() * 18, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    og.gain.setValueAtTime(0.52, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
    osc.connect(og);
    og.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.55);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.55);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.42, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(f);
    f.connect(ng);
    ng.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.62);
  }

  public playImpactSplinter(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 950;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.3);
  }

  public playThunder(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(340, t);
    f.frequency.exponentialRampToValueAtTime(65, t + 2.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 2.6);
  }

  public playCoinChime(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    [1318.5, 1760].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);
      g.gain.setValueAtTime(0.11, t + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.25);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.28);
    });
  }

  public playPageTurn(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.16);
  }

  public playShipBell(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.95);
  }

  public playAlertBell(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    [987.77, 1318.5].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.14);
      g.gain.setValueAtTime(0.15, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.5);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + i * 0.14);
      osc.stop(t + i * 0.14 + 0.54);
    });
  }

  public playMonsterRoar(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 1.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.35);

    og.gain.setValueAtTime(0.001, t);
    og.gain.linearRampToValueAtTime(0.45, t + 0.18);
    og.gain.exponentialRampToValueAtTime(0.001, t + 1.45);

    osc.connect(filter);
    filter.connect(og);
    og.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 1.5);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 240;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.28, t + 0.22);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    src.connect(nf);
    nf.connect(ng);
    ng.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 1.45);
  }

  public playSplashHuge(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(720, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.9);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.38, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 1.0);
  }

  public playGhostWhisper(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;

    // Haunted low spectral horn + high eerie harmonic shimmer
    const low = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    low.type = 'sine';
    low.frequency.setValueAtTime(110, t);
    low.frequency.exponentialRampToValueAtTime(82, t + 2.2);
    lg.gain.setValueAtTime(0.0001, t);
    lg.gain.linearRampToValueAtTime(0.18, t + 0.45);
    lg.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    low.connect(lg);
    lg.connect(this.sfxGain);
    low.start(t);
    low.stop(t + 2.35);

    const shimmer = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(494, t + 0.1);
    shimmer.frequency.exponentialRampToValueAtTime(466, t + 1.9);
    sg.gain.setValueAtTime(0.0001, t + 0.1);
    sg.gain.linearRampToValueAtTime(0.055, t + 0.6);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    shimmer.connect(sg);
    sg.connect(this.sfxGain);
    shimmer.start(t + 0.1);
    shimmer.stop(t + 2.1);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(920, t);
    nf.Q.value = 5;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.09, t + 0.5);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    src.connect(nf);
    nf.connect(ng);
    ng.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 2.15);
  }

  public playLightningCrack(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1400, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.35);
    this.playThunder();
  }

  public playHailImpact(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2100 + Math.random() * 900, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.06);
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }
}
