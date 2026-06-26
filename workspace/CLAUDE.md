# workspace — Planning & Documentation

This folder contains planning documents, design notes, and cross-cutting references.
**No runnable code lives here.**

## Project overview
**Project Management** — a single-user application for managing multiple projects.
There is no login system; all data is shared and accessible to the one user.

## Architecture
- **Frontend:** Angular 19 standalone, PrimeNG 19, SCSS, RxJS (`project-management-client/`)
- **Backend:** Node/Express, TypeScript, MongoDB, Inversify DI (`project-management-server/`)
- **Database:** MongoDB at `mongo.fingercraft.run:27017`, database `project-management-db`

## Ports
| Service | Port |
|---------|------|
| Angular dev server | 54201 |
| Express API | 1089 |
| Local Docker deployment (nginx) | 80 (configurable via `PM_PORT`) |

## Local Docker deployment

**`local-deploy/`** contains Docker Compose configuration for running the full stack
locally via three containers: `pm-nginx` (reverse proxy), `pm-client` (Angular static
files), `pm-server` (Express API). MongoDB is **not** managed there — it must be a
separate container. See `local-deploy/CLAUDE.md` for setup instructions and design notes.

Key design choices in that folder:
- Build context is the **repo root** so Dockerfiles can reach both sub-project sources
  and deploy-specific config overrides (environment.ts, app-config.json).
- `../.dockerignore` at the repo root excludes `node_modules`/`dist`/`.angular` — do
  not delete it or builds will re-run `npm ci` on every source change.
- The Angular production environment is overridden by `local-deploy/client/environment.ts`
  at build time, setting `apiBaseUrl: '/api'` so all calls route through nginx.
- `corsAllowed` in `local-deploy/server/app-config.json` is hardcoded to `http://localhost`
  (port 80). If `PM_PORT` changes, that file and a server image rebuild are required.

## Design specification
**`application-design.md`** is the canonical design reference — design principles (P0–P8),
the complete data model, canvas/interaction rules, routing, and architecture. It expands
`application-details.md` (the original vision). Read it before implementing features.
Section 13 ("Resolved Decisions", D1–D7) records the confirmed architectural forks and their rationale;
§14 lists what's still open.

Feature areas added after the first pass (see the design spec sections noted, and the matching
`D-IMPL-19…33` in `implementation-decisions.md`):
- **Groups** — container items with vertical/horizontal/wrap reflow (`groups` collection; §5.9, §8.8).
- **Multi-select / multi-drag / multi-delete** (§8.7).
- **Projection to parent** — a parent card lists its opted-in direct children, ordered by a
  layout-derived reading order computed server-side (§5.10, §6.4, §8.9).
- **Inline card editing** and **inline completion toggles** (§7.3; updates decision D6).
- **Reparenting** — promote a selection to the parent's parent, or drop items onto a task's drop zone to
  make them children; position-preserving, via a server `ReparentService` (§8.10).
- **Markdown bodies** — Task descriptions and Note details are Markdown with a markup/preview editor and
  paste-to-link (§8.11).
- **Due dates** — optional per-task `dueDate` with a live card countdown (§8.12).
- **Frontend null policy** — prefer `undefined` over `null` in the client; see the frontend CLAUDE.md.

> Beyond what the spec covers, the codebase also has **Dashboards** and **DataDefinitions** (metric
> widgets); these are documented in `project-management-mcp/` (tools + `pm://context`) but not yet in
> `application-design.md` §5–§6.

## MCP server maintenance

**`project-management-mcp/` must be kept in sync with the app as it evolves.**

Whenever a session changes the data model, adds new concepts, alters UI behaviour, or adds/removes API endpoints, update the MCP server in the same session:
- `src/tools/*.ts` — Zod schemas, tool descriptions, new/removed tools
- `src/index.ts` — the `pm://context` resource (data model, widget type compatibility table, workflow examples, editing behaviour)
- `project-management-mcp/CLAUDE.md` — tool surface table

See `project-management-mcp/CLAUDE.md` for the full guidance.

## Standards reference
See `project-standards.md`
for the full coding standards that govern both projects.
