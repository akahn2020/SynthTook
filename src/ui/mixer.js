// 5-channel mixer: LEAD, KICK, SNARE, HAT, MASTER. Each strip = volume slider
// (0..1) + MUTE button. Mute zeros the GainNode but preserves the underlying
// volume in params, so dragging the slider while muted "pre-stages" the level
// for unmute (standard mixer behavior).

import { fmt } from './sliderUtils.js';

const CHANNELS = [
  { key: 'lead',   label: 'LEAD'   },
  { key: 'kick',   label: 'KICK'   },
  { key: 'snare',  label: 'SNARE'  },
  { key: 'hat',    label: 'HAT'    },
  { key: 'master', label: 'MASTER' },
];

export function applyMixerToGains(params, gainNodes) {
  for (const { key } of CHANNELS) {
    const cfg = params.mixer[key];
    const gain = gainNodes[key];
    if (!gain) continue;
    gain.gain.value = cfg.muted ? 0 : cfg.volume;
  }
}

export function initMixer({ params, gainNodes, container, triggerSave }) {
  const save = triggerSave || (() => {});
  container.innerHTML = '';

  const heading = document.createElement('h3');
  heading.className = 'mixer-heading';
  heading.textContent = 'MIXER';
  container.appendChild(heading);

  const strips = document.createElement('div');
  strips.className = 'mixer-strips';
  container.appendChild(strips);

  for (const { key, label } of CHANNELS) {
    const cfg = params.mixer[key];
    const gain = gainNodes[key];

    const strip = document.createElement('div');
    strip.className = 'mixer-strip' + (cfg.muted ? ' muted' : '') + (key === 'master' ? ' is-master' : '');

    const labelEl = document.createElement('div');
    labelEl.className = 'mixer-label';
    labelEl.textContent = label;
    strip.appendChild(labelEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.001';
    slider.value = String(cfg.volume);
    strip.appendChild(slider);

    const valueEl = document.createElement('div');
    valueEl.className = 'mixer-value';
    valueEl.textContent = fmt(cfg.volume, 'percent');
    strip.appendChild(valueEl);

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'mute-btn' + (cfg.muted ? ' muted' : '');
    muteBtn.textContent = 'MUTE';
    strip.appendChild(muteBtn);

    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      cfg.volume = v;
      if (!cfg.muted) gain.gain.value = v;
      valueEl.textContent = fmt(v, 'percent');
      save();
    });

    muteBtn.addEventListener('click', () => {
      cfg.muted = !cfg.muted;
      gain.gain.value = cfg.muted ? 0 : cfg.volume;
      strip.classList.toggle('muted', cfg.muted);
      muteBtn.classList.toggle('muted', cfg.muted);
      save();
    });

    strips.appendChild(strip);
  }
}
