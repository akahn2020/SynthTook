// Drum-params editor. A 3-tab selector (KICK / SNARE / HAT) drives a slider
// list for the active drum. Slider edits write into params.drumParams; the
// DrumKit reads that object on every trigger so changes apply to the next hit.

import { mapValue, unmapValue, fmt } from './sliderUtils.js';

const DRUM_DEFS = [
  {
    key: 'kick', label: 'KICK', items: [
      { path: 'startFreq',  label: 'PITCH',   min: 60,    max: 400, curve: 'exp', format: 'hz' },
      { path: 'endFreq',    label: 'BOTTOM',  min: 20,    max: 200, curve: 'exp', format: 'hz' },
      { path: 'pitchDecay', label: 'P.DECAY', min: 0.02,  max: 0.5, curve: 'exp', format: 'time' },
      { path: 'ampDecay',   label: 'DECAY',   min: 0.05,  max: 1.0, curve: 'exp', format: 'time' },
    ],
  },
  {
    key: 'snare', label: 'SNARE', items: [
      { path: 'hpFreq',     label: 'TONE',    min: 200,   max: 6000, curve: 'exp', format: 'hz' },
      { path: 'bodyFreq',   label: 'BODY',    min: 80,    max: 600,  curve: 'exp', format: 'hz' },
      { path: 'noiseDecay', label: 'N.DECAY', min: 0.04,  max: 0.6,  curve: 'exp', format: 'time' },
      { path: 'bodyDecay',  label: 'B.DECAY', min: 0.02,  max: 0.4,  curve: 'exp', format: 'time' },
    ],
  },
  {
    key: 'hat', label: 'HAT', items: [
      { path: 'hpFreq', label: 'TONE',  min: 2000, max: 14000, curve: 'exp', format: 'hz' },
      { path: 'decay', label: 'DECAY', min: 0.01, max: 0.3,   curve: 'exp', format: 'time' },
    ],
  },
];

export function initDrumControls(params, container, triggerSave) {
  const save = triggerSave || (() => {});

  const groupEl = document.createElement('div');
  groupEl.className = 'control-group';

  const heading = document.createElement('h3');
  heading.textContent = 'DRUM SOUND';
  groupEl.appendChild(heading);

  // Drum selector — 3-button row
  const selRow = document.createElement('div');
  selRow.className = 'wave-row drum-sel-row';
  const selBtns = [];
  let activeKey = DRUM_DEFS[0].key;
  for (const d of DRUM_DEFS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wave-btn' + (d.key === activeKey ? ' active' : '');
    btn.textContent = d.label;
    btn.dataset.key = d.key;
    btn.addEventListener('click', () => {
      activeKey = d.key;
      selBtns.forEach(b => b.classList.toggle('active', b.dataset.key === activeKey));
      renderSliders();
    });
    selRow.appendChild(btn);
    selBtns.push(btn);
  }
  groupEl.appendChild(selRow);

  // Slider container (rebuilt on selector change)
  const sliderHolder = document.createElement('div');
  groupEl.appendChild(sliderHolder);

  function renderSliders() {
    sliderHolder.innerHTML = '';
    const def = DRUM_DEFS.find(d => d.key === activeKey);
    const drumParams = params.drumParams[def.key];

    for (const item of def.items) {
      const row = document.createElement('label');
      row.className = 'slider-row';

      const labelEl = document.createElement('span');
      labelEl.textContent = item.label;
      row.appendChild(labelEl);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.001';
      input.value = String(unmapValue(drumParams[item.path], item.min, item.max, item.curve));
      row.appendChild(input);

      const valueEl = document.createElement('span');
      valueEl.className = 'slider-value';
      valueEl.textContent = fmt(drumParams[item.path], item.format);
      row.appendChild(valueEl);

      input.addEventListener('input', () => {
        const v = mapValue(Number(input.value), item.min, item.max, item.curve);
        drumParams[item.path] = v;
        valueEl.textContent = fmt(v, item.format);
        save();
      });

      sliderHolder.appendChild(row);
    }
  }

  renderSliders();
  container.appendChild(groupEl);
}
