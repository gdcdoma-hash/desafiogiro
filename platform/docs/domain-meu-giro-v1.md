# Meu Giro V1 básico

## Objetivo

O Meu Giro V1 apresenta ao participante autenticado a inscrição do desafio em
foco, sua meta, quilômetros realizados e restantes, percentual e situação. A
inscrição aparece mesmo antes da primeira atividade. Quando há inscrição no mês
corrente, ela tem prioridade sobre desafios antigos incompletos.

## Modelo e competência

`participant_activities` vincula cada atividade ao participante e à inscrição.
O registro preserva simultaneamente:

- o instante (`started_at`);
- o início civil no local do desafio (`started_local_at` e `timezone`);
- o mês de competência derivado do início local (`competence_month`).

Assim, um longão iniciado às 23h30 no último dia do mês continua pertencendo
àquele mês, ainda que termine no mês seguinte. A atividade deve começar dentro
do período esportivo do desafio e o participante deve ser o titular da
inscrição.

## Contingência administrativa

Usuários com `activities.manage` registram atividades manuais pelo painel. O
RPC `record_manual_activity` converte o horário civil usando o fuso do desafio,
valida o vínculo e o período e grava `activity.manual.created` na auditoria. A
UI usa somente a chave pública do Supabase; `service_role` não é exposta.

## Acesso do participante

`participant_user_links` associa a conta autenticada ao cadastro. RLS limita a
leitura de atividades ao próprio participante. `my_giro()` é uma consulta
`security definer` que resolve o participante autenticado e nunca aceita um ID
de participante informado pelo cliente, evitando consulta cruzada.

## Preparação para Strava e limitações

O modelo reserva `source_code = STRAVA` e `external_id` único para uma futura
sincronização idempotente. Esta versão **não** implementa OAuth, chamadas à API,
webhooks, importação ou reconciliação do Strava. Também não altera GAS/Sheets,
não migra dados reais e usa apenas fixtures fictícias nos testes.

Atividades manuais não podem ser excluídas pelo frontend na V1. Correções
operacionais futuras devem adotar estorno/versionamento auditável em vez de
apagar histórico.
