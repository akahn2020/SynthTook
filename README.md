# SynthTook

Web-based mini-synth + step sequencer driven by Web Audio API and Web MIDI API.

## Run

ES modules need an http origin (not `file://`):

```
npx http-server .
```

Then open the printed URL (e.g. `http://localhost:8080`) in **Chrome** or **Edge**. Web MIDI is not supported in Safari and is unreliable in older Firefox builds — use a Chromium browser.

## Use

1. Click **POWER ON** (browsers require a user gesture before starting audio).
2. Pick your MIDI input (e.g. M-Audio Keystation 49e) from the dropdown.
3. Play with the keystation, with the on-screen keyboard, or with the computer keys `a w s e d f t g y h u j k`.
4. Click cells in the 16-step grid, set a BPM, hit **PLAY**.

## Phase 1 scope

- 4-voice polyphony with oldest-note voice stealing.
- One sawtooth oscillator → low-pass filter → per-note gain envelope.
- Live input from MIDI / on-screen / computer keyboard, all funneling through the same voice manager.
- 16-step single-track sequencer using the Chris Wilson lookahead scheduler pattern.

Phase 2 adds full ADSR, filter modulation, multi-track patterns, and pattern save/load.
