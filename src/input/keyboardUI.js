// On-screen piano + computer-keyboard input. Four octaves: C2 (MIDI 36) to C6
// (84), matching the Keystation 49e's range and the lead piano-roll. Black
// keys are absolutely positioned over the white-key strip — avoids the brittle
// negative-margin overlap pattern. Key widths must stay in sync with the
// .white-key / .black-key rules in style.css.

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
  const heldByKb = new Set();

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

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.target instanceof HTMLInputElement) return;
    const note = COMPUTER_KB_MAP[e.key.toLowerCase()];
    if (note === undefined) return;
    if (heldByKb.has(note)) return;
    heldByKb.add(note);
    press(note);
  });
  document.addEventListener('keyup', (e) => {
    const note = COMPUTER_KB_MAP[e.key.toLowerCase()];
    if (note === undefined) return;
    if (heldByKb.delete(note)) release(note);
  });

  window.addEventListener('blur', () => {
    heldByKb.forEach(release);
    heldByKb.clear();
    heldByMouse.forEach(release);
    heldByMouse.clear();
  });
}
