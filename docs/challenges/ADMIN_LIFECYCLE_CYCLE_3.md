# Desafios — Ciclo 3: operação administrativa

## Objetivo

Transformar as proteções de ciclo de vida já garantidas pelo banco em ações explícitas do painel administrativo, sem permitir saltos de estado ou alterações estruturais perigosas.

## Estados do desafio

- `DRAFT`: configuração livre de período, metas e ofertas.
- `SCHEDULED`: configuração estrutural bloqueada; edição pronta para entrar em operação.
- `ACTIVE`: desafio em andamento.
- `FINISHED`: encerramento normal.
- `CANCELLED`: encerramento excepcional preservando histórico.
- `ARCHIVED`: estado final de consulta histórica.

## Transições expostas no painel

- Rascunho → Programado: ação `Programar desafio`.
- Programado → Ativo: ação `Ativar desafio`.
- Ativo → Encerrado: ação `Encerrar desafio`.
- Rascunho/Programado/Ativo → Cancelado: ação excepcional, com confirmação explícita.
- Encerrado/Cancelado → Arquivado: ação de organização histórica.

O painel nunca oferece uma transição que o banco não aceite.

## Estados da oferta

- `DRAFT`: configuração livre.
- `SCHEDULED`: pronta para abertura.
- `OPEN`: disponível para inscrições.
- `CLOSED`: encerrada normalmente.
- `DISABLED`: desativada excepcionalmente.

## Transições expostas no painel

- Rascunho → Programada: `Programar oferta`.
- Rascunho/Programada → Aberta: `Abrir oferta`, somente quando o desafio estiver Programado ou Ativo e houver meta vinculada.
- Programada/Aberta → Encerrada: `Encerrar oferta`.
- Rascunho/Programada/Aberta/Encerrada → Desativada: ação excepcional.

## Proteções de interface

1. Ações ficam indisponíveis durante uma operação em andamento.
2. Mensagens de erro do banco são traduzidas para orientação operacional curta.
3. A configuração estrutural é apresentada como bloqueada depois que o desafio sai de rascunho.
4. Cancelamento/desativação devem ser visualmente diferenciados de encerramento normal.
5. Nenhuma ação destrutiva apaga histórico.

## Auditoria

Cada mudança de estado feita pelo painel deve registrar evento de auditoria com o recurso, estado anterior e estado novo. Não registrar dados pessoais ou segredos em metadata.

## Fora deste ciclo

- inscrições reais;
- participantes;
- estoque;
- financeiro;
- automação por relógio para mudar status sem ação administrativa.

Esses itens entram em ciclos próprios e não devem ser acoplados ao domínio Desafios antes das respectivas regras serem consolidadas.
