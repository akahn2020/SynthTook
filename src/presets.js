// Factory presets — read-only "starter pack" of bass-focused patches each
// bundling a synth params recipe + a lead pattern + drums + mixer + BPM.
// Loaded via the preset modal: chosen preset's `data` is written into the
// autosave key and the page reloads, so the standard restore path in main.js
// repopulates every UI surface. Same load path as user slots.

import { AUTOSAVE_VERSION } from './persistence.js';

// Grid spans MIDI 84 (C6, row 0) down to 24 (C1, row 60).
const PITCH_TOP = 84;
const PITCH_COUNT = 61;
const STEPS = 16;

// MIDI helpers — preset notes are nicer to read by name than by integer.
const PCS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
function m(name, octave) { return 12 * (octave + 1) + PCS[name]; }

// events = [{ midi, step, length? }] — length defaults to 1 (no tie).
// length > 1 places 'on' at step plus (length-1) 'tied' cells after it.
function leadPattern(events) {
  const cells = Array.from({ length: PITCH_COUNT }, () => new Array(STEPS).fill(null));
  for (const e of events) {
    const row = PITCH_TOP - e.midi;
    if (row < 0 || row >= PITCH_COUNT) continue;
    const len = e.length ?? 1;
    cells[row][e.step] = 'on';
    for (let i = 1; i < len; i++) {
      const c = e.step + i;
      if (c >= STEPS) break;
      cells[row][c] = 'tied';
    }
  }
  return { cells };
}

// hits = { kick: [step,...], snare: [step,...], hat: [step,...] }
function drumPattern(hits = {}) {
  const cells = [
    new Array(STEPS).fill(false),
    new Array(STEPS).fill(false),
    new Array(STEPS).fill(false),
  ];
  for (const s of hits.kick  || []) cells[0][s] = true;
  for (const s of hits.snare || []) cells[1][s] = true;
  for (const s of hits.hat   || []) cells[2][s] = true;
  return { cells };
}

function mixer({ lead = 0.7, kick = 0.9, snare = 0.7, hat = 0.5, master = 0.5, muteDrums = false } = {}) {
  return {
    lead:   { volume: lead,   muted: false },
    kick:   { volume: kick,   muted: muteDrums },
    snare:  { volume: snare,  muted: muteDrums },
    hat:    { volume: hat,    muted: muteDrums },
    master: { volume: master, muted: false },
  };
}

const ARP_OFF = { enabled: false, mode: 'up', rate: 16, gate: 0.7 };

function preset({ name, description, bpm, params, events, drums, mix }) {
  return {
    name,
    description,
    data: {
      version: AUTOSAVE_VERSION,
      leadTracks: [
        { params, pattern: leadPattern(events) },
        // LEAD B intentionally omitted — load path leaves it at defaults
        // (empty pattern + default saw params).
      ],
      drumPattern: drumPattern(drums),
      globalParams: { mixer: mix, arp: ARP_OFF },
      bpm,
      activeLeadIndex: 0,
    },
  };
}

// --- The 8 starter patches ---------------------------------------------------

