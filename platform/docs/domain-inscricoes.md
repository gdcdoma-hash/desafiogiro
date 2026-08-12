# Domínio Inscrições — ciclo 1

## Objetivo

Criar o vínculo permanente entre participante, desafio, meta e oferta comercial sem acoplar ainda estoque, financeiro, atividades ou certificados.

## Entidade `registrations`

Cada inscrição possui UUID próprio e referencia:

- `participant_id`: participante;
- `challenge_id`: edição do desafio;
- `goal_id`: meta escolhida;
- `offer_id`: oferta utilizada;
- `occurrence_number`: posição daquela inscrição dentro da mesma oferta para o participante;
- `price_snapshot`: valor da oferta no momento da inscrição;
- `status`: situação operacional;
- timestamps de criação e atualização.

## Estados iniciais

- `PENDING`: criada, ainda não confirmada;
- `CONFIRMED`: inscrição confirmada para participação;
- `COMPLETED`: participação concluída;
- `CANCELLED`: cancelada preservando histórico;
- `EXPIRED`: perdeu validade sem confirmação.

Pagamento será modelado em domínio próprio. Portanto `CONFIRMED` não significa necessariamente que o futuro módulo financeiro tenha liquidado um recebimento; a origem da confirmação será explicitada posteriormente.

## Regras estruturais

1. participante, meta e oferta devem existir;
2. meta e oferta devem pertencer ao mesmo desafio registrado na inscrição;
3. a meta escolhida precisa estar habilitada na oferta;
4. `price_snapshot` é copiado da oferta e não muda se o preço comercial for alterado no futuro;
5. `occurrence_number` é único para participante + oferta;
6. o número de inscrições do participante na oferta não pode ultrapassar `max_per_participant`;
7. inscrição nunca é apagada pelo painel administrativo neste ciclo;
8. `ID_DGMB` não participa das chaves relacionais novas; o vínculo é feito pelo UUID do participante.

## Permissões

- `registrations.read`: consultar inscrições;
- `registrations.manage`: criar e atualizar inscrições.

## Fora deste ciclo

- pagamento e PIX;
- estoque/reserva de medalha;
- aceite e conclusão esportiva detalhada;
- atividades/Strava;
- certificado;
- migração histórica efetiva;
- cancelamento financeiro/reembolso.
