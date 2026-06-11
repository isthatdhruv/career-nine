#!/bin/bash
#
# repair-prod-flyway.sh
# ─────────────────────────────────────────────────────────────────────────────
# Fixes the Flyway startup failure on the PRODUCTION backend (api):
#
#   FlywayValidateException: Validate failed: Migrations have failed validation
#   Migration checksum mismatch for migration version 20260601008
#   -> Applied to database : 1126498585
#   -> Resolved locally    : -1407705226. Either revert the changes to the
#      migration, or run repair to update the schema history.
#
# Cause: a migration that was ALREADY APPLIED to prod had its file edited
# afterwards (here: the "cleaned db migration" commit + the dhruv-from-palak
# merge reformatted V20260601008__drop_legacy_report_type_subtype.sql). Flyway
# stores a checksum of each applied migration and refuses to start when the
# local file no longer matches.
#
# Flyway NEVER re-runs an already-applied version, so the schema change the
# migration made (dropping report_type/report_subtype) is untouched and stays
# done. The only fix needed is to realign the stored checksum with the current
# local file — exactly what `flyway repair` does. This script does that with a
# targeted UPDATE, taking the correct value straight from Flyway's own log
# output ("Resolved locally"), so no CRC has to be recomputed by hand.
#
# This is the CHECKSUM-MISMATCH counterpart to repair-staging-flyway.sh (which
# handles the *orphan* case — "applied migration not resolved locally" — via
# DELETE). For an orphan failure on prod, re-use that script with prod env vars:
#   DB_PORT=3306 DB_NAME=career-9 API_CONTAINER=api bash repair-staging-flyway.sh
#
# SAFE and IDEMPOTENT:
#   * auto-detects (version, old-checksum, new-checksum) by parsing the api
#     container's Flyway log — the authoritative source for the expected value
#   * only touches a version that EXISTS as a local migration file AND whose
#     row currently holds exactly the old checksum Flyway reported (so a second
#     run, or a row already at the new value, is a no-op — never a clobber)
#   * dumps flyway_schema_history to a timestamped backup before any change
#   * if there is nothing to repair it exits 0 without changes
#
# Run on the VPS, from the repo root:
#   bash repair-prod-flyway.sh              # detect + confirm + repair
#   bash repair-prod-flyway.sh --dry-run    # show what it WOULD change, no write
#   bash repair-prod-flyway.sh -y           # repair without the prompt
#   bash repair-prod-flyway.sh -y --restart # repair, then restart api + tail logs
#
# Manual override (e.g. if the api logs have already rotated away):
#   VERSION=20260601008 NEW_CHECKSUM=-1407705226 bash repair-prod-flyway.sh
#   VERSION=20260601008 OLD_CHECKSUM=1126498585 NEW_CHECKSUM=-1407705226 \
#     bash repair-prod-flyway.sh -y
#
# Other env overrides:
#   DB_PORT=3306 DB_NAME=career-9 DB_CONTAINER=career-nine-mysql_db_api-1 ...
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config (env-overridable; defaults match the VPS production setup) ──────────
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"                        # production MySQL host port (docker-compose maps 3306->3306)
DB_NAME="${DB_NAME:-career-9}"
DB_USER="${DB_USER:-root}"
# Password: explicit DB_PASSWORD wins, else MYSQL_ROOT_PASSWORD from the env,
# else the known compose default. Never placed on a command line (uses MYSQL_PWD).
DB_PASSWORD="${DB_PASSWORD:-${MYSQL_ROOT_PASSWORD:-Career-qCsfeuECc3MW}}"
DB_CONTAINER="${DB_CONTAINER:-}"                  # set to career-nine-mysql_db_api-1 to use docker exec instead of host client
API_CONTAINER="${API_CONTAINER:-api}"             # container whose logs are parsed and which --restart restarts
HISTORY_TABLE="${HISTORY_TABLE:-flyway_schema_history}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="${MIGRATION_DIR:-$SCRIPT_DIR/spring-social/src/main/resources/db/migration}"
BACKUP_DIR="${BACKUP_DIR:-/tmp}"
LOG_TAIL="${LOG_TAIL:-600}"                        # how many lines of api log to scan for mismatch blocks

# Optional explicit override: skip log auto-detection and repair exactly this one.
VERSION="${VERSION:-}"
OLD_CHECKSUM="${OLD_CHECKSUM:-}"                   # optional in manual mode (read from DB if omitted)
NEW_CHECKSUM="${NEW_CHECKSUM:-}"

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
      sed -n '2,56p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown argument: $arg (use --help)"; exit 2 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# ── DB access helpers (host mysql client, or docker exec if DB_CONTAINER set) ──
