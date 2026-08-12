# Pagamentos — Ciclo 1

## Objetivo

Criar uma camada própria para registrar pagamentos vinculados a inscrições sem acoplar ainda PIX automático, conciliação bancária, estoque ou financeiro.

## Decisões técnicas deste ciclo

- Um pagamento pertence a uma inscrição.
- Uma inscrição pode ter mais de um registro de pagamento/tentativa.
- O valor, método e referência externa ficam imutáveis após a criação.
- Estados iniciais: `PENDING`, `CONFIRMED` e `CANCELLED`.
- Confirmação registra `paid_at` automaticamente quando não informado.
- Estados finais não são reabertos neste ciclo.
- O módulo não altera automaticamente o status da inscrição. Essa integração será tratada separadamente para não esconder regra de negócio dentro do domínio financeiro.
- `method_code` é extensível; este ciclo não impõe uma lista fechada de meios de pagamento.

## Segurança

- Leitura exige `payments.read`.
- Inclusão e atualização exigem `payments.manage`.
- Anônimos não recebem acesso à tabela.
- Exclusão não é concedida ao perfil autenticado.

## Fora deste ciclo

- geração e expiração de chaves PIX;
- integração com banco/gateway;
- baixa automática da inscrição;
- estorno;
- contas a receber/caixa;
- vínculo com estoque de medalhas.
