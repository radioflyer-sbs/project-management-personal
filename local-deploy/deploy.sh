#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
    echo "Usage: $0 [up|down|rebuild|logs|status]"
    echo ""
    echo "  up       Build (if needed) and start all containers  [default]"
    echo "  down     Stop and remove containers"
    echo "  rebuild  Force-rebuild all images from scratch and restart"
    echo "  logs     Follow combined container logs (Ctrl-C to stop)"
    echo "  status   Show running container status"
}

check_env() {
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        echo "⚠  .env not found — copying .env.example to .env"
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        echo ""
        echo "✎  Edit .env now (set MONGO_CONNECTION_STRING and JWT_SECRET), then re-run."
        exit 1
    fi
}

CMD="${1:-up}"

case "$CMD" in
    up)
        check_env
        docker compose up --build -d
        echo ""
        PORT="${PM_PORT:-80}"
        echo "✓  Started. Open http://localhost:${PORT}"
        ;;
    down)
        docker compose down
        ;;
    rebuild)
        check_env
        docker compose build --no-cache
        docker compose up -d
        echo ""
        PORT="${PM_PORT:-80}"
        echo "✓  Rebuilt and started. Open http://localhost:${PORT}"
        ;;
    logs)
        docker compose logs -f
        ;;
    status)
        docker compose ps
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo "Unknown command: $CMD"
        usage
        exit 1
        ;;
esac
