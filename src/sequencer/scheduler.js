// Lookahead scheduler — see Chris Wilson, "A Tale of Two Clocks".
// JS timer wakes every SCHEDULE_INTERVAL ms and queues any pattern events that
// fall inside the next LOOKAHEAD-second window onto the audio thread, so timing
// fidelity comes from audioContext.currentTime, not setTimeout jitter.
//
// `globalStep` is a monotonic 16th-note counter. Each lead track and the drum
// pattern indexes into its own cells with `globalStep % pattern.numSteps`, so
// per-track lengths produce polymetric loops (e.g. LEAD A = 8 over LEAD B = 32
// loops cleanly without sync drift).

const SCHEDULE_INTERVAL_MS = 25;
const LOOKAHEAD_S = 0.1;

export class Scheduler {
  constructor(ctx, leadTracks, drumPattern, drumKit) {
    this.ctx = ctx;
    this.leadTracks = leadTracks;
    this.drumPattern = drumPattern || null;
    this.drumKit = drumKit || null;
    this.bpm = 120;
    this.stepsPerBeat = 4; // 16th notes
    this.globalStep = 0;
    this.nextStepTime = 0;
    this.audibleStep = -1; // global step actually sounding now (for live record)
    this.timerId = null;
    this.onStep = null;
    // Semitone offset applied to lead-track notes at schedule time. Set by the
    // Transposer when live-transpose mode is on; drums are unaffected. The
    // ~LOOKAHEAD_S lookahead means a change here takes effect at the next step
    // that hasn't been scheduled yet — typically <100ms latency.
    this.transposeOffset = 0;
  }

  setBpm(bpm) {
    this.bpm = bpm;
  }

  setTransposeOffset(semitones) {
    this.transposeOffset = semitones | 0;
  }

  start() {
    if (this.timerId !== null) return;
    this.globalStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this._tick();
  }

  stop() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.audibleStep = -1;
    for (const t of this.leadTracks.tracks) t.voiceManager.allOff();
  }

  isRunning() {
    return this.timerId !== null;
  }

  _stepDuration() {
    return 60 / this.bpm / this.stepsPerBeat;
  }

  _tick() {
    const horizon = this.ctx.currentTime + LOOKAHEAD_S;
    while (this.nextStepTime < horizon) {
      const dur = this._stepDuration();
      this._scheduleStep(this.globalStep, this.nextStepTime, dur);
      this.nextStepTime += dur;
      this.globalStep++;
    }
    this.timerId = setTimeout(() => this._tick(), SCHEDULE_INTERVAL_MS);
  }

  _scheduleStep(globalStep, when, duration) {
    // Capture once so both the noteOn and the matching noteOff use the same
    // offset even if the Transposer updates mid-step.
    const xpose = this.transposeOffset;
    for (const track of this.leadTracks.tracks) {
      const pattern = track.pattern;
      const idx = globalStep % pattern.numSteps;
      // Walk every row so we can pick up tie extents per pitch. Only 'on' cells
      // trigger here — 'tied' cells are absorbed into the prior 'on' via
      // tieExtent and produce no event of their own.
      for (let r = 0; r < pattern.cells.length; r++) {
        if (pattern.cells[r][idx] !== 'on') continue;
        const out = pattern.pitches[r] + xpose;
        const tied = pattern.tieExtent(r, idx); // # of 'tied' steps following
        track.voiceManager.noteOn(out, 100, when);
        // Gate the original step at 0.9; each tied step extends gate by 1 step.
        track.voiceManager.noteOff(out, when + duration * (0.9 + tied));
      }
    }
    if (this.drumPattern && this.drumKit) {
      const idx = globalStep % this.drumPattern.numSteps;
      const tracks = this.drumPattern.tracksAtStep(idx);
      for (const t of tracks) this.drumKit.trigger(t, when);
    }
    const delayMs = Math.max(0, (when - this.ctx.currentTime) * 1000);
    setTimeout(() => { this.audibleStep = globalStep; }, delayMs);
    if (this.onStep) this.onStep(globalStep, when);
  }
}
