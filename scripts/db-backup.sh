#!/bin/bash

# MySQL Database Backup Script
# Runs daily via cron to dump the career-9 database
# Creates a self-contained dump and emails it

DB_NAME="career-9"
DB_USER="root"
DB_PASS="Career-qCsfeuECc3MW"
DB_HOST="localhost"
DB_PORT="3306"

BACKUP_DIR="/home/whisky/Projects/career-nine/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql"

# Keep backups for 30 days
RETENTION_DAYS=30

# Email settings
EMAIL_TO="dhruv.kccsw@kccitm.edu.in"
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
    gzip "$BACKUP_FILE"
    GZIP_FILE="${BACKUP_FILE}.gz"
    FILESIZE=$(du -h "$GZIP_FILE" | cut -f1)
    echo "[$(date)] Backup successful: ${GZIP_FILE} (${FILESIZE})"

    # Email the backup as attachment
    echo "Database backup for ${DB_NAME} on $(date +"%d %b %Y %I:%M %p").

File: $(basename "$GZIP_FILE")
Size: ${FILESIZE}

To restore, run:
  gunzip $(basename "$GZIP_FILE")
  mysql -u root -p < $(basename "${GZIP_FILE%.gz}")" | mutt \
        -s "$EMAIL_SUBJECT" \
        -a "$GZIP_FILE" \
        -- "$EMAIL_TO" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "[$(date)] Email sent to ${EMAIL_TO}"
    else
        echo "[$(date)] WARNING: Email failed. Backup saved locally at ${GZIP_FILE}"
    fi
else
    echo "[$(date)] Backup FAILED for ${DB_NAME}"
    exit 1
fi

# Delete backups older than retention period
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Cleanup done. Backups older than ${RETENTION_DAYS} days removed."
