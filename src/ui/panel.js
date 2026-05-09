const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

function noteName(midi) {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}
function isBlack(midi) {
  return BLACK_PCS.has(midi % 12);
}

export function initPanel({
  pattern, scheduler, recorder,
  gridContainer, playBtn, stopBtn, recBtn, clearBtn, bpmInput,
}) {
  gridContainer.innerHTML = '';
  gridContainer.style.gridTemplateColumns = `40px repeat(${pattern.numSteps}, 1fr)`;

  const cellEls = []; // cellEls[row][col]
  const colCells = Array.from({ length: pattern.numSteps }, () => []);

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
      cell.addEventListener('click', () => {
        const on = pattern.toggle(r, c);
        cell.classList.toggle('on', on);
      });
      gridContainer.appendChild(cell);
      rowEls.push(cell);
      colCells[c].push(cell);
    }
    cellEls.push(rowEls);
  }

  let prevPlayStep = -1;
  scheduler.onStep = (stepIdx, when) => {
    const delayMs = Math.max(0, (when - scheduler.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (prevPlayStep >= 0) {
        for (const el of colCells[prevPlayStep]) el.classList.remove('current');
      }
      for (const el of colCells[stepIdx]) el.classList.add('current');
      prevPlayStep = stepIdx;
    }, delayMs);
  };

  let prevRecStep = -1;
  recorder.onCursorMove = (step) => {
    if (prevRecStep >= 0 && prevRecStep < pattern.numSteps) {
      for (const el of colCells[prevRecStep]) el.classList.remove('rec-current');
    }
    if (step >= 0 && step < pattern.numSteps) {
      for (const el of colCells[step]) el.classList.add('rec-current');
    }
    prevRecStep = step;
  };

  recorder.onNoteRecorded = (row, col) => {
    const cell = cellEls[row]?.[col];
    if (!cell) return;
    cell.classList.add('on');
    cell.classList.add('flash');
    setTimeout(() => cell.classList.remove('flash'), 180);
  };

  const clearPlayCursor = () => {
    for (const col of colCells) for (const el of col) el.classList.remove('current');
    prevPlayStep = -1;
  };

  playBtn.addEventListener('click', () => {
    if (!scheduler.isRunning()) {
      scheduler.start();
      recorder.refreshCursor();
    }
  });
  stopBtn.addEventListener('click', () => {
    scheduler.stop();
    clearPlayCursor();
    recorder.refreshCursor();
  });

  recBtn.addEventListener('click', () => {
    recorder.setArmed(!recorder.armed);
    recBtn.classList.toggle('armed', recorder.armed);
  });

  clearBtn.addEventListener('click', () => {
    pattern.clear();
    for (const row of cellEls) for (const cell of row) cell.classList.remove('on');
    recorder.resetCursor();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (!recorder.armed || scheduler.isRunning()) return;
    if (e.code === 'Space') {
      e.preventDefault();
      recorder.advance();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      recorder.advance();
    }
  });

  const applyBpm = () => {
    const v = Number(bpmInput.value);
    if (Number.isFinite(v) && v >= 40 && v <= 240) scheduler.setBpm(v);
  };
  bpmInput.addEventListener('input', applyBpm);
  applyBpm();
}
