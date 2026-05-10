// Pattern slots: 8 named save slots that live in localStorage alongside the
// autosave session. Default click on a slot = LOAD (replaces autosave, reloads
// the page so the standard restore path repopulates every UI surface). Toggle
// SAVE mode then click a slot to overwrite it (with a name prompt). Toggle
// CLEAR mode then click a slot to remove its contents.

import {
  listSlots,
  saveSlot,
  clearSlot,
  AUTOSAVE_KEY,
} from '../persistence.js';

const NUM_SLOTS = 8;

function formatTimestamp(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initSlots({ container, buildSnapshot }) {
  let mode = 'load'; // 'load' | 'save' | 'clear'

  function render() {
    container.innerHTML = '';

    const heading = document.createElement('h3');
    heading.className = 'slots-heading';
    heading.textContent = 'PATTERN SLOTS';
    container.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'slots-row';
    container.appendChild(grid);

    const slots = listSlots();
    for (let i = 0; i < NUM_SLOTS; i++) {
      const slot = slots[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      const cls = ['slot-btn'];
      if (slot) cls.push('filled');
      if (mode === 'save') cls.push('save-target');
      else if (mode === 'clear' && slot) cls.push('clear-target');
      btn.className = cls.join(' ');
      btn.title = slot ? `${slot.name} — saved ${formatTimestamp(slot.savedAt)}` : 'Empty slot';

      const num = document.createElement('div');
      num.className = 'slot-num';
      num.textContent = String(i + 1);
      btn.appendChild(num);

      const name = document.createElement('div');
      name.className = 'slot-name';
      name.textContent = slot ? slot.name : '—';
      btn.appendChild(name);

      btn.addEventListener('click', () => handleSlotClick(i, slot));
      grid.appendChild(btn);
    }

    const controls = document.createElement('div');
    controls.className = 'slots-controls';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'slot-mode-btn' + (mode === 'save' ? ' active' : '');
    saveBtn.textContent = mode === 'save' ? '× CANCEL' : '+ SAVE TO…';
    saveBtn.addEventListener('click', () => {
      mode = mode === 'save' ? 'load' : 'save';
      render();
    });
    controls.appendChild(saveBtn);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'slot-mode-btn danger' + (mode === 'clear' ? ' active' : '');
    clearBtn.textContent = mode === 'clear' ? '× CANCEL' : 'CLEAR…';
    clearBtn.addEventListener('click', () => {
      mode = mode === 'clear' ? 'load' : 'clear';
      render();
    });
    controls.appendChild(clearBtn);

    const hint = document.createElement('span');
    hint.className = 'slots-hint';
    hint.textContent =
      mode === 'save'  ? 'click a slot to save (you\'ll name it)' :
      mode === 'clear' ? 'click a filled slot to delete it' :
                         'click a filled slot to load it';
    controls.appendChild(hint);

    container.appendChild(controls);
  }

  function handleSlotClick(index, slot) {
    if (mode === 'save') {
      const fallback = slot?.name ?? `Slot ${index + 1}`;
      const userName = window.prompt('Name this pattern:', fallback);
      if (userName === null) {
        mode = 'load';
        render();
        return;
      }
      const name = userName.trim() || fallback;
      saveSlot(index, buildSnapshot(), name);
      mode = 'load';
      render();
      return;
    }

    if (mode === 'clear') {
      if (!slot) {
        mode = 'load';
        render();
        return;
      }
      if (!window.confirm(`Clear slot ${index + 1} ("${slot.name}")?`)) {
        mode = 'load';
        render();
        return;
      }
      clearSlot(index);
      mode = 'load';
      render();
      return;
    }

    // Default mode = load
    if (!slot) return;
    if (!window.confirm(`Load "${slot.name}"? Your current session will be replaced and the page will reload.`)) return;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(slot.data));
    location.reload();
  }

  render();
}
