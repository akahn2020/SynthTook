import { SynthVoice } from './synthVoice.js';

export class VoiceManager {
  constructor(ctx, destination, params, voiceCount = 8) {
    this.ctx = ctx;
    this.params = params;
    this.voices = Array.from({ length: voiceCount }, () => new SynthVoice(ctx, destination, params));
    this.allocCounter = 0;
  }

  noteOn(midiNote, velocity, when) {
    let voice = this.voices.find(v => v.midiNote === midiNote);
    if (!voice) voice = this.voices.find(v => v.isFree());
    if (!voice) {
      voice = this.voices.reduce((oldest, v) =>
        v.allocOrder < oldest.allocOrder ? v : oldest
      );
    }
    voice.allocOrder = ++this.allocCounter;
    voice.noteOn(midiNote, velocity, when);
  }

  noteOff(midiNote, when) {
    const voice = this.voices.find(v => v.midiNote === midiNote);
    if (voice) voice.noteOff(when);
  }

  allOff(when) {
    this.voices.forEach(v => v.noteOff(when));
  }

  setFilterBase(cutoff, resonance) {
    for (const v of this.voices) v.setFilterBase(cutoff, resonance);
  }

  setFilterEnvAmount(amount) {
    for (const v of this.voices) v.setFilterEnvAmount(amount);
  }

  setWave(type) {
    for (const v of this.voices) v.setWave(type);
  }
}
