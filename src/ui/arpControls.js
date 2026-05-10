// Arpeggiator control group: ON/OFF toggle, mode, rate, gate.
// Renders as a standard .control-group appended to #controls-section.

import { mapValue, unmapValue, fmt } from './sliderUtils.js';

const MODES = [
  { value: 'up',     label: 'UP'  },
  { value: 'down',   label: 'DN'  },
  { value: 'updown', label: 'UD'  },
  { value: 'random', label: 'RND' },
];

const RATES = [
  { value: 4,  label: '1/4'  },
  { value: 8,  label: '1/8'  },
  { value: 16, label: '1/16' },
  { value: 32, label: '1/32' },
];

export function initArpControls(arpeggiator, params, container, triggerSave) {
  const save = triggerSave || (() => {});
  const arp = params.arp;

  const groupEl = document.createElement('div');
  groupEl.className = 'control-group';

  const heading = document.createElement('h3');
  heading.textContent = 'ARP';
  groupEl.appendChild(heading);

  // ON/OFF toggle — single full-width button styled like a wave-btn
  const toggleRow = document.createElement('div');
  toggleRow.className = 'arp-toggle-row';
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'wave-btn arp-toggle' + (arp.enabled ? ' active' : '');
  toggleBtn.textContent = arp.enabled ? 'ON' : 'OFF';
  toggleBtn.addEventListener('click', () => {
    const next = !arp.enabled;
    arpeggiator.setEnabled(next);
    toggleBtn.classList.toggle('active', next);
    toggleBtn.textContent = next ? 'ON' : 'OFF';
    save();
  });
  toggleRow.appendChild(toggleBtn);
  groupEl.appendChild(toggleRow);

  // Mode buttons
  const modeRow = document.createElement('div');
  modeRow.className = 'wave-row';
  const modeButtons = [];
  for (const m of MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wave-btn' + (arp.mode === m.value ? ' active' : '');
    btn.textContent = m.label;
    btn.dataset.mode = m.value;
    btn.addEventListener('click', () => {
      arpeggiator.setMode(m.value);
      arp.mode = m.value;
      modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === m.value));
      save();
    });
    modeRow.appendChild(btn);
    modeButtons.push(btn);
  }
  groupEl.appendChild(modeRow);

  // Rate buttons
  const rateRow = document.createElement('div');
  rateRow.className = 'wave-row';
  const rateButtons = [];
  for (const r of RATES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wave-btn' + (arp.rate === r.value ? ' active' : '');
    btn.textContent = r.label;
    btn.dataset.rate = String(r.value);
    btn.addEventListener('click', () => {
      arpeggiator.setRate(r.value);
      arp.rate = r.value;
      rateButtons.forEach(b => b.classList.toggle('active', Number(b.dataset.rate) === r.value));
      save();
    });
    rateRow.appendChild(btn);
    rateButtons.push(btn);
  }
  groupEl.appendChild(rateRow);

  // Gate slider (0.05 .. 1.0)
  const gateRow = document.createElement('label');
  gateRow.className = 'slider-row';
  const labelEl = document.createElement('span');
  labelEl.textContent = 'GATE';
  gateRow.appendChild(labelEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.001';
  input.value = String(unmapValue(arp.gate, 0.05, 1, 'lin'));
  gateRow.appendChild(input);

  const valueEl = document.createElement('span');
  valueEl.className = 'slider-value';
  valueEl.textContent = fmt(arp.gate, 'unit');
  gateRow.appendChild(valueEl);

  input.addEventListener('input', () => {
    const v = mapValue(Number(input.value), 0.05, 1, 'lin');
    arp.gate = v;
    arpeggiator.setGate(v);
    valueEl.textContent = fmt(v, 'unit');
    save();
  });
  groupEl.appendChild(gateRow);

  container.appendChild(groupEl);
}
