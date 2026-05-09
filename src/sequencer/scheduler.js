// Lookahead scheduler — see Chris Wilson, "A Tale of Two Clocks".
// JS timer wakes every SCHEDULE_INTERVAL ms and queues any pattern events that
// fall inside the next LOOKAHEAD-second window onto the audio thread, so timing
// fidelity comes from audioContext.currentTime, not setTimeout jitter.

const SCHEDULE_INTERVAL_MS = 25;
const LOOKAHEAD_S = 0.1;

export class Scheduler {
  constructor(ctx, pattern, voiceManager) {
    this.ctx = ctx;
    this.pattern = pattern;
    this.voiceManager = voiceManager;
    this.bpm = 120;
    this.stepsPerBeat = 4; // 16th notes
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.audibleStep = -1; // updated in real time as steps actually play
    this.timerId = null;
    this.onStep = null;
  }

  setBpm(bpm) {
    this.bpm = bpm;
  }

  start() {
    if (this.timerId !== null) return;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this._tick();
  }

  stop() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.audibleStep = -1;
    this.voiceManager.allOff();
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
      this._scheduleStep(this.currentStep, this.nextStepTime, dur);
      this.nextStepTime += dur;
      this.currentStep = (this.currentStep + 1) % this.pattern.numSteps;
    }
    this.timerId = setTimeout(() => this._tick(), SCHEDULE_INTERVAL_MS);
  }

  _scheduleStep(stepIdx, when, duration) {
    const notes = this.pattern.notesAtStep(stepIdx);
    for (const midi of notes) {
      this.voiceManager.noteOn(midi, 100, when);
      this.voiceManager.noteOff(midi, when + duration * 0.9);
    }
    const delayMs = Math.max(0, (when - this.ctx.currentTime) * 1000);
    setTimeout(() => { this.audibleStep = stepIdx; }, delayMs);
    if (this.onStep) this.onStep(stepIdx, when);
  }
}
