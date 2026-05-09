// Sits between input sources (MIDI, on-screen keyboard, computer keyboard)
// and the voice manager. When armed, also writes incoming notes into the
// pattern.
//
// Step-record (scheduler stopped): each note is written at stepCursor; a
// short chord window groups simultaneous notes onto the same step before the
// cursor advances.
//
// Live-record (scheduler running): each note is written at scheduler.audibleStep
// (the step actually sounding right now, not the lookahead-ahead currentStep).

const CHORD_WINDOW_MS = 80;

export class Recorder {
  constructor(voiceManager, pattern, scheduler) {
    this.voiceManager = voiceManager;
    this.pattern = pattern;
    this.scheduler = scheduler;
    this.armed = false;
    this.stepCursor = 0;
    this._chordTimer = null;
    this.onCursorMove = null;     // (step) => void; -1 = hide
    this.onNoteRecorded = null;   // (row, col) => void
  }

  setArmed(on) {
    this.armed = !!on;
    this._cancelChordWindow();
    this._notifyCursor();
  }

  refreshCursor() {
    this._notifyCursor();
  }

  advance() {
    this._cancelChordWindow();
    this.stepCursor = (this.stepCursor + 1) % this.pattern.numSteps;
    this._notifyCursor();
  }

  resetCursor() {
    this._cancelChordWindow();
    this.stepCursor = 0;
    this._notifyCursor();
  }

  noteOn(midi, velocity) {
    this.voiceManager.noteOn(midi, velocity);
    if (!this.armed) return;
    if (this.scheduler.isRunning()) {
      const step = this.scheduler.audibleStep;
      if (step >= 0) this._writeNote(step, midi);
    } else {
      this._writeNote(this.stepCursor, midi);
      this._scheduleChordAdvance();
    }
  }

  noteOff(midi) {
    this.voiceManager.noteOff(midi);
  }

  allOff() {
    this.voiceManager.allOff();
  }

  _writeNote(step, midi) {
    const row = this.pattern.pitches.indexOf(midi);
    if (row < 0) return; // out of pattern range
    this.pattern.setCell(row, step, true);
    if (this.onNoteRecorded) this.onNoteRecorded(row, step);
  }

  _scheduleChordAdvance() {
    if (this._chordTimer !== null) clearTimeout(this._chordTimer);
    this._chordTimer = setTimeout(() => {
      this._chordTimer = null;
      this.stepCursor = (this.stepCursor + 1) % this.pattern.numSteps;
      this._notifyCursor();
    }, CHORD_WINDOW_MS);
  }

  _cancelChordWindow() {
    if (this._chordTimer !== null) {
      clearTimeout(this._chordTimer);
      this._chordTimer = null;
    }
  }

  _notifyCursor() {
    if (!this.onCursorMove) return;
    if (!this.armed || this.scheduler.isRunning()) this.onCursorMove(-1);
    else this.onCursorMove(this.stepCursor);
  }
}
