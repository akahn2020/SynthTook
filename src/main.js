import { VoiceManager } from './audio/voiceManager.js';
import { DrumKit, DEFAULT_DRUM_PARAMS } from './audio/drums.js';
import { initMidiInput } from './input/midiInput.js';
import { initKeyboardUI } from './input/keyboardUI.js';
import { Scheduler } from './sequencer/scheduler.js';
import { Pattern } from './sequencer/pattern.js';
import { DrumPattern } from './sequencer/drumPattern.js';
import { Recorder } from './sequencer/recorder.js';
import { Arpeggiator } from './sequencer/arpeggiator.js';
import { initPanel } from './ui/panel.js';
import { initControls } from './ui/controls.js';
import { initArpControls } from './ui/arpControls.js';
import { initDrumControls } from './ui/drumControls.js';
import { initHelp } from './ui/help.js';
import { initVisualizer } from './ui/visualizer.js';
import { initMixer, applyMixerToGains } from './ui/mixer.js';
import { initSlots } from './ui/slots.js';
import { saveState, loadState, debounce } from './persistence.js';

initHelp();

const powerBtn = document.getElementById('power-btn');
const statusEl = document.getElementById('status');
const midiSelect = document.getElementById('midi-select');
const bpmInput = document.getElementById('bpm-input');

let started = false;

function defaultLeadParams() {
  return {
    wave:      'sawtooth',
    amp:       { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.2 },
    filter:    { cutoff: 2200, resonance: 1 },
    filterEnv: { amount: 1500, attack: 0.01, decay: 0.3 },
  };
}

function makeLeadTracksRegistry(tracks) {
  return {
    tracks,
    activeIndex: 0,
    listeners: [],
    active() { return this.tracks[this.activeIndex]; },
    setActive(i) {
      if (i < 0 || i >= this.tracks.length) return;
      if (this.activeIndex === i) return;
      this.activeIndex = i;
      for (const fn of this.listeners) fn(this.active(), i);
    },
    onChange(fn) { this.listeners.push(fn); },
  };
}

