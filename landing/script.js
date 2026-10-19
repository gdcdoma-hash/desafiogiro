(() => {
  'use strict';
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-nav');
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      menuButton.setAttribute('aria-label', open ? 'Abrir menu' : 'Fechar menu');
      menu.hidden = open;
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      menu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Abrir menu');
    }));
  }

  const dialog = document.querySelector('#image-dialog');
  const image = document.querySelector('#dialog-image');
  const caption = document.querySelector('#dialog-caption');
  let trigger = null;
  function showImage(src, alt, source) {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    trigger = source;
    image.src = src;
    image.alt = alt;
    caption.textContent = alt;
    dialog.showModal();
  }
  document.addEventListener('click', event => { const button=event.target.closest('.gallery-item,#open-gallery'); if(button)showImage(button.dataset.image,button.dataset.alt,button); });
  document.querySelector('#close-dialog')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => { if (trigger) trigger.focus(); });
  document.querySelector('#year').textContent = String(new Date().getFullYear());
})();
