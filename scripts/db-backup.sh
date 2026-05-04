#!/bin/bash

# MySQL Database Backup Script
# Runs daily via cron to dump the career-9 database
# Creates a self-contained dump and emails it

DB_NAME="career-9"
DB_USER="root"
DB_PASS="Career-qCsfeuECc3MW"
DB_HOST="127.0.0.1"
DB_PORT="3306"

BACKUP_DIR="/root/project/career-nine/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

# Keep backups for 7 days
RETENTION_DAYS=7

# Email settings
EMAIL_TO="dhruv.kccsw@kccitm.edu.in"
EMAIL_SUBJECT="backup - $(date +"%d-%m-%Y")"

# DigitalOcean Spaces (S3-compatible) — env vars override defaults
DO_BUCKET="${DO_SPACES_BUCKET:-storage-c9}"
DO_REGION="${DO_SPACES_REGION:-sgp1}"
DO_ACCESS_KEY="${DO_SPACES_ACCESS_KEY:-DO801TH68APHQF8DFA4J}"
DO_SECRET_KEY="${DO_SPACES_SECRET_KEY:-sr6jJMFt83bI9nyA8jaQDVjhFKt9ltQPJEWejDNLgAA}"
DO_PREFIX="backups"

mkdir -p "$BACKUP_DIR"

# Self-contained dump: includes CREATE DATABASE, routines, triggers, events
# --single-transaction ensures consistent snapshot without locking
set -o pipefail
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --add-drop-table \
    --databases "$DB_NAME" 2>/dev/null \
    | gzip -9 > "$BACKUP_FILE"
DUMP_EXIT=$?
set +o pipefail

if [ $DUMP_EXIT -eq 0 ]; then
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup successful: ${BACKUP_FILE} (${FILESIZE})"

    # Email the backup via Spring Boot Gmail API endpoint
    EMAIL_BODY="Database backup for ${DB_NAME} on $(date +"%d %b %Y %I:%M %p").

File: $(basename "$BACKUP_FILE")
Size: ${FILESIZE}

To restore, run:
  gunzip < $(basename "$BACKUP_FILE") | mysql -u root -p"

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "http://127.0.0.1:8080/email/send-with-attachment" \
        -F "to=${EMAIL_TO}" \
        -F "subject=${EMAIL_SUBJECT}" \
        -F "body=${EMAIL_BODY}" \
        -F "file=@${BACKUP_FILE}")

    if [ "$HTTP_STATUS" = "200" ]; then
        echo "[$(date)] Email sent to ${EMAIL_TO}"
    else
        echo "[$(date)] WARNING: Email failed (HTTP ${HTTP_STATUS}). Backup saved locally at ${BACKUP_FILE}"
    fi

    # Upload to DigitalOcean Spaces and prune objects older than retention period
    echo "[$(date)] Syncing to DO Spaces (${DO_BUCKET}/${DO_PREFIX}/)..."
    python3 - "$BACKUP_FILE" "$DO_BUCKET" "$DO_PREFIX" "$DO_ACCESS_KEY" "$DO_SECRET_KEY" "$DO_REGION" "$RETENTION_DAYS" <<'PYEOF'
import sys, os, hashlib, hmac, datetime, xml.etree.ElementTree as ET
from urllib.parse import quote
import requests

file_path, bucket, prefix, access_key, secret_key, region, retention = sys.argv[1:8]
retention = int(retention)
host = f"{bucket}.{region}.digitaloceanspaces.com"

def _sign(k, m):
    return hmac.new(k, m.encode(), hashlib.sha256).digest()

def signed(method, key_path, query="", extra=None, body=b""):
    now = datetime.datetime.utcnow()
    datestamp = now.strftime('%Y%m%d')
    amzdate = now.strftime('%Y%m%dT%H%M%SZ')
    payload_hash = hashlib.sha256(body).hexdigest()

    h = {k.lower(): v for k, v in (extra or {}).items()}
    h['host'] = host
    h['x-amz-date'] = amzdate
    h['x-amz-content-sha256'] = payload_hash

    names = sorted(h.keys())
    canon_headers = ''.join(f'{n}:{h[n].strip()}\n' for n in names)
    signed_names = ';'.join(names)
    canon_uri = '/' + '/'.join(quote(p, safe='') for p in key_path.split('/') if p)
    if not key_path or key_path == '/':
        canon_uri = '/'
    canon_req = f'{method}\n{canon_uri}\n{query}\n{canon_headers}\n{signed_names}\n{payload_hash}'
    cred_scope = f'{datestamp}/{region}/s3/aws4_request'
    string_to_sign = f'AWS4-HMAC-SHA256\n{amzdate}\n{cred_scope}\n{hashlib.sha256(canon_req.encode()).hexdigest()}'
    key_sig = _sign(_sign(_sign(_sign(f'AWS4{secret_key}'.encode(), datestamp), region), 's3'), 'aws4_request')
    sig = hmac.new(key_sig, string_to_sign.encode(), hashlib.sha256).hexdigest()
    h['authorization'] = f'AWS4-HMAC-SHA256 Credential={access_key}/{cred_scope}, SignedHeaders={signed_names}, Signature={sig}'

    url = f'https://{host}{canon_uri}'
    if query:
        url += f'?{query}'
    return requests.request(method, url, data=body, headers=h, timeout=120)

# 1. Upload latest gzip
name = os.path.basename(file_path)
key = f"{prefix}/{name}"
with open(file_path, 'rb') as f:
    payload = f.read()
r = signed('PUT', key, '', {'Content-Type': 'application/gzip', 'x-amz-acl': 'private'}, payload)
if r.status_code in (200, 204):
    print(f"  Uploaded: s3://{bucket}/{key} ({len(payload) // (1024*1024)} MB)")
else:
    print(f"  UPLOAD FAILED ({r.status_code}): {r.text[:200]}", file=sys.stderr)
    sys.exit(1)

# 2. List objects under prefix and delete anything older than retention window
q = f"prefix={quote(prefix + '/', safe='')}"
r = signed('GET', '/', q, {})
if r.status_code != 200:
    print(f"  LIST FAILED ({r.status_code}): {r.text[:200]}", file=sys.stderr)
    sys.exit(0)

ns = {'s3': 'http://s3.amazonaws.com/doc/2006-03-01/'}
root = ET.fromstring(r.content)
cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=retention)
deleted = 0
for c in root.findall('s3:Contents', ns):
    k = c.find('s3:Key', ns).text
    lm = c.find('s3:LastModified', ns).text
    lm_dt = datetime.datetime.strptime(lm[:19], '%Y-%m-%dT%H:%M:%S')
    if lm_dt < cutoff:
        d = signed('DELETE', k, '', {})
        if d.status_code in (200, 204):
            deleted += 1
            print(f"  Deleted: s3://{bucket}/{k}")
        else:
            print(f"  DELETE FAILED for {k} ({d.status_code})", file=sys.stderr)
print(f"  Spaces cleanup: removed {deleted} object(s) older than {retention} days")
PYEOF
    DO_EXIT=$?
    if [ $DO_EXIT -ne 0 ]; then
        echo "[$(date)] WARNING: DO Spaces sync had errors (exit ${DO_EXIT})"
    fi
else
    echo "[$(date)] Backup FAILED for ${DB_NAME}"
    exit 1
fi

# Delete local backups older than retention period
find "$BACKUP_DIR" \( -name "*.sql" -o -name "*.sql.gz" \) -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Cleanup done. Local backups older than ${RETENTION_DAYS} days removed."
