#!/bin/bash
# Backup automatique PostgreSQL → archive locale
# Crontab recommandé : 0 2 * * * /opt/pokemarket/infrastructure/scripts/backup.sh

set -e
APP_DIR="/opt/pokemarket"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/postgres_$DATE.sql.gz"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

source "$APP_DIR/.env"

echo "[$(date)] Starting backup..."
docker compose -f "$APP_DIR/infrastructure/docker/docker-compose.prod.yml" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"

echo "[$(date)] Backup saved: $FILE ($(du -sh "$FILE" | cut -f1))"

# Supprimer les backups de plus de KEEP_DAYS jours
find "$BACKUP_DIR" -name "postgres_*.sql.gz" -mtime "+$KEEP_DAYS" -delete
echo "[$(date)] Old backups cleaned (kept last $KEEP_DAYS days)"
