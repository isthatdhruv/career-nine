# Career-Nine

Full-stack educational platform for student assessment, career guidance, and academic management.

## Tech Stack

- **Backend:** Spring Boot 2.5.5, Java 11, MySQL
- **Frontend:** React 18, TypeScript, Material-UI, Bootstrap 5
- **Cache:** Redis 7.2
- **Deployment:** Docker Compose

## Architecture

```
React SPA (port 3000)
    ↓ HTTP/REST
Spring Boot API (port 8080)
    ↓ JDBC
MySQL (port 3306) ──── scheduled sync ────→ MySQL Staging (port 3307)
    ↑                    (daily 3 AM)
Redis Cache (port 6379)
```

## Quick Start

```bash
# Create shared network
docker network create career_shared_net

# Start all services
docker compose up -d

# View logs
docker logs -f api
```

## Services

| Service | Container | Port | Description |
|---|---|---|---|
| MySQL (Master) | `mysql_db_api` | 3306 | Production database (`career-9`) |
| MySQL (Staging) | `mysql_db_staging` | 3307 | Staging/testing database (`career-9`) |
| Redis | `redis_cache` | 6379 | Caching layer |
| Spring Boot API | `api` | 8080 | Backend REST API |
| Sync Cron | `sync_cron` | — | Scheduled master → staging sync |

## Database Sync (Master → Staging)

The staging database (`mysql_db_staging`) is an independent, writable copy of the master database (`mysql_db_api`). A scheduled sync keeps staging up-to-date with production data while preserving any test data added directly to staging.

### How It Works

- A cron container (`sync_cron`) runs a sync script daily at **3:00 AM UTC**
- The script uses `mysqldump --replace` to export master and import into staging
- `REPLACE INTO` strategy means:

| Scenario | Behavior |
|---|---|
| New rows in master | Added to staging |
| Rows exist in both (conflict) | **Master version wins** |
| Test-only rows in staging | **Preserved** (not deleted) |

### Manual Sync

To trigger a sync manually at any time:

```bash
docker exec career-nine-sync_cron-1 /usr/local/bin/sync-master-to-staging.sh
```

### Connecting to Staging DB

```bash
# Via docker exec
docker exec -it career-nine-mysql_db_staging-1 mysql -u root -pCareer-qCsfeuECc3MW career-9

# Via host (port 3307)
mysql -h localhost -P 3307 -u root -pCareer-qCsfeuECc3MW career-9
```

### Changing Sync Schedule

Edit the `crontab` file and rebuild the cron container:

```bash
# Example: change to every 6 hours
# 0 */6 * * * /usr/local/bin/sync-master-to-staging.sh >> /var/log/sync.log 2>&1

docker compose up -d --build sync_cron
```

### Relevant Files

| File | Purpose |
|---|---|
| `sync-master-to-staging.sh` | Dump master, import into staging using `REPLACE INTO` |
| `Dockerfile.cron` | Alpine container with mysql-client and cron |
| `crontab` | Cron schedule (default: daily 3 AM UTC) |
| `docker-compose.yml` | All service definitions |

## Development

### Backend

```bash
cd spring-social
mvn spring-boot:run                          # Start with dev profile (port 8091)
mvn spring-boot:run -Dspring-boot.run.profiles=staging  # Staging profile
mvn test                                     # Run tests
```

### Frontend

```bash
cd react-social
npm install
npm start         # Dev server (port 3000)
npm run build     # Production build
```

## Environment

- Dev backend port: **8091** | Docker backend port: **8080**
- Dev database: `kareer-9` | Docker database: `career-9`
- Default DB credentials: `root` / `Career-qCsfeuECc3MW`
