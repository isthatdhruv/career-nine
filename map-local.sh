#!/usr/bin/env bash
#
# map-local.sh — point a public-looking https URL at a local server.
#
# Usage:
#   ./map-local.sh <domain> <port>           Add/update a mapping
#   ./map-local.sh start <domain>            Add mapping AND launch one
#                                            registered dev server (foreground)
#   ./map-local.sh start --staging           Launch every staging server in parallel
#   ./map-local.sh start --prod              Launch every prod server in parallel
#   ./map-local.sh start --all               Launch every registered server
#                                            (staging + prod — note port conflicts
#                                            because both envs share dev ports)
#   ./map-local.sh start --list              Show registered starts
#   ./map-local.sh stop <domain>             Kill the dev server for one domain
#   ./map-local.sh stop --staging            Kill every staging dev server
#   ./map-local.sh stop --prod               Kill every prod dev server
#   ./map-local.sh stop --all                Kill every node dev server (any env)
#   ./map-local.sh stop --caddy              Stop the Caddy brew service
#   ./map-local.sh --remove <domain>         Remove a mapping
#   ./map-local.sh --list                    List managed mappings
#
# Examples:
#   ./map-local.sh staging-dashboard.career-9.com 3000
#   ./map-local.sh start staging-dashboard.career-9.com
#   ./map-local.sh start --staging
#   ./map-local.sh stop --staging
#   ./map-local.sh stop --caddy
#   ./map-local.sh --remove staging-dashboard.career-9.com
#
# What it does:
#   1. Adds  "127.0.0.1  <domain>"  to /etc/hosts (idempotent, tagged).
#   2. Adds a reverse-proxy block to the Caddyfile with `tls internal`,
#      so https://<domain>/ on this machine terminates at Caddy and
#      forwards to http://localhost:<port>.
#   3. Installs Caddy's local CA into the system trust store on first run
#      so the browser trusts the cert with no warnings.
#   4. (Re)starts the Caddy brew service as root so it can bind 443.
#
# Requires: caddy (brew install caddy), sudo.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOSTS_FILE="/etc/hosts"
CADDYFILE="/usr/local/etc/Caddyfile"   # Intel-brew prefix on this machine
TAG="map-local"
TRUST_MARKER="$HOME/.caddy-local-ca-trusted"

# Registry of "one-shot start" targets.
# Each entry: <domain>|<relative-dir-under-repo>|<port>|<dev-command>|<env>|<kind>
#   <env>   = 'staging' or 'prod' — used by --staging / --prod / --all filters.
#   <kind>  = 'node'  → script launches it in the background.
#             'print' → script only sets up the Caddy/hosts mapping and
#                       prints the command for the user to run manually
#                       (used for the Java backend — same dev profile for
#                       both envs, so the user starts it themselves).
START_REGISTRY=(
  "staging-dashboard.career-9.com|react-social|3000|npm run start:staging:local|staging|node"
  "staging-assessment.career-9.com|career-nine-assessment|5173|npm run dev:staging:local|staging|node"
  "api-staging.career-9.com|spring-social|8080|mvn spring-boot:run|staging|print"
  "dashboard.career-9.com|react-social|3000|npm run start:production:local|prod|node"
  "assessment.career-9.com|career-nine-assessment|5173|npm run dev:production:local|prod|node"
  "api.career-9.com|spring-social|8080|mvn spring-boot:run|prod|print"
)

err()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }

