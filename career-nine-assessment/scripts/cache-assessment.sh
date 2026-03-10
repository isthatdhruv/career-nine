#!/bin/bash
# Syncs locked assessment JSON from backend into public/assessment-cache/
# for static serving in the frontend build.
#
# Usage:
#   ./scripts/cache-assessment.sh [base_url]          # Sync all locked assessments
#   ./scripts/cache-assessment.sh 5 [base_url]        # Sync specific assessment ID
#
# Runs automatically before build via "prebuild" npm script.

set -e

CACHE_DIR="public/assessment-cache"

# If first arg is a number, it's a specific assessment ID
if [[ "$1" =~ ^[0-9]+$ ]]; then
  ASSESSMENT_ID=$1
  BASE_URL=${2:-"https://api.career-9.com:8080"}
else
  ASSESSMENT_ID=""
  BASE_URL=${1:-"https://api.career-9.com:8080"}
fi

sync_assessment() {
  local id=$1
  local dir="${CACHE_DIR}/${id}"
  mkdir -p "$dir"

  curl -sf "${BASE_URL}/assessments/getby/${id}" -o "${dir}/data.json"
  curl -sf "${BASE_URL}/assessments/getById/${id}" -o "${dir}/config.json"
  echo "  ✓ Fetched assessment ${id} (data: $(wc -c < "${dir}/data.json")B, config: $(wc -c < "${dir}/config.json")B)"

  # Extract base64 images from JSON into separate files (saves ~3.5MB per assessment with images)
  node scripts/extract-assessment-images.cjs "$dir"

  # Minify JSON (remove whitespace)
  node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))" "${dir}/data.json" > "${dir}/data.min.json" && mv "${dir}/data.min.json" "${dir}/data.json"
  node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))" "${dir}/config.json" > "${dir}/config.min.json" && mv "${dir}/config.min.json" "${dir}/config.json"
  echo "  ✓ Optimized assessment ${id} (data: $(wc -c < "${dir}/data.json")B, config: $(wc -c < "${dir}/config.json")B)"
}

remove_unlocked() {
  # Remove cache dirs for assessments no longer locked
  local locked_ids=("$@")
  if [ -d "$CACHE_DIR" ]; then
    for dir in "$CACHE_DIR"/*/; do
      [ -d "$dir" ] || continue
      local id=$(basename "$dir")
      local found=false
      for lid in "${locked_ids[@]}"; do
        if [ "$id" = "$lid" ]; then
          found=true
          break
        fi
      done
      if [ "$found" = false ]; then
        rm -rf "$dir"
        echo "  ✗ Removed unlocked assessment ${id}"
      fi
    done
  fi
}

echo "Syncing assessment cache from ${BASE_URL}..."

if [ -n "$ASSESSMENT_ID" ]; then
  # Single assessment mode
  sync_assessment "$ASSESSMENT_ID"
else
  # Auto-sync all locked assessments
  LOCKED_IDS=$(curl -sf "${BASE_URL}/assessments/locked-ids")

  if [ -z "$LOCKED_IDS" ] || [ "$LOCKED_IDS" = "[]" ]; then
    echo "  No locked assessments found. Clearing cache."
    rm -rf "$CACHE_DIR"
    mkdir -p "$CACHE_DIR"
    exit 0
  fi

  # Parse JSON array [1,5,12] into bash array
  IDS=($(echo "$LOCKED_IDS" | tr -d '[]' | tr ',' ' '))
  echo "  Locked assessments: ${IDS[*]}"

  for id in "${IDS[@]}"; do
    sync_assessment "$id"
  done

  # Clean up any assessments that were unlocked
  remove_unlocked "${IDS[@]}"
fi

echo "Done!"
