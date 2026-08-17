# Plataforma Portal Giro

Esta pasta contém a nova fundação técnica do Portal Giro. Ela permanece isolada
para não interferir no Portal público existente em `../portal/` nem no
redirecionador legado em `../index.html` enquanto a migração é concluída.

## Estado atual

Já existem, com migrations, RLS e testes automatizados:

- autenticação administrativa e RBAC;
- auditoria administrativa;
- desafios, metas, ofertas e ciclo de vida;
- participantes;
- inscrições administrativas;
- pré-inscrição pública com catálogo filtrado e fila administrativa;
- pagamentos e confirmação administrativa;
- estoque, reservas e reconciliação;
- planejamento e recebimento de pedidos de medalhas;
- organização, repasse, confirmação e ocorrências de entrega de medalhas;
- painéis administrativos correspondentes.

A página pública de inscrição usa apenas RPCs explicitamente liberadas ao papel
anônimo. As tabelas internas permanecem protegidas por RLS e permissões.

## Limites atuais

- não migra automaticamente os dados existentes no GAS/Google Sheets;
- entrega o Meu Giro V1 básico com progresso e contingência manual, sem integrar
  OAuth/API do Strava nem substituir ou alterar GAS/Sheets legado;
- pagamento PIX ainda depende do fluxo administrativo existente; não há gateway
  financeiro automático;
- não altera o domínio/redirecionador legado de produção;
- não requer serviço pago para o ciclo atual;
- mantém banco, aplicação e hospedagem portáveis.

## Pré-requisitos

- Node.js LTS;
- pnpm 10;
- Docker Desktop ou Docker Engine;
- Supabase CLI;
- PostgreSQL Client (`pg_dump`, `pg_restore` e `psql`).

## Executar localmente

```bash
cd platform
cp .env.example .env
pnpm install
supabase start
supabase db reset
supabase test db
pnpm test
pnpm typecheck
pnpm --filter @portal-giro/api dev
pnpm --filter @portal-giro/admin-web dev
```

Use `supabase status -o env` para obter as chaves exclusivamente locais. Copie
somente os valores locais necessários para `.env`; esse arquivo é ignorado pelo
Git.

Para o Vite, crie `apps/admin-web/.env.local` com:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública local exibida pelo Supabase CLI>
VITE_PORTAL_GIRO_ENV=local
VITE_APP_VERSION=local
```

Para o Worker local, use `.dev.vars` dentro de `apps/api/`:

```dotenv
SUPABASE_ANON_KEY=<chave anon local exibida pelo Supabase CLI>
```

## Criar o administrador fictício local

O cadastro público está desativado. Para testar, crie manualmente um usuário
fictício no Supabase Studio local (`http://127.0.0.1:54323`) e associe seu UUID:

```sql
insert into public.user_roles (user_id, role_id)
select '<UUID-FICTICIO>', id
from public.app_roles
where code = 'platform_admin';
```

Nunca reutilize e-mail, senha, CPF, telefone ou outro dado de uma pessoa real.

## Prévia administrativa isolada

A aplicação em `apps/admin-web` é publicada separadamente do Portal visual. A
chave `VITE_SUPABASE_PUBLISHABLE_KEY` é pública por definição; chaves secretas e
`service_role` são proibidas no frontend. A autorização permanece no PostgreSQL
por meio de RLS, permissões e RPCs com validação interna.

O usuário autenticado sem `admin.access` não obtém contexto administrativo.
Ações administrativas sensíveis validam permissões específicas no banco.
Eventos de auditoria só podem ser gravados por uma sessão com `admin.access` e
não aceitam senha, token, CPF ou outros campos sensíveis proibidos.

## Comandos de qualidade

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

O workflow `Foundation checks` também recria o banco do zero e executa os testes
PgTAP de todas as migrations antes da integração de mudanças na `dev`.

## Ambientes

O repositório continua tratando configuração, migrations e dados como elementos
separados. Não coloque chaves secretas, dumps reais ou dados pessoais no Git.
Antes de promover qualquer ambiente ou migrar dados legados, valide backup,
restauração e compatibilidade das migrations.

Consulte `docs/environments.md`, `docs/security.md` e
`docs/backup-restore.md` antes de configurar ou promover qualquer ambiente.
