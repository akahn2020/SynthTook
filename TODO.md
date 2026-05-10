# TODO

Working punch list against the original plan + things noticed during build.

## Done

- [x] Phase 1 — audio engine, MIDI / on-screen / computer-keyboard input, 8-voice manager with oldest-note stealing, Chris Wilson lookahead scheduler, 16-step pattern, transport
- [x] Phase 2 — full ADSR amp envelope, filter cutoff/resonance with live updates, AD filter envelope routed to cutoff via additive signal connection
- [x] Wave selector (sine / triangle / square / sawtooth, hot-swappable mid-note)
- [x] Help modal with quick start + starter patches
- [x] Step record + live record from any input source
- [x] Multi-track — lead piano roll + 3-track synthesized drums (kick / snare / hat)
- [x] Spectrum visualizer (AnalyserNode → canvas, magenta-to-cyan bars)
- [x] Auto-save / auto-restore (localStorage, debounced 250 ms)
- [x] Public GitHub repo at akahn2020/SynthTook

## Up next

### Planned (planned in detail — see `~/.claude/plans/synchronous-forging-jellyfish.md`)

- [x] **Expand pitch range to C2–C6** (4 octaves, MIDI 36–84). Matches the M-Audio Keystation 49e key range exactly so bass lines below middle C become recordable.
  - `src/main.js` — change pitches loop to `for (let n = 84; n >= 36; n--)`.
  - `style.css` — `#grid { max-height: 400px; overflow-y: auto; scrollbar-width: thin; }` with neon-styled scrollbar.
  - `src/ui/panel.js` — after building grid cells, set `gridContainer.scrollTop` so C4 is centered in the viewport.
  - `src/persistence.js` — bump `VERSION` from 2 → 3 so old saved sessions (25-row patterns) are discarded silently rather than half-restored.
  - `src/sequencer/recorder.js` — no change (already filters by `pattern.pitches.indexOf(midi)`; wider pitches array = wider recordable range automatically).

- [x] **Mixer (5 channels: volume + mute)** — LEAD, KICK, SNARE, HAT, MASTER faders so each track's level is independent.
  - Audio-graph rework: `voiceManager → leadGain`, `drumKit._kick → kickGain`, `_snare → snareGain`, `_hihat → hatGain`, all four → `masterGain` → destination, with the analyser still tapping masterGain.
  - `src/audio/drums.js` — DrumKit owns three internal `kickGain` / `snareGain` / `hatGain` nodes; each `_kick/_snare/_hihat` connects through its track gain. Add `setTrackVolume(track, value)`.
  - `src/main.js` — create `leadGain` and `masterGain` separately; pass `leadGain` to `VoiceManager` constructor, `masterGain` to `DrumKit`. Add `params.mixer` with per-channel `{ volume, muted }`.
  - **NEW** `src/ui/mixer.js` — builds 5 channel strips (label + horizontal slider + MUTE button). Slider is 0..1; mute sets `gain.value = 0` while preserving the underlying volume in params (standard mixer mute behavior: dragging the slider while muted updates the value but not the audio).
  - **NEW** `src/ui/sliderUtils.js` — extract `mapValue` / `unmapValue` / `fmt` from `controls.js` so `mixer.js` can reuse them without duplication.
  - `src/ui/controls.js` — import slider helpers from `sliderUtils.js` instead of defining them inline.
  - `src/persistence.js` — already deep-copies params, so `mixer` field is auto-saved. Bump `VERSION` to 3 (same bump as pitch-range part).
  - `index.html` — add `<section id="mixer-section">` between `#controls-section` and `#sequencer-section`. Add a "MIXER" section in the help modal (and renumber PATCHES from 7 to 8).
  - `style.css` — channel-strip styles using existing `--neon` / `--neon-2` palette. Muted strip = dimmed slider + glowing red MUTE button.

### Other high value

- [x] **Arpeggiator** — hold a chord, get a programmed pattern. Modes UP / DN / UD / RND, rate 1/4–1/32, gate slider. Sits between input and recorder, so arp notes also record into the lead pattern when REC is armed.
- [x] **Modulation matrix** — covered by existing routings: filter envelope (AD) → cutoff with amount knob, and velocity → amp peak hard-wired in `synthVoice.js`. Full configurable matrix (LFO source, key tracking, arbitrary dests) intentionally out of scope.
- [x] **Per-track synth params** — drum tracks (KICK/SNARE/HAT) have editable timbre via the DRUM SOUND panel; lead split into LEAD A / LEAD B tabs, each with independent oscillator + ADSR + filter + filter-env, scheduled simultaneously through their own VoiceManagers and a shared LEAD mixer fader.

### Medium

- [x] **Pattern slots** — 8 named slots in localStorage alongside the autosave. SAVE TO… mode prompts for a name; CLEAR… mode deletes; default click on a filled slot loads (replaces autosave + reloads the page).
- [x] **Variable pattern length** — per-track LEN selector (8 / 16 / 32) for each lead track + the drum pattern. Scheduler uses a global step counter and indexes each pattern via `globalStep % numSteps`, so different lengths produce polymetric loops without sync drift.
- [ ] **Velocity-sensitive recording** — capture MIDI velocity per recorded note (currently hardcoded 100).
- [ ] **Quantize toggle for live record** — snap recorded notes to nearest step instead of exact-time landing.
- [ ] **Drum record mode** — map a MIDI / computer-key range to drum tracks during REC.
- [ ] **MIDI CC handling** — pitch bend, mod wheel, sustain pedal.

### Low / polish

- [ ] **CRT / neon CSS pass** — scanlines, animated glow, sharper synthwave look.
- [ ] ~~Master volume slider~~ — superseded by the planned **Mixer** above.
- [ ] ~~Octave shift~~ — superseded by the planned **Expand pitch range to C2–C6** above (with scrollable viewport).
- [ ] **Pattern import / export** — JSON download / upload for sharing.
- [ ] **MIDI export** — render pattern to a `.mid` file.
- [ ] **GitHub Pages deploy** — host at `akahn2020.github.io/SynthTook`.

## Known small issues

- [ ] Click-and-drag across grid cells to paint multiple at once
- [ ] Mouseenter on virtual keyboard plays note when dragging across keys
- [ ] Disable transport buttons before POWER ON (currently they do nothing if clicked, but visually look active)
- [ ] Status bar is silent during recording — could show "REC step N" when armed and stopped

## Reference

- Original plan: `C:\Users\akade\.claude\plans\synchronous-forging-jellyfish.md`
- Live: <https://github.com/akahn2020/SynthTook>
