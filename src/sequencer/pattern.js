// 2D piano-roll pattern. `pitches` is an ordered list of MIDI notes (top row
// first by convention). `cells[row][col]` is one of:
//   null     — empty step
//   'on'     — note triggers at this step
//   'tied'   — continuation of the 'on' that started earlier in the same row;
//              extends the note's gate by one step without re-triggering.
// `notesAtStep(col)` returns each pitch whose cell at `col` is 'on' (ties are
// handled by the scheduler via `tieExtent`).

export class Pattern {
  constructor(numSteps = 16, pitches = [60]) {
    this.numSteps = numSteps;
    this.pitches = pitches.slice();
    this.cells = this.pitches.map(() => new Array(numSteps).fill(null));
  }

  // Default click: cycle null → 'on' → null. Returns the new state.
  toggle(row, col) {
    if (!this.cells[row]) return null;
    this.cells[row][col] = this.cells[row][col] ? null : 'on';
    return this.cells[row][col];
  }

  // Shift-click: flip an existing 'on' ↔ 'tied'. Only meaningful when the cell
  // is already populated AND there's an earlier note in the same row to extend
  // — otherwise a 'tied' cell would never sound. Returns the new state, or
  // null if no change was applied.
  toggleTie(row, col) {
    const cells = this.cells[row];
    if (!cells) return null;
    const cur = cells[col];
    if (cur === 'on') {
      if (col === 0) return cur; // first column can't tie back to anything
      const prev = cells[col - 1];
      if (prev !== 'on' && prev !== 'tied') return cur; // nothing to extend
      cells[col] = 'tied';
    } else if (cur === 'tied') {
      cells[col] = 'on';
    } else {
      return null; // empty cell — ignore shift-click
    }
    return cells[col];
  }

  setCell(row, col, value) {
    if (!this.cells[row]) return;
    if (value === 'on' || value === 'tied') this.cells[row][col] = value;
    else if (value === true)  this.cells[row][col] = 'on';
    else this.cells[row][col] = null;
  }

  isOn(row, col) {
    return !!this.cells[row]?.[col];
  }

  cellAt(row, col) {
    return this.cells[row]?.[col] ?? null;
  }

  // How many 'tied' cells immediately follow the 'on' at (row, col)? Does not
  // wrap across the pattern boundary — a tie at the start of the next loop is
  // treated as a fresh note. Returns 0 when nothing follows.
  tieExtent(row, col) {
    const cells = this.cells[row];
    if (!cells) return 0;
    let count = 0;
    for (let c = col + 1; c < this.numSteps && cells[c] === 'tied'; c++) count++;
    return count;
  }

  notesAtStep(col) {
    const notes = [];
    for (let r = 0; r < this.cells.length; r++) {
      if (this.cells[r][col] === 'on') notes.push(this.pitches[r]);
    }
    return notes;
  }

  clear() {
    this.cells.forEach(row => row.fill(null));
  }

  setLength(numSteps) {
    if (numSteps === this.numSteps) return;
    if (numSteps > this.numSteps) {
      const pad = numSteps - this.numSteps;
      for (const row of this.cells) for (let i = 0; i < pad; i++) row.push(null);
    } else {
      for (const row of this.cells) row.length = numSteps;
    }
    this.numSteps = numSteps;
  }
}
