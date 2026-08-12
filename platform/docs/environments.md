# Separação de ambientes

## Local

É o único ambiente executável obrigatório neste ciclo. Usa Docker, Supabase
local e dados fictícios descartáveis.

## Homologação

Quando autorizado, deverá possuir projeto Supabase e Worker próprios, sem
reaproveitar URLs, banco ou segredos de produção. Continuará usando somente
dados fictícios durante o primeiro ciclo.

## Produção

Não será criada nem publicada neste ciclo. Qualquer criação de projeto externo,
alteração de domínio, segredo, deploy ou cobrança exige autorização separada.

## Variáveis

- valores públicos do navegador usam o prefixo `VITE_`;
- segredos nunca recebem o prefixo `VITE_`;
- a chave privilegiada do Supabase não é necessária no navegador;
- `.env`, `.env.local` e `.dev.vars` não entram no Git;
- a inicialização falha quando uma variável obrigatória está ausente.
