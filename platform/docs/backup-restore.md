# Backup e restauração com dados fictícios

## Restrições

O procedimento deste ciclo deve ser executado apenas contra bancos locais com
dados inventados. O script de restauração bloqueia destinos que não indiquem
`localhost` ou `127.0.0.1`.

## Backup

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

## Aceite

- restauração termina sem erro;
- existem dois papéis técnicos;
- existem seis permissões iniciais;
- as políticas RLS continuam presentes;
- nenhum dado de negócio ou pessoal aparece no destino;
- o arquivo de backup não é versionado.
