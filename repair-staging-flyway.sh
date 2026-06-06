#!/bin/bash
#
# repair-staging-flyway.sh
# ─────────────────────────────────────────────────────────────────────────────
# Fixes the Flyway startup failure on the STAGING backend (api-staging):
#
#   FlywayValidateException: Validate failed: Migrations have failed validation
#   Detected applied migration not resolved locally: 20260603002 ...
#   Detected applied migration not resolved locally: 20260603003 ...
#
# Cause: those migrations were applied directly to the staging DB but never
# committed to git, so Flyway can't match them to a local file and aborts on
# startup. The fix is the same as `flyway repair`: drop the orphan rows from
# `flyway_schema_history` so validation passes. The schema objects they created
# (if any) are left untouched.
#
# This script is SAFE and IDEMPOTENT:
#   * dumps flyway_schema_history to a timestamped backup before touching it
#   * only removes versions that are recorded as applied but NOT present in the
#     local migration folder AND older than the newest local migration
#     (guards against running from a stale checkout)
#   * if there is nothing to repair it exits 0 without changes
#
# Run on the VPS, from the repo root:
#   bash repair-staging-flyway.sh             # detect + confirm + repair
#   bash repair-staging-flyway.sh --dry-run   # show what it WOULD remove, no change
#   bash repair-staging-flyway.sh -y          # repair without the prompt
#   bash repair-staging-flyway.sh -y --restart  # repair, then restart api-staging
#
# Override anything via env vars, e.g.:
#   DB_PORT=3307 DB_NAME=career-9-staging ORPHAN_VERSIONS="20260603002 20260603003" \
#     bash repair-staging-flyway.sh -y
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config (env-overridable; defaults match the VPS staging setup) ────────────
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3307}"                       # staging MySQL host port (see sync-master-to-staging.sh)
DB_NAME="${DB_NAME:-career-9-staging}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-Career-qCsfeuECc3MW}"
DB_CONTAINER="${DB_CONTAINER:-}"                 # set to e.g. mysql_db_staging to use `docker exec` instead of host client
API_CONTAINER="${API_CONTAINER:-api-staging}"    # container restarted by --restart
HISTORY_TABLE="${HISTORY_TABLE:-flyway_schema_history}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="${MIGRATION_DIR:-$SCRIPT_DIR/spring-social/src/main/resources/db/migration}"
BACKUP_DIR="${BACKUP_DIR:-/tmp}"

# Optional explicit override: skip auto-detection and target exactly these versions.
ORPHAN_VERSIONS="${ORPHAN_VERSIONS:-}"

# ── Flags ─────────────────────────────────────────────────────────────────────
ASSUME_YES=0
DRY_RUN=0
DO_RESTART=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes)      ASSUME_YES=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --restart)     DO_RESTART=1 ;;
    -h|--help)
      sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown argument: $arg (use --help)"; exit 2 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# ── DB access helpers (host mysql client, or docker exec if DB_CONTAINER set) ──
# run_sql <sql>      -> raw, tab-separated, no headers (for parsing)
# show_sql <sql>     -> pretty boxed table (for humans)
run_sql() {
  if [ -n "$DB_CONTAINER" ]; then
    docker exec -e MYSQL_PWD="$DB_PASSWORD" "$DB_CONTAINER" \
      mysql -u "$DB_USER" -N -e "$1" "$DB_NAME"
  else
    MYSQL_PWD="$DB_PASSWORD" mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" \
      -u "$DB_USER" -N -e "$1" "$DB_NAME"
  fi
}
show_sql() {
  if [ -n "$DB_CONTAINER" ]; then
    docker exec -e MYSQL_PWD="$DB_PASSWORD" "$DB_CONTAINER" \
      mysql -u "$DB_USER" -t -e "$1" "$DB_NAME"
  else
    MYSQL_PWD="$DB_PASSWORD" mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" \
      -u "$DB_USER" -t -e "$1" "$DB_NAME"
  fi
}
dump_table() {
  local out="$1"
  if [ -n "$DB_CONTAINER" ]; then
    docker exec -e MYSQL_PWD="$DB_PASSWORD" "$DB_CONTAINER" \
      mysqldump -u "$DB_USER" --no-tablespaces --skip-comments "$DB_NAME" "$HISTORY_TABLE" > "$out"
  else
    MYSQL_PWD="$DB_PASSWORD" mysqldump --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" \
      -u "$DB_USER" --no-tablespaces --skip-comments "$DB_NAME" "$HISTORY_TABLE" > "$out"
  fi
}

# ── 1. Connectivity / sanity ──────────────────────────────────────────────────
log "Target: ${DB_USER}@${DB_CONTAINER:-${DB_HOST}:${DB_PORT}} db=${DB_NAME} table=${HISTORY_TABLE}"
run_sql "SELECT 1" >/dev/null 2>&1 || die "Cannot connect to the staging database. Check DB_HOST/DB_PORT/DB_CONTAINER and creds."

if [ "$(run_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='${HISTORY_TABLE}'")" != "1" ]; then
  die "Table ${DB_NAME}.${HISTORY_TABLE} does not exist — wrong DB? Nothing to repair."
fi

echo
log "Current applied migrations (tail):"
show_sql "SELECT installed_rank,version,description,type,success,installed_on
          FROM ${HISTORY_TABLE} WHERE version IS NOT NULL
          ORDER BY installed_rank DESC LIMIT 8"

