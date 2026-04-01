#!/bin/bash
# ============================================================================
# Career-9 Daily Backup Script
# Backs up: MySQL database + project files → uploads to DigitalOcean Spaces
# Usage:   ./backup.sh
# Cron:    0 2 * * * /path/to/career-nine/backup.sh >> /path/to/career-nine/backups/backup.log 2>&1
# ============================================================================

set -euo pipefail

# ── Configuration ──
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_LOCAL_DIR="${PROJECT_DIR}/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
DAY_FOLDER=$(date +"%Y-%m-%d")
BACKUP_NAME="career9_backup_${DATE}"

# Database (env vars override defaults — used by Docker backup container)
DB_NAME="${DB_NAME:-career-9}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-Career-qCsfeuECc3MW}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DOCKER_MYSQL_CONTAINER="mysql_db_api"

# DigitalOcean Spaces (S3-compatible) — env vars override defaults
DO_BUCKET="${DO_SPACES_BUCKET:-storage-c9}"
DO_REGION="${DO_SPACES_REGION:-sgp1}"
DO_ENDPOINT="${DO_SPACES_ENDPOINT:-https://sgp1.digitaloceanspaces.com}"
DO_ACCESS_KEY="${DO_SPACES_ACCESS_KEY:-}"
DO_SECRET_KEY="${DO_SPACES_SECRET_KEY:-}"
DO_BACKUP_PATH="backups/${DAY_FOLDER}"

# Retention: keep last N days of local backups
LOCAL_RETENTION_DAYS=7

# Files/folders to exclude from project backup
EXCLUDE_PATTERNS=(
    "node_modules"
    ".git"
    "target"
    "backups"
    "*.jar"
    "*.class"
    ".idea"
    ".vscode"
    "build"
    "dist"
    "mysql_data"
    "redis_data"
    "*.log"
)

# ============================================================================
echo "============================================================"
echo "  Career-9 Backup — ${DATE}"
echo "============================================================"
echo ""

# ── Ensure local backup dir exists ──
mkdir -p "${BACKUP_LOCAL_DIR}/${DAY_FOLDER}"
WORK_DIR="${BACKUP_LOCAL_DIR}/${DAY_FOLDER}"

# ── Step 1: Database Dump ──
echo "[1/4] Dumping MySQL database '${DB_NAME}'..."
DB_DUMP_FILE="${WORK_DIR}/${BACKUP_NAME}_db.sql.gz"

# Try local mysqldump first (works inside backup container + local dev),
# then fall back to docker exec
if command -v mysqldump &>/dev/null; then
    echo "  Using mysqldump → ${DB_HOST}:${DB_PORT}"
    mysqldump -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" \
        --single-transaction --routines --triggers --events \
        "${DB_NAME}" 2>/dev/null | gzip > "${DB_DUMP_FILE}"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_MYSQL_CONTAINER}$"; then
    echo "  Using Docker container: ${DOCKER_MYSQL_CONTAINER}"
    docker exec "${DOCKER_MYSQL_CONTAINER}" \
        mysqldump -u"${DB_USER}" -p"${DB_PASSWORD}" \
        --single-transaction --routines --triggers --events \
        "${DB_NAME}" 2>/dev/null | gzip > "${DB_DUMP_FILE}"
else
    echo "  WARNING: Neither mysqldump nor Docker MySQL container found. Skipping DB backup."
    DB_DUMP_FILE=""
fi

if [ -n "${DB_DUMP_FILE}" ] && [ -f "${DB_DUMP_FILE}" ]; then
    DB_SIZE=$(du -h "${DB_DUMP_FILE}" | cut -f1)
    echo "  Done: ${DB_DUMP_FILE} (${DB_SIZE})"
else
    echo "  WARNING: DB dump failed or empty."
fi

# ── Step 2: Project Files Archive ──
echo ""
echo "[2/4] Archiving project files..."
PROJECT_ARCHIVE="${WORK_DIR}/${BACKUP_NAME}_files.tar.gz"

EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="${EXCLUDE_ARGS} --exclude=${pattern}"
done

tar czf "${PROJECT_ARCHIVE}" \
    -C "$(dirname "${PROJECT_DIR}")" \
    ${EXCLUDE_ARGS} \
    "$(basename "${PROJECT_DIR}")" 2>/dev/null || true

if [ -f "${PROJECT_ARCHIVE}" ]; then
    FILES_SIZE=$(du -h "${PROJECT_ARCHIVE}" | cut -f1)
    echo "  Done: ${PROJECT_ARCHIVE} (${FILES_SIZE})"
else
    echo "  WARNING: Project archive failed."
fi

# ── Step 3: Upload to DigitalOcean Spaces ──
echo ""
echo "[3/4] Uploading to DigitalOcean Spaces (${DO_BUCKET}/${DO_BACKUP_PATH})..."

# Check if aws CLI is available, if not try s3cmd, if not use curl
upload_to_spaces() {
    local FILE_PATH="$1"
    local REMOTE_KEY="$2"
    local CONTENT_TYPE="${3:-application/octet-stream}"

    if command -v aws &>/dev/null; then
        AWS_ACCESS_KEY_ID="${DO_ACCESS_KEY}" \
        AWS_SECRET_ACCESS_KEY="${DO_SECRET_KEY}" \
        aws s3 cp "${FILE_PATH}" "s3://${DO_BUCKET}/${REMOTE_KEY}" \
            --endpoint-url "${DO_ENDPOINT}" \
            --acl private \
            --quiet
        return $?
    fi

    if command -v s3cmd &>/dev/null; then
        s3cmd put "${FILE_PATH}" "s3://${DO_BUCKET}/${REMOTE_KEY}" \
            --access_key="${DO_ACCESS_KEY}" \
            --secret_key="${DO_SECRET_KEY}" \
            --host="${DO_REGION}.digitaloceanspaces.com" \
            --host-bucket="%(bucket)s.${DO_REGION}.digitaloceanspaces.com" \
            --no-progress \
            --quiet
        return $?
    fi

    # Fallback: curl with S3 v4 signing
    local DATE_STAMP=$(date -u +"%Y%m%d")
    local DATETIME=$(date -u +"%Y%m%dT%H%M%SZ")
    local FILE_NAME=$(basename "${FILE_PATH}")

    # Use python for S3 signing (available on most systems)
    python3 - "${FILE_PATH}" "${DO_BUCKET}" "${REMOTE_KEY}" "${DO_ACCESS_KEY}" "${DO_SECRET_KEY}" "${DO_REGION}" "${DO_ENDPOINT}" <<'PYEOF'
import sys, os, hashlib, hmac, datetime, requests

file_path = sys.argv[1]
bucket = sys.argv[2]
key = sys.argv[3]
access_key = sys.argv[4]
secret_key = sys.argv[5]
region = sys.argv[6]
endpoint = sys.argv[7]

with open(file_path, 'rb') as f:
    payload = f.read()

now = datetime.datetime.utcnow()
datestamp = now.strftime('%Y%m%d')
amzdate = now.strftime('%Y%m%dT%H%M%SZ')
payload_hash = hashlib.sha256(payload).hexdigest()

headers = {
    'x-amz-date': amzdate,
    'x-amz-content-sha256': payload_hash,
    'x-amz-acl': 'private',
    'Content-Type': 'application/octet-stream',
}

canonical_uri = f'/{key}'
canonical_querystring = ''
canonical_headers = ''.join(f'{k.lower()}:{v}\n' for k, v in sorted(headers.items()))
signed_headers = ';'.join(k.lower() for k in sorted(headers.keys()))

canonical_request = f'PUT\n{canonical_uri}\n{canonical_querystring}\nhost:{bucket}.{region}.digitaloceanspaces.com\n{canonical_headers}\nhost;{signed_headers}\n{payload_hash}'

algorithm = 'AWS4-HMAC-SHA256'
credential_scope = f'{datestamp}/{region}/s3/aws4_request'
string_to_sign = f'{algorithm}\n{amzdate}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode()).hexdigest()}'

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

signing_key = sign(sign(sign(sign(f'AWS4{secret_key}'.encode('utf-8'), datestamp), region), 's3'), 'aws4_request')
signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

headers['Authorization'] = f'{algorithm} Credential={access_key}/{credential_scope}, SignedHeaders=host;{signed_headers}, Signature={signature}'
headers['Host'] = f'{bucket}.{region}.digitaloceanspaces.com'

url = f'https://{bucket}.{region}.digitaloceanspaces.com/{key}'
resp = requests.put(url, data=payload, headers=headers)
if resp.status_code in (200, 204):
    print(f'  Uploaded: {key}')
else:
    print(f'  FAILED ({resp.status_code}): {resp.text[:200]}', file=sys.stderr)
    sys.exit(1)
PYEOF
    return $?
}