# Password is passed via MYSQL_PWD, never on the command line.
run_sql() {   # raw, tab-separated, no headers (for parsing)
  if [ -n "$DB_CONTAINER" ]; then
    docker exec -e MYSQL_PWD="$DB_PASSWORD" "$DB_CONTAINER" \
      mysql -u "$DB_USER" -N -e "$1" "$DB_NAME"
  else
    MYSQL_PWD="$DB_PASSWORD" mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" \
      -u "$DB_USER" -N -e "$1" "$DB_NAME"
  fi
}
show_sql() {  # pretty boxed table (for humans)
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

# Does a local migration file V<version>__*.sql exist? (sanity guard)
local_file_for() {
  ls -1 "$MIGRATION_DIR"/V"$1"__*.sql 2>/dev/null | head -n1
}

# ── 1. Connectivity / sanity ──────────────────────────────────────────────────
log "Target: ${DB_USER}@${DB_CONTAINER:-${DB_HOST}:${DB_PORT}} db=${DB_NAME} table=${HISTORY_TABLE}"
run_sql "SELECT 1" >/dev/null 2>&1 || die "Cannot connect to the production database. Check DB_HOST/DB_PORT/DB_CONTAINER and creds."

if [ "$(run_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='${HISTORY_TABLE}'")" != "1" ]; then
  die "Table ${DB_NAME}.${HISTORY_TABLE} does not exist — wrong DB? Nothing to repair."
fi

echo
log "Current applied migrations (tail):"
show_sql "SELECT installed_rank,version,LEFT(description,38) AS description,success,checksum,installed_on
          FROM ${HISTORY_TABLE} WHERE version IS NOT NULL
          ORDER BY installed_rank DESC LIMIT 8"

# ── 2. Determine which (version, old, new) checksums to repair ─────────────────
# Each entry in MISMATCHES is "version|old_checksum|new_checksum".
declare -a MISMATCHES=()

if [ -n "$VERSION" ]; then
  # Manual mode: operator named the version explicitly.
  [ -n "$NEW_CHECKSUM" ] || die "VERSION set but NEW_CHECKSUM not given. Provide NEW_CHECKSUM=<resolved-locally value>."
  if [ -z "$OLD_CHECKSUM" ]; then
    OLD_CHECKSUM="$(run_sql "SELECT checksum FROM ${HISTORY_TABLE} WHERE version='${VERSION}'" || true)"
    [ -n "$OLD_CHECKSUM" ] || die "Version ${VERSION} not found in ${HISTORY_TABLE}; cannot determine its current checksum."
  fi
  MISMATCHES+=("${VERSION}|${OLD_CHECKSUM}|${NEW_CHECKSUM}")
else
  # Auto-detect mode: parse the api container's Flyway log for mismatch blocks.
  #   Migration checksum mismatch for migration version <V>
  #   -> Applied to database : <OLD>
  #   -> Resolved locally    : <NEW>. ...
  docker inspect "$API_CONTAINER" >/dev/null 2>&1 \
    || die "Container '${API_CONTAINER}' not found. Set API_CONTAINER=... or use manual mode (VERSION=/NEW_CHECKSUM=)."

  logs="$(docker logs --tail "$LOG_TAIL" "$API_CONTAINER" 2>&1 || true)"
  declare -A SEEN_OLD=() SEEN_NEW=()
  cur_ver=""; cur_old=""
  while IFS= read -r line; do
    case "$line" in
      *"checksum mismatch for migration version"*)
        cur_ver="$(printf '%s' "$line" | grep -oE 'version[[:space:]]+[0-9]+' | grep -oE '[0-9]+' || true)"
        cur_old="" ;;
      *"Applied to database"*)
        cur_old="$(printf '%s' "$line" | grep -oE ':[[:space:]]*-?[0-9]+' | grep -oE '\-?[0-9]+' || true)" ;;
      *"Resolved locally"*)
        cur_new="$(printf '%s' "$line" | grep -oE ':[[:space:]]*-?[0-9]+' | grep -oE '\-?[0-9]+' || true)"
        if [ -n "$cur_ver" ] && [ -n "$cur_old" ] && [ -n "$cur_new" ]; then
          SEEN_OLD["$cur_ver"]="$cur_old"     # last occurrence per version wins (most recent crash)
          SEEN_NEW["$cur_ver"]="$cur_new"
        fi
        cur_ver=""; cur_old="" ;;
    esac
  done <<< "$logs"

  if [ "${#SEEN_NEW[@]}" -eq 0 ]; then
    echo
    log "No 'checksum mismatch' lines found in the last ${LOG_TAIL} lines of '${API_CONTAINER}'."
    log "Either the failure is a different kind (e.g. orphan rows — see repair-staging-flyway.sh),"
    log "or the logs have rotated. Re-run in manual mode: VERSION=... NEW_CHECKSUM=... bash $(basename "$0")"
    exit 0
  fi
  for v in "${!SEEN_NEW[@]}"; do
    MISMATCHES+=("${v}|${SEEN_OLD[$v]}|${SEEN_NEW[$v]}")
  done
fi

