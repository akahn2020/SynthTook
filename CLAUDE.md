# SynthTook — project guide for Claude

A web-based mini-synth + step sequencer. Vanilla JS + ES modules, no build step. The user is a hobbyist building this on Windows; primary live input is an **M-Audio Keystation 49e** (49 keys, C2–C6, USB class-compliant MIDI). Target browsers: **Chrome / Edge** only (Web MIDI is unreliable elsewhere).

Live at <https://github.com/akahn2020/SynthTook>.

## Run

```powershell
npx http-server "C:\Users\akade\Code\SynthTook" -p 8080 -c-1
```

Open `http://localhost:8080` in Chrome or Edge. Click **POWER ON** (browsers gate audio behind a user gesture). The dev server is normally already running in the background of the working session.

## Architecture

### Audio graph (current)

```
input sources ──► transposer ──► arp ──► recorder ──► voiceManager ──► masterGain ──► destination
  (MIDI / on-screen / computer kb)                       (8 voices)                 ↘ analyser
                       │                                                            (visualizer tap)
                       └── publishes offset ──► scheduler (applied to lead notes only)

scheduler ──► voiceManager.noteOn(when, midi+offset)   (lead playback)
scheduler ──► drumKit.trigger(track, when) ──────────► masterGain   (drum playback, unaffected by transpose)
```

### Module layout

| File | Role |
|---|---|
| `src/main.js` | Composition root. Creates AudioContext on POWER ON, instantiates everything, wires modules together, restores saved session. |
| `src/audio/synthVoice.js` | One voice slot. Owns a `BiquadFilter` and the per-voice plumbing for the filter envelope (`ConstantSource → envGain → envScale → filter.frequency`). Creates a fresh `OscillatorNode` + amp-gain pair on every note so a stolen-note tail can ring out without colliding with the new note's envelope. |
| `src/audio/voiceManager.js` | 8 voices, oldest-note voice stealing. API: `noteOn(midi, vel, when?)`, `noteOff(midi, when?)`, `allOff()`, `setFilterBase`, `setFilterEnvAmount`, `setWave`. |
| `src/audio/drums.js` | Synthesized kick (sine sweep), snare (HP-filtered noise + 200 Hz triangle body), hat (HP-filtered noise burst). One shared `noiseBuffer`. |
| `src/input/midiInput.js` | Web MIDI; parses status nibble; **treats Note On with velocity 0 as Note Off** (Keystation does this). Routes to whatever sink it's given (currently the recorder). |
| `src/input/keyboardUI.js` | On-screen keyboard (C3–C5) + computer-keyboard mapping `a w s e d f t g y h u j k`. Black keys absolute-positioned over white-key strip. Releases held notes on `window.blur`. |
| `src/sequencer/scheduler.js` | Chris Wilson lookahead scheduler — 25 ms timer, 100 ms lookahead. Fires lead (`voiceManager.noteOn/off(when)`) and drums (`drumKit.trigger(track, when)`) for each step. Tracks `audibleStep` via setTimeout (used by recorder for live-record). |
| `src/sequencer/pattern.js` | 2D piano-roll model. `pitches` = ordered MIDI notes, `cells[row][col]` = bool. `notesAtStep(col)` = chord at that step. |
| `src/sequencer/drumPattern.js` | 3-row × 16-step bool grid. `tracksAtStep(col)` = which drums fire. |
| `src/sequencer/recorder.js` | Sits between input and voice manager. When armed, also writes incoming notes into `pattern`. Two modes (auto-detected): step-record (scheduler stopped, advances `stepCursor` after each note with an 80 ms chord window) and live-record (scheduler running, writes to `scheduler.audibleStep`). |
| `src/sequencer/transposer.js` | Live-transpose intercept at the head of the input chain (in front of arp). When enabled, swallows incoming notes (no play, no arp, no record) and sets a semitone offset = `pressedMidi − root`, which the scheduler applies to lead-track notes only. Root is computed on demand via injected `getRoot()` (currently the lowest active note across lead patterns; default C4 if empty). Last-press-wins; offset persists after release. |
| `src/ui/transposeBar.js` | LIVE TRANSPOSE toggle + root/offset readout inserted at the top of `#keyboard-section`. Subscribes to `transposer.onChange` to update the readout on each key press. |
| `src/ui/panel.js` | Builds the lead piano-roll grid + drum grid. Wires PLAY/STOP/REC/CLEAR, BPM, recorder-cursor visuals, step-cursor visuals, spacebar/arrow-right rest. |
| `src/ui/controls.js` | Builds the OSCILLATOR (wave selector) + AMP / FILTER / FILTER ENV slider groups. Sliders are 0..1 with optional exponential curve mapping. |
| `src/ui/visualizer.js` | `AnalyserNode` → canvas. Spectrum bars with magenta-to-cyan gradient over a horizon line. |
| `src/ui/help.js` | Shows / hides the help modal. Esc / backdrop / X to close. |
| `src/persistence.js` | localStorage auto-save. `saveState({pattern, drumPattern, params, bpm})` deep-copies; debounced 250 ms. `loadState()` returns null if missing or version mismatch. |

