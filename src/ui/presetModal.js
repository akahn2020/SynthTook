// Factory preset library modal. List of presets on the left; description and
// LOAD button on the right. Loading writes the preset's data into the autosave
// key and reloads the page — same path used by user slots, so every UI surface
// repopulates via the standard restore flow in main.js.

import { FACTORY_PRESETS } from '../presets.js';
import { replaceSession } from '../persistence.js';

export function initPresetModal() {
  const modal     = document.getElementById('preset-modal');
  const closeBtn  = document.getElementById('preset-close');
  const backdrop  = modal.querySelector('.modal-backdrop');
  const listEl    = document.getElementById('preset-list');
  const titleEl   = document.getElementById('preset-detail-title');
  const descEl    = document.getElementById('preset-detail-desc');
  const metaEl    = document.getElementById('preset-detail-meta');
  const loadBtn   = document.getElementById('preset-load');

  let selectedIndex = 0;

  function renderList() {
    listEl.innerHTML = '';
    for (let i = 0; i < FACTORY_PRESETS.length; i++) {
      const p = FACTORY_PRESETS[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-list-item' + (i === selectedIndex ? ' active' : '');
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        selectedIndex = i;
        renderList();
        renderDetail();
      });
      listEl.appendChild(btn);
    }
  }

  function renderDetail() {
    const p = FACTORY_PRESETS[selectedIndex];
    titleEl.textContent = p.name;
    descEl.textContent = p.description;

    const lead = p.data.leadTracks[0];
    const params = lead.params;
    metaEl.innerHTML = '';
    const meta = [
      ['BPM',  p.data.bpm],
      ['Wave', params.wave.toUpperCase()],
      ['Cutoff',     `${Math.round(params.filter.cutoff)} Hz`],
      ['Resonance',  params.filter.resonance.toFixed(1)],
      ['Filter env', `${Math.round(params.filterEnv.amount)} Hz`],
      ['Amp ADSR',   `${fmtMs(params.amp.attack)} / ${fmtMs(params.amp.decay)} / ${params.amp.sustain.toFixed(2)} / ${fmtMs(params.amp.release)}`],
    ];
    for (const [label, value] of meta) {
      const row = document.createElement('div');
      row.className = 'preset-meta-row';
      const k = document.createElement('span'); k.className = 'preset-meta-key';   k.textContent = label;
      const v = document.createElement('span'); v.className = 'preset-meta-value'; v.textContent = value;
      row.appendChild(k); row.appendChild(v);
      metaEl.appendChild(row);
    }
  }

  function fmtMs(seconds) {
    return seconds >= 1 ? `${seconds.toFixed(2)}s` : `${Math.round(seconds * 1000)}ms`;
  }

  function show() {
    selectedIndex = 0;
    renderList();
    renderDetail();
    modal.classList.remove('hidden');
  }
  function hide() { modal.classList.add('hidden'); }

  closeBtn.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) hide();
  });

  loadBtn.addEventListener('click', async () => {
    const p = FACTORY_PRESETS[selectedIndex];
    if (!window.confirm(`Load "${p.name}"? Your current session will be replaced and the page will reload.`)) return;
    await replaceSession(p.data);
    location.reload();
  });

  return { show, hide };
}
