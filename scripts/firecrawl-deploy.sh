#!/usr/bin/env bash
# =============================================================
# Firecrawl Staging Deployment Script
# Usage:
#   ./scripts/firecrawl-deploy.sh          — fresh deploy / restart
#   ./scripts/firecrawl-deploy.sh --wipe   — wipe data volumes and redeploy
#   ./scripts/firecrawl-deploy.sh --down   — stop all containers (keep data)
#   ./scripts/firecrawl-deploy.sh --status — show container status
#   ./scripts/firecrawl-deploy.sh --logs   — tail logs for all containers
# =============================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.firecrawl.yml"
ENV_FILE=".env.firecrawl"
COMPOSE_CMD="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

# ── Colour helpers ────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────
check_prerequisites() {
  command -v docker >/dev/null 2>&1 || error "Docker is not installed."
  docker compose version >/dev/null 2>&1 || error "Docker Compose v2 is not installed."
  [[ -f "$COMPOSE_FILE" ]] || error "Missing $COMPOSE_FILE — run this script from the project root."
  [[ -f "$ENV_FILE" ]] || error "Missing $ENV_FILE — copy .env.firecrawl and fill in secrets first."

  # Check for unfilled placeholder values
  if grep -q "REPLACE_WITH" "$ENV_FILE"; then
    error "Found REPLACE_WITH placeholders in $ENV_FILE. Fill in all secrets before deploying."
  fi
}

# ── Secret generation helper ──────────────────────────────
generate_secrets() {
  info "Generating secrets and writing to $ENV_FILE ..."
  PG_PASS=$(openssl rand -base64 32)
  RMQ_PASS=$(openssl rand -base64 32)
  BULL_KEY=$(openssl rand -hex 32)
  TEST_KEY=$(openssl rand -hex 24)

  sed -i "s|REPLACE_WITH_GENERATED_PASSWORD|${PG_PASS}|1" "$ENV_FILE"
  sed -i "s|REPLACE_WITH_GENERATED_PASSWORD|${RMQ_PASS}|1" "$ENV_FILE"
  sed -i "s|REPLACE_WITH_GENERATED_KEY|${BULL_KEY}|1"      "$ENV_FILE"
  sed -i "s|REPLACE_WITH_GENERATED_KEY|${TEST_KEY}|1"      "$ENV_FILE"

  info "Secrets written. Save these somewhere safe:"
  echo "  POSTGRES_PASSWORD : $PG_PASS"
  echo "  RABBITMQ_PASSWORD : $RMQ_PASS"
  echo "  BULL_AUTH_KEY     : $BULL_KEY"
  echo "  TEST_API_KEY      : $TEST_KEY"
}

# ── Main actions ──────────────────────────────────────────
action="${1:-deploy}"

case "$action" in
  --generate-secrets)
    generate_secrets
    ;;

  --wipe)
    warn "This will DELETE all Firecrawl data volumes (Postgres data will be lost)."
    read -rp "Are you sure? Type 'yes' to continue: " confirm
    [[ "$confirm" == "yes" ]] || { info "Aborted."; exit 0; }
    check_prerequisites
    info "Stopping and removing volumes ..."
    $COMPOSE_CMD down -v
    info "Pulling latest images ..."
    $COMPOSE_CMD pull
    info "Starting fresh stack ..."
    $COMPOSE_CMD up -d
    info "Done. Waiting 30s for Postgres init scripts to complete ..."
    sleep 30
    $COMPOSE_CMD ps
    ;;

  --down)
    check_prerequisites
    info "Stopping all Firecrawl containers (data preserved) ..."
    $COMPOSE_CMD down
    ;;

  --status)
    $COMPOSE_CMD ps
    ;;

  --logs)
    $COMPOSE_CMD logs -f --tail=100
    ;;

  deploy|--deploy|"")
    check_prerequisites
    info "Pulling latest images ..."
    $COMPOSE_CMD pull
    info "Starting / updating Firecrawl stack ..."
    $COMPOSE_CMD up -d
    info "Containers started. Status:"
    $COMPOSE_CMD ps
    echo ""
    info "Run smoke tests with:"
    echo "  curl -s -X POST http://localhost:3002/v1/scrape \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"url\": \"https://example.com\"}' | jq ."
    ;;

  *)
    echo "Usage: $0 [--generate-secrets | --wipe | --down | --status | --logs | deploy]"
    exit 1
    ;;
esac
