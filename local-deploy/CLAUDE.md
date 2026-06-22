# local-deploy — Docker Compose Deployment

This folder contains everything needed to run the Project Management application locally
on a single machine using Docker. Designed for **WSL/Ubuntu** with Docker (Docker Desktop
or Docker Engine). The build context for all images is the **repo root** — one level up.

---

## Containers

Four containers are managed here.

| Container | Image | Role | Memory at runtime |
|-----------|-------|------|-------------------|
| `pm-nginx` | `nginx:alpine` | Reverse proxy — single entry point for the browser | ~10 MB |
| `pm-client` | `nginx:alpine` (built) | Serves compiled Angular static files | ~10 MB |
| `pm-server` | `node:20-alpine` (built) | Runs the compiled Express API | ~80–120 MB |
| `pm-mongo` | `mongo:latest` | MongoDB — data persisted in the `pm-mongo-data` named volume | ~100–200 MB |

Data is stored in the Docker named volume `pm-mongo-data`. The volume survives `docker compose down`
and even a full Docker reinstall, as long as you don't run `docker volume rm pm-mongo-data` or
`docker compose down -v`.

Traffic flow:

```
Browser → pm-nginx :80
              ├── /api/*      → pm-server :1089
              ├── /socket.io/ → pm-server :1089  (WebSocket upgrade)
              └── /*          → pm-client :80
```

---

## Quick start

```bash
# 1. Copy and edit the environment file
cp .env.example .env
# Edit MONGO_CONNECTION_STRING and JWT_SECRET at minimum

# 2. Make the script executable (once)
chmod +x deploy.sh

# 3. Start
./deploy.sh up
```

Open **http://localhost:80** (or the `PM_PORT` you set in `.env`).

---

## deploy.sh commands

```
./deploy.sh up       Build (if needed) and start all containers  [default]
./deploy.sh down     Stop and remove containers
./deploy.sh rebuild  Force-rebuild all images from scratch and restart
./deploy.sh logs     Follow combined container logs (Ctrl-C to stop)
./deploy.sh status   Show running container status
```

---

## Environment variables (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PM_PORT` | `80` | Host port nginx listens on |
| `MONGO_CONNECTION_STRING` | `mongodb://pm-mongo:27017` | MongoDB connection — defaults to the managed `pm-mongo` service |
| `MONGO_DATABASE_NAME` | `project-management-db` | MongoDB database |
| `JWT_SECRET` | *(none — must set)* | Secret for JWT signing (app doesn't enforce auth, but the field must be present) |

---

## MongoDB data persistence

Data is stored in the Docker named volume `pm-mongo-data` (mapped to `/data/db` inside the container).

**The volume survives:**
- `docker compose down` and `docker compose up`
- Container recreation and image updates

**The volume is destroyed by:**
- `docker compose down -v` (the `-v` flag explicitly removes volumes — don't use it)
- `docker volume rm pm-mongo-data`

To back up the data, use `mongodump` against the running container:
```bash
docker compose exec pm-mongo mongodump --out /tmp/backup
docker compose cp pm-mongo:/tmp/backup ./mongo-backup
```

To restore:
```bash
docker compose cp ./mongo-backup pm-mongo:/tmp/backup
docker compose exec pm-mongo mongorestore /tmp/backup
```

---

## Changing the exposed port

```
PM_PORT=8080
```

The app is then at `http://localhost:8080`. If you change from port 80 you must also update
`server/app-config.json` `corsAllowed` to include `http://localhost:8080` and rebuild
(`./deploy.sh rebuild`), because the CORS key has no environment-variable override.

---

## Build speed & memory design

- **Multi-stage Dockerfiles** — the heavy Node+devDependencies builder stage is discarded;
  the runtime image contains only the compiled output and production dependencies.
- **Layer caching** — `package*.json` is copied and `npm ci` runs before source files are
  copied, so a source-only change skips the install layer.
- **`--omit=dev`** on the server runtime stage excludes TypeScript and other dev tools from
  the final image (~40 % smaller node_modules).
- All runtime containers use Alpine-based images (nginx:alpine ≈ 8 MB, node:20-alpine ≈ 65 MB
  before app code).
- The `.dockerignore` at the repo root excludes `node_modules`, `dist`, `.angular`, `.git`
  from the build context, keeping context uploads fast.

Typical rebuild times after a source-only change:
- server: ~20–30 s (TypeScript compile only)
- client: ~45–90 s (Angular production build)
- nginx/proxy: instant (config volume-mounted; no image rebuild needed)

---

## CORS note

The `server/app-config.json` bakes `http://localhost` and `http://localhost:80` into
`corsAllowed`. Because `getAppConfig()` has no env-var override for this field, changing
the port requires editing the JSON and rebuilding the server image.

---

## MCP server

The MCP server (`project-management-mcp/`) is **not containerized here** — it uses stdio
transport and is registered directly with Claude Code as a local process.

Build it once:
```bash
cd ../project-management-mcp
npm run build
```

In your Claude Code MCP config, set `PM_API_URL` to go through nginx (not directly to the
server port) so traffic uses the same path as the browser:
```json
{
  "mcpServers": {
    "project-management": {
      "command": "node",
      "args": ["/path/to/project-management-mcp/dist/index.js"],
      "env": { "PM_API_URL": "http://localhost:80/api" }
    }
  }
}
```

---

## File layout

```
local-deploy/
├── CLAUDE.md                  this file
├── .env.example               copy to .env and fill in values
├── .gitignore                 excludes .env from git
├── deploy.sh                  up / down / rebuild / logs / status
├── docker-compose.yml         three-container orchestration
├── client/
│   ├── Dockerfile             multi-stage: Node (ng build) → nginx:alpine
│   ├── environment.ts         Angular prod environment: apiBaseUrl=/api, socketUrl=/
│   └── nginx-spa.conf         SPA fallback + asset caching inside the client container
├── server/
│   ├── Dockerfile             multi-stage: Node (tsc) → node:alpine (dist/index.js)
│   └── app-config.json        base config (mongo/jwt overridden by env vars)
└── nginx/
    └── nginx.conf             reverse proxy routes
```

`../.dockerignore` (repo root) excludes `node_modules`, `dist`, `.angular`, `.git` from the
Docker build context. Do not delete it — without it, every `npm install` would re-run even
when no packages changed.
