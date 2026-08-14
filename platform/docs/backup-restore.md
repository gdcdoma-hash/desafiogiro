# Backup e restauração

## Objetivo

Os scripts versionados neste repositório servem para validar, de forma isolada,
que o schema e os dados de teste da plataforma podem ser exportados em formato
PostgreSQL e restaurados fora do ambiente original.

Eles **não** substituem o procedimento de backup do banco remoto e não devem ser
apontados para produção sem uma revisão específica do ciclo de migração.

## Ensaio local

O procedimento automatizado atual deve ser executado apenas contra bancos locais
com dados inventados. O script de restauração bloqueia destinos que não indiquem
`localhost` ou `127.0.0.1`.

Com o Supabase local iniciado:

```bash
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
./scripts/backup/backup-local.sh
```

O arquivo `.dump` é criado em `backups/`, validado com `pg_restore --list` e
ignorado pelo Git.

## Restauração isolada

Crie outro PostgreSQL local vazio e execute:

```bash
export RESTORE_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54332/postgres'
./scripts/restore/restore-local.sh backups/<arquivo-ficticio>.dump
```

O script restaura o dump e verifica a existência das estruturas básicas de RBAC.
As migrations e os testes PgTAP continuam sendo a fonte de verdade do schema.

## Aceite do ensaio local

- `pg_dump` termina sem erro;
- `pg_restore --list` consegue ler o arquivo gerado;
- a restauração em um banco local vazio termina sem erro;
- tabelas de RBAC, migrations e políticas RLS continuam presentes;
- o banco restaurado contém somente os dados fictícios que estavam no banco de
  origem do ensaio;
- o arquivo de backup não é versionado.

## Antes de migrar dados reais

Antes de qualquer desligamento do GAS/Sheets ou promoção definitiva do novo
banco, deve existir um procedimento separado e validado para:

1. exportar o banco remoto completo sem expor credenciais no repositório;
2. armazenar ao menos uma cópia fora do provedor principal;
3. restaurar essa cópia em ambiente isolado;
4. conferir contagens e integridade dos domínios críticos;
5. registrar data, origem, versão das migrations e resultado do teste de
   restauração.

Nenhum banco legado deve ser desativado apenas porque um arquivo de backup foi
gerado; a restauração precisa ser testada primeiro.
