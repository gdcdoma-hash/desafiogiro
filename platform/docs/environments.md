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

### Prévia administrativa

| Variável                        | Visibilidade | Uso                                           |
| ------------------------------- | ------------ | --------------------------------------------- |
| `VITE_SUPABASE_URL`             | pública      | endereço da API do projeto de desenvolvimento |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | pública      | chave de cliente protegida por Auth e RLS     |
| `VITE_PORTAL_GIRO_ENV`          | pública      | identificação visual do ambiente              |
| `VITE_APP_VERSION`              | pública      | versão exibida e registrada na auditoria      |

Nunca configurar `service_role`, chave secreta ou senha do banco com prefixo
`VITE_`, pois esse prefixo inclui o valor no JavaScript enviado ao navegador.
