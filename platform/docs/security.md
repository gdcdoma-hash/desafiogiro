# Segurança da fundação

## Autenticação

- Supabase Auth com cadastro público desativado;
- login administrativo por e-mail e senha;
- sessão validada novamente pela API;
- usuário autenticado sem `admin.access` recebe acesso negado;
- nenhum parâmetro de URL concede autoridade.

## Autorização

- papéis e permissões são conceitos separados;
- permissões são concedidas explicitamente;
- RLS permanece ativa nas tabelas administrativas;
- o primeiro ciclo possui apenas `platform_admin` e `audit_reader`;
- papéis operacionais futuros não são presumidos.

## Auditoria

Eventos registram ator, ação, recurso, resultado, correlação, origem e data.
Metadados não podem conter `password`, `token`, `secret`, `cpf` ou
`authorization`. Usuários comuns não recebem `UPDATE`, `DELETE` ou `TRUNCATE`
na tabela de auditoria.

## Segredos

- nunca são gravados no repositório;
- nunca são enviados em respostas de erro;
- nunca são registrados na auditoria;
- chaves administrativas só poderão existir em ambiente confiável do servidor.
