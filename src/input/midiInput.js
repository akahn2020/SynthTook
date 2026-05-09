// Web MIDI input. Routes parsed Note On / Note Off into the voice manager.
// Treats Note On with velocity 0 as Note Off (controllers like the Keystation
// often send these instead of explicit Note Off messages).

export async function initMidiInput(voiceManager, dropdownEl) {
  if (!navigator.requestMIDIAccess) {
    dropdownEl.innerHTML = '<option>Web MIDI not supported (use Chrome/Edge)</option>';
    dropdownEl.disabled = true;
    return;
  }

  let access;
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
  } catch (err) {
    dropdownEl.innerHTML = `<option>MIDI access denied: ${err.name}</option>`;
    dropdownEl.disabled = true;
    return;
  }

  let activeInput = null;

  const populate = () => {
    const previous = activeInput?.id ?? '';
    dropdownEl.innerHTML = '<option value="">— select MIDI input —</option>';
    for (const input of access.inputs.values()) {
      const opt = document.createElement('option');
      opt.value = input.id;
      opt.textContent = input.name || input.id;
      dropdownEl.appendChild(opt);
    }
    if (previous && access.inputs.has(previous)) {
      dropdownEl.value = previous;
    } else if (access.inputs.size === 1) {
      dropdownEl.value = [...access.inputs.values()][0].id;
      dropdownEl.dispatchEvent(new Event('change'));
    }
  };

  dropdownEl.addEventListener('change', () => {
    if (activeInput) activeInput.onmidimessage = null;
    activeInput = null;
    voiceManager.allOff();

    const id = dropdownEl.value;
    if (!id) return;
    const input = access.inputs.get(id);
    if (!input) return;
    activeInput = input;
    input.onmidimessage = (e) => handleMidiMessage(e.data, voiceManager);
  });

  access.onstatechange = populate;
  populate();
}

function handleMidiMessage(data, voiceManager) {
  if (!data || data.length < 2) return;
  const status = data[0] & 0xf0;
  if (status === 0x90) {
    const note = data[1];
    const vel = data[2] ?? 0;
    if (vel === 0) voiceManager.noteOff(note);
    else voiceManager.noteOn(note, vel);
  } else if (status === 0x80) {
    voiceManager.noteOff(data[1]);
  }
  // Other messages (CC, pitch bend, aftertouch) ignored in Phase 1.
}
