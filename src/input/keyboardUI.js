// On-screen piano + computer-keyboard input. Four octaves: C2 (MIDI 36) to C6
// (84), matching the Keystation 49e's range and the lead piano-roll. Black
// keys are absolutely positioned over the white-key strip — avoids the brittle
// negative-margin overlap pattern. Key widths must stay in sync with the
// .white-key / .black-key rules in style.css.
//
// The computer-keyboard cluster (a w s e d f t g y h u j k) covers a single
// octave. An OCTAVE shift control above the on-screen piano slides that
// cluster up/down in octaves, clamped so mapped notes stay within C2–C6.
// Z / X are shortcuts for shift down / up.

const START_MIDI = 36;   // C2
const END_MIDI = 84;     // C6
const WHITE_W = 35;
const BLACK_W = 22;

const BLACK_NOTES = new Set([1, 3, 6, 8, 10]);
function isBlack(midi) { return BLACK_NOTES.has(midi % 12); }

const COMPUTER_KB_MAP = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65,
  t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(m) {
  return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

const MAP_VALUES = Object.values(COMPUTER_KB_MAP);
const MAP_MIN = Math.min(...MAP_VALUES);
const MAP_MAX = Math.max(...MAP_VALUES);
const MIN_OCTAVE_SHIFT = Math.ceil((START_MIDI - MAP_MIN) / 12);
const MAX_OCTAVE_SHIFT = Math.floor((END_MIDI - MAP_MAX) / 12);

export function initKeyboardUI(voiceManager, keyArea) {
  keyArea.innerHTML = '';
  const noteToEl = new Map();

  const whiteRow = document.createElement('div');
  whiteRow.className = 'white-row';
  let whiteCountBefore = 0;
  const whiteCountByMidi = new Map();

  for (let n = START_MIDI; n <= END_MIDI; n++) {
    if (isBlack(n)) {
      whiteCountByMidi.set(n, whiteCountBefore);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'key white-key';
    el.dataset.note = n;
    whiteRow.appendChild(el);
    noteToEl.set(n, el);
    whiteCountBefore++;
  }
  keyArea.appendChild(whiteRow);

  for (let n = START_MIDI; n <= END_MIDI; n++) {
    if (!isBlack(n)) continue;
    const wcb = whiteCountByMidi.get(n);
    const el = document.createElement('div');
    el.className = 'key black-key';
    el.dataset.note = n;
    el.style.left = `${wcb * WHITE_W - BLACK_W / 2}px`;
    keyArea.appendChild(el);
    noteToEl.set(n, el);
  }

  const heldByMouse = new Set();
  // Keyed by keyboard key (lowercased), not MIDI — so shifting octave while a
  // key is held still releases the exact note that was pressed.
  const heldByKb = new Map();

  const press = (note) => {
    voiceManager.noteOn(note, 100);
    noteToEl.get(note)?.classList.add('active');
  };
  const release = (note) => {
    voiceManager.noteOff(note);
    noteToEl.get(note)?.classList.remove('active');
  };

  noteToEl.forEach((el, note) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      heldByMouse.add(note);
      press(note);
    });
    el.addEventListener('mouseup', () => {
      if (heldByMouse.delete(note)) release(note);
    });
    el.addEventListener('mouseleave', (e) => {
      if ((e.buttons & 1) && heldByMouse.delete(note)) release(note);
    });
  });

  // --- Octave shift control ---
  let octaveShift = 0;

  const section = keyArea.closest('#keyboard-section') ?? keyArea.parentElement;
  const octaveBar = document.createElement('div');
  octaveBar.className = 'octave-bar';
  octaveBar.innerHTML = `
    <span class="octave-label">OCTAVE</span>
    <button type="button" class="octave-btn" data-dir="-1" aria-label="Shift octave down">&minus;</button>
    <span class="octave-range"></span>
    <button type="button" class="octave-btn" data-dir="1" aria-label="Shift octave up">+</button>
    <span class="octave-hint">Z / X</span>
  `;
  const keyboardEl = section.querySelector('#keyboard');
  section.insertBefore(octaveBar, keyboardEl);

  const rangeEl = octaveBar.querySelector('.octave-range');
  const downBtn = octaveBar.querySelector('[data-dir="-1"]');
  const upBtn = octaveBar.querySelector('[data-dir="1"]');

  function shiftedNote(baseNote) {
    return baseNote + octaveShift * 12;
  }

  function updateRangeUI() {
    rangeEl.textContent = `${midiToName(shiftedNote(MAP_MIN))} – ${midiToName(shiftedNote(MAP_MAX))}`;
    downBtn.disabled = octaveShift <= MIN_OCTAVE_SHIFT;
    upBtn.disabled = octaveShift >= MAX_OCTAVE_SHIFT;
  }

  function releaseHeldKb() {
    for (const note of heldByKb.values()) release(note);
    heldByKb.clear();
  }

  function shiftOctave(delta) {
    const next = Math.max(MIN_OCTAVE_SHIFT, Math.min(MAX_OCTAVE_SHIFT, octaveShift + delta));
    if (next === octaveShift) return;
    releaseHeldKb();
    octaveShift = next;
    updateRangeUI();
  }

  downBtn.addEventListener('click', () => shiftOctave(-1));
  upBtn.addEventListener('click', () => shiftOctave(1));
  updateRangeUI();

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (k === 'z' || k === 'x') {
      if (e.repeat) return;
      shiftOctave(k === 'z' ? -1 : 1);
      return;
    }
    if (e.repeat) return;
    const base = COMPUTER_KB_MAP[k];
    if (base === undefined) return;
    if (heldByKb.has(k)) return;
    const note = shiftedNote(base);
    heldByKb.set(k, note);
    press(note);
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    const note = heldByKb.get(k);
    if (note === undefined) return;
    heldByKb.delete(k);
    release(note);
  });

  window.addEventListener('blur', () => {
    releaseHeldKb();
    heldByMouse.forEach(release);
    heldByMouse.clear();
  });
}