# ── 3. Filter to the rows that genuinely need (and are safe to) repair ─────────
# Keep a version only if: a local file exists, the row exists, its current
# checksum equals the reported OLD, and OLD != NEW. Anything else is reported
# and skipped (never clobbered).
declare -a TODO=()
for entry in "${MISMATCHES[@]}"; do
  IFS='|' read -r v old new <<< "$entry"

  file="$(local_file_for "$v" || true)"
  if [ -z "$file" ]; then
    log "SKIP ${v}: no local migration file V${v}__*.sql — this is an ORPHAN, not a checksum mismatch."
    log "     Handle with repair-staging-flyway.sh (DELETE), not this script."
    continue
  fi

  current="$(run_sql "SELECT checksum FROM ${HISTORY_TABLE} WHERE version='${v}'" || true)"
  if [ -z "$current" ]; then
    log "SKIP ${v}: no row in ${HISTORY_TABLE} (nothing applied to repair)."
    continue
  fi
  if [ "$current" = "$new" ]; then
    log "SKIP ${v}: stored checksum already equals the local value (${new}) — already repaired."
    continue
  fi
  if [ "$current" != "$old" ]; then
    log "SKIP ${v}: DB checksum (${current}) does not match the reported applied value (${old})."
    log "     Refusing to overwrite an unexpected value. Investigate manually."
    continue
  fi
  TODO+=("${v}|${old}|${new}|${file}")
done

if [ "${#TODO[@]}" -eq 0 ]; then
  echo
  log "✓ Nothing to repair — ${DB_NAME}.${HISTORY_TABLE} checksums are already consistent."
  log "  Flyway validation will pass; just (re)start ${API_CONTAINER}."
  [ "$DO_RESTART" -eq 1 ] && { echo; log "Restarting ${API_CONTAINER}..."; docker restart "$API_CONTAINER" >/dev/null && docker logs --tail 40 "$API_CONTAINER"; }
  exit 0
fi

# Show the planned changes.
echo
log "Planned checksum repairs (UPDATE stored checksum → local file value):"
printf '       %-16s %-14s -> %-14s  %s\n' "VERSION" "OLD (DB)" "NEW (local)" "FILE"
for t in "${TODO[@]}"; do
  IFS='|' read -r v old new file <<< "$t"
  printf '       %-16s %-14s -> %-14s  %s\n' "$v" "$old" "$new" "$(basename "$file")"
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo; log "--dry-run: no changes made."
  exit 0
fi

# ── 4. Confirm ────────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" -ne 1 ]; then
  echo
  read -r -p "Apply ${#TODO[@]} checksum repair(s) to ${DB_NAME}.${HISTORY_TABLE}? [y/N] " ans
  case "$ans" in y|Y|yes|YES) ;; *) log "Aborted by user. No changes made."; exit 0 ;; esac
fi

# ── 5. Backup, then update in a single transaction ────────────────────────────
ts="$(date '+%Y-%m-%d_%H-%M-%S')"
backup="${BACKUP_DIR%/}/flyway_schema_history_${DB_NAME}_${ts}.sql"
mkdir -p "$BACKUP_DIR"
log "Backing up ${HISTORY_TABLE} → ${backup}"
dump_table "$backup"
[ -s "$backup" ] || die "Backup is empty — aborting before any update."
log "Backup OK ($(du -h "$backup" | cut -f1)). Restore with: mysql ${DB_NAME} < ${backup}"

# Build the transaction. The "AND checksum = old" guard keeps this idempotent
# and prevents overwriting any value other than the one Flyway reported.
sql="START TRANSACTION;"
for t in "${TODO[@]}"; do
  IFS='|' read -r v old new file <<< "$t"
  sql+=" UPDATE ${HISTORY_TABLE} SET checksum = ${new} WHERE version = '${v}' AND checksum = ${old};"
done
sql+=" COMMIT;"

log "Applying checksum repair(s)..."
run_sql "$sql"

# ── 6. Verify ─────────────────────────────────────────────────────────────────
fail=0
for t in "${TODO[@]}"; do
  IFS='|' read -r v old new file <<< "$t"
  now="$(run_sql "SELECT checksum FROM ${HISTORY_TABLE} WHERE version='${v}'" || true)"
  if [ "$now" = "$new" ]; then
    log "  ✓ ${v}: checksum now ${now}"
  else
    log "  ✗ ${v}: expected ${new}, found ${now}"; fail=1
  fi
done
[ "$fail" -eq 0 ] || die "One or more rows did not update as expected. Inspect manually; restore from ${backup} if needed."

leftover="$(run_sql "SELECT COUNT(*) FROM ${HISTORY_TABLE} WHERE success=0" || true)"
[ "${leftover:-0}" = "0" ] || log "WARN: ${leftover} row(s) with success=0 present — Flyway may still complain; review them."

echo
log "✓ Repair complete. Flyway checksum validation will now pass for: $(for t in "${TODO[@]}"; do IFS='|' read -r v _ _ _ <<< "$t"; printf '%s ' "$v"; done)"

# ── 7. Optional restart ───────────────────────────────────────────────────────
if [ "$DO_RESTART" -eq 1 ]; then
  echo
  log "Restarting ${API_CONTAINER}..."
  docker restart "$API_CONTAINER" >/dev/null
  log "Recent ${API_CONTAINER} logs (Ctrl-C to stop following):"
  docker logs --tail 40 -f "$API_CONTAINER"
else
  echo
  log "Next: restart the production backend, e.g.  docker restart ${API_CONTAINER}"
  log "      (or re-run with --restart to do it now)"
fi
