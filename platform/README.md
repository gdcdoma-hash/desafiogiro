# Fundação técnica do Portal Giro

Esta pasta contém o primeiro ciclo técnico da nova plataforma. Ela foi criada de
forma isolada para não interferir no Portal público existente em `../portal/` nem
no redirecionador de produção em `../index.html`.

## Limites deste ciclo

- não conecta com GAS ou Google Sheets;
- não contém dados reais;
- não implementa inscrição, pagamento, PIX, estoque ou Strava;
- não publica no domínio atual;
- não exige serviço pago;
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
VITE_SUPABASE_ANON_KEY=<chave anon local exibida pelo Supabase CLI>
VITE_API_URL=http://localhost:8787
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

## Comandos de qualidade

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Ambientes

| Ambiente   | Banco            | Dados permitidos  | Publicação neste ciclo |
| ---------- | ---------------- | ----------------- | ---------------------- |
| local      | Supabase local   | somente fictícios | sim, apenas na máquina |
| staging    | projeto separado | somente fictícios | não configurada        |
| production | projeto separado | banco vazio       | proibida               |

Consulte `docs/environments.md`, `docs/security.md` e
`docs/backup-restore.md` antes de configurar qualquer ambiente externo.
