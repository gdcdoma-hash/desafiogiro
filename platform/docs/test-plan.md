# Plano mínimo de testes

## Automatizados

- configuração aceita somente ambientes conhecidos;
- autorização concede apenas permissões explícitas;
- TypeScript compila em modo estrito;
- API e interface geram builds independentes;
- migração cria RBAC e auditoria;
- teste SQL confere papéis, permissões e ausência de chaves proibidas.

## Integração local

1. iniciar Supabase local;
2. reconstruir o banco com `supabase db reset`;
3. executar `supabase test db`;
4. criar administrador fictício;
5. validar login correto e incorreto;
6. validar acesso negado sem papel;
7. validar `platform_admin` e `audit_reader`;
8. gerar e restaurar backup em outro banco local;
9. repetir os testes SQL no banco restaurado.

## Não incluído

Não há teste com GAS, Sheets, Strava, PIX, pagamento, estoque, domínio público
ou dados de participantes neste ciclo.
