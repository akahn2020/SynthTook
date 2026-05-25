// Live-transpose intercept. Sits at the head of the input chain, in front of
// the arpeggiator:
//
//   MIDI / keyboard ──► Transposer ──► Arpeggiator ──► Recorder ──► VoiceManager
//                          │
//                          └── publishes offset ──► Scheduler (applies to lead notes only)
//
// When enabled, incoming Note On is swallowed (not played, not arped, not
// recorded) — instead the pressed pitch sets a semitone offset relative to a
// root note. Last-press-wins; the offset persists after release. Drums are
// untouched. When disabled the Transposer is a transparent pass-through.
//
// The root is computed on demand via the injected `getRoot()` callback so it
// can track whatever the user means by "the 1st" — typically the lowest active
// note across the lead patterns.

export class Transposer {
  constructor(downstream, getRoot) {
    this.downstream = downstream;
    this.getRoot = getRoot || (() => 60);
    this.scheduler = null;
    this.enabled = false;
    this.offset = 0;
    this.lastRoot = 60;
    this.lastPressed = null;
    this.onChange = null; // ({ enabled, offset, root, pressed }) => void
  }

  setScheduler(scheduler) {
    this.scheduler = scheduler;
  }

  setEnabled(on) {
    const next = !!on;
    if (this.enabled === next) return;
    this.enabled = next;
    // Release anything currently held so the toggle doesn't leave stuck notes
    // or have a sustained chord suddenly mute when we start swallowing input.
    this.downstream.allOff();
    if (!next) {
      this.offset = 0;
      this.lastPressed = null;
      this._pushOffset();
    } else {
      this.lastRoot = this.getRoot();
    }
    this._notify();
  }

  noteOn(midi, velocity) {
    if (this.enabled) {
      this.lastRoot = this.getRoot();
      this.offset = midi - this.lastRoot;
      this.lastPressed = midi;
      this._pushOffset();
      this._notify();
      return;
    }
    this.downstream.noteOn(midi, velocity);
  }

  noteOff(midi) {
    if (this.enabled) return; // offset persists after release
    this.downstream.noteOff(midi);
  }

  allOff() {
    this.downstream.allOff();
  }

  _pushOffset() {
    if (this.scheduler) this.scheduler.setTransposeOffset(this.offset);
  }

  _notify() {
    if (!this.onChange) return;
    this.onChange({
      enabled: this.enabled,
      offset: this.offset,
      root: this.lastRoot,
      pressed: this.lastPressed,
    });
  }
}
