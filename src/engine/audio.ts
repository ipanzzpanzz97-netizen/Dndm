import { FloorSurface } from './materials';

export class HouseAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientGain: GainNode | null = null;
  private ambientStarted = false;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.ambientStarted && this.ctx && this.noiseBuffer) {
      this.startAmbient();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.025, this.ctx.currentTime, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startAmbient(): void {
    if (!this.ctx || !this.noiseBuffer) return;
    this.ambientStarted = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;

    const gain = this.ctx.createGain();
    gain.gain.value = this.muted ? 0 : 0.025;

    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.ambientGain = gain;
  }

  public playFootstep(surface: FloorSurface): void {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // 1. Sub-thud body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';

    let baseFreq = 160;
    let clickFreq = 1800;
    let decay = 0.065;
    let clickGainVal = 0.11;

    if (surface === 'tile') {
      baseFreq = 210 + Math.random() * 25;
      clickFreq = 2600;
      decay = 0.048;
      clickGainVal = 0.14;
    } else if (surface === 'terracotta') {
      baseFreq = 165 + Math.random() * 18;
      clickFreq = 1950;
      decay = 0.062;
      clickGainVal = 0.11;
    } else if (surface === 'wood') {
      baseFreq = 108 + Math.random() * 14;
      clickFreq = 920;
      decay = 0.095;
      clickGainVal = 0.075;
    } else {
      baseFreq = 145 + Math.random() * 16;
      clickFreq = 1600;
      decay = 0.072;
      clickGainVal = 0.12;
    }

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + decay);

    oscGain.gain.setValueAtTime(0.14, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.01);

    // 2. Surface texture transient click
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = clickFreq + (Math.random() - 0.5) * 260;
    bp.Q.value = surface === 'tile' ? 2.4 : 1.4;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(clickGainVal, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    nSrc.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.ctx.destination);
    nSrc.start(now, Math.random() * 1.2, 0.05);
  }

  public playUiClick(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.045);
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