# Cache sudo creds upfront so every later sudo invocation runs silently. This
# avoids the case where a prompt fires deep inside a function and the user
# can't see it (terminal buffering, IDE terminals, etc) — making the script
# look like it's hanging.
ensure_sudo() {
  info "this command needs sudo for /etc/hosts and Caddy — caching creds now"
  sudo -v || err "sudo authentication failed"
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

require_caddy() {
  command -v caddy >/dev/null 2>&1 || err "caddy not found. Install with: brew install caddy"
  [ -d "$(dirname "$CADDYFILE")" ] || err "Caddy config dir $(dirname "$CADDYFILE") missing"
  [ -f "$CADDYFILE" ] || { info "creating empty Caddyfile at $CADDYFILE"; sudo touch "$CADDYFILE"; }
}

# --- /etc/hosts helpers ----------------------------------------------------

hosts_add() {
  local domain="$1"
  # Drop any existing managed entry for this domain, then append a fresh one.
  hosts_remove "$domain" silent
  printf '127.0.0.1\t%s\t# %s\n' "$domain" "$TAG" | sudo tee -a "$HOSTS_FILE" >/dev/null
  ok "/etc/hosts: 127.0.0.1 -> $domain"
}

hosts_remove() {
  local domain="$1" mode="${2:-loud}"
  if grep -qE "[[:space:]]${domain//./\\.}([[:space:]]|$)" "$HOSTS_FILE"; then
    sudo sed -i '' "/[[:space:]]${domain//./\\.}\([[:space:]]\|\$\)/d" "$HOSTS_FILE"
    [ "$mode" = "loud" ] && ok "/etc/hosts: removed $domain"
  fi
}

# --- Caddyfile helpers -----------------------------------------------------

caddy_block_add() {
  local domain="$1" port="$2"
  local tmp; tmp="$(mktemp)"

  # Strip any previous block for this domain — both managed (between our
  # marker comments) and unmanaged (a bare `<domain> {` ... `}` block written
  # by hand). Without the unmanaged-strip, hand-written blocks survive and
  # Caddy ends up with two site definitions for the same address, which fails
  # validation and aborts the script on a fresh staging run.
  local d_re="^[[:space:]]*${domain//./\\.}[[:space:]]*\\{[[:space:]]*\$"
  awk -v d="$domain" -v tag="$TAG" -v d_re="$d_re" '
    BEGIN { in_managed=0; in_unmanaged=0 }
    # Managed block markers — drop everything between them, markers included.
    $0 == "# >>> " tag ": " d { in_managed=1; next }
    in_managed && $0 == "# <<< " tag ": " d { in_managed=0; next }
    in_managed { next }
    # Unmanaged block opening: a line matching exactly "<domain> {".
    in_unmanaged==0 && $0 ~ d_re { in_unmanaged=1; next }
    # Matching closing brace, alone on its line.
    in_unmanaged && $0 ~ /^[[:space:]]*\}[[:space:]]*$/ { in_unmanaged=0; next }
    in_unmanaged { next }
    { print }
  ' "$CADDYFILE" > "$tmp"

  {
    cat "$tmp"
    # Ensure trailing newline before our block.
    [ -s "$tmp" ] && tail -c1 "$tmp" | od -An -c | grep -q '\\n' || echo
    echo "# >>> $TAG: $domain"
    echo "$domain {"
    echo "	tls internal"
    # Use 127.0.0.1 explicitly: on macOS `localhost` resolves to ::1 (IPv6)
    # AND 127.0.0.1, and Caddy picks ::1 first. CRA's dev server binds only
    # to IPv4 (HOST=127.0.0.1 in start:staging:local), so Caddy gets ECONNREFUSED
    # against ::1:3000 and returns 502 → blank page in the browser.
    echo "	reverse_proxy http://127.0.0.1:$port"
    echo "}"
    echo "# <<< $TAG: $domain"
  } | sudo tee "$CADDYFILE" >/dev/null

  rm -f "$tmp"
  ok "Caddyfile: $domain -> http://localhost:$port"
}

caddy_block_remove() {
  local domain="$1"
  local tmp; tmp="$(mktemp)"
  awk -v d="$domain" -v tag="$TAG" '
    BEGIN { skip=0 }
    $0 == "# >>> " tag ": " d { skip=1; next }
    skip && $0 == "# <<< " tag ": " d { skip=0; next }
    !skip { print }
  ' "$CADDYFILE" > "$tmp"
  sudo cp "$tmp" "$CADDYFILE"
  rm -f "$tmp"
  ok "Caddyfile: removed block for $domain"
}

# --- Caddy service / trust -------------------------------------------------

caddy_validate() {
  sudo caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null \
    || err "Caddyfile failed validation. Run: caddy validate --config $CADDYFILE"
}

