#!/usr/bin/env bash
# restore-prod-dump-to-staging-v3.sh
#
# Loads a PRODUCTION mysqldump into a NEW schema `career-9-staging-v3` on the
# STAGING MySQL container. It never writes to `career-9-staging-v2` (the schema
# the running api-staging uses) and never connects to the production server.
#
# Run it ONLY inside the staging rebuild window, AFTER the mysql_db_staging
# memory limit was raised to 2.5g in docker-compose.yml and the container was
# recreated with it:
#     docker compose up -d mysql_db_staging        # ~30s staging blip
# The script refuses to run while the limit is still 1.5g: the restore fills
# the 1G InnoDB buffer pool and would OOM-kill mysqld (it did on 2026-09-15).
#
# Usage:  ./restore-prod-dump-to-staging-v3.sh [/path/to/career-9_<stamp>.sql.gz]
#         (default: newest career-9_*.sql.gz in /root/project/career-nine/backups/)
#
# Why the header filter: the nightly cron dump is taken with --databases, so its
# header carries `DROP DATABASE IF EXISTS career-9` (inside a /*!40000 */
# conditional comment, which MySQL EXECUTES), `CREATE DATABASE career-9`,
# `USE career-9`, and a SET @@GLOBAL.GTID_PURGED that errors on any server with
# its own GTID history. Piped unfiltered into the PRODUCTION server (port 3306)
# that header drops prod. All four are stripped here and the target schema is
# fixed on the mysql command line instead.
set -euo pipefail

CONTAINER="career-nine-sandbox-mysql_db_staging-1"
EXPECT_MYSQL_DATABASE="career-9-staging"        # env of the staging container: guards against prod
TARGET_DB="career-9-staging-v3"
MIN_MEM_BYTES=$((2 * 1024 * 1024 * 1024))       # refuse below 2 GiB
DEFAULT_DUMP_DIR="/root/project/career-nine/backups"

log(){ printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die(){ log "ERROR: $*"; exit 1; }
# One SQL statement as root inside the container (-N: no column header).
q(){ docker exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -e "$1"' sh "$1"; }
mem(){ docker stats --no-stream --format '{{.MemUsage}} ({{.MemPerc}})' "$CONTAINER"; }

DUMP="${1:-$(ls -t "$DEFAULT_DUMP_DIR"/career-9_*.sql.gz 2>/dev/null | head -1)}"
[[ -f "${DUMP:-}" ]] || die "no dump given and none found in $DEFAULT_DUMP_DIR"

# ── Guards ───────────────────────────────────────────────────────────────────
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" == "true" ]] \
  || die "$CONTAINER is not running"
db_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" | sed -n 's/^MYSQL_DATABASE=//p')"
[[ "$db_env" == "$EXPECT_MYSQL_DATABASE" ]] \
  || die "$CONTAINER has MYSQL_DATABASE='$db_env', expected '$EXPECT_MYSQL_DATABASE'. Refusing: is this really the staging container?"
mem_limit="$(docker inspect -f '{{.HostConfig.Memory}}' "$CONTAINER")"
(( mem_limit >= MIN_MEM_BYTES )) \
  || die "container memory limit is $((mem_limit/1024/1024)) MiB (< 2 GiB). Raise it in docker-compose.yml and run 'docker compose up -d mysql_db_staging' first."
existing="$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET_DB'")"
[[ "$existing" == "0" ]] \
  || die "$TARGET_DB already has $existing tables. If you really want to reload it, drop it yourself first: DROP DATABASE \`$TARGET_DB\`"
log "checking dump $DUMP ..."
zcat "$DUMP" | tail -n 1 | grep -q '^-- Dump completed' || die "dump has no '-- Dump completed' footer (truncated?)"

# ── Header filter ────────────────────────────────────────────────────────────
FILTER='/^SET @@GLOBAL\.GTID_PURGED/d; /DROP DATABASE IF EXISTS `career-9`/d; /^CREATE DATABASE /d; /^USE `career-9`;/d'
leftover="$(zcat "$DUMP" | head -n 200 | sed -E "$FILTER" | grep -nE '^(USE |CREATE DATABASE|/\*!40000 DROP DATABASE|SET @@GLOBAL)' || true)"
[[ -z "$leftover" ]] || die "header still contains database-level statements after filtering:"$'\n'"$leftover"
expected_tables="$(zcat "$DUMP" | grep -c '^CREATE TABLE' || true)"

# ── Restore ──────────────────────────────────────────────────────────────────
started_at="$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER")"
log "dump:     $DUMP ($(du -h "$DUMP" | cut -f1), $expected_tables tables)"
log "target:   $CONTAINER / $TARGET_DB   mem=$(mem)   limit=$((mem_limit/1024/1024)) MiB"
q "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
log "restoring (several minutes; sql_log_bin=0 so the binlog is not doubled) ..."
set +e
zcat "$DUMP" \
  | sed -E "$FILTER" \
  | docker exec -i -e TARGET_DB="$TARGET_DB" "$CONTAINER" sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --max-allowed-packet=536870912 --init-command="SET SESSION sql_log_bin=0" "$TARGET_DB"'
