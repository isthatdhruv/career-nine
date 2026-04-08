#!/bin/bash

# Syncs master DB (career-9) to staging DB (career-9-staging)
# Run from host: bash sync-master-to-staging.sh

DB_USER="root"
DB_PASSWORD="Career-qCsfeuECc3MW"
MASTER_PORT=3306
STAGING_PORT=3307
MASTER_DB="career-9"
STAGING_DB="career-9-staging"
DUMP_FILE="/tmp/master_dump.sql"

echo "[$(date)] Syncing $MASTER_DB → $STAGING_DB ..."

# Dump master
echo "Dumping master..."
mysqldump -h 127.0.0.1 -P $MASTER_PORT -u $DB_USER -p"$DB_PASSWORD" \
  --single-transaction --routines --triggers \
  "$MASTER_DB" > "$DUMP_FILE"

if [ $? -ne 0 ]; then
  echo "ERROR: Dump failed."
  exit 1
fi

echo "Dump size: $(du -h $DUMP_FILE | cut -f1)"

# Create staging DB if it doesn't exist
mysql -h 127.0.0.1 -P $STAGING_PORT -u $DB_USER -p"$DB_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$STAGING_DB\`;"

# Drop all tables in staging, then import fresh
echo "Cleaning staging DB..."
mysql -h 127.0.0.1 -P $STAGING_PORT -u $DB_USER -p"$DB_PASSWORD" \
  -e "SET FOREIGN_KEY_CHECKS=0; SET GROUP_CONCAT_MAX_LEN=1000000; \
      SET @tables = (SELECT GROUP_CONCAT('\`',table_name,'\`') FROM information_schema.tables WHERE table_schema='$STAGING_DB'); \
      IF @tables IS NOT NULL THEN SET @sql = CONCAT('DROP TABLE IF EXISTS ', @tables); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; END IF; \
      SET FOREIGN_KEY_CHECKS=1;" \
  "$STAGING_DB" 2>/dev/null

echo "Importing into staging..."
mysql -h 127.0.0.1 -P $STAGING_PORT -u $DB_USER -p"$DB_PASSWORD" \
  "$STAGING_DB" < "$DUMP_FILE"

if [ $? -ne 0 ]; then
  echo "ERROR: Import failed."
  exit 1
fi

rm -f "$DUMP_FILE"
echo "[$(date)] Done. Staging is now a clean copy of master."
