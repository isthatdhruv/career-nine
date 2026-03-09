#!/bin/bash
# Fetches locked assessment JSON from backend and splits into static files
# for the frontend build. These get served from CDN for instant loading.
#
# Usage: ./scripts/cache-assessment.sh <assessment_id> [base_url]
# Example: ./scripts/cache-assessment.sh 5 http://localhost:8080

set -e

ASSESSMENT_ID=$1
BASE_URL=${2:-"http://localhost:8080"}
CACHE_DIR="public/assessment-cache/${ASSESSMENT_ID}"

if [ -z "$ASSESSMENT_ID" ]; then
  echo "Usage: $0 <assessment_id> [base_url]"
  exit 1
fi

mkdir -p "$CACHE_DIR"

echo "Fetching assessment $ASSESSMENT_ID from $BASE_URL..."

# Fetch questionnaire data (what getby/{id} returns)
curl -sf "${BASE_URL}/assessments/getby/${ASSESSMENT_ID}" -o "${CACHE_DIR}/data.json"
echo "  ✓ Saved questionnaire data → ${CACHE_DIR}/data.json ($(wc -c < "${CACHE_DIR}/data.json") bytes)"

# Fetch assessment config (what getById/{id} returns)
curl -sf "${BASE_URL}/assessments/getById/${ASSESSMENT_ID}" -o "${CACHE_DIR}/config.json"
echo "  ✓ Saved assessment config → ${CACHE_DIR}/config.json ($(wc -c < "${CACHE_DIR}/config.json") bytes)"

echo ""
echo "Done! Assessment $ASSESSMENT_ID cached for static serving."
echo "Run 'npm run build' to include in production build."
