# Portal Giro V1 — checklist de liberação

Este checklist é o gate mínimo da entrega acelerada da V1. Ele não substitui testes automatizados nem autoriza alteração de produção por si só.

## Automatizado e já coberto no repositório

- `Foundation checks`: formatação, lint, typecheck, testes, build, recriação integral do Supabase local e PgTAP.
- fluxo vertical de pré-inscrição pública: solicitação anônima, fila administrativa, processamento, participante, inscrição e pagamento PIX pendente (`0066_v1_public_registration_core_flow.sql`).
- confirmação financeira e estoque: confirmação do pagamento, confirmação da inscrição quando o total pago atinge o preço, tentativa de reserva, saldo disponível e liberação da reserva em cancelamento (`0008_payment_confirmation_reservations.sql` e testes posteriores de desacoplamento/reconciliação).
- RLS/RBAC e grants administrativos e anônimos cobertos pelos testes de segurança existentes.

## Gate de prévia remota

Executar em ambiente de desenvolvimento remoto, nunca no GAS/Sheets de produção:

1. abrir a página pública em desktop e celular;
2. enviar uma pré-inscrição fictícia;
3. confirmar que a solicitação aparece na fila administrativa;
4. processar a solicitação e confirmar criação de participante, inscrição `PENDING` e pagamento `PENDING`;
5. confirmar o pagamento fictício e conferir inscrição `CONFIRMED`;
6. conferir a situação da reserva de estoque e, se faltar estoque, confirmar que a inscrição permanece consistente e aparece para reconciliação;
7. validar busca/filtros dos painéis de participantes, inscrições e pagamentos;
8. sair e entrar novamente no painel;
9. validar que conta sem permissão administrativa não acessa dados administrativos.

## Gate antes de produção

Obrigatório antes de alterar domínio, rota pública ou desligar qualquer fluxo legado:

- identificar o commit exato candidato à produção;
- `Foundation checks` verde nesse commit/PR;
- backup do banco remoto atual e procedimento de restauração conferido;
- variáveis definitivas configuradas sem `service_role` no frontend;
- URLs de autenticação/recovery conferidas para o domínio definitivo;
- smoke test remoto aprovado em desktop e celular;
- plano de rollback: restaurar a publicação anterior e manter GAS/Sheets operacionais enquanto houver necessidade de reversão;
- autorização explícita do responsável para o corte de produção.

## Regra de rollback da V1

Se surgir erro que possa criar inscrição/pagamento inconsistente, impedir acesso administrativo ou comprometer estoque, interromper novas operações no novo portal e restaurar a publicação anterior. Não apagar nem alterar o legado durante o rollback.

## Fora do gate da V1

Não bloqueiam a primeira liberação, salvo se causarem falha no fluxo principal:

- completar todas as primitivas de migração histórica;
- Meu Giro/Strava completo;
- automações financeiras avançadas;
- refinamentos cosméticos;
- módulos novos sem impacto na inscrição e operação atual.
