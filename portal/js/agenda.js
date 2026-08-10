(() => {
  const events = [
    { date: '2026-01-11', name: 'Trilha do Padroeiro', city: 'Carutapera' },
    { date: '2026-01-18', name: 'Trilha da Piaba', city: 'Peri Mirim' },
    { date: '2026-03-22', name: 'Trilha do Porto', city: 'Porto Rico do Maranhão' },
    { date: '2026-04-12', name: 'Trilha da Resenha', city: 'Amapá do Maranhão' },
    { date: '2026-04-26', name: 'Trilha Floresta dos Guarás', city: 'Cururupu' },
    { date: '2026-05-03', name: 'Trilha da BR 316', city: 'Governador Nunes Freire' },
    { date: '2026-05-24', name: 'Trilha do Caranguejo', city: 'Cândido Mendes' },
    { date: '2026-06-07', name: 'Trilha Centro Novo Bike', city: 'Centro Novo do Maranhão' },
    { date: '2026-06-28', name: 'Trilha do Anu', city: 'Palmeirândia' },
    { date: '2026-07-05', name: 'Trilha do Ouro', city: 'Godofredo Viana' },
    { date: '2026-07-19', name: 'Trilha do Camarão', city: 'Apicum-Açu' },
    { date: '2026-08-02', name: 'Trilha do Cacau', city: 'São Bento' },
    { date: '2026-09-07', name: 'Passeio Ciclístico', city: 'Cedral' },
    { date: '2026-09-13', name: 'Trilha do Bacuri', city: 'Bacuri' },
    { date: '2026-09-27', name: 'Trilha dos Quilombos', city: 'Mirinzal' },
    { date: '2026-10-11', name: 'Trilha do Açaí', city: 'Luís Domingues' },
    { date: '2026-10-25', name: 'Trilha da Tapiaca', city: 'Santa Helena / Turilândia–Turiaçu' },
    { date: '2026-11-08', name: 'Maraka Trilha', city: 'Maracaçumé' },
    { date: '2026-11-15', name: 'Trilha do Rio Gurupi', city: 'Boa Vista do Gurupi' },
    { date: '2026-11-22', name: 'Trilha do Buriti', city: 'Alcântara' },
    { date: '2026-12-13', name: 'Trilha do JJ', city: 'Pinheiro' }
  ];

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const list = document.querySelector('#association-events');
  const select = document.querySelector('#agenda-month');
  if (!list || !select) return;

  const render = () => {
    const month = select.value;
    const filtered = month === 'todos' ? events : events.filter((event) => new Date(`${event.date}T12:00:00`).getMonth() === Number(month));
    list.innerHTML = '';

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state inline"><span>Sem eventos</span><h3>Nenhuma data cadastrada para este mês.</h3></div>';
      return;
    }

    const grouped = filtered.reduce((acc, event) => {
      const m = new Date(`${event.date}T12:00:00`).getMonth();
      (acc[m] ||= []).push(event);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([monthIndex, monthEvents]) => {
      const group = document.createElement('section');
      group.className = 'month-group';
      group.innerHTML = `<div class="month-heading"><span>${String(Number(monthIndex)+1).padStart(2,'0')}</span><h3>${monthNames[monthIndex]}</h3></div><div class="month-events"></div>`;
      const container = group.querySelector('.month-events');

      monthEvents.forEach((event) => {
        const date = new Date(`${event.date}T12:00:00`);
        const card = document.createElement('article');
        card.className = 'event-card association-event';
        card.innerHTML = `<div class="event-date"><strong>${String(date.getDate()).padStart(2,'0')}</strong><span>${monthNames[date.getMonth()].slice(0,3).toUpperCase()}</span></div><div class="event-info"><span class="event-origin">Evento da associação</span><h4>${event.name}</h4><p>${event.city} — MA</p></div>`;
        container.appendChild(card);
      });

      list.appendChild(group);
    });
  };

  select.addEventListener('change', render);
  render();
})();