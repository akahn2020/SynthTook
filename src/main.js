import { VoiceManager } from './audio/voiceManager.js';
import { initMidiInput } from './input/midiInput.js';
import { initKeyboardUI } from './input/keyboardUI.js';
import { Scheduler } from './sequencer/scheduler.js';
import { Pattern } from './sequencer/pattern.js';
import { Recorder } from './sequencer/recorder.js';
import { initPanel } from './ui/panel.js';
import { initControls } from './ui/controls.js';
import { initHelp } from './ui/help.js';

initHelp();

const powerBtn = document.getElementById('power-btn');
const statusEl = document.getElementById('status');
const midiSelect = document.getElementById('midi-select');

let started = false;

powerBtn.addEventListener('click', async () => {
  if (started) return;
  started = true;

  const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  await ctx.resume();

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);

  const params = {
    wave:      'sawtooth',
    amp:       { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.2 },
    filter:    { cutoff: 2200, resonance: 1 },
    filterEnv: { amount: 1500, attack: 0.01, decay: 0.3 },
  };

  const voiceManager = new VoiceManager(ctx, masterGain, params, 8);

  const pitches = [];
  for (let n = 72; n >= 48; n--) pitches.push(n); // C5 down to C3 (top-to-bottom)
  const pattern = new Pattern(16, pitches);
  const scheduler = new Scheduler(ctx, pattern, voiceManager);
  const recorder = new Recorder(voiceManager, pattern, scheduler);

  midiSelect.disabled = false;
  midiSelect.innerHTML = '<option value="">— select MIDI input —</option>';
  await initMidiInput(recorder, midiSelect);

  initKeyboardUI(recorder, document.querySelector('#keyboard .key-area'));

  initControls(voiceManager, params, document.getElementById('controls-section'));

  initPanel({
    pattern,
    scheduler,
    recorder,
    gridContainer: document.getElementById('grid'),
    playBtn: document.getElementById('play-btn'),
    stopBtn: document.getElementById('stop-btn'),
    recBtn: document.getElementById('rec-btn'),
    clearBtn: document.getElementById('clear-btn'),
    bpmInput: document.getElementById('bpm-input'),
  });

  powerBtn.disabled = true;
  powerBtn.textContent = 'POWERED ON';
  statusEl.textContent = `audio: running · ${ctx.sampleRate} Hz · 8 voices`;
});
