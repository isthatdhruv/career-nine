#!/bin/bash

# MySQL Database Backup Script
# Runs daily via cron to dump the career-9 database
# Creates a self-contained dump and emails it

DB_NAME="career-9"
DB_USER="root"
DB_PASS="Career-qCsfeuECc3MW"
DB_HOST="127.0.0.1"
DB_PORT="3306"

BACKUP_DIR="/root/project/career-nine/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql"

# Keep backups for 30 days
RETENTION_DAYS=30

# Email settings
EMAIL_TO="dhruv.kccsw@kccitm.edu.in,utkrishtmittal@kccitm.edu.in"
EMAIL_SUBJECT="backup - $(date +"%d-%m-%Y")"

mkdir -p "$BACKUP_DIR"

# Self-contained dump: includes CREATE DATABASE, routines, triggers, events
# --single-transaction ensures consistent snapshot without locking
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --add-drop-table \
    --databases "$DB_NAME" \
    > "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup successful: ${BACKUP_FILE} (${FILESIZE})"

    # Email the backup via Spring Boot Gmail API endpoint
    EMAIL_BODY="Database backup for ${DB_NAME} on $(date +"%d %b %Y %I:%M %p").

File: $(basename "$BACKUP_FILE")
Size: ${FILESIZE}

To restore, run:
  mysql -u root -p < $(basename "$BACKUP_FILE")"

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "http://127.0.0.1:8080/email/send-with-attachment" \
        -F "to=${EMAIL_TO}" \
        -F "subject=${EMAIL_SUBJECT}" \
        -F "body=${EMAIL_BODY}" \
        -F "file=@${BACKUP_FILE}")

    if [ "$HTTP_STATUS" = "200" ]; then
        echo "[$(date)] Email sent to ${EMAIL_TO}"
    else
        echo "[$(date)] WARNING: Email failed (HTTP ${HTTP_STATUS}). Backup saved locally at ${BACKUP_FILE}"
    fi
else
    echo "[$(date)] Backup FAILED for ${DB_NAME}"
    exit 1
fi

# Delete backups older than retention period
find "$BACKUP_DIR" -name "*.sql" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Cleanup done. Backups older than ${RETENTION_DAYS} days removed."
