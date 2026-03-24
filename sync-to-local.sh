#!/bin/bash

REMOTE_HOST="143.110.191.1"
DB_NAME="career-9"
REMOTE_USER="root"
REMOTE_PASSWORD="Career-qCsfeuECc3MW"

echo "Which remote database do you want to sync from?"
echo "  1) Master  (mysql_db_api - production)"
echo "  2) Staging (mysql_db_staging - testing)"
echo ""
read -p "Enter choice [1/2]: " choice

case $choice in
  1)
    REMOTE_CONTAINER="career-nine-mysql_db_api-1"
    echo "Selected: Master (production)"
    ;;
  2)
    REMOTE_CONTAINER="career-nine-mysql_db_staging-1"
    echo "Selected: Staging (testing)"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

# Find local MySQL container
LOCAL_CONTAINERS=$(docker ps --filter ancestor=mysql --format "{{.Names}}" 2>/dev/null)

if [ -z "$LOCAL_CONTAINERS" ]; then
  echo "ERROR: No local MySQL containers found running."
  exit 1
fi

CONTAINER_COUNT=$(echo "$LOCAL_CONTAINERS" | wc -l | tr -d ' ')

if [ "$CONTAINER_COUNT" -eq 1 ]; then
  LOCAL_CONTAINER="$LOCAL_CONTAINERS"
  echo "Found local MySQL container: $LOCAL_CONTAINER"
else
  echo ""
  echo "Multiple local MySQL containers found:"
  i=1
  while IFS= read -r name; do
    echo "  $i) $name"
    i=$((i + 1))
  done <<< "$LOCAL_CONTAINERS"
  echo ""
  read -p "Enter choice [1-$CONTAINER_COUNT]: " container_choice
  LOCAL_CONTAINER=$(echo "$LOCAL_CONTAINERS" | sed -n "${container_choice}p")
  if [ -z "$LOCAL_CONTAINER" ]; then
    echo "Invalid choice. Exiting."
    exit 1
  fi
fi

read -sp "Enter LOCAL MySQL root password: " LOCAL_PASSWORD
echo ""

echo ""
echo "Syncing $DB_NAME from $REMOTE_CONTAINER → $LOCAL_CONTAINER ..."

# Ensure local DB exists
docker exec "$LOCAL_CONTAINER" mysql -u root -p"$LOCAL_PASSWORD" \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" 2>/dev/null

if [ $? -ne 0 ]; then
  echo "ERROR: Could not connect to local MySQL. Check your password."
  exit 1
fi

# Pipe dump from remote to local
ssh root@"$REMOTE_HOST" "docker exec $REMOTE_CONTAINER mysqldump \
  -u $REMOTE_USER -p'$REMOTE_PASSWORD' \
  --replace --single-transaction --routines --triggers --set-gtid-purged=OFF \
  $DB_NAME" | docker exec -i "$LOCAL_CONTAINER" mysql -u root -p"$LOCAL_PASSWORD" "$DB_NAME"

if [ $? -ne 0 ]; then
  echo "ERROR: Sync failed."
  exit 1
fi

# Verify
TABLE_COUNT=$(docker exec "$LOCAL_CONTAINER" mysql -u root -p"$LOCAL_PASSWORD" -N \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null)

echo ""
echo "Sync complete! $TABLE_COUNT tables in local $DB_NAME."
