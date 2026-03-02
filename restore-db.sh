#!/bin/bash
# Database Restore Script for Trying POS

BACKUP_DIR="/root/trying-backups"

# Load database URL from env file
if [ -f /opt/trying/.env ]; then
    export $(grep DATABASE_URL /opt/trying/.env | xargs)
fi

echo "=========================================="
echo "  TRYING POS - Database Restore"
echo "=========================================="

# List available backups
echo "Available backups:"
echo ""
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | nl | awk '{print $1 ". " $10 " (" $6 ") - " $7 " " $8}'

if [ $(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l) -eq 0 ]; then
    echo "No backups found!"
    exit 1
fi

echo ""
echo "Enter backup number to restore (or 'q' to quit):"
read -r BACKUP_NUM

if [ "$BACKUP_NUM" = "q" ]; then
    echo "Cancelled."
    exit 0
fi

# Get the backup file
BACKUP_FILE=$(ls -1t "$BACKUP_DIR"/backup_*.sql.gz | sed -n "${BACKUP_NUM}p")

if [ -z "$BACKUP_FILE" ]; then
    echo "Invalid backup number!"
    exit 1
fi

echo ""
echo "⚠️  WARNING: This will OVERWRITE your current database!"
echo "Backup file: $(basename $BACKUP_FILE)"
echo ""
echo "Type 'RESTORE' to confirm (or anything else to cancel):"
read -r CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "[1/3] Decompressing backup..."
TEMP_SQL="/tmp/restore_temp.sql"
gunzip -c "$BACKUP_FILE" > "$TEMP_SQL"
echo "✓ Decompressed"

echo "[2/3] Stopping application..."
pm2 stop trying 2>/dev/null
echo "✓ Application stopped"

echo "[3/3] Restoring database..."
psql "$DATABASE_URL" < "$TEMP_SQL"

if [ $? -eq 0 ]; then
    echo "✓ Database restored successfully"
else
    echo "✗ Restore failed!"
    pm2 start trying
    rm -f "$TEMP_SQL"
    exit 1
fi

# Cleanup
rm -f "$TEMP_SQL"

echo ""
echo "Starting application..."
pm2 start trying
echo "✓ Application started"

echo ""
echo "=========================================="
echo "  Restore completed!"
echo "=========================================="
