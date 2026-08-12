#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-./backups}"
mkdir -p "$backup_dir"
backup_file="$backup_dir/portal-giro-fictional-$(date -u +%Y%m%dT%H%M%SZ).dump"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file" \
  "${DATABASE_URL:?Defina DATABASE_URL para um banco local com dados fictícios}"

pg_restore --list "$backup_file" >/dev/null
printf '%s\n' "$backup_file"