## Conventions

- **Vanilla JS + ES modules, no bundler, no test framework.** Hobby project. Don't propose adding TypeScript / Vite / Vitest unless asked. ([feedback memory](~/.claude/projects/C--Users-akade-Code-SynthTook/memory/feedback_quality_bar.md))
- **Audio timing comes from `audioContext.currentTime`, not `setInterval`.** Always schedule audio events via `setValueAtTime` / `linearRampToValueAtTime` / `setTargetAtTime` with explicit `when` times. JS timers are only used to wake up the lookahead scheduler.
- **AudioContext requires a user gesture.** All audio init happens inside the POWER ON click handler. Don't try to create AudioContext at module load.
- **`latencyHint: 'interactive'`** on AudioContext — keeps round-trip low for live MIDI playing.
- **Filter envelope is additive via signal connection**, not direct scheduling on `filter.frequency`. This lets the live CUTOFF slider change the base value without fighting the envelope automation.
- **Per-note Oscillator + GainNode pairs** (not reusable). OscillatorNode is one-shot — `start()` can only be called once. Each voice slot keeps a long-lived filter and (for drums) gain bus, but creates fresh oscillators on every note.
- **Mute and stop logic uses `cancelAndHoldAtTime(when)` with a `cancelHold` helper** that falls back to `cancelScheduledValues` for older browsers. This locks the param's current value at the cancel point so subsequent ramps interpolate cleanly.
- **Keystation quirk:** sends Note On with velocity 0 instead of explicit Note Off. The MIDI parser treats those as Note Off. Don't break this.
- **Inputs are decoupled from playback.** Live keyboard input → `transposer` → `arp` → `recorder.noteOn` → `voiceManager.noteOn` (no `when` = immediate). Sequencer playback → `voiceManager.noteOn(midi + scheduler.transposeOffset, vel, when)` directly (bypasses recorder so playback isn't recorded into itself).
- **Transpose offset is captured per-step in the scheduler.** Inside `_scheduleStep`, the current `transposeOffset` is read once and reused for both the noteOn and matching noteOff, so a mid-step update from the Transposer can't leave a note hanging at the wrong pitch.

## Status

**Done:** Phase 1 (engine + transport), Phase 2 (ADSR / filter / filter env / wave selector / record-from-keyboard), most of Phase 3 (multi-track via synthesized drums, spectrum visualizer, auto-save).

**Active plan:** `~/.claude/plans/synchronous-forging-jellyfish.md` — expand pitch range to C2–C6 (matches Keystation 49e) + add a 5-channel volume + mute mixer (LEAD / KICK / SNARE / HAT / MASTER).

**Roadmap:** see `TODO.md` in this directory. Highlights: arpeggiator, modulation matrix, sample loading, per-track synth params.

## Things NOT to do

- Don't add a build step, bundler, TypeScript, or test framework. ([explicit user preference](~/.claude/projects/C--Users-akade-Code-SynthTook/memory/feedback_quality_bar.md))
- Don't replace the Chris Wilson lookahead scheduler with `setInterval`. The whole timing fidelity story depends on it.
- Don't ship features that need Safari (no Web MIDI). Document Chrome/Edge as the target.
- Don't change the version constant in `persistence.js` casually — it invalidates user-saved sessions. Bump it deliberately when the persisted shape changes (pattern dimensions, params shape).
- Don't bypass the user-gesture gate. AudioContext must be created inside the POWER ON click handler or it will be created in a "suspended" state in newer Chromium.
- Don't write a per-feature CHANGELOG / migration doc unless asked. The git history is enough.

## Hardware reference

- **Live MIDI:** M-Audio Keystation 49e, USB class-compliant. C2–C6, default channel 1, sends Note On vel-0 instead of Note Off. ([memory](~/.claude/projects/C--Users-akade-Code-SynthTook/memory/user_keystation.md))
