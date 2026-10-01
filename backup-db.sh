#!/usr/bin/env bash
#
# backup-db.sh — on-demand dump of the live MySQL database(s) into ./backup/
#
# Usage:
#   ./backup-db.sh               dump this checkout's own environment (see below)
#   ./backup-db.sh production    dump production  -> career-9
#   ./backup-db.sh staging       dump staging     -> career-9-staging
#   ./backup-db.sh all           dump both
#
# Default target is chosen from the folder name:
#   career-nine-sandbox/  -> staging
#   career-nine/          -> production
#
# Output: ./backup/<db>_<YYYY-MM-DD_HH-MM-SS>.sql.gz  (next to this script)
# Nothing in ./backup/ is ever deleted by this script.
#
# The dump runs INSIDE the MySQL container with that container's own mysqldump
# and MYSQL_ROOT_PASSWORD, so no credentials are stored here and there is no
# client/server version mismatch (host mysqldump is 8.0, the servers are 9.x).
#
# Memory note: each MySQL container has a compose memory limit. If mysqld is
# already close to it, a dump can push it over; the kernel then OOM-kills
# mysqld, Docker restarts the container and the dump fails. The script warns
# before dumping when usage is high and reports a mid-dump restart explicitly.
#
# Restore into the same server (the dump includes CREATE DATABASE IF NOT EXISTS + USE):
#   gunzip < backup/<file>.sql.gz \
#     | docker exec -i <container> sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backup"

# Container -> database mapping, from docker-compose.yml in each checkout.
PRODUCTION_CONTAINER="career-nine-mysql_db_api-1"
PRODUCTION_DB="career-9"
STAGING_CONTAINER="career-nine-sandbox-mysql_db_staging-1"
STAGING_DB="career-9-staging-v3"

# Warn before dumping when the container already uses at least this % of its memory limit.
MEM_WARN_PERCENT=85

case "$(basename "$SCRIPT_DIR")" in
  *sandbox*) DEFAULT_TARGET="staging" ;;
  *)         DEFAULT_TARGET="production" ;;
esac

usage() {
  cat <<USAGE
Usage: $(basename "$0") [production|staging|all]
  (no argument) -> ${DEFAULT_TARGET}   (derived from folder '$(basename "$SCRIPT_DIR")')
Dumps are written to: ${BACKUP_DIR}/
USAGE
}

TARGET="${1:-$DEFAULT_TARGET}"
case "$TARGET" in
  production|prod)  TARGETS=(production) ;;
  staging|stage)    TARGETS=(staging) ;;
  all|both)         TARGETS=(production staging) ;;
  -h|--help|help)   usage; exit 0 ;;
  *) echo "ERROR: unknown target '$TARGET'" >&2; usage >&2; exit 2 ;;
esac

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# pigz (parallel gzip) if installed, plain gzip otherwise. Output is standard .gz either way.
GZIP_BIN="$(command -v pigz || command -v gzip)"

container_started_at() { docker inspect -f '{{.State.StartedAt}}' "$1" 2>/dev/null || true; }

dump_one() {
  local env="$1" container db stamp out tmp footer size tables started_at mem_pct
  case "$env" in
    production) container="$PRODUCTION_CONTAINER"; db="$PRODUCTION_DB" ;;
    staging)    container="$STAGING_CONTAINER";    db="$STAGING_DB" ;;
  esac

  if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" != "true" ]]; then
    log "ERROR: $env container '$container' is not running"
    return 1
  fi
  started_at="$(container_started_at "$container")"

  # Pre-flight: warn if mysqld is already near its cgroup limit (see memory note above).
  mem_pct="$(docker stats --no-stream --format '{{.MemPerc}}' "$container" 2>/dev/null || true)"
  if [[ "$mem_pct" =~ ^([0-9]+) ]] && (( BASH_REMATCH[1] >= MEM_WARN_PERCENT )); then
    log "WARNING: $env container is at ${mem_pct} of its memory limit; the dump may get mysqld OOM-killed" \
        "(container restarts, dump fails). Raise its limit or lower --innodb-buffer-pool-size in docker-compose.yml."
  fi

  stamp="$(date '+%Y-%m-%d_%H-%M-%S')"
  out="$BACKUP_DIR/${db}_${stamp}.sql.gz"
  tmp="$out.part"

  log "$env: dumping '$db' from $container ..."
  # MYSQL_PWD keeps the password out of the command line / process list.
  # --single-transaction = consistent InnoDB snapshot without locking the live DB.
  set +e
  docker exec -e DB="$db" "$container" sh -c '
        MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot \
          --single-transaction --quick --hex-blob \
          --routines --triggers --events \
          --add-drop-table --set-gtid-purged=OFF \
          --databases "$DB"' \
    | "$GZIP_BIN" > "$tmp"
  local -a st=("${PIPESTATUS[@]}")
  set -e
  if (( st[0] != 0 || st[1] != 0 )); then
    rm -f "$tmp"
    log "ERROR: $env dump failed (mysqldump/docker exec exit ${st[0]}, ${GZIP_BIN##*/} exit ${st[1]})"
    if [[ "$(container_started_at "$container")" != "$started_at" ]]; then
      log "ERROR: $env container RESTARTED during the dump: mysqld was most likely OOM-killed at its compose memory limit." \
          "Check: dmesg -T | grep -i 'out of memory'   and   docker inspect $container"
    fi
    return 1
  fi

  # A truncated dump is worse than none: require mysqldump's closing marker
  # (zcat also fails here if the gzip stream itself is damaged).
  if ! footer="$(zcat "$tmp" | tail -n 1)" || [[ "$footer" != "-- Dump completed"* ]]; then
    rm -f "$tmp"
    log "ERROR: $env dump is incomplete (no '-- Dump completed' footer)"
    return 1
  fi

  mv "$tmp" "$out"
  size="$(du -h "$out" | cut -f1)"
  tables="$(docker exec -e DB="$db" "$container" sh -c '
        MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -e \
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"$DB\" AND table_type=\"BASE TABLE\""' \
        2>/dev/null || echo '?')"
  log "$env: OK  $out  (${size}, ${tables} tables in '$db')"
}

mkdir -p "$BACKUP_DIR"
log "target: ${TARGETS[*]}  ->  $BACKUP_DIR/"

rc=0
for env in "${TARGETS[@]}"; do
  dump_one "$env" || rc=1
done
exit "$rc"