caddy_trust_once() {
  if [ ! -f "$TRUST_MARKER" ]; then
    info "installing Caddy local CA into system trust store (one-time)"
    sudo caddy trust || err "caddy trust failed"
    touch "$TRUST_MARKER"
  fi
}

caddy_reload_or_start() {
  # Caddy must run as root to bind :443. Use brew services with sudo.
  if sudo brew services list 2>/dev/null | awk '$1=="caddy"{print $2}' | grep -q started; then
    info "reloading Caddy"
    sudo caddy reload --config "$CADDYFILE" --adapter caddyfile \
      || sudo brew services restart caddy
  else
    info "starting Caddy as root (binds :443)"
    sudo brew services start caddy
  fi
  ok "Caddy is running"
}

# --- add / start -----------------------------------------------------------

do_add() {
  local domain="$1" port="$2"
  [[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || err "invalid domain: $domain"
  [[ "$port"   =~ ^[0-9]+$ ]]          || err "invalid port: $port"
  require_caddy
  hosts_add        "$domain"
  caddy_block_add  "$domain" "$port"
  caddy_validate
  caddy_trust_once
  caddy_reload_or_start
}

# Split "domain|dir|port|cmd|env|kind" into named globals.
# kind defaults to 'node' if not present.
parse_entry() {
  IFS='|' read -r R_DOMAIN R_DIR R_PORT R_CMD R_ENV R_KIND <<< "$1"
  R_KIND="${R_KIND:-node}"
}

# Pretty-print the manual command for a 'print' entry.
print_run_instructions() {
  ok   "mapped https://$R_DOMAIN/  →  http://localhost:$R_PORT  (run manually)"
  info "to start the backend (Java dev profile is the default):"
  printf '    cd %s && %s\n' "$R_DIR" "$R_CMD"
}

start_lookup() {
  local domain="$1" entry
  for entry in "${START_REGISTRY[@]}"; do
    [ "${entry%%|*}" = "$domain" ] && { echo "$entry"; return 0; }
  done
  return 1
}

list_starts() {
  echo "Registered starts:"
  local entry
  for entry in "${START_REGISTRY[@]}"; do
    parse_entry "$entry"
    printf "  [%-7s] [%-5s] %-35s →  %s  (port %s, %s)\n" \
      "$R_ENV" "$R_KIND" "$R_DOMAIN" "$R_DIR" "$R_PORT" "$R_CMD"
  done
  echo
  echo "Single domain:  ./map-local.sh start <domain>"
  echo "Group:          ./map-local.sh start --staging | --prod | --all"
  echo
  echo "kind=print entries only register the Caddy mapping; you start them manually."
}

ensure_deps() {
  local target_dir="$1" name="$2"
  if [ ! -d "$target_dir/node_modules" ]; then
    info "node_modules missing in $name — running npm install"
    # react-social has pre-existing peer-dep conflicts (mdb-react-ui-kit /
    # @types/react), so fall back to --legacy-peer-deps if a plain install
    # fails. Assessment project doesn't need the flag but it's harmless.
    if ! (cd "$target_dir" && npm install); then
      info "plain npm install failed in $name — retrying with --legacy-peer-deps"
      (cd "$target_dir" && npm install --legacy-peer-deps) \
        || err "npm install failed in $name even with --legacy-peer-deps"
    fi
  fi
}

# Recursively SIGTERM a pid and all its descendants. Used to take down the
# npm → react-scripts/vite process tree on Ctrl+C.
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

# Launch one entry in the foreground (exec — replaces this shell).
# For kind=print entries, only set up the mapping and print run instructions.
do_start_one() {
  local domain="$1" entry
  entry="$(start_lookup "$domain")" \
    || err "no registered start for '$domain'. Run: $0 start --list"
  parse_entry "$entry"
  ensure_sudo
  do_add "$R_DOMAIN" "$R_PORT"

  if [ "$R_KIND" = "print" ]; then
    echo
    print_run_instructions
    exit 0
  fi

  local target_dir="$SCRIPT_DIR/$R_DIR"
  [ -d "$target_dir" ] || err "directory not found: $target_dir"
  ensure_deps "$target_dir" "$R_DIR"

  echo
  info "launching dev server: (cd $R_DIR && $R_CMD)"
  info "open https://$R_DOMAIN/  once it's ready  —  Ctrl+C stops the dev server (Caddy keeps running)"
  echo
  cd "$target_dir"
  exec bash -c "$R_CMD"
}

# Launch every entry matching $filter (staging | prod | all) in parallel.
do_start_many() {
  local filter="$1" entry
  local -a selected=()
  for entry in "${START_REGISTRY[@]}"; do
    parse_entry "$entry"
    if [ "$filter" = "all" ] || [ "$R_ENV" = "$filter" ]; then
      selected+=("$entry")
    fi
  done
  [ ${#selected[@]} -gt 0 ] || err "no registry entries with env='$filter'"

  info "start --$filter: ${#selected[@]} entries — $(echo "${selected[@]##*|}" | tr ' ' ',' | sed 's/^,//')"
  ensure_sudo

  if [ "$filter" = "all" ]; then
    info "running --all: staging + prod servers share the same dev ports"
    info "expect 'port already in use' errors — pick one env in practice"
  fi

  # Track which entries are auto-launched ('node') vs. only mapped ('print').
  local -a node_entries=() print_entries=()

  # Prepare every mapping + install node deps first, sequentially.
  for entry in "${selected[@]}"; do
    parse_entry "$entry"
    do_add "$R_DOMAIN" "$R_PORT"
    if [ "$R_KIND" = "print" ]; then
      print_entries+=("$entry")
    else
      local target_dir="$SCRIPT_DIR/$R_DIR"
      [ -d "$target_dir" ] || err "directory not found: $target_dir"
      ensure_deps "$target_dir" "$R_DIR"
      node_entries+=("$entry")
    fi
  done

  # Launch node entries in parallel; cleanup on Ctrl+C kills the whole tree.
  # NOTE: bash 3.2 + `set -u` errors on "${arr[@]}" when arr is empty, so we
  # use the ${arr[@]+...} guard everywhere these arrays are expanded.
  local -a PIDS=()
  cleanup_many() {
    echo
    info "stopping dev servers..."
    local p
    for p in ${PIDS[@]+"${PIDS[@]}"}; do kill_tree "$p"; done
    sleep 1
    exit 0
  }
  trap cleanup_many INT TERM

  for entry in ${node_entries[@]+"${node_entries[@]}"}; do
    parse_entry "$entry"
    local target_dir="$SCRIPT_DIR/$R_DIR"
    info "launching [$R_ENV] $R_DOMAIN  →  (cd $R_DIR && $R_CMD)"
    ( cd "$target_dir" && exec bash -c "$R_CMD" ) &
    PIDS+=("$!")
  done

  echo
  if [ ${#node_entries[@]} -gt 0 ]; then
    ok "auto-launched servers:"
    for entry in "${node_entries[@]}"; do
      parse_entry "$entry"
      echo "    https://$R_DOMAIN/"
    done
  fi

  if [ ${#print_entries[@]} -gt 0 ]; then
    echo
    ok "backend mappings ready (start manually — Java dev profile is the default):"
    for entry in "${print_entries[@]}"; do
      parse_entry "$entry"
      echo "    https://$R_DOMAIN/  →  http://localhost:$R_PORT"
      echo "        cd $R_DIR && $R_CMD"
    done
  fi

  if [ ${#node_entries[@]} -gt 0 ]; then
    echo
    info "Press Ctrl+C to stop the auto-launched servers (Caddy keeps running)."
    wait
  else
    info "no node servers to wait on — Caddy mappings are in place. Done."
  fi
}

do_start() {
  local arg="${1:-}"
  case "$arg" in
    "" | --list | -h | --help) list_starts; exit 0 ;;
    --all)     do_start_many all ;;
    --staging) do_start_many staging ;;
    --prod)    do_start_many prod ;;
    *)         do_start_one "$arg" ;;
  esac
}

# --- stop ------------------------------------------------------------------

# Kill whatever's listening on a TCP port, plus its descendants.
# Sends SIGTERM, gives processes a moment, then SIGKILL if still alive.
stop_port() {
  local port="$1" label="$2"
  local pids; pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    info "nothing listening on :$port  ($label)"
    return 0
  fi
  info "stopping :$port ($label) — pids: $(echo "$pids" | tr '\n' ' ')"
  local pid
  for pid in $pids; do kill_tree "$pid"; done
  sleep 1
  local remaining; remaining="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -n "$remaining" ]; then
    info "still alive — SIGKILL: $(echo "$remaining" | tr '\n' ' ')"
    for pid in $remaining; do kill -KILL "$pid" 2>/dev/null || true; done
  fi
  ok "freed :$port"
}

stop_caddy() {
  if sudo brew services list 2>/dev/null | awk '$1=="caddy"{print $2}' | grep -q started; then
    info "stopping Caddy brew service"
    sudo brew services stop caddy
    ok "Caddy stopped"
  else
    info "Caddy is not running"
  fi
}

# Stop the dev servers for every node entry matching $filter (staging|prod|all),
# de-duplicating by port so we don't try the same port twice. Uses a string
# instead of a bash array to dodge bash-3.2's unbound-variable bug with empty
# arrays under `set -u`.
stop_filter() {
  local filter="$1" entry seen=" " stopped_any=0
  for entry in "${START_REGISTRY[@]}"; do
    parse_entry "$entry"
    [ "$R_KIND" = "node" ] || continue
    if [ "$filter" = "all" ] || [ "$R_ENV" = "$filter" ]; then
      case "$seen" in
        *" $R_PORT "*) ;;  # already handled this port
        *)
          seen="$seen$R_PORT "
          stop_port "$R_PORT" "$R_DOMAIN"
          stopped_any=1
          ;;
      esac
    fi
  done
  [ "$stopped_any" = 1 ] || err "no node entries match: $filter"
  echo
  info "Caddy is still running. To stop it too:  $0 stop --caddy"
}

do_stop() {
  local arg="${1:-}"
  case "$arg" in
    "" | -h | --help)
      echo "Usage: $0 stop <domain> | --staging | --prod | --all | --caddy"
      exit 0
      ;;
    --caddy)   ensure_sudo; stop_caddy ;;
    --all)     stop_filter all ;;
    --staging) stop_filter staging ;;
    --prod)    stop_filter prod ;;
    *)
      local entry; entry="$(start_lookup "$arg")" \
        || err "no registered start for '$arg'. Run: $0 start --list"
      parse_entry "$entry"
      if [ "$R_KIND" = "print" ]; then
        info "$arg is kind=print (no auto-launched process)."
        info "if the Java backend is running, stop it in its own terminal (Ctrl+C)"
        exit 0
      fi
      stop_port "$R_PORT" "$arg"
      echo
      info "Caddy is still running. To stop it too:  $0 stop --caddy"
      ;;
  esac
}

