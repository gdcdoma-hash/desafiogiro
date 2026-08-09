// Portal Giro V1 — JavaScript isolado de desenvolvimento.

(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');

  if (toggle && menu) {
    const label = toggle.querySelector('.sr-only');

    const closeMenu = ({ returnFocus = false } = {}) => {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
      if (label) label.textContent = 'Abrir menu';
      if (returnFocus) toggle.focus();
    };

    const openMenu = () => {
      toggle.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-open');
      if (label) label.textContent = 'Fechar menu';
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeMenu();
      else openMenu();
    });

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu({ returnFocus: true });
      }
    });

    document.addEventListener('click', (event) => {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1060) closeMenu();
    });
  }

  // Preserva parâmetros de origem, especialmente REF, ao sair do Portal para a inscrição.
  const currentParams = new URLSearchParams(window.location.search);
  const inscriptionLinks = document.querySelectorAll('[data-inscricao-link]');

  inscriptionLinks.forEach((link) => {
    const target = new URL(link.getAttribute('href'), window.location.href);

    currentParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });

    link.href = target.href;
  });
})();
