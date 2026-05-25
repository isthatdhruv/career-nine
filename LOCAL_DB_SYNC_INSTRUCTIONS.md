# Sync Remote Master DB to Local Machine

Instructions for Claude Code to dump the master database from the remote server and import it into a local MySQL Docker container.

## Remote Server Details

- **Host:** 144.126.253.186
- **MySQL Port:** 3306 (exposed from `mysql_db_api` container)
- **Database:** `career-9`
- **User:** `root`
- **Password:** `Career-qCsfeuECc3MW`
- **MySQL Version:** 9.6.0

## Prerequisites

Local machine must have:
- Docker installed and running
- A MySQL container running locally (with port mapped, e.g., `3306:3306`)
- SSH access to `143.110.191.1` (if port 3306 is not publicly exposed)

Find your local MySQL container name:
```bash
docker ps --filter ancestor=mysql --format "{{.Names}}"
```

## Option A: SSH + Docker-to-Docker (Recommended)

```bash
# Step 1: Dump remote DB via SSH into a local file
ssh root@143.110.191.1 "docker exec career-nine-mysql_db_api-1 mysqldump \
  -u root -p'Career-qCsfeuECc3MW' \
  --replace \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  career-9" > career-9-dump.sql

# Step 2: Create DB in local container if it doesn't exist
docker exec <LOCAL_MYSQL_CONTAINER> mysql -u root -p'<LOCAL_PASSWORD>' \
  -e "CREATE DATABASE IF NOT EXISTS \`career-9\`;"

# Step 3: Copy dump into local container and import
docker cp career-9-dump.sql <LOCAL_MYSQL_CONTAINER>:/tmp/career-9-dump.sql
docker exec <LOCAL_MYSQL_CONTAINER> bash -c \
  "mysql -u root -p'<LOCAL_PASSWORD>' career-9 < /tmp/career-9-dump.sql"

# Step 4: Cleanup
docker exec <LOCAL_MYSQL_CONTAINER> rm /tmp/career-9-dump.sql
rm career-9-dump.sql

# Step 5: Verify
docker exec <LOCAL_MYSQL_CONTAINER> mysql -u root -p'<LOCAL_PASSWORD>' \
  -e "USE \`career-9\`; SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='career-9';"
```

Replace `<LOCAL_MYSQL_CONTAINER>` with your local container name and `<LOCAL_PASSWORD>` with your local root password.

## Option B: Direct Remote Dump (if remote port 3306 is exposed)

```bash
# Step 1: Dump remote DB (uses mysql client inside local container)
docker exec <LOCAL_MYSQL_CONTAINER> mysqldump \
  -h 143.110.191.1 -P 3306 \
  -u root -p'Career-qCsfeuECc3MW' \
  --replace \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  career-9 > /tmp/career-9-dump.sql

# Step 2: Create DB and import
docker exec <LOCAL_MYSQL_CONTAINER> mysql -u root -p'<LOCAL_PASSWORD>' \
  -e "CREATE DATABASE IF NOT EXISTS \`career-9\`;"
docker cp /tmp/career-9-dump.sql <LOCAL_MYSQL_CONTAINER>:/tmp/career-9-dump.sql
docker exec <LOCAL_MYSQL_CONTAINER> bash -c \
  "mysql -u root -p'<LOCAL_PASSWORD>' career-9 < /tmp/career-9-dump.sql"
```

## Option C: One-Liner via SSH Pipe

```bash
ssh root@143.110.191.1 "docker exec career-nine-mysql_db_api-1 mysqldump \
  -u root -p'Career-qCsfeuECc3MW' \
  --replace --single-transaction --set-gtid-purged=OFF \
  career-9" | docker exec -i <LOCAL_MYSQL_CONTAINER> mysql -u root -p'<LOCAL_PASSWORD>' career-9
```

This pipes the dump directly from the remote container into your local container — no intermediate file.

**Note:** The local database `career-9` must already exist before running this. Create it first:
```bash
docker exec <LOCAL_MYSQL_CONTAINER> mysql -u root -p'<LOCAL_PASSWORD>' \
  -e "CREATE DATABASE IF NOT EXISTS \`career-9\`;"
```

## Local DB Config for Spring Boot

Dev profile (`application.yml`) uses `kareer-9` by default. Either:

1. Rename the imported DB:
```bash
# Not directly possible in MySQL — create kareer-9 and import there instead
docker exec <LOCAL_MYSQL_CONTAINER> mysql -u root -p'<LOCAL_PASSWORD>' \
  -e "CREATE DATABASE IF NOT EXISTS \`kareer-9\`;"
# Then use kareer-9 instead of career-9 in the import commands above
```

2. Or update the JDBC URL in `application.yml` to point to `career-9`.

## Notes

- The dump is ~159MB as of 2026-03-24
- Uses `--replace` so re-running overwrites existing data (master wins), but local-only rows are preserved
- Uses `--single-transaction` for a consistent snapshot without locking tables
- Uses `--set-gtid-purged=OFF` to avoid GTID warnings when importing into a non-replicated local instance
- If your local MySQL container has a different password, update `<LOCAL_PASSWORD>` accordingly
- If your local container maps to a different port (e.g., `3307:3306`), the internal port is still 3306 — docker exec runs inside the container so port mapping doesn't matter
