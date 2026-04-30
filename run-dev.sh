#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/spring-social"
FRONTEND_DIR="$ROOT_DIR/react-social"

cleanup() {
  echo ""
  echo "Shutting down..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "Starting Spring Boot backend (port 8091)..."
cd "$BACKEND_DIR"
mvn spring-boot:run &
BACKEND_PID=$!

echo "Starting React frontend (port 3000)..."
cd "$FRONTEND_DIR"
if [[ ! -d node_modules ]]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm start &
FRONTEND_PID=$!

echo ""
echo "Backend PID: $BACKEND_PID  |  Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."
wait
