export function initHelp() {
  const modal = document.getElementById('help-modal');
  const openBtn = document.getElementById('info-btn');
  const closeBtn = document.getElementById('help-close');
  const backdrop = modal.querySelector('.modal-backdrop');

  const show = () => modal.classList.remove('hidden');
  const hide = () => modal.classList.add('hidden');

  openBtn.addEventListener('click', show);
  closeBtn.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) hide();
  });
}
