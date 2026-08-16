# Portal Giro V1 — smoke test remoto

Use somente a prévia remota isolada e dados fictícios.

## Dados de teste

- nome: `TESTE PORTAL GIRO V1`
- telefone: número fictício válido no formato E.164 que não pertença a participante real
- cidade/UF: valor fictício coerente
- REF: código de teste conhecido no ambiente

## Sequência

1. confirmar que o catálogo público carrega oferta e meta válidas;
2. enviar a pré-inscrição uma única vez e registrar o horário;
3. tentar repetir a mesma solicitação enquanto ela estiver pendente e confirmar bloqueio da duplicidade;
4. no painel administrativo, localizar a solicitação pelo nome/telefone;
5. processar e conferir `PROCESSED`;
6. conferir exatamente um participante ativo para o telefone;
7. conferir uma inscrição `PENDING` com o preço exibido na oferta;
8. conferir um pagamento PIX `PENDING` com o mesmo valor;
9. confirmar o pagamento;
10. conferir pagamento `CONFIRMED`, `paid_at` preenchido e inscrição `CONFIRMED` quando o total confirmado alcançar o preço;
11. conferir reserva de estoque; ausência de estoque não pode desfazer o pagamento nem corromper a inscrição;
12. sair do painel, entrar novamente e repetir a consulta;
13. validar em viewport de celular que fila, inscrição e pagamento continuam utilizáveis.

## Falha bloqueadora

Bloquear a promoção se ocorrer qualquer um destes casos:

- duplicação de participante/inscrição/pagamento;
- preço da inscrição diferente do preço apresentado na oferta sem regra explícita;
- pagamento confirmado sem persistir após recarregar;
- inscrição inconsistente após confirmação financeira;
- acesso administrativo sem permissão;
- erro de banco que exija edição manual para recuperar integridade;
- impossibilidade de voltar à publicação anterior.

Registre o commit testado, data, ambiente e resultado antes da promoção.