const ACID_303 = preset({
  name: '303 Acid Bass',
  description:
    'Saw + low cutoff + high resonance + fast filter env on every note. The squelchy ' +
    'wow is the AD envelope sweeping the filter open and back. Try tweaking RESONANCE ' +
    '(big squelch) and FILTER ENV AMOUNT (sweep depth) while it plays.',
  bpm: 128,
  params: {
    wave: 'sawtooth',
    amp:       { attack: 0.005, decay: 0.15, sustain: 0,   release: 0.05 },
    filter:    { cutoff: 250, resonance: 14 },
    filterEnv: { amount: 4500, attack: 0.005, decay: 0.4 },
  },
  events: [
    { midi: m('A',2),  step: 0 },  { midi: m('A',2),  step: 1 },
    { midi: m('A',3),  step: 2 },  { midi: m('A',2),  step: 3 },
    { midi: m('A',2),  step: 4 },  { midi: m('C',3),  step: 5 },
    { midi: m('A',2),  step: 6 },  { midi: m('E',3),  step: 7 },
    { midi: m('A',2),  step: 8 },  { midi: m('A',2),  step: 9 },
    { midi: m('A',2),  step: 10 }, { midi: m('G',3),  step: 11 },
    { midi: m('A',2),  step: 12 }, { midi: m('A',2),  step: 13 },
    { midi: m('D',3),  step: 14 }, { midi: m('A',2),  step: 15 },
  ],
  drums: {
    kick:  [0, 4, 8, 12],
    snare: [4, 12],
    hat:   [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  },
  mix: mixer({ lead: 0.7, kick: 0.9, snare: 0.6, hat: 0.4 }),
});

const SUB_BASS = preset({
  name: 'Sub Bass',
  description:
    'Sine + long sustain + filter wide open. The "808" sub: pure fundamental, no harmonics, ' +
    'felt more than heard. Each note is held across 4 steps using ties — shift-click an "on" ' +
    'cell to convert it to a tie (extends the previous note). Uses MIDI down to G#1.',
  bpm: 75,
  params: {
    wave: 'sine',
    amp:       { attack: 0.01, decay: 0.3, sustain: 1.0, release: 0.4 },
    filter:    { cutoff: 12000, resonance: 0.5 },
    filterEnv: { amount: 0, attack: 0.005, decay: 0.1 },
  },
  events: [
    { midi: m('C',2),  step: 0,  length: 4 },
    { midi: m('Ab',1), step: 4,  length: 4 },
    { midi: m('C',2),  step: 8,  length: 4 },
    { midi: m('Ab',1), step: 12, length: 4 },
  ],
  drums: {
    kick:  [0, 8],
    snare: [4, 12],
    hat:   [],
  },
  mix: mixer({ lead: 0.9, kick: 0.7, snare: 0.5, hat: 0 }),
});

const NES_PULSE = preset({
  name: 'NES Pulse Bass',
  description:
    'Square wave + snappy ADSR + filter wide open. The classic 8-bit pulse-channel bass — ' +
    'every triad arpeggiated across octaves. No filter motion at all; the character comes ' +
    'entirely from the square wave and the staccato envelope.',
  bpm: 140,
  params: {
    wave: 'square',
    amp:       { attack: 0.002, decay: 0.08, sustain: 0.8, release: 0.01 },
    filter:    { cutoff: 12000, resonance: 0.5 },
    filterEnv: { amount: 0, attack: 0.005, decay: 0.1 },
  },
  events: [
    { midi: m('C',3), step: 0 },  { midi: m('G',3), step: 1 },
    { midi: m('C',4), step: 2 },  { midi: m('G',3), step: 3 },
    { midi: m('C',3), step: 4 },  { midi: m('G',3), step: 5 },
    { midi: m('C',4), step: 6 },  { midi: m('G',3), step: 7 },
    { midi: m('F',3), step: 8 },  { midi: m('C',4), step: 9 },
    { midi: m('F',4), step: 10 }, { midi: m('C',4), step: 11 },
    { midi: m('C',3), step: 12 }, { midi: m('G',3), step: 13 },
    { midi: m('C',4), step: 14 }, { midi: m('G',3), step: 15 },
  ],
  drums: {
    kick:  [0, 4, 8, 12],
    snare: [],
    hat:   [2, 6, 10, 14],
  },
  mix: mixer({ lead: 0.6, kick: 0.8, snare: 0, hat: 0.4 }),
});

const HOUSE_BOUNCER = preset({
  name: 'House Octave Bouncer',
  description:
    'Saw + medium filter + small filter env on every 16th. The iconic Moroder "I Feel Love" ' +
    'pattern — root note + octave-up alternating, two bars per chord. Try the FILTER CUTOFF ' +
    'while it plays for live filter sweeps.',
  bpm: 124,
  params: {
    wave: 'sawtooth',
    amp:       { attack: 0.005, decay: 0.1, sustain: 0, release: 0.08 },
    filter:    { cutoff: 1200, resonance: 4 },
    filterEnv: { amount: 2000, attack: 0.005, decay: 0.2 },
  },
  events: [
    { midi: m('A',2), step: 0 }, { midi: m('A',3), step: 1 },
    { midi: m('A',2), step: 2 }, { midi: m('A',3), step: 3 },
    { midi: m('A',2), step: 4 }, { midi: m('A',3), step: 5 },
    { midi: m('A',2), step: 6 }, { midi: m('A',3), step: 7 },
    { midi: m('G',2), step: 8 }, { midi: m('G',3), step: 9 },
    { midi: m('G',2), step: 10 }, { midi: m('G',3), step: 11 },
    { midi: m('G',2), step: 12 }, { midi: m('G',3), step: 13 },
    { midi: m('G',2), step: 14 }, { midi: m('G',3), step: 15 },
  ],
  drums: {
    kick:  [0, 4, 8, 12],
    snare: [4, 12],
    hat:   [2, 6, 10, 14],
  },
  mix: mixer({ lead: 0.7, kick: 0.9, snare: 0.6, hat: 0.4 }),
});

const MOOG_FUNK = preset({
  name: 'Minimoog Funk',
  description:
    'Saw + moderate filter + subtle filter env. Loosely based on Herbie Hancock\'s ' +
    '"Chameleon" riff in B♭ minor — syncopated phrasing across two bars. With our single ' +
    'oscillator (no stacked saws) it\'s thinner than a real Minimoog, but the shape is here.',
  bpm: 105,
  params: {
    wave: 'sawtooth',
    amp:       { attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.15 },
    filter:    { cutoff: 900, resonance: 3 },
    filterEnv: { amount: 1500, attack: 0.005, decay: 0.3 },
  },
  events: [
    { midi: m('Bb',2), step: 0,  length: 2 },
    { midi: m('Bb',2), step: 3 },
    { midi: m('Eb',3), step: 4,  length: 2 },
    { midi: m('F',3),  step: 7 },
    { midi: m('F#',3), step: 8 },
    { midi: m('G',3),  step: 9 },
    { midi: m('Bb',3), step: 12 },
    { midi: m('Ab',3), step: 13 },
    { midi: m('F',3),  step: 14 },
    { midi: m('Eb',3), step: 15 },
  ],
  drums: {
    kick:  [0, 7, 10],
    snare: [4, 12],
    hat:   [0,2,4,6,8,10,12,14],
  },
  mix: mixer({ lead: 0.75, kick: 0.85, snare: 0.65, hat: 0.5 }),
});

const PLUCK = preset({
  name: 'Pluck',
  description:
    'Triangle + very short ADSR + small filter env. A bright, percussive plucked sound for ' +
    'arpeggios and melodies. The triangle gives a softer body than saw; the short filter env ' +
    'adds a click at the attack.',
  bpm: 110,
  params: {
    wave: 'triangle',
    amp:       { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.08 },
    filter:    { cutoff: 2500, resonance: 1 },
    filterEnv: { amount: 3000, attack: 0.001, decay: 0.15 },
  },
  events: [
    { midi: m('C',4), step: 0 }, { midi: m('E',4), step: 1 },
    { midi: m('G',4), step: 2 }, { midi: m('E',4), step: 3 },
    { midi: m('C',4), step: 4 }, { midi: m('E',4), step: 5 },
    { midi: m('G',4), step: 6 }, { midi: m('E',4), step: 7 },
    { midi: m('F',4), step: 8 }, { midi: m('A',4), step: 9 },
    { midi: m('C',5), step: 10 }, { midi: m('A',4), step: 11 },
    { midi: m('E',4), step: 12 }, { midi: m('G',4), step: 13 },
    { midi: m('B',4), step: 14 }, { midi: m('G',4), step: 15 },
  ],
  drums: {
    kick:  [0, 8],
    snare: [],
    hat:   [4, 12],
  },
  mix: mixer({ lead: 0.7, kick: 0.8, snare: 0, hat: 0.4 }),
});

const SOFT_PAD = preset({
  name: 'Soft Pad',
  description:
    'Sine + long attack + long release + slow filter env. A held chord that breathes — two ' +
    '8-step chords per loop (C major → A minor) using ties to sustain notes across every ' +
    'step. Drums muted so the pad sits on its own. This is what the tie feature was made for.',
  bpm: 90,
  params: {
    wave: 'sine',
    amp:       { attack: 0.8, decay: 1.5, sustain: 0.8, release: 1.5 },
    filter:    { cutoff: 1800, resonance: 0.5 },
    filterEnv: { amount: 800, attack: 0.6, decay: 1.5 },
  },
  events: [
    { midi: m('C',3), step: 0, length: 8 },
    { midi: m('E',3), step: 0, length: 8 },
    { midi: m('G',3), step: 0, length: 8 },
    { midi: m('A',2), step: 8, length: 8 },
    { midi: m('C',3), step: 8, length: 8 },
    { midi: m('E',3), step: 8, length: 8 },
  ],
  drums: { kick: [], snare: [], hat: [] },
  mix: mixer({ lead: 0.7, master: 0.5, muteDrums: true }),
});

const STAB = preset({
  name: 'Stab',
  description:
    'Saw + short ADSR + medium filter env, played as off-beat hits over a four-on-floor kick. ' +
    'Classic techno/house "stab" — sits in the gaps between the kick. C minor (i and v).',
  bpm: 120,
  params: {
    wave: 'sawtooth',
    amp:       { attack: 0.005, decay: 0.12, sustain: 0, release: 0.1 },
    filter:    { cutoff: 1500, resonance: 6 },
    filterEnv: { amount: 2500, attack: 0.005, decay: 0.25 },
  },
  events: [
    { midi: m('C',3), step: 2 },
    { midi: m('C',3), step: 6 },
    { midi: m('G',2), step: 10 },
    { midi: m('G',2), step: 14 },
  ],
  drums: {
    kick:  [0, 4, 8, 12],
    snare: [4, 12],
    hat:   [0,2,4,6,8,10,12,14],
  },
  mix: mixer({ lead: 0.75, kick: 0.85, snare: 0.65, hat: 0.45 }),
});

export const FACTORY_PRESETS = [
  ACID_303,
  SUB_BASS,
  NES_PULSE,
  HOUSE_BOUNCER,
  MOOG_FUNK,
  PLUCK,
  SOFT_PAD,
  STAB,
];
