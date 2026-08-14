# Segurança da fundação

## Autenticação

- Supabase Auth com cadastro público administrativo desativado;
- login administrativo por e-mail e senha;
- sessão validada novamente pela API;
- usuário autenticado sem `admin.access` não obtém contexto administrativo;
- nenhum parâmetro de URL concede autoridade.

A página pública de pré-inscrição não exige login, mas o papel `anon` recebe
somente `EXECUTE` nas RPCs explicitamente públicas:

- `get_public_registration_catalog()`;
- `submit_public_registration_request(...)`.

O acesso direto à view do catálogo e às tabelas internas não é concedido ao
papel anônimo.

## Autorização

- papéis e permissões são conceitos separados;
- permissões são concedidas explicitamente;
- RLS permanece ativa nas tabelas administrativas e de participante;
- funções administrativas `SECURITY DEFINER` validam permissões no próprio
  banco antes de executar operações sensíveis;
- helpers internos de pagamento e reserva não são executáveis diretamente por
  clientes autenticados;
- papéis operacionais futuros não são presumidos.

Os objetos administrativos ainda são consumidos pelo frontend autenticado por
meio do PostgREST/Supabase e, por isso, parte deles permanece visível no schema
GraphQL para o papel `authenticated`. Isso não concede acesso aos registros: RLS
e as permissões continuam sendo a fronteira de autorização. A remoção dessa
visibilidade só deve ocorrer junto de uma migração deliberada do frontend para
APIs/RPCs equivalentes, para não quebrar os painéis existentes.

## Auditoria

Eventos registram ator, ação, recurso, resultado, correlação, origem e data.
Metadados não podem conter `password`, `token`, `secret`, `cpf` ou
`authorization`.

`write_audit_event(...)` exige sessão autenticada com `admin.access`. Isso evita
que uma conta autenticada comum injete registros na trilha de auditoria, embora
a RPC permaneça disponível para a API administrativa atual.

Usuários clientes não recebem `UPDATE`, `DELETE` ou `TRUNCATE` na tabela de
auditoria.

## Inscrição pública

- catálogo anônimo é filtrado para desafios públicos e ofertas abertas dentro do
  período válido;
- submissões públicas passam por função `SECURITY DEFINER` com validação de
  oferta, meta, telefone, cidade e UF;
- uma solicitação pendente duplicada para o mesmo telefone e oferta é bloqueada;
- o processamento administrativo é serializado por telefone para impedir criação
  concorrente de participantes duplicados;
- participantes ativos possuem unicidade parcial por `phone_e164` como segunda
  barreira de integridade.

## Segredos

- nunca são gravados no repositório;
- nunca são enviados em respostas de erro;
- nunca são registrados na auditoria;
- chaves administrativas só podem existir em ambiente confiável do servidor;
- frontend usa apenas chave publicável/anon apropriada ao Supabase.

## Validação contínua

Toda PR que altera `platform/**` passa pelo `Foundation checks`, que executa
formatação, lint, typecheck, testes, build, recriação integral do banco e testes
PgTAP. Recomendações do advisor do Supabase são revisadas após mudanças de DDL;
avisos de índice ainda não utilizado não são motivo isolado para remover índices
em uma plataforma recente.
