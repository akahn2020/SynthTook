// Persistence adapter. In Electron, reads/writes JSON files via the IPC bridge
// exposed at window.synthtookFS. In a plain browser (dev via http-server), falls
// back to localStorage so the same code path keeps working.
//
// All public functions are async — the browser fallback resolves synchronously
// but still returns promises so call sites don't have to branch on environment.
//
// Pattern slots: 1–8, one JSON file per slot on disk; a single packed JSON blob
// in localStorage when in browser mode.

export const AUTOSAVE_VERSION = 4;
const SLOTS_VERSION = 1;
const NUM_SLOTS = 8;
const AUTOSAVE_KEY = 'synthtook:session';
const SLOTS_KEY    = 'synthtook:slots';

const fs = (typeof window !== 'undefined' && window.synthtookFS) || null;

function buildPersistedSnapshot(snapshot) {
  const data = { version: AUTOSAVE_VERSION, ...snapshot };
  if (snapshot.drumPattern) {
    data.drumPattern = { cells: snapshot.drumPattern.cells.map(row => row.slice()) };
  }
  if (snapshot.globalParams) {
    data.globalParams = JSON.parse(JSON.stringify(snapshot.globalParams));
  }
  return data;
}

// --- Session (autosave) ---

export async function saveState(snapshot) {
  try {
    const data = buildPersistedSnapshot(snapshot);
    if (fs) await fs.writeSession(data);
    else    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('SynthTook: save failed', e);
  }
}

export async function loadState() {
  try {
    let data = null;
    if (fs) {
      data = await fs.readSession();
      // One-time migration: lift any pre-existing localStorage session into the
      // disk file so users who previously ran the web build keep their session
      // on first Electron launch.
      if (!data && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.version === AUTOSAVE_VERSION) {
            await fs.writeSession(parsed);
            localStorage.removeItem(AUTOSAVE_KEY);
            data = parsed;
          }
        }
      }
    } else {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      data = raw ? JSON.parse(raw) : null;
    }
    if (!data) return null;
    if (data.version !== AUTOSAVE_VERSION) return null;
    return data;
  } catch (e) {
    console.warn('SynthTook: load failed', e);
    return null;
  }
}

export async function clearSavedState() {
  try {
    if (fs) await fs.clearSession();
    else    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {}
}

// Used by the slot loader and the factory-preset loader: install a previously
// saved snapshot into the session slot, then the caller reloads the page so the
// standard restore path in main.js repopulates every UI surface.
export async function replaceSession(data) {
  if (fs) await fs.writeSession(data);
  else    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
}

// --- Pattern slots ---

function emptySlots() { return new Array(NUM_SLOTS).fill(null); }

function readSlotsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return emptySlots();
    const parsed = JSON.parse(raw);
    if (parsed.version !== SLOTS_VERSION) return emptySlots();
    const slots = parsed.slots ?? [];
    const out = emptySlots();
    for (let i = 0; i < NUM_SLOTS; i++) out[i] = slots[i] ?? null;
    return out;
  } catch {
    return emptySlots();
  }
}

function writeSlotsToLocalStorage(slots) {
  localStorage.setItem(SLOTS_KEY, JSON.stringify({ version: SLOTS_VERSION, slots }));
}

export async function listSlots() {
  if (fs) {
    const raw = await fs.listSlots();
    const out = emptySlots();
    for (let i = 0; i < NUM_SLOTS; i++) out[i] = raw?.[i] ?? null;

    // One-time slot migration from localStorage on first Electron launch.
    if (out.every(s => s === null) && typeof localStorage !== 'undefined') {
      const lsSlots = readSlotsFromLocalStorage();
      if (lsSlots.some(s => s !== null)) {
        for (let i = 0; i < NUM_SLOTS; i++) {
          if (lsSlots[i]) await fs.writeSlot(i, lsSlots[i]);
        }
        localStorage.removeItem(SLOTS_KEY);
        return lsSlots;
      }
    }
    return out;
  }
  return readSlotsFromLocalStorage();
}

export async function saveSlot(index, snapshot, name) {
  const slot = {
    name: name || `Slot ${index + 1}`,
    savedAt: Date.now(),
    data: buildPersistedSnapshot(snapshot),
  };
  if (fs) {
    await fs.writeSlot(index, slot);
  } else {
    const slots = readSlotsFromLocalStorage();
    slots[index] = slot;
    writeSlotsToLocalStorage(slots);
  }
}

export async function loadSlot(index) {
  const slots = await listSlots();
  const slot = slots[index];
  if (!slot || slot.data?.version !== AUTOSAVE_VERSION) return null;
  return slot;
}

export async function clearSlot(index) {
  if (fs) {
    await fs.clearSlot(index);
  } else {
    const slots = readSlotsFromLocalStorage();
    slots[index] = null;
    writeSlotsToLocalStorage(slots);
  }
}

export function debounce(fn, ms = 250) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
