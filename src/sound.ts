// Sound: soft synthesized effects (no files) and optional background music.
// Everything starts OFF on every launch; audio may only start after a tap (browser rule),
// so the AudioContext is created when a toggle is switched on.

export type SoundName = 'rotate' | 'drop' | 'land' | 'spawn' | 'over' | 'best';

/** Effects are kept modest; the music sits well below them. */
const SFX_VOLUME = 0.22;
const BGM_VOLUME = 0.1;

export class Sound {
  sfxOn = false;
  bgmOn = false;
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private bgmPlayer: AudioBufferSourceNode | null = null;
  /** True between game over and the next game: the music waits for the next start. */
  private musicStopped = false;
  /** Loads the music (a data URL) when it is first needed; null when there is none. */
  loadBgm: () => Promise<string | null> = async () => null;

  private audio(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = SFX_VOLUME;
      this.sfxGain.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = BGM_VOLUME;
      this.bgmGain.connect(this.ctx.destination);
    }
    // Must happen inside the tap that switched sound on (browser autoplay rules).
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Pauses everything (music and effects) while the page is hidden; resumes when shown again. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.sfxOn || this.bgmOn) void this.ctx.resume();
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (on) this.audio();
  }

  /**
   * Switches the music. The audio context starts inside the tap; the music is downloaded and
   * decoded the first time, then played as a looping buffer (works the same on iOS and Android).
   * Resolves false when there is no music to play.
   */
  async setBgm(on: boolean): Promise<boolean> {
    this.bgmOn = on;
    if (!on) {
      this.bgmPlayer?.stop();
      this.bgmPlayer = null;
      return true;
    }
    const ctx = this.audio();
    if (!this.bgmBuffer) {
      const src = await this.loadBgm().catch(() => null);
      if (!src) return false;
      const bytes = Uint8Array.from(atob(src.slice(src.indexOf(',') + 1)), (c) => c.charCodeAt(0));
      this.bgmBuffer = await ctx.decodeAudioData(bytes.buffer);
    }
    if (!this.bgmOn || this.bgmPlayer || this.musicStopped) return true;
    this.startPlayer();
    return true;
  }

  /** Stops the music (game over) but keeps the switch on. */
  stopMusic(): void {
    this.musicStopped = true;
    this.bgmPlayer?.stop();
    this.bgmPlayer = null;
  }

  /** Plays the music again from the beginning (new game), if the switch is on. */
  restartMusic(): void {
    this.musicStopped = false;
    this.bgmPlayer?.stop();
    this.bgmPlayer = null;
    if (this.bgmOn && this.bgmBuffer && this.ctx) this.startPlayer();
  }

  private startPlayer(): void {
    const player = this.ctx!.createBufferSource();
    player.buffer = this.bgmBuffer;
    player.loop = true;
    player.connect(this.bgmGain!);
    player.start();
    this.bgmPlayer = player;
  }

  play(name: SoundName): void {
    if (!this.sfxOn || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'rotate':
        this.tone(t, 900, 1100, 0.05, 'square', 0.25);
        break;
      case 'drop':
        this.tone(t, 520, 300, 0.14, 'triangle', 0.5);
        break;
      case 'land':
        this.tone(t, 170, 80, 0.12, 'sine', 0.9);
        this.noise(t, 0.06, 600, 0.25);
        break;
      case 'spawn':
        this.poyo(t);
        break;
      case 'over':
        [440, 370, 294].forEach((f, i) => this.tone(t + i * 0.14, f, f * 0.97, 0.16, 'triangle', 0.55));
        break;
      case 'best':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.09, f, f, 0.12, 'triangle', 0.5));
        break;
    }
  }

  /**
   * A cute "poyo": a soft sine that bounces up and settles down, with a quick wobble like jelly.
   */
  private poyo(t: number): void {
    const ctx = this.ctx!;
    const dur = 0.2;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    // Po: a quick swoop up. Yo: a gentle slide down.
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(560, t + dur);
    // The wobble: a fast vibrato on the pitch.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 22;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(45, t + 0.06);
    lfo.connect(depth).connect(osc.frequency);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.sfxGain!);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.02);
    lfo.stop(t + dur + 0.02);
  }

  /** A short note sliding from f1 to f2 Hz with a quick fade-out. */
  private tone(t: number, f1: number, f2: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A soft puff of filtered noise. */
  private noise(t: number, dur: number, freq: number, vol: number): void {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.value = vol;
    src.connect(filter).connect(env).connect(this.sfxGain!);
    src.start(t);
  }
}