powerBtn.addEventListener('click', async () => {
  if (started) return;
  started = true;

  const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  await ctx.resume();

  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  const leadGain = ctx.createGain();
  leadGain.connect(masterGain);

  initVisualizer(ctx, masterGain, document.getElementById('visualizer'));

  // Build pitches once, shared across all lead tracks (same range, same grid layout).
  const pitches = [];
  for (let n = 84; n >= 36; n--) pitches.push(n); // C6 down to C2 (matches Keystation 49e)

  const leadTrackDefs = [
    { name: 'LEAD A' },
    { name: 'LEAD B' },
  ];
  const tracks = leadTrackDefs.map(def => {
    const params = defaultLeadParams();
    const voiceManager = new VoiceManager(ctx, leadGain, params, 8);
    const pattern = new Pattern(16, pitches);
    return { name: def.name, params, voiceManager, pattern };
  });
  const leadTracks = makeLeadTracksRegistry(tracks);

  const globalParams = {
    mixer: {
      lead:   { volume: 0.7, muted: false },
      kick:   { volume: 0.9, muted: false },
      snare:  { volume: 0.7, muted: false },
      hat:    { volume: 0.5, muted: false },
      master: { volume: 0.5, muted: false },
    },
    arp: { enabled: false, mode: 'up', rate: 16, gate: 0.7 },
    drumParams: JSON.parse(JSON.stringify(DEFAULT_DRUM_PARAMS)),
  };

  const drumKit = new DrumKit(ctx, masterGain, globalParams.drumParams);

  const gainNodes = {
    lead:   leadGain,
    kick:   drumKit.kickGain,
    snare:  drumKit.snareGain,
    hat:    drumKit.hatGain,
    master: masterGain,
  };
  applyMixerToGains(globalParams, gainNodes);

  const drumPattern = new DrumPattern(16);
  const scheduler = new Scheduler(ctx, leadTracks, drumPattern, drumKit);
  const recorder = new Recorder(leadTracks, scheduler);
  const arp = new Arpeggiator(recorder, globalParams.arp);
  arp.setScheduler(scheduler);

  // --- Restore saved session, if any ---
  const saved = loadState();
  if (saved) {
    if (Array.isArray(saved.leadTracks)) {
      for (let i = 0; i < tracks.length && i < saved.leadTracks.length; i++) {
        const sav = saved.leadTracks[i];
        if (sav?.params) {
          const p = tracks[i].params;
          if (typeof sav.params.wave === 'string') p.wave = sav.params.wave;
          if (sav.params.amp) Object.assign(p.amp, sav.params.amp);
          if (sav.params.filter) Object.assign(p.filter, sav.params.filter);
          if (sav.params.filterEnv) Object.assign(p.filterEnv, sav.params.filterEnv);
        }
        const cells = sav?.pattern?.cells;
        if (cells) {
          const savedNumSteps = cells[0]?.length ?? tracks[i].pattern.numSteps;
          if (savedNumSteps !== tracks[i].pattern.numSteps) {
            tracks[i].pattern.setLength(savedNumSteps);
          }
          for (let r = 0; r < tracks[i].pattern.cells.length; r++) {
            for (let c = 0; c < tracks[i].pattern.cells[r].length; c++) {
              tracks[i].pattern.cells[r][c] = !!cells[r]?.[c];
            }
          }
        }
      }
    }
    if (saved.drumPattern?.cells) {
      const savedNumSteps = saved.drumPattern.cells[0]?.length ?? drumPattern.numSteps;
      if (savedNumSteps !== drumPattern.numSteps) {
        drumPattern.setLength(savedNumSteps);
      }
      for (let t = 0; t < drumPattern.cells.length; t++) {
        for (let c = 0; c < drumPattern.cells[t].length; c++) {
          drumPattern.cells[t][c] = !!saved.drumPattern.cells[t]?.[c];
        }
      }
    }
    if (saved.globalParams) {
      if (saved.globalParams.mixer) {
        for (const key of Object.keys(globalParams.mixer)) {
          if (saved.globalParams.mixer[key]) Object.assign(globalParams.mixer[key], saved.globalParams.mixer[key]);
        }
      }
      if (saved.globalParams.arp) Object.assign(globalParams.arp, saved.globalParams.arp);
      if (saved.globalParams.drumParams) {
        for (const key of Object.keys(globalParams.drumParams)) {
          if (saved.globalParams.drumParams[key]) Object.assign(globalParams.drumParams[key], saved.globalParams.drumParams[key]);
        }
      }
    }
    if (Number.isInteger(saved.activeLeadIndex)) {
      leadTracks.activeIndex = Math.max(0, Math.min(tracks.length - 1, saved.activeLeadIndex));
    }
    // Reapply restored params to per-track audio nodes
    for (const t of tracks) {
      t.voiceManager.setWave(t.params.wave);
      t.voiceManager.setFilterBase(t.params.filter.cutoff, t.params.filter.resonance);
      t.voiceManager.setFilterEnvAmount(t.params.filterEnv.amount);
    }
    applyMixerToGains(globalParams, gainNodes);
    if (Number.isFinite(saved.bpm)) {
      scheduler.setBpm(saved.bpm);
      bpmInput.value = saved.bpm;
    }
  }

  function buildSnapshot() {
    return {
      leadTracks: tracks.map(t => ({
        params: JSON.parse(JSON.stringify(t.params)),
        pattern: { cells: t.pattern.cells.map(row => row.slice()) },
      })),
      drumPattern,
      globalParams,
      bpm: scheduler.bpm,
      activeLeadIndex: leadTracks.activeIndex,
    };
  }

  const triggerSave = debounce(() => {
    saveState(buildSnapshot());
  }, 250);

  // Persist on track switch too (active index is part of session).
  leadTracks.onChange(() => triggerSave());

  // --- Inputs ---
  midiSelect.disabled = false;
  midiSelect.innerHTML = '<option value="">— select MIDI input —</option>';
  await initMidiInput(arp, midiSelect);

  initKeyboardUI(arp, document.querySelector('#keyboard .key-area'));

  initControls(leadTracks, document.getElementById('lead-controls'), triggerSave);
  initArpControls(arp, globalParams, document.getElementById('arp-controls'), triggerSave);
  initDrumControls(globalParams, document.getElementById('drum-controls'), triggerSave);

  initMixer({
    params: globalParams,
    gainNodes,
    container: document.getElementById('mixer-section'),
    triggerSave,
  });

  initSlots({
    container: document.getElementById('slots-section'),
    buildSnapshot,
  });

  initPanel({
    leadTracks,
    drumPattern,
    scheduler,
    recorder,
    leadTabsContainer: document.getElementById('lead-tabs'),
    gridContainer: document.getElementById('grid'),
    drumBarContainer: document.getElementById('drum-bar'),
    drumGridContainer: document.getElementById('drum-grid'),
    playBtn: document.getElementById('play-btn'),
    stopBtn: document.getElementById('stop-btn'),
    recBtn: document.getElementById('rec-btn'),
    clearBtn: document.getElementById('clear-btn'),
    bpmInput,
    triggerSave,
  });

  powerBtn.disabled = true;
  powerBtn.textContent = 'POWERED ON';
  statusEl.textContent = `audio: running · ${ctx.sampleRate} Hz · ${tracks.length} lead tracks · 8 voices each` + (saved ? ' · session restored' : '');
});
