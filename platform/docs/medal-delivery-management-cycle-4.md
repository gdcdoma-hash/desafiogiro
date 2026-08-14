# Entrega de medalhas — ciclo 4

Este ciclo adiciona ao painel administrativo os controles para abrir e encerrar o período de entrega de um desafio e criar lotes de distribuição.

O período é aberto pela função `activate_medal_delivery_period`, que cria pendências somente para inscrições confirmadas ou concluídas. Enquanto o período estiver aberto, novas confirmações entram automaticamente no fluxo.

Os lotes podem representar entrega em evento, retirada na loja, Correios ou outro método. Cada lote registra identificação, cidade/UF e a pessoa responsável pelo transporte ou repasse.

A interface de gestão só é exibida para usuários com `medal_deliveries.manage`; a leitura continua disponível conforme `medal_deliveries.read`.
