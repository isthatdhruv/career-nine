#!/bin/bash

# Merge-import a SQL dump into master and/or staging without dropping tables.
# Usage: ./merge-dump.sh <path-to-dump.sql>

DUMP_FILE="$1"
DB_NAME="career-9"
DB_USER="root"
DB_PASSWORD="Career-qCsfeuECc3MW"
MASTER_CONTAINER="career-nine-mysql_db_api-1"
STAGING_CONTAINER="career-nine-mysql_db_staging-1"

if [ -z "$DUMP_FILE" ]; then
  echo "Usage: ./merge-dump.sh <path-to-dump.sql>"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: File '$DUMP_FILE' not found."
  exit 1
fi

echo "Dump file: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
echo ""
echo "Where do you want to merge this dump?"
echo "  1) Master only  (mysql_db_api)"
echo "  2) Staging only (mysql_db_staging)"
echo "  3) Both"
echo ""
read -p "Enter choice [1/2/3]: " choice

TARGETS=()
case $choice in
  1) TARGETS=("$MASTER_CONTAINER") ;;
  2) TARGETS=("$STAGING_CONTAINER") ;;
  3) TARGETS=("$MASTER_CONTAINER" "$STAGING_CONTAINER") ;;
  *) echo "Invalid choice. Exiting."; exit 1 ;;
esac

echo ""
echo "Conflict strategy:"
echo "  1) Dump wins   — REPLACE INTO (overwrites existing rows with dump data)"
echo "  2) DB wins     — INSERT IGNORE (keeps existing rows, only adds new ones)"
echo ""
read -p "Enter choice [1/2]: " strategy

case $strategy in
  1) SED_PATTERN='s/^INSERT INTO/REPLACE INTO/g' ;;
  2) SED_PATTERN='s/^INSERT INTO/INSERT IGNORE INTO/g' ;;
  *) echo "Invalid choice. Exiting."; exit 1 ;;
esac

# Create a merge-safe version of the dump:
# - Strip DROP TABLE statements
# - Strip CREATE TABLE (use IF NOT EXISTS instead)
# - Convert INSERT to REPLACE/INSERT IGNORE
echo "Preparing merge-safe dump..."
SAFE_DUMP="/tmp/merge_safe_dump.sql"

sed \
  -e '/^DROP TABLE/d' \
  -e 's/^CREATE TABLE /CREATE TABLE IF NOT EXISTS /g' \
  -e "$SED_PATTERN" \
  "$DUMP_FILE" > "$SAFE_DUMP"

echo "Merge-safe dump ready ($(du -h "$SAFE_DUMP" | cut -f1))"

for CONTAINER in "${TARGETS[@]}"; do
  echo ""
  echo "Importing into $CONTAINER ..."

  # Copy dump into container
  docker cp "$SAFE_DUMP" "$CONTAINER":/tmp/merge_dump.sql

  # Import
  docker exec "$CONTAINER" bash -c \
    "mysql -u $DB_USER -p'$DB_PASSWORD' $DB_NAME < /tmp/merge_dump.sql"

  if [ $? -ne 0 ]; then
    echo "ERROR: Import into $CONTAINER failed."
  else
    TABLE_COUNT=$(docker exec "$CONTAINER" mysql -u "$DB_USER" -p"$DB_PASSWORD" -N \
      -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null)
    echo "$CONTAINER: OK — $TABLE_COUNT tables in $DB_NAME"
  fi

  # Cleanup inside container
  docker exec "$CONTAINER" rm -f /tmp/merge_dump.sql
done

# Cleanup
rm -f "$SAFE_DUMP"

echo ""
echo "Done."