# ── 2. Determine which versions are orphans ───────────────────────────────────
mapfile -t db_versions < <(run_sql "SELECT version FROM ${HISTORY_TABLE} WHERE version IS NOT NULL ORDER BY version")
[ "${#db_versions[@]}" -gt 0 ] || die "No versioned migrations found in history — refusing to touch anything."

declare -a orphans=()

if [ -n "$ORPHAN_VERSIONS" ]; then
  # Explicit mode: only remove the versions the operator named (that actually exist).
  for v in ${ORPHAN_VERSIONS//,/ }; do
    if printf '%s\n' "${db_versions[@]}" | grep -qx "$v"; then
      orphans+=("$v")
    else
      log "Note: version $v not present in history (already gone) — skipping."
    fi
  done
else
  # Auto-detect mode: compare history against the local migration folder.
  [ -d "$MIGRATION_DIR" ] || die "Migration folder not found: $MIGRATION_DIR
       Run from the repo root, or set MIGRATION_DIR=..., or pass ORPHAN_VERSIONS=\"...\"."
  mapfile -t local_versions < <(ls -1 "$MIGRATION_DIR" 2>/dev/null \
      | grep -oE '^V[0-9]+' | sed 's/^V//' | sort -u)
  [ "${#local_versions[@]}" -ge 10 ] || die "Only ${#local_versions[@]} local migrations found in $MIGRATION_DIR — looks like a wrong/empty checkout. Aborting for safety."

  # Newest local version: anything applied but NEWER than this is 'ahead of checkout',
  # which is a checkout problem, not a true orphan — we warn but never delete it.
  max_local="$(printf '%s\n' "${local_versions[@]}" | sort | tail -n1)"

  for v in "${db_versions[@]}"; do
    if printf '%s\n' "${local_versions[@]}" | grep -qx "$v"; then
      continue                                   # resolved locally → fine
    fi
    if (( 10#$v > 10#$max_local )); then
      log "WARN: applied version $v is newer than newest local ($max_local). NOT removing —"
      log "      your checkout may be behind. Investigate manually if this is unexpected."
      continue
    fi
    orphans+=("$v")                              # applied, not local, older than tip → orphan
  done
fi

if [ "${#orphans[@]}" -eq 0 ]; then
  echo
  log "✓ No orphan rows to remove — ${DB_NAME}.${HISTORY_TABLE} is already consistent."
  log "  Flyway validation will pass; just (re)start ${API_CONTAINER}."
  [ "$DO_RESTART" -eq 1 ] && { echo; log "Restarting ${API_CONTAINER}..."; docker restart "$API_CONTAINER" && docker logs --tail 40 "$API_CONTAINER"; }
  exit 0
fi

# Build a quoted IN-list: '20260603002','20260603003'
in_list=""
for v in "${orphans[@]}"; do in_list="${in_list:+$in_list,}'$v'"; done

echo
log "Orphan rows to remove (applied in DB, missing locally):"
show_sql "SELECT installed_rank,version,description,type,success,installed_on
          FROM ${HISTORY_TABLE} WHERE version IN ($in_list)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo; log "--dry-run: no changes made. Would DELETE versions: ${orphans[*]}"
  exit 0
fi

# ── 3. Confirm ────────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" -ne 1 ]; then
  echo
  read -r -p "Delete ${#orphans[@]} orphan row(s) from ${DB_NAME}.${HISTORY_TABLE}? [y/N] " ans
  case "$ans" in y|Y|yes|YES) ;; *) log "Aborted by user. No changes made."; exit 0 ;; esac
fi

# ── 4. Backup, then delete in a transaction ───────────────────────────────────
ts="$(date '+%Y-%m-%d_%H-%M-%S')"
backup="${BACKUP_DIR%/}/flyway_schema_history_${DB_NAME}_${ts}.sql"
mkdir -p "$BACKUP_DIR"
log "Backing up ${HISTORY_TABLE} → ${backup}"
dump_table "$backup"
[ -s "$backup" ] || die "Backup is empty — aborting before any delete."
log "Backup OK ($(du -h "$backup" | cut -f1)). Restore with: mysql ${DB_NAME} < ${backup}"

log "Deleting orphan rows..."
run_sql "START TRANSACTION;
         DELETE FROM ${HISTORY_TABLE} WHERE version IN ($in_list);
         COMMIT;"

# ── 5. Verify ─────────────────────────────────────────────────────────────────
remaining="$(run_sql "SELECT COUNT(*) FROM ${HISTORY_TABLE} WHERE version IN ($in_list)")"
[ "$remaining" = "0" ] || die "Expected 0 orphan rows after delete, found $remaining. Inspect manually."
failed="$(run_sql "SELECT COUNT(*) FROM ${HISTORY_TABLE} WHERE success=0")"
[ "$failed" = "0" ] || log "WARN: ${failed} row(s) with success=0 still present — Flyway may still complain; review them."

echo
log "✓ Repair complete. Removed: ${orphans[*]}"
log "  ${DB_NAME}.${HISTORY_TABLE} no longer has migrations missing locally; Flyway validation will pass."

# ── 6. Optional restart ───────────────────────────────────────────────────────
if [ "$DO_RESTART" -eq 1 ]; then
  echo
  log "Restarting ${API_CONTAINER}..."
  docker restart "$API_CONTAINER"
  log "Recent ${API_CONTAINER} logs (Ctrl-C to stop following):"
  docker logs --tail 40 -f "$API_CONTAINER"
else
  echo
  log "Next: restart the staging backend, e.g.  docker restart ${API_CONTAINER}"
  log "      (or re-run with --restart to do it now)"
fi
