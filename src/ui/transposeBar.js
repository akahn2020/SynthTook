// LIVE TRANSPOSE bar above the on-screen keyboard. Toggles the Transposer on
// and off, and shows the current root + offset readout so the user can see
// what the loop will play before the next downbeat.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(m) {
  return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
}

function fmtOffset(n) {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : String(n);
}

export function initTransposeBar(transposer, container) {
  const bar = document.createElement('div');
  bar.className = 'transpose-bar';
  bar.innerHTML = `
    <span class="transpose-label">LIVE TRANSPOSE</span>
    <button type="button" class="transpose-toggle" aria-pressed="false">OFF</button>
    <span class="transpose-readout"></span>
    <span class="transpose-hint">press any key to shift the loop</span>
  `;
  // Insert at the top of the section so it sits above OCTAVE and the keyboard.
  container.insertBefore(bar, container.firstChild);

  const toggleBtn = bar.querySelector('.transpose-toggle');
  const readoutEl = bar.querySelector('.transpose-readout');

  function render(state) {
    const { enabled, offset, root, pressed } = state ?? {
      enabled: transposer.enabled,
      offset: transposer.offset,
      root: transposer.lastRoot,
      pressed: transposer.lastPressed,
    };
    toggleBtn.textContent = enabled ? 'ON' : 'OFF';
    toggleBtn.setAttribute('aria-pressed', String(enabled));
    toggleBtn.classList.toggle('active', enabled);
    bar.classList.toggle('enabled', enabled);

    if (!enabled) {
      readoutEl.textContent = '';
      return;
    }
    const rootName = midiToName(root);
    const offText = fmtOffset(offset);
    if (pressed === null || pressed === undefined) {
      readoutEl.textContent = `ROOT ${rootName} · ${offText}`;
    } else {
      readoutEl.textContent = `ROOT ${rootName} · ${offText} (${midiToName(pressed)})`;
    }
  }

  toggleBtn.addEventListener('click', () => {
    transposer.setEnabled(!transposer.enabled);
  });

  transposer.onChange = render;
  render();
}
