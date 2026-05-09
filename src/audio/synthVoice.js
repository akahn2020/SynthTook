// One voice slot. Owns a low-pass filter and per-voice plumbing for the
// filter envelope (ConstantSource → envGain → envScale → filter.frequency,
// added on top of the live "base" cutoff). A fresh oscillator + amp gain are
// created per note so a stolen-note tail can ring out without colliding with
// the new note's envelope.
//
// Amplitude envelope: full ADSR. Filter envelope: AD (attack to peak, decay
// back to 0), with the "amount" knob scaling how much it modulates cutoff.

const STEAL_FADE_S = 0.005;

function midiToHz(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function cancelHold(param, when) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(when);
  else param.cancelScheduledValues(when);
}

export class SynthVoice {
  constructor(ctx, destination, params) {
    this.ctx = ctx;
    this.params = params;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = params.filter.cutoff;
    this.filter.Q.value = params.filter.resonance;
    this.filter.connect(destination);

    // Filter envelope: const(1) → envGain[0..1] → envScale[Hz] → filter.frequency
    this.envSource = ctx.createConstantSource();
    this.envSource.offset.value = 1;
    this.envGain = ctx.createGain();
    this.envGain.gain.value = 0;
    this.envScale = ctx.createGain();
    this.envScale.gain.value = params.filterEnv.amount;
    this.envSource.connect(this.envGain);
    this.envGain.connect(this.envScale);
    this.envScale.connect(this.filter.frequency);
    this.envSource.start();

    this.activeNote = null;
    this.allocOrder = 0;
  }

  get midiNote() {
    return this.activeNote ? this.activeNote.midiNote : null;
  }

  isFree() {
    return this.activeNote === null;
  }

  setFilterBase(cutoff, resonance) {
    this.filter.frequency.value = cutoff;
    this.filter.Q.value = resonance;
  }

  setFilterEnvAmount(amount) {
    this.envScale.gain.value = amount;
  }

  setWave(type) {
    if (this.activeNote) {
      try { this.activeNote.osc.type = type; } catch {}
    }
  }

  noteOn(midiNote, velocity, when) {
    const t = when ?? this.ctx.currentTime;
    this._cutActive(t);

    const { amp, filterEnv } = this.params;

    const osc = this.ctx.createOscillator();
    osc.type = this.params.wave;
    osc.frequency.setValueAtTime(midiToHz(midiNote), t);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    osc.connect(gain).connect(this.filter);
    osc.start(t);

    const peak = Math.max(0.05, (velocity / 127) * 0.5);
    const sustainLevel = Math.max(0, peak * amp.sustain);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + amp.attack);
    gain.gain.linearRampToValueAtTime(sustainLevel, t + amp.attack + amp.decay);

    cancelHold(this.envGain.gain, t);
    this.envGain.gain.setValueAtTime(0, t);
    this.envGain.gain.linearRampToValueAtTime(1, t + filterEnv.attack);
    this.envGain.gain.setTargetAtTime(0, t + filterEnv.attack, Math.max(0.005, filterEnv.decay / 3));

    this.activeNote = { osc, gain, midiNote };
  }

  noteOff(when) {
    const t = when ?? this.ctx.currentTime;
    if (!this.activeNote) return;
    const { osc, gain } = this.activeNote;
    const release = this.params.amp.release;
    cancelHold(gain.gain, t);
    gain.gain.linearRampToValueAtTime(0, t + release);
    const stopAt = t + release + 0.01;
    try { osc.stop(stopAt); } catch {}
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch {}
    };
    this.activeNote = null;
  }

  _cutActive(t) {
    if (!this.activeNote) return;
    const { osc, gain } = this.activeNote;
    cancelHold(gain.gain, t);
    gain.gain.linearRampToValueAtTime(0, t + STEAL_FADE_S);
    try { osc.stop(t + STEAL_FADE_S + 0.005); } catch {}
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch {}
    };
    this.activeNote = null;
  }
}
