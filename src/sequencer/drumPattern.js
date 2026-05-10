import { DRUM_TRACKS } from '../audio/drums.js';

export class DrumPattern {
  constructor(numSteps = 16) {
    this.numSteps = numSteps;
    this.numTracks = DRUM_TRACKS.length;
    this.cells = Array.from({ length: this.numTracks }, () => new Array(numSteps).fill(false));
    this.labels = DRUM_TRACKS.slice();
  }

  toggle(track, step) {
    if (!this.cells[track]) return false;
    this.cells[track][step] = !this.cells[track][step];
    return this.cells[track][step];
  }

  setCell(track, step, on) {
    if (!this.cells[track]) return;
    this.cells[track][step] = !!on;
  }

  isOn(track, step) {
    return !!this.cells[track]?.[step];
  }

  tracksAtStep(step) {
    const out = [];
    for (let t = 0; t < this.numTracks; t++) {
      if (this.cells[t][step]) out.push(t);
    }
    return out;
  }

  clear() {
    this.cells.forEach(row => row.fill(false));
  }

  setLength(numSteps) {
    if (numSteps === this.numSteps) return;
    if (numSteps > this.numSteps) {
      const pad = numSteps - this.numSteps;
      for (const row of this.cells) for (let i = 0; i < pad; i++) row.push(false);
    } else {
      for (const row of this.cells) row.length = numSteps;
    }
    this.numSteps = numSteps;
  }
}
