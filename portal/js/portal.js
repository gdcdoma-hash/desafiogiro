// Portal Giro V1 — JavaScript isolado de desenvolvimento.

(() => {
  // Padroniza a navegação das páginas internas: sempre oferece um caminho explícito para a Home.
  const internalNav = document.querySelector('.sub-nav');
  if (internalNav) {
    internalNav.classList.add('internal-nav');
    if (!internalNav.querySelector('.internal-home')) {
      const homeLink = document.createElement('a');
      homeLink.className = 'internal-home';
      homeLink.href = '../';
      homeLink.innerHTML = '<span aria-hidden="true">⌂</span> Início';
      internalNav.prepend(homeLink);
    }
  }

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
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu({ returnFocus: true });
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
  document.querySelectorAll('[data-inscricao-link]').forEach((link) => {
    const target = new URL(link.getAttribute('href'), window.location.href);
    currentParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
    link.href = target.href;
  });

  // O destaque principal do cabeçalho pertence sempre ao Desafio Giro.
  const sectionLinks = [...document.querySelectorAll('.main-nav a[href^="#"]')];
  const sections = sectionLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const setCurrent = (id) => {
      sectionLinks.forEach((link) => {
        if (link.classList.contains('nav-cta')) {
          link.setAttribute('aria-current', id === 'desafio-giro' ? 'location' : 'false');
          return;
        }
        if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setCurrent(visible[0].target.id);
    }, { rootMargin: '-96px 0px -58% 0px', threshold: [0.08, 0.2, 0.4] });

    sections.forEach((section) => observer.observe(section));
  }
})();
