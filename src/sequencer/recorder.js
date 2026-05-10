// Sits between input sources (MIDI, on-screen keyboard, computer keyboard)
// and the active lead track's voice manager. When armed, also writes incoming
// notes into that track's pattern.
//
// Step-record (scheduler stopped): each note is written at stepCursor; a
// short chord window groups simultaneous notes onto the same step before the
// cursor advances.
//
// Live-record (scheduler running): each note is written at scheduler.audibleStep
// (the step actually sounding right now, not the lookahead-ahead currentStep).
//
// "Active track" comes from the leadTracks registry so switching tabs while
// recording reroutes subsequent notes to the new track without restarting REC.

const CHORD_WINDOW_MS = 80;

export class Recorder {
  constructor(leadTracks, scheduler) {
    this.leadTracks = leadTracks;
    this.scheduler = scheduler;
    this.armed = false;
    this.stepCursor = 0;
    this._chordTimer = null;
    this.onCursorMove = null;     // (step) => void; -1 = hide
    this.onNoteRecorded = null;   // (trackIndex, row, col) => void
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
    this.stepCursor = (this.stepCursor + 1) % this._numSteps();
    this._notifyCursor();
  }

  resetCursor() {
    this._cancelChordWindow();
    this.stepCursor = 0;
    this._notifyCursor();
  }

  noteOn(midi, velocity) {
    const active = this.leadTracks.active();
    active.voiceManager.noteOn(midi, velocity);
    if (!this.armed) return;
    if (this.scheduler.isRunning()) {
      const globalStep = this.scheduler.audibleStep;
      if (globalStep >= 0) {
        const step = globalStep % active.pattern.numSteps;
        this._writeNote(step, midi);
      }
    } else {
      this._writeNote(this.stepCursor, midi);
      this._scheduleChordAdvance();
    }
  }

  noteOff(midi) {
    this.leadTracks.active().voiceManager.noteOff(midi);
  }

  allOff() {
    for (const t of this.leadTracks.tracks) t.voiceManager.allOff();
  }

  _writeNote(step, midi) {
    const idx = this.leadTracks.activeIndex;
    const pattern = this.leadTracks.active().pattern;
    const row = pattern.pitches.indexOf(midi);
    if (row < 0) return; // out of pattern range
    pattern.setCell(row, step, true);
    if (this.onNoteRecorded) this.onNoteRecorded(idx, row, step);
  }

  _numSteps() {
    return this.leadTracks.active().pattern.numSteps;
  }

  _scheduleChordAdvance() {
    if (this._chordTimer !== null) clearTimeout(this._chordTimer);
    this._chordTimer = setTimeout(() => {
      this._chordTimer = null;
      this.stepCursor = (this.stepCursor + 1) % this._numSteps();
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
