// Builds the transport, lead-track tabs (with per-track length selector), the
// lead piano-roll grid, the drum length selector, and the drum grid.
// Subscribes to leadTracks for active-track changes so the visible lead grid
// always reflects the currently selected track.
//
// Lead grid and drum grid each have their own play-cursor pointer because
// patterns may have different lengths (polymetric playback). The scheduler
// emits a monotonic globalStep; each grid maps it through `% numSteps`.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

const LENGTH_OPTIONS = [8, 16, 32];

function noteName(midi) {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}
function isBlack(midi) {
  return BLACK_PCS.has(midi % 12);
}

function buildLengthSelector(getCurrent, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'length-selector';
  const label = document.createElement('span');
  label.className = 'length-label';
  label.textContent = 'LEN';
  wrap.appendChild(label);
  const buttons = [];
  for (const len of LENGTH_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'len-btn';
    btn.textContent = String(len);
    btn.dataset.len = String(len);
    btn.addEventListener('click', () => onPick(len));
    wrap.appendChild(btn);
    buttons.push(btn);
  }
  function refresh() {
    const cur = getCurrent();
    for (const b of buttons) b.classList.toggle('active', Number(b.dataset.len) === cur);
  }
  refresh();
  return { el: wrap, refresh };
}

export function initPanel({
  leadTracks, drumPattern, scheduler, recorder,
  leadTabsContainer, gridContainer, drumBarContainer, drumGridContainer,
  playBtn, stopBtn, recBtn, clearBtn, bpmInput,
  triggerSave,
}) {
  const save = triggerSave || (() => {});

  // --- Lead-track tabs + lead length selector ---
  const tabButtons = [];
  let leadLenSelector = null;

  function buildLeadTabs() {
    leadTabsContainer.innerHTML = '';
    tabButtons.length = 0;

    const tabsWrap = document.createElement('div');
    tabsWrap.className = 'track-tabs';
    leadTabsContainer.appendChild(tabsWrap);

    for (let i = 0; i < leadTracks.tracks.length; i++) {
      const t = leadTracks.tracks[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lead-tab' + (i === leadTracks.activeIndex ? ' active' : '');
      btn.textContent = t.name;
      btn.addEventListener('click', () => leadTracks.setActive(i));
      tabsWrap.appendChild(btn);
      tabButtons.push(btn);
    }

    leadLenSelector = buildLengthSelector(
      () => leadTracks.active().pattern.numSteps,
      (len) => {
        leadTracks.active().pattern.setLength(len);
        rebuildLeadGrid();
        recorder.refreshCursor();
        leadLenSelector.refresh();
        save();
      }
    );
    leadTabsContainer.appendChild(leadLenSelector.el);
  }
  buildLeadTabs();

  // --- Lead piano-roll grid (rebuilt when active track changes or length changes) ---
  let leadCellEls = [];
  let leadColCells = [];
  let prevLeadPlayStep = -1;
  let prevRecStep = -1;

  function applyCellState(cell, state) {
    cell.classList.toggle('on', state === 'on');
    cell.classList.toggle('tied', state === 'tied');
  }

  function rebuildLeadGrid() {
    const pattern = leadTracks.active().pattern;
    gridContainer.innerHTML = '';
    gridContainer.style.gridTemplateColumns = `40px repeat(${pattern.numSteps}, 1fr)`;
    leadCellEls = [];
    leadColCells = Array.from({ length: pattern.numSteps }, () => []);

    for (let r = 0; r < pattern.pitches.length; r++) {
      const midi = pattern.pitches[r];
      const black = isBlack(midi);

      const label = document.createElement('div');
      label.className = 'roll-label' + (black ? ' black-row' : '');
      label.textContent = noteName(midi);
      gridContainer.appendChild(label);

      const rowEls = [];
      for (let c = 0; c < pattern.numSteps; c++) {
        const cell = document.createElement('div');
        let cls = 'roll-cell';
        if (black) cls += ' black-row';
        if (c % 4 === 0) cls += ' beat-start';
        cell.className = cls;
        applyCellState(cell, pattern.cellAt(r, c));
        cell.addEventListener('click', (e) => {
          if (e.shiftKey) pattern.toggleTie(r, c);
          else pattern.toggle(r, c);
          applyCellState(cell, pattern.cellAt(r, c));
          save();
        });
        gridContainer.appendChild(cell);
        rowEls.push(cell);
        leadColCells[c].push(cell);
      }
      leadCellEls.push(rowEls);
    }

    const c4Row = pattern.pitches.indexOf(60);
    if (c4Row >= 0 && leadCellEls[c4Row]?.[0]) {
      const cell = leadCellEls[c4Row][0];
      gridContainer.scrollTop = cell.offsetTop - gridContainer.clientHeight / 2 + cell.offsetHeight / 2;
    }

    prevLeadPlayStep = -1;
    prevRecStep = -1;
  }
  rebuildLeadGrid();

  // --- Drum length selector + drum grid ---
  let drumCellEls = [];
  let drumColCells = [];
  let prevDrumPlayStep = -1;
  let drumLenSelector = null;

  function buildDrumBar() {
    drumBarContainer.innerHTML = '';
    drumLenSelector = buildLengthSelector(
      () => drumPattern.numSteps,
      (len) => {
        drumPattern.setLength(len);
        rebuildDrumGrid();
        drumLenSelector.refresh();
        save();
      }
    );
    drumBarContainer.appendChild(drumLenSelector.el);
  }

  function rebuildDrumGrid() {
    drumGridContainer.innerHTML = '';
    drumGridContainer.style.gridTemplateColumns = `40px repeat(${drumPattern.numSteps}, 1fr)`;
    drumCellEls = [];
    drumColCells = Array.from({ length: drumPattern.numSteps }, () => []);

    for (let t = 0; t < drumPattern.numTracks; t++) {
      const label = document.createElement('div');
      label.className = 'drum-label';
      label.textContent = drumPattern.labels[t];
      drumGridContainer.appendChild(label);

      const rowEls = [];
      for (let c = 0; c < drumPattern.numSteps; c++) {
        const cell = document.createElement('div');
        let cls = 'drum-cell';
        if (c % 4 === 0) cls += ' beat-start';
        if (drumPattern.isOn(t, c)) cls += ' on';
        cell.className = cls;
        cell.addEventListener('click', () => {
          const on = drumPattern.toggle(t, c);
          cell.classList.toggle('on', on);
          save();
        });
        drumGridContainer.appendChild(cell);
        rowEls.push(cell);
        drumColCells[c].push(cell);
      }
      drumCellEls.push(rowEls);
    }
    prevDrumPlayStep = -1;
  }
  buildDrumBar();
  rebuildDrumGrid();

  function updateColumnCursor(colCells, prevStep, stepIdx, cls) {
    if (prevStep >= 0 && colCells[prevStep]) {
      for (const el of colCells[prevStep]) el.classList.remove(cls);
    }
    if (stepIdx >= 0 && colCells[stepIdx]) {
      for (const el of colCells[stepIdx]) el.classList.add(cls);
    }
  }

  scheduler.onStep = (globalStep, when) => {
    const delayMs = Math.max(0, (when - scheduler.ctx.currentTime) * 1000);
    setTimeout(() => {
      const leadStep = globalStep % leadTracks.active().pattern.numSteps;
      const drumStep = globalStep % drumPattern.numSteps;
      updateColumnCursor(leadColCells, prevLeadPlayStep, leadStep, 'current');
      prevLeadPlayStep = leadStep;
      updateColumnCursor(drumColCells, prevDrumPlayStep, drumStep, 'current');
      prevDrumPlayStep = drumStep;
    }, delayMs);
  };

  recorder.onCursorMove = (step) => {
    updateColumnCursor(leadColCells, prevRecStep, step, 'rec-current');
    prevRecStep = step;
  };

  recorder.onNoteRecorded = (trackIdx, row, col) => {
    if (trackIdx !== leadTracks.activeIndex) return;
    const cell = leadCellEls[row]?.[col];
    if (!cell) return;
    cell.classList.add('on');
    cell.classList.add('flash');
    setTimeout(() => cell.classList.remove('flash'), 180);
    save();
  };

  // --- Active-track change → repaint tabs + lead grid + length selector ---
  leadTracks.onChange(() => {
    for (let i = 0; i < tabButtons.length; i++) {
      tabButtons[i].classList.toggle('active', i === leadTracks.activeIndex);
    }
    rebuildLeadGrid();
    leadLenSelector.refresh();
    recorder.refreshCursor();
  });

  const clearPlayCursors = () => {
    updateColumnCursor(leadColCells, prevLeadPlayStep, -1, 'current');
    prevLeadPlayStep = -1;
    updateColumnCursor(drumColCells, prevDrumPlayStep, -1, 'current');
    prevDrumPlayStep = -1;
  };

  playBtn.addEventListener('click', () => {
    if (!scheduler.isRunning()) {
      scheduler.start();
      recorder.refreshCursor();
    }
  });
  stopBtn.addEventListener('click', () => {
    scheduler.stop();
    clearPlayCursors();
    recorder.refreshCursor();
  });

  recBtn.addEventListener('click', () => {
    recorder.setArmed(!recorder.armed);
    recBtn.classList.toggle('armed', recorder.armed);
  });

  clearBtn.addEventListener('click', () => {
    for (const t of leadTracks.tracks) t.pattern.clear();
    drumPattern.clear();
    rebuildLeadGrid();
    rebuildDrumGrid();
    recorder.resetCursor();
    save();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (!recorder.armed || scheduler.isRunning()) return;
    if (e.code === 'Space' || e.code === 'ArrowRight') {
      e.preventDefault();
      recorder.advance();
    }
  });

  const applyBpm = () => {
    const v = Number(bpmInput.value);
    if (Number.isFinite(v) && v >= 40 && v <= 240) {
      scheduler.setBpm(v);
      save();
    }
  };
  bpmInput.addEventListener('input', applyBpm);
  applyBpm();
}
