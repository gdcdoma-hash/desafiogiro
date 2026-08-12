#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:?Informe o arquivo .dump fictício}"
: "${RESTORE_DATABASE_URL:?Defina RESTORE_DATABASE_URL para um banco local vazio}"

case "$RESTORE_DATABASE_URL" in
  *localhost*|*127.0.0.1*) ;;
  *) printf 'Restauração bloqueada: o destino precisa ser local.\n' >&2; exit 2 ;;
esac

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$RESTORE_DATABASE_URL" \
  "$backup_file"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "select count(*) as roles from public.app_roles; select count(*) as permissions from public.app_permissions;"
