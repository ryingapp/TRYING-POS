#!/bin/bash
# Automated Database Backup Script for Trying POS

# Configuration
BACKUP_DIR="/root/trying-backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RETENTION_DAYS=7
MAX_BACKUPS=30

# Load database URL from env file
if [ -f /opt/trying/.env ]; then
    export $(grep DATABASE_URL /opt/trying/.env | xargs)
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Extract database details from DATABASE_URL
# Format: postgresql://user:password@host/database
DB_URL="$DATABASE_URL"

echo "=========================================="
echo "  TRYING POS - Database Backup"
echo "  $(date)"
echo "=========================================="

# Perform backup
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
echo "[1/4] Creating backup..."
pg_dump "$DB_URL" > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Backup created: $BACKUP_FILE"
    
    # Compress backup
    echo "[2/4] Compressing backup..."
    gzip "$BACKUP_FILE"
    BACKUP_FILE="$BACKUP_FILE.gz"
    echo "✓ Compressed: $BACKUP_FILE"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "  Size: $SIZE"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Remove old backups (keep last RETENTION_DAYS days)
echo "[3/4] Cleaning old backups..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "✓ Removed backups older than $RETENTION_DAYS days"

# Keep only MAX_BACKUPS most recent files
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
if [ $BACKUP_COUNT -gt $MAX_BACKUPS ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    echo "  Removing $REMOVE_COUNT oldest backups (keeping $MAX_BACKUPS max)..."
    ls -1t "$BACKUP_DIR"/backup_*.sql.gz | tail -n $REMOVE_COUNT | xargs rm -f
    echo "✓ Kept $MAX_BACKUPS most recent backups"
fi

# List current backups
echo "[4/4] Current backups:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -5 | awk '{print "  " $9 " (" $5 ")"}'

echo "=========================================="
echo "  Backup completed successfully!"
echo "=========================================="
