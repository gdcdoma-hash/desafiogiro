# Desafios — modelo de dados proposto

## Objetivo

Converter as regras aprovadas do domínio Desafios em um desenho técnico que possa ser implementado por migração PostgreSQL sem acoplar o sistema ao legado em Google Sheets.

Este documento prepara a migração, contratos e RLS. Ele não altera o banco por si só.

## 1. Tabela `challenges`

Representa uma edição do Desafio Giro.

Campos propostos:

- `id uuid primary key default extensions.gen_random_uuid()`;
- `code text not null unique` — identificador legível e estável da edição;
- `name text not null` — nome público;
- `short_description text` — descrição curta;
- `reference_year smallint not null`;
- `reference_month smallint not null`;
- `sport_starts_at timestamptz not null`;
- `sport_ends_at timestamptz not null`;
- `timezone text not null default 'America/Fortaleza'`;
- `status text not null default 'DRAFT'`;
- `is_public boolean not null default false`;
- `admin_notes text`;
- `created_at timestamptz not null default now()`;
- `updated_at timestamptz not null default now()`.

Constraints principais:

- `reference_month between 1 and 12`;
- `reference_year` dentro de faixa administrativa razoável;
- `sport_ends_at > sport_starts_at`;
- `status in ('DRAFT','SCHEDULED','ACTIVE','FINISHED','CANCELLED','ARCHIVED')`;
- código com formato seguro para uso em URL/integrações;
- unicidade de competência poderá ser por `(reference_year, reference_month, code)`, sem impedir futuras edições especiais no mesmo mês.

## 2. Tabela `challenge_goals`

Representa metas de quilometragem disponíveis em uma edição.

Campos propostos:

- `id uuid primary key default extensions.gen_random_uuid()`;
- `challenge_id uuid not null references public.challenges(id) on delete restrict`;
- `distance_km integer not null`;
- `public_label text`;
- `display_order integer not null default 0`;
- `is_active boolean not null default true`;
- `created_at timestamptz not null default now()`;
- `updated_at timestamptz not null default now()`.

Constraints principais:

- `distance_km > 0`;
- impedir duplicidade de meta ativa de mesma quilometragem dentro do mesmo desafio;
- não usar cascade destrutivo a partir de desafio.

## 3. Tabela `challenge_offers`

Representa uma janela comercial de inscrição.

Campos propostos:

- `id uuid primary key default extensions.gen_random_uuid()`;
- `challenge_id uuid not null references public.challenges(id) on delete restrict`;
- `code text not null` — código interno estável dentro do desafio;
- `internal_name text not null`;
- `public_name text not null`;
- `category text not null` — rótulo configurável, podendo começar por `NORMAL` e `REPESCAGEM` sem limitar o domínio;
- `registration_starts_at timestamptz not null`;
- `registration_ends_at timestamptz not null`;
- `price_cents integer not null`;
- `priority integer not null default 0`;
- `max_per_participant integer not null default 1`;
- `status text not null default 'DRAFT'`;
- `rules jsonb not null default '{}'::jsonb`;
- `created_at timestamptz not null default now()`;
- `updated_at timestamptz not null default now()`.

Constraints principais:

- unicidade de `(challenge_id, code)`;
- `registration_ends_at > registration_starts_at`;
- `price_cents >= 0`;
- `max_per_participant > 0`;
- `status in ('DRAFT','SCHEDULED','OPEN','CLOSED','DISABLED')`;
- `jsonb_typeof(rules) = 'object'`.

O preço será armazenado em centavos para evitar inconsistências de ponto flutuante.

## 4. Tabela `challenge_offer_goals`

Relaciona explicitamente as metas liberadas por cada oferta.

Campos propostos:

- `offer_id uuid not null references public.challenge_offers(id) on delete restrict`;
- `goal_id uuid not null references public.challenge_goals(id) on delete restrict`;
- `created_at timestamptz not null default now()`;
- primary key `(offer_id, goal_id)`.

Regra adicional de aplicação: oferta e meta precisam pertencer ao mesmo desafio. A garantia deve existir também no banco, preferencialmente por trigger/constraint function simples, e não apenas na interface.

## 5. Imutabilidade e histórico

Enquanto não houver inscrições vinculadas, o módulo administrativo poderá editar os campos normalmente, respeitando validações.

Após existir inscrição vinculada, o domínio de Inscrições deverá informar essa condição e a API passará a bloquear alterações destrutivas em:

- competência;
- período esportivo;
- distância da meta utilizada;
- oferta utilizada;
- preço histórico;
- limite/regra comercial que já tenha produzido inscrição.

O banco deste ciclo não cria dependência de uma tabela de inscrições ainda inexistente. A proteção completa será adicionada quando esse domínio entrar.

## 6. Cancelamento e exclusão

- `challenges` não será apagado para representar cancelamento;
- `CANCELLED` preserva a edição;
- metas e ofertas deixam de aceitar novas inscrições por estado/visibilidade;
- nenhuma FK principal deste domínio usa `on delete cascade` para apagar histórico funcional.

## 7. Permissões propostas

Novas permissões RBAC:

- `challenges.read` — consultar desafios, metas e ofertas no painel;
- `challenges.manage` — criar e alterar desafios, metas e ofertas.

O papel `platform_admin` recebe ambas por padrão.

## 8. RLS proposta

As quatro tabelas devem ter RLS habilitada.

Painel administrativo:

- `select` permitido a usuário autenticado com `challenges.read`;
- `insert/update` permitido a usuário autenticado com `challenges.manage`;
- `delete` não será exposto ao papel autenticado neste ciclo.

A leitura pública do Portal não será aberta diretamente nessas tabelas neste ciclo. Quando necessária, deve ser feita por endpoint/view controlada que exponha apenas campos públicos e registros publicáveis.

## 9. Auditoria

A API deverá registrar eventos usando `public.write_audit_event` para ações como:

- `challenge.create`;
- `challenge.update`;
- `challenge.status_change`;
- `challenge.goal.create`;
- `challenge.goal.update`;
- `challenge.offer.create`;
- `challenge.offer.update`;
- `challenge.offer.goals_change`.

A auditoria não deve receber conteúdo pessoal, segredos ou payloads completos desnecessários.

## 10. Índices previstos

- `challenges(reference_year, reference_month)`;
- `challenges(status, sport_starts_at)`;
- `challenge_goals(challenge_id, display_order)`;
- `challenge_offers(challenge_id, registration_starts_at, registration_ends_at)`;
- `challenge_offers(status)`.

## 11. Contratos de API previstos

Operações administrativas mínimas:

- listar desafios;
- consultar detalhe completo;
- criar desafio em `DRAFT`;
- atualizar dados permitidos;
- alterar status e visibilidade;
- criar/editar/reordenar metas;
- criar/editar ofertas;
- associar/desassociar metas de uma oferta;
- consultar estado derivado de oferta: futura, aberta, encerrada ou desabilitada.

## 12. Validações antes de aplicar ao Supabase

Antes de rodar a migração no projeto conectado:

1. criar o SQL versionado em `platform/supabase/migrations`;
2. criar testes SQL para constraints e RLS;
3. revisar o SQL contra a fundação RBAC já instalada;
4. revisar advisors de segurança após a aplicação;
5. não criar branch paga do Supabase sem autorização explícita;
6. não inserir dados históricos nesta migração estrutural.

Com esse modelo, não há decisão funcional adicional obrigatória para escrever a primeira migração do domínio Desafios.
