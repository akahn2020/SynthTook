// 2D piano-roll pattern. `pitches` is an ordered list of MIDI notes (top row
// first by convention). `cells[row][col]` is true when that pitch is active on
// that step. `notesAtStep(col)` returns the chord (zero or more pitches) that
// the scheduler should fire at step `col`.

export class Pattern {
  constructor(numSteps = 16, pitches = [60]) {
    this.numSteps = numSteps;
    this.pitches = pitches.slice();
    this.cells = this.pitches.map(() => new Array(numSteps).fill(false));
  }

  toggle(row, col) {
    if (!this.cells[row]) return false;
    this.cells[row][col] = !this.cells[row][col];
    return this.cells[row][col];
  }

  setCell(row, col, on) {
    if (!this.cells[row]) return;
    this.cells[row][col] = !!on;
  }

  isOn(row, col) {
    return !!this.cells[row]?.[col];
  }

  notesAtStep(col) {
    const notes = [];
    for (let r = 0; r < this.cells.length; r++) {
      if (this.cells[r][col]) notes.push(this.pitches[r]);
    }
    return notes;
  }

  clear() {
    this.cells.forEach(row => row.fill(false));
  }
}
