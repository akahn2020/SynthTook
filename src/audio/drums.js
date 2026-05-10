// Synthesized drums in pure Web Audio — no samples needed.
// Three voices: kick (sine sweep), snare (filtered noise + tone), hihat (HP noise).
// Each voice routes through its own track-bus GainNode (kickGain / snareGain /
// hatGain), exposed publicly so the mixer can adjust per-track levels and mute.
//
// Per-hit timbre is read from `drumParams` (a live reference) on each trigger,
// so slider changes apply to the next hit immediately without rebuilding the kit.

let _noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (_noiseBuffer && _noiseBuffer.sampleRate === ctx.sampleRate) return _noiseBuffer;
  const seconds = 1;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  _noiseBuffer = buffer;
  return buffer;
}

export const DRUM_TRACKS = ['KICK', 'SNARE', 'HAT'];

export const DEFAULT_DRUM_PARAMS = {
  kick:  { startFreq: 160, endFreq: 40, pitchDecay: 0.12, ampDecay: 0.2 },
  snare: { hpFreq: 1200, bodyFreq: 200, noiseDecay: 0.18, bodyDecay: 0.1 },
  hat:   { hpFreq: 8000, decay: 0.05 },
};

export class DrumKit {
  constructor(ctx, destination, drumParams) {
    this.ctx = ctx;
    this.drumParams = drumParams || DEFAULT_DRUM_PARAMS;

    this.kickGain  = ctx.createGain();
    this.snareGain = ctx.createGain();
    this.hatGain   = ctx.createGain();
    this.kickGain.connect(destination);
    this.snareGain.connect(destination);
    this.hatGain.connect(destination);

    getNoiseBuffer(ctx);
  }

  trigger(track, when) {
    const t = when ?? this.ctx.currentTime;
    if (track === 0) this._kick(t);
    else if (track === 1) this._snare(t);
    else if (track === 2) this._hihat(t);
  }

  _kick(t) {
    const p = this.drumParams.kick;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const gain = this.ctx.createGain();
    osc.connect(gain).connect(this.kickGain);

    osc.frequency.setValueAtTime(p.startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, p.endFreq), t + p.pitchDecay);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.9, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.ampDecay);

    osc.start(t);
    osc.stop(t + p.ampDecay + 0.02);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
  }

  _snare(t) {
    const p = this.drumParams.snare;

    const noise = this.ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(this.ctx);
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = p.hpFreq;
    const noiseGain = this.ctx.createGain();
    noise.connect(noiseFilter).connect(noiseGain).connect(this.snareGain);
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.5, t + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + p.noiseDecay);
    noise.start(t);
    noise.stop(t + p.noiseDecay + 0.02);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = p.bodyFreq;
    const oscGain = this.ctx.createGain();
    osc.connect(oscGain).connect(this.snareGain);
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.35, t + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + p.bodyDecay);
    osc.start(t);
    osc.stop(t + p.bodyDecay + 0.02);

    const cleanup = () => {
      try { noise.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); } catch {}
      try { osc.disconnect(); oscGain.disconnect(); } catch {}
    };
    noise.onended = cleanup;
  }

  _hihat(t) {
    const p = this.drumParams.hat;

    const noise = this.ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = p.hpFreq;
    const gain = this.ctx.createGain();
    noise.connect(filter).connect(gain).connect(this.hatGain);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.decay);

    noise.start(t);
    noise.stop(t + p.decay + 0.02);
    noise.onended = () => {
      try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
    };
  }
}
