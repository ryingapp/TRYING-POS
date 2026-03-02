#!/bin/bash
# Setup Automated Backup Cron Job for Trying POS

echo "=========================================="
echo "  TRYING POS - Backup Setup"
echo "=========================================="

# Make scripts executable
chmod +x /opt/trying/backup-db.sh
chmod +x /opt/trying/restore-db.sh

echo "[1/3] Scripts made executable"

# Create backup directory
mkdir -p /root/trying-backups
echo "[2/3] Backup directory created"

# Setup cron job (daily at 3 AM)
CRON_JOB="0 3 * * * /opt/trying/backup-db.sh >> /var/log/trying-backup.log 2>&1"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "[3/3] ✓ Cron job added (daily at 3 AM)"
else
    echo "[3/3] ✓ Cron job already exists"
fi

echo ""
echo "Current backup schedule:"
crontab -l | grep backup-db.sh

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Commands:"
echo "  - Manual backup:  /opt/trying/backup-db.sh"
echo "  - Restore:        /opt/trying/restore-db.sh"
echo "  - View backups:   ls -lh /root/trying-backups/"
echo "  - View logs:      tail -f /var/log/trying-backup.log"
echo ""
echo "Automatic backups will run daily at 3 AM"
echo "=========================================="
