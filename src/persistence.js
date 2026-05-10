// Auto-save / auto-restore of the current session (lead tracks, drum pattern,
// global params: mixer / arp / drumParams, BPM, active track) to localStorage.
// Debounced so rapid slider drags don't hit storage on every frame.
//
// Pattern slots (1–8) live alongside the autosave session under a separate
// key. Loading a slot writes its snapshot into the autosave key and reloads
// the page so the standard restore path picks it up — avoids manually
// re-rendering every UI surface.

export const AUTOSAVE_KEY = 'synthtook:session';
const SLOTS_KEY = 'synthtook:slots';
const VERSION = 4;
const SLOTS_VERSION = 1;
const NUM_SLOTS = 8;

function buildPersistedSnapshot(snapshot) {
  const data = { version: VERSION, ...snapshot };
  if (snapshot.drumPattern) {
    data.drumPattern = { cells: snapshot.drumPattern.cells.map(row => row.slice()) };
  }
  if (snapshot.globalParams) {
    data.globalParams = JSON.parse(JSON.stringify(snapshot.globalParams));
  }
  return data;
}

export function saveState(snapshot) {
  try {
    const data = buildPersistedSnapshot(snapshot);
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('SynthTook: save failed', e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== VERSION) return null;
    return data;
  } catch (e) {
    console.warn('SynthTook: load failed', e);
    return null;
  }
}

export function clearSavedState() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
}

function readSlots() {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return new Array(NUM_SLOTS).fill(null);
    const parsed = JSON.parse(raw);
    if (parsed.version !== SLOTS_VERSION) return new Array(NUM_SLOTS).fill(null);
    const slots = parsed.slots ?? [];
    const out = new Array(NUM_SLOTS).fill(null);
    for (let i = 0; i < NUM_SLOTS; i++) out[i] = slots[i] ?? null;
    return out;
  } catch {
    return new Array(NUM_SLOTS).fill(null);
  }
}

function writeSlots(slots) {
  localStorage.setItem(SLOTS_KEY, JSON.stringify({ version: SLOTS_VERSION, slots }));
}

export function listSlots() {
  return readSlots();
}

export function saveSlot(index, snapshot, name) {
  const slots = readSlots();
  slots[index] = {
    name: name || `Slot ${index + 1}`,
    savedAt: Date.now(),
    data: buildPersistedSnapshot(snapshot),
  };
  writeSlots(slots);
}

export function loadSlot(index) {
  const slot = readSlots()[index];
  if (!slot || slot.data?.version !== VERSION) return null;
  return slot;
}

export function clearSlot(index) {
  const slots = readSlots();
  slots[index] = null;
  writeSlots(slots);
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
