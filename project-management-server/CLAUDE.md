# project-management-server — Node/Express Backend

## Project purpose
Project Management application. Single user, no login system. Allows managing multiple projects.

## Stack
- **Node + Express** with TypeScript
- **MongoDB** via official driver (`mongodb` package)
- **Inversify** for dependency injection (`reflect-metadata` must be first import in `index.ts`)
- **Socket.IO** for real-time (when needed)
- **Zod** for request body validation
- **jsonwebtoken + bcrypt** (scaffolded as standard; not actively used — no auth required for this app)
- `ts-node` for development, `tsc` for production build

## Dev server
```
npm start
```
Runs on **port 1089**

MongoDB: `mongodb://mongo.fingercraft.run:27017` → database `project-management-db`

## Key folder map
```
src/
├── index.ts                  — Entry point (reflect-metadata MUST be line 1 import)
├── container.ts              — Inversify composition root (all bindings live here)
├── tokens.ts                 — Symbol injection tokens (one per injectable)
├── config.ts                 — getAppConfig() with env-var override
├── mongo-helper.ts           — MongoDB connection wrapper (shared across all DB services)
├── setup-express.ts          — Express + middleware + route wiring
├── system-setup.ts           — One-time startup logic (migrations, seeds, etc.)
├── auth/                     — jwt.ts + auth-middleware.ts (scaffolded; not used for routing)
├── database/
│   ├── db-service.ts         — Abstract base (DbService) for per-entity DB services
│   └── <domain>/             — Add domain DB services here
├── server/                   — Route factory functions (one per concern)
└── model/
    ├── db-collection-names.constants.ts  — All collection name strings centralized here
    └── shared-models/        — Shared interfaces (IDENTICAL to client's shared-models)
```

## Critical patterns
- `import 'reflect-metadata'` **must be the very first import** in `index.ts`.
- Every injectable class is decorated with `@injectable()`.
- All services are bound in `container.ts` — this is the **single composition root**.
- Routes use **factory functions** (`createXxxRouter(service, ...)`) — never import services from globals.
- Every route handler `try`/`catch`es and returns appropriate status codes.
- Return early with `res.status(...).json(...); return;` — never `return res.status(...)`.
- Collection names come from `DbCollectionNames` constant — never use inline strings.
- Multi-collection / multi-step operations live in a **dedicated domain service**, never inline in a route
  handler: `CascadeDeleteService` (subtree deletes) and `ReparentService` (move an item to a new parent —
  rewrites the item's `ancestorTaskIds` and every descendant's materialized path, carries a group's
  members, schedules projection recompute). Each item router exposes `PUT /:id/reparent`
  (`{ newParentTaskId: string | null }`, `null` = project root).
- Partial-update PUTs clear an optional field when the body sends `null` for it (e.g. `dueDate`, `groupId`)
  — mirror the existing `delete merged.<field>` pattern in the task router.

## Config
`app-config.json` at project root (gitignored). See `APP-CONFIG.md` for schema.
Each leaf overrideable by environment variable (see `src/config.ts` `CONFIG_ENV_MAP`).

## Single-user note
This application has no multi-user auth requirement. The auth middleware and JWT files are
scaffolded per standard but routes do NOT require authentication tokens. Do not add auth gates
to routes unless the requirements change.
