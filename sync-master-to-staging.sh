#!/bin/bash

MASTER_HOST="${MASTER_HOST:-mysql_db_api}"
MASTER_PORT="${MASTER_PORT:-3306}"
STAGING_HOST="${STAGING_HOST:-mysql_db_staging}"
STAGING_PORT="${STAGING_PORT:-3306}"
DB_NAME="${DB_NAME:-career-9}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-Career-qCsfeuECc3MW}"

DUMP_FILE="/tmp/master_dump.sql"

echo "[$(date)] Starting sync from master to staging..."

# Wait for both databases to be ready
for HOST in "$MASTER_HOST" "$STAGING_HOST"; do
  echo "Waiting for $HOST to be ready..."
  for i in $(seq 1 30); do
    if mysqladmin ping -h "$HOST" -P "$MASTER_PORT" -u "$DB_USER" -p"$DB_PASSWORD" --silent 2>/dev/null; then
      echo "$HOST is ready."
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "ERROR: $HOST not ready after 30 attempts. Exiting."
      exit 1
    fi
    sleep 2
  done
done

# Dump master with REPLACE INTO
echo "Dumping master database..."
mysqldump -h "$MASTER_HOST" -P "$MASTER_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  --replace \
  --single-transaction \
  --routines \
  --triggers \
  --no-create-db \
  "$DB_NAME" > "$DUMP_FILE"

if [ $? -ne 0 ]; then
  echo "ERROR: mysqldump failed. Exiting."
  exit 1
fi

echo "Dump size: $(du -h $DUMP_FILE | cut -f1)"

# Import into staging
echo "Importing into staging..."
mysql -h "$STAGING_HOST" -P "$STAGING_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
  "$DB_NAME" < "$DUMP_FILE"

if [ $? -ne 0 ]; then
  echo "ERROR: Import failed. Exiting."
  exit 1
fi

# Cleanup
rm -f "$DUMP_FILE"

echo "[$(date)] Sync complete."
