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
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const monthSelect = document.querySelector('#association-month');
  const citySelect = document.querySelector('#association-city');
  const clearButton = document.querySelector('#association-clear');
  const list = document.querySelector('#association-events');
  const count = document.querySelector('#association-result-count');
  const description = document.querySelector('#association-result-description');
  if (!monthSelect || !citySelect || !list) return;

  let initialPositionApplied = false;

  months.forEach((month, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  [...new Set(events.map((event) => event.city))].sort((a,b) => a.localeCompare(b,'pt-BR')).forEach((city) => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    citySelect.appendChild(option);
  });

  const atStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const getTemporalStatus = (date) => {
    const today = atStartOfDay(new Date());
    const eventDay = atStartOfDay(date);

    if (eventDay.getTime() === today.getTime()) {
      return { key: 'today', label: 'Hoje' };
    }

    if (eventDay < today) {
      return { key: 'past', label: 'Passado' };
    }

    return { key: 'future', label: 'Futuro' };
  };

  const positionAtFirstActiveEvent = () => {
    if (initialPositionApplied) return;
    initialPositionApplied = true;

    const firstActive = list.querySelector('.status-today, .status-future');
    if (!firstActive) return;

    requestAnimationFrame(() => {
      firstActive.scrollIntoView({ behavior: 'auto', block: 'center' });
    });
  };

  const render = () => {
    const selectedMonth = monthSelect.value;
    const selectedCity = citySelect.value;
    const filtered = events.filter((event) => {
      const date = new Date(`${event.date}T12:00:00`);
      const byMonth = selectedMonth === 'todos' || date.getMonth() === Number(selectedMonth);
      const byCity = selectedCity === 'todas' || event.city === selectedCity;
      return byMonth && byCity;
    });

    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'evento' : 'eventos'}`;
    const labels = [];
    if (selectedMonth !== 'todos') labels.push(months[Number(selectedMonth)]);
    if (selectedCity !== 'todas') labels.push(selectedCity);
    description.textContent = labels.length ? labels.join(' • ') : 'Calendário completo de 2026';
    list.innerHTML = '';

    if (!filtered.length) {
      list.innerHTML = '<div class="association-empty">Nenhum evento encontrado com estes filtros.</div>';
      return;
    }

    const grouped = filtered.reduce((acc,event) => {
      const month = new Date(`${event.date}T12:00:00`).getMonth();
      (acc[month] ||= []).push(event);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([monthIndex, monthEvents]) => {
      const group = document.createElement('section');
      group.className = 'association-month-group';
      group.innerHTML = `<div class="association-month-heading"><span>${String(Number(monthIndex)+1).padStart(2,'0')}</span><h3>${months[monthIndex]}</h3></div><div class="association-month-events"></div>`;
      const container = group.querySelector('.association-month-events');
      monthEvents.forEach((event) => {
        const date = new Date(`${event.date}T12:00:00`);
        const status = getTemporalStatus(date);
        const card = document.createElement('article');
        card.className = `association-event-card status-${status.key}`;
        card.innerHTML = `<div class="association-event-date"><strong>${String(date.getDate()).padStart(2,'0')}</strong><span>${months[date.getMonth()].slice(0,3).toUpperCase()}</span></div><div class="association-event-info"><div class="event-badges"><span class="origin">Calendário da associação</span><span class="temporal-status ${status.key}">${status.label}</span></div><h4>${event.name}</h4><p>${event.city} — MA</p></div>`;
        container.appendChild(card);
      });
      list.appendChild(group);
    });

    if (selectedMonth === 'todos' && selectedCity === 'todas') {
      positionAtFirstActiveEvent();
    }
  };

  monthSelect.addEventListener('change', render);
  citySelect.addEventListener('change', render);
  clearButton.addEventListener('click', () => {
    monthSelect.value = 'todos';
    citySelect.value = 'todas';
    render();
  });
  render();
})();