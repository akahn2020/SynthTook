// Arpeggiator. Sits between input sources (MIDI / on-screen / computer-keyboard)
// and the recorder. When disabled it's a transparent pass-through. When
// enabled it captures held notes, ignores their direct sustain, and feeds the
// recorder a stream of triggered notes following the chosen mode + rate.
//
// Because output flows through the recorder, arpeggiated notes both play
// (via voiceManager) and record into the pattern when REC is armed.
//
// Rate is expressed as a note-value divisor: 4 = quarter, 8 = eighth,
// 16 = sixteenth, 32 = 32nd. Tick interval = (60 / bpm) * (4 / rate).

export class Arpeggiator {
  constructor(downstream, params) {
    this.downstream = downstream;
    this.params = params; // { enabled, mode, rate, gate }
    this.scheduler = null;
    this.heldNotes = new Map(); // midi -> velocity
    this.lastVelocity = 100;
    this.timerId = null;
    this.position = 0;
    this.lastFiredNote = null;
  }

  setScheduler(scheduler) {
    this.scheduler = scheduler;
  }

  setEnabled(on) {
    const next = !!on;
    if (this.params.enabled === next) return;
    this.params.enabled = next;
    if (next) {
      // Switch from sustained-passthrough to arping
      for (const midi of this.heldNotes.keys()) this.downstream.noteOff(midi);
      if (this.heldNotes.size > 0) {
        this.position = 0;
        this._fireOnce();
        this._startTimer();
      }
    } else {
      // Switch from arping to sustained-passthrough
      this._stopTimer();
      this._releaseLastFired();
      for (const [midi, vel] of this.heldNotes.entries()) {
        this.downstream.noteOn(midi, vel);
      }
    }
  }

  setMode(mode) {
    this.params.mode = mode;
    this.position = 0;
  }

  setRate(rate) {
    this.params.rate = rate;
  }

  setGate(gate) {
    this.params.gate = gate;
  }

  noteOn(midi, velocity) {
    this.heldNotes.set(midi, velocity);
    this.lastVelocity = velocity;
    if (!this.params.enabled) {
      this.downstream.noteOn(midi, velocity);
      return;
    }
    if (this.timerId === null) {
      this.position = 0;
      this._fireOnce();
      this._startTimer();
    }
  }

  noteOff(midi) {
    const wasHeld = this.heldNotes.delete(midi);
    if (!this.params.enabled) {
      if (wasHeld) this.downstream.noteOff(midi);
      return;
    }
    if (this.heldNotes.size === 0) {
      this._stopTimer();
      this._releaseLastFired();
    }
  }

  allOff() {
    this.heldNotes.clear();
    this._stopTimer();
    this._releaseLastFired();
    this.downstream.allOff();
  }

  _intervalMs() {
    const bpm = this.scheduler?.bpm ?? 120;
    return ((60 / bpm) * (4 / this.params.rate)) * 1000;
  }

  _startTimer() {
    if (this.timerId !== null) return;
    const tick = () => {
      this._fireOnce();
      this.timerId = setTimeout(tick, this._intervalMs());
    };
    this.timerId = setTimeout(tick, this._intervalMs());
  }

  _stopTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  _fireOnce() {
    if (this.heldNotes.size === 0) return;
    this._releaseLastFired();
    const sorted = [...this.heldNotes.keys()].sort((a, b) => a - b);
    const midi = this._pickNote(sorted);
    this.downstream.noteOn(midi, this.lastVelocity);
    this.lastFiredNote = midi;
    const gateMs = Math.max(20, this._intervalMs() * this.params.gate);
    const note = midi;
    setTimeout(() => {
      if (this.lastFiredNote === note) {
        this.downstream.noteOff(note);
        this.lastFiredNote = null;
      }
    }, gateMs);
  }

  _pickNote(sorted) {
    const n = sorted.length;
    let idx;
    switch (this.params.mode) {
      case 'down':
        idx = (n - 1) - (this.position % n);
        this.position = (this.position + 1) % n;
        break;
      case 'updown': {
        // 0,1,...,n-1,n-2,...,1 then repeat
        const period = Math.max(1, 2 * n - 2);
        const p = this.position % period;
        idx = p < n ? p : period - p;
        this.position = (this.position + 1) % period;
        break;
      }
      case 'random':
        idx = Math.floor(Math.random() * n);
        break;
      case 'up':
      default:
        idx = this.position % n;
        this.position = (this.position + 1) % n;
        break;
    }
    return sorted[idx];
  }

  _releaseLastFired() {
    if (this.lastFiredNote !== null) {
      this.downstream.noteOff(this.lastFiredNote);
      this.lastFiredNote = null;
    }
  }
}