# --- list ------------------------------------------------------------------

list_mappings() {
  echo "Managed /etc/hosts entries:"
  grep "# $TAG" "$HOSTS_FILE" 2>/dev/null || echo "  (none)"
  echo
  echo "Managed Caddy blocks:"
  if [ -f "$CADDYFILE" ]; then
    grep "^# >>> $TAG:" "$CADDYFILE" | sed "s/^# >>> $TAG: /  /" || echo "  (none)"
  else
    echo "  (no Caddyfile)"
  fi
}

# --- main ------------------------------------------------------------------

[ $# -eq 0 ] && usage 1

info "map-local.sh $* (pid $$)"

case "$1" in
  -h|--help)
    usage 0
    ;;
  --list)
    list_mappings
    exit 0
    ;;
  start)
    shift
    do_start "${1:-}"
    ;;
  stop)
    shift
    do_stop "${1:-}"
    ;;
  --remove)
    [ $# -eq 2 ] || err "usage: $0 --remove <domain>"
    require_caddy
    domain="$2"
    hosts_remove "$domain"
    caddy_block_remove "$domain"
    caddy_validate
    caddy_reload_or_start
    ok "removed mapping for $domain"
    ;;
  *)
    [ $# -eq 2 ] || err "usage: $0 <domain> <port>   (or start <domain>, --remove <domain>, --list)"
    do_add "$1" "$2"
    echo
    ok "open https://$1/  → forwards to http://localhost:$2"
    ;;
esac
