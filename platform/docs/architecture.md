# Arquitetura do primeiro ciclo

## Decisão central

O Portal público atual continua sendo um site estático independente. A nova
fundação nasce em `platform/` e não modifica o funcionamento, as URLs ou o
processo de publicação já existente.

## Componentes

- `apps/admin-web`: interface React/Vite exclusiva para administradores;
- `apps/api`: API TypeScript/Hono compatível com Cloudflare Workers;
- `packages/contracts`: contratos e permissões compartilhados;
- `packages/authorization`: autorização explícita no código;
- `packages/config`: validação da configuração por ambiente;
- `supabase/migrations`: esquema PostgreSQL versionado;
- `scripts`: backup e restauração independentes do painel do provedor.

## Portabilidade

- as migrações usam PostgreSQL;
- o núcleo da API usa Web Standards;
- a interface é compilada como arquivos estáticos;
- credenciais são injetadas por ambiente;
- backups usam ferramentas PostgreSQL;
- nenhuma regra de negócio depende de D1, KV ou R2;
- Supabase Auth e Storage ficam atrás das fronteiras da aplicação.

## Domínios deliberadamente ausentes

Participantes, desafios, inscrições, financeiro, estoque, atividades,
certificados, marketing e relacionamento serão modelados em ciclos futuros,
após suas regras e critérios de migração receberem aprovação específica.
