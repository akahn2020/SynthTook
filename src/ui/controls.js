// Slider panel for amp ADSR, filter base, and filter envelope.
// Sliders are 0..1 with optional exponential curve mapping to natural ranges
// (Hz, seconds). Live filter changes update every voice's BiquadFilter
// immediately via voiceManager.setFilterBase / setFilterEnvAmount.

const SLIDER_GROUPS = [
  {
    title: 'AMP ENVELOPE', items: [
      { path: ['amp', 'attack'],  label: 'ATTACK',   min: 0.001, max: 2,  curve: 'exp', format: 'time' },
      { path: ['amp', 'decay'],   label: 'DECAY',    min: 0.01,  max: 2,  curve: 'exp', format: 'time' },
      { path: ['amp', 'sustain'], label: 'SUSTAIN',  min: 0,     max: 1,  curve: 'lin', format: 'unit' },
      { path: ['amp', 'release'], label: 'RELEASE',  min: 0.01,  max: 3,  curve: 'exp', format: 'time' },
    ],
  },
  {
    title: 'FILTER', items: [
      { path: ['filter', 'cutoff'],    label: 'CUTOFF',    min: 50,  max: 12000, curve: 'exp', format: 'hz', live: 'filter' },
      { path: ['filter', 'resonance'], label: 'RESONANCE', min: 0.5, max: 20,    curve: 'exp', format: 'q',  live: 'filter' },
    ],
  },
  {
    title: 'FILTER ENV', items: [
      { path: ['filterEnv', 'amount'], label: 'AMOUNT', min: 0,     max: 6000, curve: 'lin', format: 'hz',   live: 'filterEnvAmount' },
      { path: ['filterEnv', 'attack'], label: 'ATTACK', min: 0.001, max: 1,    curve: 'exp', format: 'time' },
      { path: ['filterEnv', 'decay'],  label: 'DECAY',  min: 0.01,  max: 2,    curve: 'exp', format: 'time' },
    ],
  },
];

function mapValue(t, min, max, curve) {
  if (curve === 'exp') return min * Math.pow(max / min, t);
  return min + t * (max - min);
}
function unmapValue(v, min, max, curve) {
  if (curve === 'exp') return Math.log(v / min) / Math.log(max / min);
  return (v - min) / (max - min);
}

function fmt(v, kind) {
  switch (kind) {
    case 'time': return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
    case 'hz':   return v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(1)} kHz`;
    case 'q':    return v.toFixed(1);
    case 'unit': return v.toFixed(2);
    default:     return String(v);
  }
}

function get(params, path) {
  return path.reduce((o, k) => o[k], params);
}
function set(params, path, value) {
  const last = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((o, k) => o[k], params);
  parent[last] = value;
}

const WAVE_TYPES = [
  { value: 'sine',     label: 'SIN' },
  { value: 'triangle', label: 'TRI' },
  { value: 'square',   label: 'SQR' },
  { value: 'sawtooth', label: 'SAW' },
];

function buildWaveGroup(voiceManager, params) {
  const groupEl = document.createElement('div');
  groupEl.className = 'control-group';

  const heading = document.createElement('h3');
  heading.textContent = 'OSCILLATOR';
  groupEl.appendChild(heading);

  const row = document.createElement('div');
  row.className = 'wave-row';

  const buttons = [];
  for (const w of WAVE_TYPES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wave-btn' + (params.wave === w.value ? ' active' : '');
    btn.textContent = w.label;
    btn.dataset.wave = w.value;
    btn.addEventListener('click', () => {
      params.wave = w.value;
      voiceManager.setWave(w.value);
      buttons.forEach(b => b.classList.toggle('active', b.dataset.wave === w.value));
    });
    row.appendChild(btn);
    buttons.push(btn);
  }

  groupEl.appendChild(row);
  return groupEl;
}

export function initControls(voiceManager, params, container) {
  container.innerHTML = '';
  container.appendChild(buildWaveGroup(voiceManager, params));

  for (const group of SLIDER_GROUPS) {
    const groupEl = document.createElement('div');
    groupEl.className = 'control-group';

    const heading = document.createElement('h3');
    heading.textContent = group.title;
    groupEl.appendChild(heading);

    for (const item of group.items) {
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
      input.value = String(unmapValue(get(params, item.path), item.min, item.max, item.curve));
      row.appendChild(input);

      const valueEl = document.createElement('span');
      valueEl.className = 'slider-value';
      valueEl.textContent = fmt(get(params, item.path), item.format);
      row.appendChild(valueEl);

      input.addEventListener('input', () => {
        const v = mapValue(Number(input.value), item.min, item.max, item.curve);
        set(params, item.path, v);
        valueEl.textContent = fmt(v, item.format);
        if (item.live === 'filter') {
          voiceManager.setFilterBase(params.filter.cutoff, params.filter.resonance);
        } else if (item.live === 'filterEnvAmount') {
          voiceManager.setFilterEnvAmount(params.filterEnv.amount);
        }
      });

      groupEl.appendChild(row);
    }

    container.appendChild(groupEl);
  }
}