UPLOAD_OK=0
UPLOAD_FAIL=0

# Upload DB dump
if [ -n "${DB_DUMP_FILE}" ] && [ -f "${DB_DUMP_FILE}" ]; then
    REMOTE_KEY="${DO_BACKUP_PATH}/$(basename "${DB_DUMP_FILE}")"
    if upload_to_spaces "${DB_DUMP_FILE}" "${REMOTE_KEY}" "application/gzip"; then
        echo "  Uploaded DB dump: ${REMOTE_KEY}"
        UPLOAD_OK=$((UPLOAD_OK + 1))
    else
        echo "  FAILED to upload DB dump"
        UPLOAD_FAIL=$((UPLOAD_FAIL + 1))
    fi
fi

# Upload project archive
if [ -f "${PROJECT_ARCHIVE}" ]; then
    REMOTE_KEY="${DO_BACKUP_PATH}/$(basename "${PROJECT_ARCHIVE}")"
    if upload_to_spaces "${PROJECT_ARCHIVE}" "${REMOTE_KEY}" "application/gzip"; then
        echo "  Uploaded project archive: ${REMOTE_KEY}"
        UPLOAD_OK=$((UPLOAD_OK + 1))
    else
        echo "  FAILED to upload project archive"
        UPLOAD_FAIL=$((UPLOAD_FAIL + 1))
    fi
fi

echo "  Upload complete: ${UPLOAD_OK} succeeded, ${UPLOAD_FAIL} failed"

# ── Step 4: Cleanup old local backups ──
echo ""
echo "[4/4] Cleaning up local backups older than ${LOCAL_RETENTION_DAYS} days..."
DELETED=0
if [ -d "${BACKUP_LOCAL_DIR}" ]; then
    while IFS= read -r old_dir; do
        rm -rf "${old_dir}"
        DELETED=$((DELETED + 1))
        echo "  Removed: ${old_dir}"
    done < <(find "${BACKUP_LOCAL_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +${LOCAL_RETENTION_DAYS} 2>/dev/null)
fi
echo "  Cleaned up ${DELETED} old backup(s)"

# ── Summary ──
echo ""
echo "============================================================"
echo "  Backup Complete — $(date +"%Y-%m-%d %H:%M:%S")"
echo "============================================================"
echo "  Local:  ${WORK_DIR}/"
echo "  Remote: s3://${DO_BUCKET}/${DO_BACKUP_PATH}/"
echo "  DB:     $([ -n "${DB_DUMP_FILE}" ] && echo "$(du -h "${DB_DUMP_FILE}" 2>/dev/null | cut -f1)" || echo "skipped")"
echo "  Files:  $([ -f "${PROJECT_ARCHIVE}" ] && echo "$(du -h "${PROJECT_ARCHIVE}" | cut -f1)" || echo "skipped")"
echo "============================================================"
