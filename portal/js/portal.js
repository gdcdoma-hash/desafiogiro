// Portal Giro V1 — JavaScript isolado de desenvolvimento.

(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');

  if (!toggle || !menu) return;

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    const label = toggle.querySelector('.sr-only');
    if (label) label.textContent = 'Abrir menu';
  };

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    menu.classList.toggle('is-open', !open);
    const label = toggle.querySelector('.sr-only');
    if (label) label.textContent = open ? 'Abrir menu' : 'Fechar menu';
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1060) closeMenu();
  });
})();
