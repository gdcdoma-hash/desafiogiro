(() => {
  const rules = [...document.querySelectorAll('.rule')];
  const index = document.querySelector('#sumario');
  const indexLinks = [...document.querySelectorAll('.rules-index-grid a')];
  const reader = document.querySelector('.rules-list');
  if (!rules.length || !index || !reader) return;

  let current = -1;

  const closeDetails = (rule) => {
    rule.querySelectorAll('details[open]').forEach((item) => item.removeAttribute('open'));
  };

  const updateFixedNav = () => {
    const bar = document.querySelector('[data-rule-bar]');
    if (!bar) return;
    const prev = bar.querySelector('[data-prev]');
    const next = bar.querySelector('[data-next]');
    const count = bar.querySelector('[data-count]');
    count.textContent = current >= 0 ? `${current + 1} de ${rules.length}` : 'Assuntos';
    prev.disabled = current <= 0;
    next.disabled = current < 0 || current >= rules.length - 1;
  };

  const showIndex = () => {
    current = -1;
    rules.forEach((rule) => rule.hidden = true);
    index.hidden = false;
    reader.classList.remove('is-reading');
    document.body.classList.remove('rule-reader-open');
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    updateFixedNav();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const showRule = (position, push = true) => {
    if (position < 0 || position >= rules.length) return;
    current = position;
    index.hidden = true;
    reader.classList.add('is-reading');
    document.body.classList.add('rule-reader-open');
    rules.forEach((rule, i) => {
      rule.hidden = i !== position;
      if (i !== position) closeDetails(rule);
    });
    if (push) history.replaceState(null, '', `#${rules[position].id}`);
    updateFixedNav();
    window.scrollTo({ top: 0, behavior: 'instant' });
    rules[position].querySelector('h2')?.focus({ preventScroll: true });
  };

  const bar = document.createElement('nav');
  bar.className = 'rule-reader-bar';
  bar.setAttribute('aria-label', 'Navegação do regulamento');
  bar.dataset.ruleBar = '';
  bar.innerHTML = '<button type="button" data-prev aria-label="Assunto anterior">← <span>Anterior</span></button><button type="button" class="subjects" data-subjects><span data-count>Assuntos</span><strong>☰ Assuntos</strong></button><button type="button" data-next aria-label="Próximo assunto"><span>Próximo</span> →</button>';
  document.body.appendChild(bar);

  bar.querySelector('[data-prev]').addEventListener('click', () => showRule(current - 1));
  bar.querySelector('[data-next]').addEventListener('click', () => showRule(current + 1));
  bar.querySelector('[data-subjects]').addEventListener('click', showIndex);

  indexLinks.forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const id = link.getAttribute('href').slice(1);
    showRule(rules.findIndex((rule) => rule.id === id));
  }));

  document.querySelectorAll('.rule-nav').forEach((nav) => nav.hidden = true);
  rules.forEach((rule) => {
    const heading = rule.querySelector('h2');
    if (heading) heading.tabIndex = -1;
    rule.querySelectorAll('a[href^="#r"]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      const id = link.getAttribute('href').slice(1);
      showRule(rules.findIndex((item) => item.id === id));
    }));
  });

  const initial = location.hash.match(/^#r(\d+)$/);
  if (initial) showRule(rules.findIndex((rule) => rule.id === location.hash.slice(1)), false);
  else showIndex();
})();