st=("${PIPESTATUS[@]}")
set -e
if [[ "$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER")" != "$started_at" ]]; then
  die "mysqld RESTARTED during the restore (OOM-killed?). $TARGET_DB is partial: DROP DATABASE \`$TARGET_DB\` and retry with more memory."
fi
(( st[0] == 0 && st[1] == 0 && st[2] == 0 )) \
  || die "restore failed (zcat=${st[0]} sed=${st[1]} mysql=${st[2]}). $TARGET_DB is partial: DROP DATABASE \`$TARGET_DB\` and retry."

# ── Verify ───────────────────────────────────────────────────────────────────
tables="$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET_DB' AND table_type='BASE TABLE'")"
size_mb="$(q "SELECT ROUND(SUM(data_length+index_length)/1048576) FROM information_schema.tables WHERE table_schema='$TARGET_DB'")"
log "restored: $tables tables (dump had $expected_tables), ${size_mb} MB   mem=$(mem)"
[[ "$tables" == "$expected_tables" ]] || die "table count mismatch"
log "flyway:   $(q "SELECT CONCAT(installed_rank,' ',version,' ',description) FROM \`$TARGET_DB\`.flyway_schema_history ORDER BY installed_rank DESC LIMIT 1")"

# ── Flyway gap ───────────────────────────────────────────────────────────────
# Production already has 20260914001 applied. This branch's V20260910001 is a
# LOWER version, so Flyway (out-of-order=false on the sandbox profile) silently
# ignores it. Hibernate ddl-auto=update would add the column anyway, but then
# flyway_schema_history would never show it. Apply it and record it, with the
# checksum Flyway itself computed for this file on career-9-staging-v2.
if [[ "$(q "SELECT COUNT(*) FROM \`$TARGET_DB\`.flyway_schema_history WHERE version='20260910001'")" == "0" ]]; then
  if [[ "$(q "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='$TARGET_DB' AND table_name='generated_report' AND column_name='suppression_reason'")" == "0" ]]; then
    q "ALTER TABLE \`$TARGET_DB\`.generated_report ADD COLUMN suppression_reason VARCHAR(500) NULL AFTER pdf_status"
  fi
  q "INSERT INTO \`$TARGET_DB\`.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) SELECT MAX(installed_rank)+1, '20260910001', 'generated report suppression reason', 'SQL', 'V20260910001__generated_report_suppression_reason.sql', -1287837177, 'root', NOW(), 96, 1 FROM \`$TARGET_DB\`.flyway_schema_history"
  log "flyway:   applied and recorded V20260910001 (sandbox-only migration below prod's head)"
fi

DC="docker compose"; docker compose version >/dev/null 2>&1 || DC="docker-compose"
log "DONE. Next, rebuild the two JVMs that embed the sandbox datasource URL (application.yml points at $TARGET_DB):"
log "    cd $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd) && $DC build api-staging report-worker-staging && $DC up -d api-staging report-worker-staging"
