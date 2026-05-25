// Inline text-input dialog. Replaces window.prompt() which is disabled in
// Electron (Chromium blocks it by default — it returns null without showing
// any UI). Uses the existing .modal / .modal-panel CSS classes so it matches
// the help and preset modals visually.
//
// Returns a Promise that resolves to the entered string (Enter or OK) or
// null (Esc, Cancel, backdrop click).

export function askName({ title = 'NAME PATTERN', label = 'Pattern name', defaultValue = '', okText = 'SAVE', cancelText = 'CANCEL' } = {}) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-panel" style="max-width: 420px; padding: 28px 32px;">
        <h2 style="margin-bottom: 18px;">${title}</h2>
        <label style="display:block; font-size:11px; letter-spacing:2px; color:var(--neon-2); margin-bottom:8px;">${label}</label>
        <input type="text"
               class="prompt-modal-input"
               style="width:100%; padding:10px 12px; background:#050308; color:var(--text); border:1px solid var(--neon); border-radius:4px; font-family:inherit; font-size:14px; outline:none; box-sizing:border-box;" />
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:22px;">
          <button type="button" data-act="cancel" style="padding:8px 18px;">${cancelText}</button>
          <button type="button" data-act="ok"     style="padding:8px 18px;">${okText}</button>
        </div>
      </div>
    `;

    const input    = modal.querySelector('.prompt-modal-input');
    const okBtn    = modal.querySelector('[data-act="ok"]');
    const cancelBtn = modal.querySelector('[data-act="cancel"]');
    const backdrop = modal.querySelector('.modal-backdrop');

    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKey, true);
      modal.remove();
      resolve(value);
    };

    function onKey(e) {
      if (e.key === 'Enter')   { e.preventDefault(); finish(input.value); }
      if (e.key === 'Escape')  { e.preventDefault(); finish(null); }
    }

    input.value = defaultValue;
    okBtn.addEventListener('click',    () => finish(input.value));
    cancelBtn.addEventListener('click', () => finish(null));
    backdrop.addEventListener('click',  () => finish(null));
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(modal);
    // Focus + select after appending so the input is in the DOM.
    input.focus();
    input.select();
  });
}
