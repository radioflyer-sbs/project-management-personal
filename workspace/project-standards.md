# Project Standards — Reference for New Projects

A consolidated reference for the coding patterns, project structure, and architectural conventions used across my projects (d-talk-client, d-talk-server, and others to follow). When starting a new project — or extending an existing one — Claude should treat this document as the default playbook unless a specific project's docs override it.

> **How to use this document:**
> - For a **new Angular frontend**, see [Frontend Standards (Angular)](#frontend-standards-angular).
> - For a **new Node/Express backend**, see [Backend Standards (Node + Express + MongoDB)](#backend-standards-node--express--mongodb).
> - For a **client-server pair**, also read [Shared Models Contract](#shared-models-contract).
> - Cross-cutting rules (TypeScript, naming, comments) apply to both — see [Cross-Cutting Code Standards](#cross-cutting-code-standards).

---

## Workspace & Project Layout

### Multi-project workspaces

Related projects live as sibling folders under one workspace root and are opened together via a VS Code `.code-workspace` file:

```
my-app/
├── my-app.code-workspace          # JSON: { folders: [{path: "client"}, {path: "server"}, {path: "workspace"}] }
├── my-app-client/                 # Angular frontend
├── my-app-server/                 # Node/Express backend
└── workspace/                     # planning docs, design notes, migration guides — no runnable code
```

The `workspace/` folder is for plans, analyses, and reference documents (like this one). Code does not live there.

### Port conventions

Choose memorable, **non-default** ports for local dev to avoid collisions with other tooling and other projects:

| Service | Pattern |
| --- | --- |
| Frontend dev server | A 5-digit port that is *not* `4200`. d-talk uses `54647`. |
| Backend HTTP/Socket.IO | A 4-digit port in the 1000–9999 range. d-talk uses `1062`. |

Configure the frontend port in `angular.json` under `serve.configurations.development.port`. The backend port comes from `app-config.json` (`serverConfig.port`), overridable by env var.

### Environment & config files

- **Frontend:** Two files in `src/environments/` — `environment.ts` (production) and `environment.development.ts` (dev). Wire the swap in `angular.json` under `build.configurations.development.fileReplacements`.
- **Backend:** A single `app-config.json` at the project root, **gitignored**, loaded once at startup, cached, and overrideable per-leaf by environment variables (see [Backend config loader](#config-loading)). Document the schema in `APP-CONFIG.md` with placeholder example values.
- Never commit secrets. The example/template config should use placeholder strings like `<your-openai-api-key>`.
- **MongoDB server:** The shared MongoDB instance is at `mongo.fingercraft.run:27017`. New projects should point their `mongo.connectionString` here and pick a unique `mongo.databaseName` for the project:
  ```json
  "mongo": {
      "connectionString": "mongodb://mongo.fingercraft.run:27017",
      "databaseName": "<new-project-db-name>"
  }
  ```

---

## Cross-Cutting Code Standards

These rules apply to **both** client and server TypeScript.

### TypeScript style rules

- **Strict mode** is on. `strict: true`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, and on the client also `noPropertyAccessFromIndexSignature` and Angular's `strictTemplates`.
- **Never use single-line `if`.** Always brace the body, even for one statement:
  ```typescript
  if (x === 1) {
      callSomeFunction();
  }
  ```
- **Avoid `any`.** When unavoidable, leave an inline comment explaining why.
- **Prefer `interface` over `class`** for data shapes. Anything shared between client and server **must** be an `interface` (browser/Node compat, no constructor coupling).
- **No default exports.** Export every symbol by name:
  ```typescript
  export const thisExample = 12;
  export class SomeClass { /* ... */ }
  ```
- **Constructor first.** In a class, the constructor is the first member.
- **Prefer `undefined` over `null`** for absence. Only use `null` where it's already required (DOM APIs, MongoDB results — and convert MongoDB's `null` to `undefined` at the boundary, e.g. via a `nullToUndefined` helper).
- **Don't use the `String()` / `Number()` constructors as casts.** Use `.toString()`, `parseInt()`, etc.
- **Vertical whitespace matters.** Separate logical blocks with blank lines so the structure of a function reads visually.

### Comments

- **Default to no comments.** Code should be self-explanatory through naming.
- When a block does need a comment, the comment is one short line stating *what* that block accomplishes (e.g. `// Sort the list by name.`), not a narration of the syntax.
- **JSDoc all exported items** — functions, methods, classes, interfaces, properties. Keep JSDoc to a sentence or two. The existing codebase uses `/** ... */` for one-liners.
- **Never commit speculative or scratch comments.** Two exceptions, both prefixed:
  - `// TODO-Immediate: ...` — placeholder code the developer must address before accepting the change.
  - `// TODO-Information: ...` — a note the developer should read before accepting.
- **Comments must be complete sentences with proper grammar.**
- Don't write comments that describe history (`// added for X`, `// fix for issue #123`). That belongs in commit messages and PR descriptions.

### Naming

- **Files:** kebab-case (`chat-room.service.ts`, `project-detail.component.ts`).
- **Classes / interfaces / types:** PascalCase. Don't prefix interfaces with `I` *except* for ones meant to define a "contract" implemented by multiple classes (`IPluginResolver`, `IVoiceChatProvider`, `ILlmModelServiceBase`). Pure data interfaces use plain PascalCase (`Project`, `ChatRoomData`).
- **Variables / functions / methods:** camelCase.
- **Constants & enum-likes:** SCREAMING_SNAKE_CASE for socket-event name constants (`ENTER_CHAT_ROOM`, `MESSAGE_CHUNK_MESSAGE`); regular constants are camelCase.
- **Observables:** suffix with `$` (`projectListing$`, `currentProject$`).
- **Private RxJS subjects backing public observables:** prefix with `_` (`_projectListing` → exposed as `projectListing$`).
- **CSS classes:** lowercase-with-dashes (`project-card-wrapper`).

---

## Frontend Standards (Angular)

### Stack

- **Angular** (standalone components — no NgModules)
- **PrimeNG** as the primary UI component library
- **Bootstrap** for layout utilities only (`d-flex`, `d-none d-lg-block`, etc.) — loaded as a CDN stylesheet from `angular.json`
- **SCSS** for all styling (`schematics.@schematics/angular:component.style: "scss"` set in `angular.json`)
- **RxJS** for reactive state; observables drive the entire component tree
- **socket.io-client** for real-time
- **Monaco Editor** (when rich text editing is needed) — loaded via `@monaco-editor/loader`
- **Zone.js** with default change detection (signals can opt in incrementally)

### Project structure

```
src/
├── app/
│   ├── components/                 # All UI components, grouped by feature domain
│   │   ├── component-base/         # Shared ComponentBase class
│   │   ├── <feature>/              # e.g. chat-core/, login/, registration/, admin/
│   │   │   ├── <list>/             # list component
│   │   │   ├── <detail>/           # detail component
│   │   │   └── <feature>.component.{ts,html,scss}
│   ├── services/
│   │   ├── chat-core/              # Domain services (state, orchestration)
│   │   │   └── api-clients/        # HTTP clients (one per concern)
│   │   ├── page-size.service.ts    # Generic, reusable across projects
│   │   └── token.service.ts
│   ├── routing/                    # Route guards, route helpers
│   ├── app.config.ts
│   ├── app.routes.ts               # Single flat routes definition
│   └── app.component.ts
├── environments/
│   ├── environment.ts              # production
│   └── environment.development.ts  # dev (file-replaced by angular.json)
├── model/
│   ├── shared-models/              # IDENTICAL copy of server's shared-models — see Shared Models Contract
│   └── <client-only-types>/
├── types/
├── utils/
├── styles.scss                     # Global styles + design tokens
├── layout.scss                     # Layout utility classes
└── buttons.scss                    # Button-specific shared rules
```

### Component pattern

**Every major component extends `ComponentBase`.** The base class lives in `src/app/components/component-base/component-base.component.ts` and exposes a `ngDestroy$` observable that fires once when the component is destroyed.

```typescript
// component-base.component.ts — ~20 lines, copy verbatim into new projects
import { Component } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
    selector: 'app-component-base',
    imports: [],
    template: ''
})
export class ComponentBase {
    private onDestroy = new Subject<void>();

    /** Emits when ngOnDestroy is called.
     *   Pipe takeUntil(this.ngDestroy$) on every subscription in the component. */
    protected ngDestroy$ = this.onDestroy.asObservable();

    ngOnDestroy() {
        this.onDestroy.next();
        this.onDestroy.complete();
    }
}
```

**Component file requirements:**

- `@Component` decorator must include `selector`, `imports`, `templateUrl`, and `styleUrl` (separate `.html` and `.scss` files — no inline templates).
- Always include `CommonModule` and `FormsModule` in `imports`. Add PrimeNG modules as needed.
- The class **must** have a constructor (even if empty), and the constructor is the first member.
- The class **must** extend `ComponentBase` and call `super()`.
- All RxJS subscriptions in the component pipe `takeUntil(this.ngDestroy$)`. With `takeUntil`, **never** call `.unsubscribe()` manually — it's automatic.
- Inject services in the constructor with `readonly`. Inject preemptively if you might use them — easier to delete than to add.
- **Never call `HttpClient` directly** from a component. Components use domain services; domain services use API clients.

**Canonical example:**

```typescript
@Component({
    selector: 'app-project-list',
    imports: [CommonModule, FormsModule, RouterModule, CardModule, /* ... */],
    templateUrl: './project-list.component.html',
    styleUrl: './project-list.component.scss'
})
export class ProjectListComponent extends ComponentBase {
    constructor(
        readonly projectsService: ProjectsService,
        readonly confirmationService: ConfirmationService,
    ) {
        super();
    }

    ngOnInit() {
        this.projectsService.projectListing$
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe(list => {
                list.sort((a, b) => a.name.localeCompare(b.name));
                this._projectListValue = list;
            });
    }

    private _projectListValue: ProjectListing[] = [];
    get projectList(): ProjectListing[] {
        return this._projectListValue;
    }
}
```

### Service pattern

Services are **the source of state.** Components consume observables from services and rarely hold their own non-trivial state.

- `@Injectable({ providedIn: 'root' })` for singletons (the default).
- Services usually call `this.initialize()` from their constructor to wire up streams.
- **State is exposed as observables** (`xxx$`), with optional snapshot getters for current value (`xxx`).
- **Reload streams:** when a service exposes data fetched from the API, it pairs the data with a private `Subject<void>` that triggers a re-fetch:
  ```typescript
  private _reloadProjectList = new Subject<void>();

  reloadProjectList() {
      this._reloadProjectList.next();
  }

  // The data observable starts with `undefined` so it fetches immediately,
  //   then refetches whenever something calls reloadProjectList().
  chatRooms$: Observable<ChatRoomData[]> = this._reloadRooms.pipe(
      startWith(undefined),
      switchMap(() => this.apiClient.getChatRooms()),
      shareReplay(1)
  );
  ```
- **CRUD methods return Observables that trigger reload on success** rather than blocking on a re-fetch:
  ```typescript
  createProject(name: string) {
      return this.client.createProject(name).pipe(
          switchMap(result => {
              this._reloadProjectList.next();
              return of(result);
          })
      );
  }
  ```
- **Async helpers** that don't fit RxJS comfortably can be plain `async` methods using `lastValueFrom(...)` to bridge.

### API client pattern

API clients live under `src/app/services/<domain>/api-clients/` and form a small hierarchy:

1. **`api-client-base.service.ts`** — abstract base class. Holds `HttpClient`, `TokenService`, an `HttpOptionsBuilder`, the API base URL, and a `parseToken()` helper.
2. **`api-client-internals.ts`** — `HttpOptionsBuilder` and `OptionsBuilderInternal` — a fluent options-builder used to attach the JWT auth header (`.buildOptions().addAuthToken().build()` or the shortcut `withAuthorization()`).
3. **`api-client.service.ts`** — the main `ClientApiService`, comprehensive coverage of major CRUD endpoints.
4. **Specialized clients** (e.g. `chatting-api-client.service.ts`) — split out when a logical concern has its own lifecycle (real-time messaging, voice, admin, etc.).

**Pattern rules:**

- All methods return RxJS `Observable`s, even for one-shot HTTP calls.
- Auth is automatic: every call (except `/login` and `/register`) uses `this.optionsBuilder.withAuthorization()`.
- `ObjectId` is the type used for all entity IDs in method signatures (it aliases to `string` in the browser — see [Shared Models Contract](#shared-models-contract)).
- Strongly type request and response bodies using interfaces from `src/model/shared-models/`.
- Token storage and parsing live in `TokenService`; the JWT is decoded with `JSON.parse(atob(token.split('.')[1]))`.

### Routing

- Use a **single flat `app.routes.ts`** with a deeply nested `children` tree — not a per-feature routing module.
- Auth-protected branches live under a parent route guarded by `authenticatedGuard` (a `CanActivateFn` returning `Observable<boolean | UrlTree>`).
- Nested routes mirror the URL hierarchy: `/projects/:projectId/chat-rooms/:chatRoomId`. Detail components read params from `ActivatedRoute.params`.
- A wildcard `path: '**'` redirects to `''`, which redirects to the home page.

### SCSS pattern

**Three global SCSS files**, all imported into `styles.scss`:

| File | Purpose |
| --- | --- |
| `src/styles.scss` | Design tokens, base typography, body/html sizing, app-wide utility classes, `:root` CSS custom properties |
| `src/layout.scss` | Layout-utility placeholders/classes (`%fit-container`, `.fit-container-scroll`, `.open-height`) |
| `src/buttons.scss` | Shared button-specific rules (e.g. `p-button:not(:first-child) { margin-left: 1em }`) |

**Design tokens via `:root` CSS custom properties** — define in `styles.scss`, override locally in component SCSS:

```scss
:root {
    // Surfaces
    --color-surface-panel: #f7f7f7;
    --color-surface-page: #ffffff;
    // Borders
    --color-border: #e0e0e0;
    // Brand
    --color-brand-primary: var(--p-primary-color, #3b82f6);
    // Typography
    --font-family-base: "Segoe UI", Arial, sans-serif;
}
```

**Component SCSS rules:**

- Class names are **lowercase-with-dashes**.
- Nest classes to **mirror containment in the HTML**. If a class appears under multiple parents, place it under the **lowest common ancestor**.
- **Use Bootstrap and PrimeNG classes for layout** — don't write new ones for `d-flex`, `d-block`, gutter spacing, etc.
- Don't create new global classes when an existing one fits.
- Don't introduce new classes for stylable PrimeNG elements unless customizing their child elements explicitly.
- Hard-coded color values are an anti-pattern — reference the `--color-*` custom properties from `styles.scss`.

### Responsive behavior

`PageSizeService` is the single source of truth for window-size reactivity:
- `pageResized$: Observable<{ width, height }>` — emits on `window.resize`, with `startWith` of the current value.
- `isSkinnyPage$ / isSkinnyPage` — true when width < 1024px.
- `isFullWidthDrawers`, `isFullScreenDialogs` — booleans for layout decisions.
- `standardDrawerStyle`, `standardDialogStyle` — getter style objects to feed into PrimeNG `[style]` inputs.

This service is generic and copies cleanly into new projects.

---

## Backend Standards (Node + Express + MongoDB)

### Stack

- **Node + Express** with **TypeScript**
- **MongoDB** via the official driver
- **Socket.IO** for real-time
- **Inversify** for DI (with `reflect-metadata`)
- **Zod** for request body validation
- **JWT (`jsonwebtoken`) + `bcrypt`** for auth
- `ts-node` for `npm start` (dev), `tsc → node dist/index.js` for build

### tsconfig

- `target: ES2022`, `module: commonjs` (for ts-node compatibility)
- `experimentalDecorators: true`, `emitDecoratorMetadata: true` — both required for Inversify
- `strict: true`, `forceConsistentCasingInFileNames: true`
- `rootDir: ./src`, `outDir: ./dist`

### Project structure

```
src/
├── index.ts                      # Entry point — must have `import 'reflect-metadata'` as line 1
├── container.ts                  # Inversify composition root
├── tokens.ts                     # Symbol() injection tokens
├── config.ts                     # getAppConfig() + env-var override
├── setup-express.ts              # Express + middleware + route wiring
├── system-setup.ts               # System-level init (migrations, etc.)
├── mongo-helper.ts               # Shared MongoDB connection wrapper
├── auth/
│   ├── jwt.ts                    # signToken / verifyToken
│   └── auth-middleware.ts        # Express auth middleware
├── database/
│   ├── db-service.ts             # @injectable abstract base
│   ├── log-db.service.ts
│   ├── auth-db.service.ts
│   └── <domain>/                 # e.g. chat-core/
│       ├── project-db.service.ts
│       ├── agent-db.service.ts
│       └── ...
├── server/
│   ├── middleware/               # Cross-cutting Express middleware
│   ├── socket-services/          # Socket.IO namespace handlers
│   ├── admin/                    # Admin-only routes
│   ├── socket.server.ts          # SocketServer base abstraction
│   ├── auth.server.ts            # createAuthRouter(authDbService)
│   ├── project.server.ts         # createProjectRouter(...)
│   └── <domain>.server.ts        # one factory function per route group
├── services/                     # Application services (non-DB)
├── chat-core/                    # Domain logic (only if it's the app's core)
└── model/
    ├── app-config.model.ts
    ├── errors/
    └── shared-models/            # IDENTICAL copy of client's shared-models
```

### Composition root via Inversify

**The container is the single composition root.** It replaces ad-hoc globals, ordering scripts, and post-construction property assignment hacks. Every service is bound once, declared its dependencies, and resolved lazily.

**`tokens.ts`** — one Symbol per injectable:

```typescript
export const TOKENS = {
    AppConfig:               Symbol('AppConfig'),
    MongoHelper:             Symbol('MongoHelper'),
    LogDbService:            Symbol('LogDbService'),
    // ... etc.
};
```

**`container.ts`** — every service is bound with `toDynamicValue(async (ctx) => ...)` + `inSingletonScope()`. The async factory is the right place for `await connect()` and `await initialize()` calls.

```typescript
export async function buildContainer(): Promise<Container> {
    const config = await getAppConfig();
    const container = new Container({ defaultScope: 'Singleton' });

    container.bind(TOKENS.AppConfig).toConstantValue(config);

    // MongoDB — connect once, reuse forever
    container.bind<MongoHelper>(TOKENS.MongoHelper).toDynamicValue(async () => {
        const helper = new MongoHelper(config.mongo.connectionString, config.mongo.databaseName);
        await helper.connect();
        return helper;
    }).inSingletonScope();

    // DB services — uniform pattern
    container.bind(TOKENS.LogDbService).toDynamicValue(async (ctx) =>
        new LogDbService(await ctx.container.getAsync(TOKENS.MongoHelper))
    ).inSingletonScope();

    // ... rest of bindings

    return container;
}
```

**Multi-bindings** for plugin-style arrays:

```typescript
container.bind<IPluginTypeResolver<any>>(TOKENS.PluginTypeResolvers).toConstantValue(new ArithmeticResolver());
container.bind<IPluginTypeResolver<any>>(TOKENS.PluginTypeResolvers).toConstantValue(new RoomInfoResolver());
// ...

// Aggregator binds AFTER all bindings above:
container.bind(TOKENS.AppPluginResolver).toDynamicValue(async (ctx) =>
    new AppPluginResolver(
        await ctx.container.getAllAsync<IPluginTypeResolver<any>>(TOKENS.PluginTypeResolvers),
    )
).inSingletonScope();
```

**Circular references** — when service A constructs B *and* B uses A at runtime (not at construction time), break the cycle with a getter:

```typescript
new SubAgentPluginResolver(
    () => ctx.container.get<ChattingService>(TOKENS.ChattingService),  // lazy getter
    /* ...other deps that *are* construction-time */
);
```

**Class decoration** — every injectable class is annotated with `@injectable()`. With `emitDecoratorMetadata`, individual constructor parameters do **not** need `@inject()` when their types are concrete classes; the container resolves them automatically. Classes whose constructors take primitives or arrays (e.g. `ModelServiceResolver` taking `ModelServiceBase[]`) keep the `toDynamicValue` factory.

### Entry point: `index.ts`

```typescript
import 'reflect-metadata';                       // MUST be the first import
import { buildContainer } from './container';
import { TOKENS } from './tokens';
import { getAppConfig } from './config';
import { initializeExpressApp } from './setup-express';
import { systemInitialization } from './system-setup';
import http from 'http';

async function run() {
    const container = await buildContainer();
    const config = await getAppConfig();

    // Eagerly resolve services that register socket handlers in their constructor.
    await container.getAsync(TOKENS.ChattingService);

    const app = await initializeExpressApp(container);
    const server = http.createServer(app);

    const socketServer = await container.getAsync<SocketServer>(TOKENS.SocketServer);
    socketServer.registerWithServer(config, server);

    await systemInitialization(container);

    server.listen(config.serverConfig.port, () => {
        console.log(`Server running on port ${config.serverConfig.port}`);
    });
}

run();
```

### Config loading

`getAppConfig()` is an idempotent loader that:
1. Reads `app-config.json` from the project root (one level above `dist/` or `src/`).
2. Caches the parsed config in module scope.
3. Walks the config object recursively and **overrides each leaf with the matching environment variable** if one is set (via a `ConfigToEnvMap` constant whose shape mirrors `IAppConfig`).
4. Converts any string values starting with `./` or `../` into absolute paths anchored at the project root.

### MongoDB layer

**`MongoHelper`** is a thin wrapper around the official `MongoClient`. Construct once at startup, share across all DB services.

- Holds a single persistent connection (no per-call connect/disconnect).
- Exposes `connect()`, `disconnect()`, `isConnected`, plus generic helpers: `makeCall`, `makeCallWithCollection`, `findDataItem` (with overloads for `findOne` true/false), `findDataItemWithProjection`, `updateDataItems`, `deleteDataItems`, `upsertDataItem`, `getPaginatedPipelineResult`.
- A reconnect handler on `'close'` reconnects unless `disconnect()` was called intentionally.
- The `null` returned by Mongo for `findOne` misses is converted to `undefined` via a `nullToUndefined` utility at the boundary.

**Collection name constants** are centralized in `src/model/db-collection-names.constants.ts` so collection strings are never typed inline.

**`DbService` abstract base** lives in `src/database/db-service.ts`. It's `@injectable()` and takes `MongoHelper` via constructor. Subclasses are per-entity (`ProjectDbService`, `AgentDbService`, etc.) and receive the helper from their own constructor.

**Per-entity DB service pattern:**

```typescript
@injectable()
export class ProjectDbService extends DbService {
    constructor(dbHelper: MongoHelper) {
        super(dbHelper);
    }

    async upsertProject(project: UpsertDbItem<Project & { _id: ObjectId; }>): Promise<Project & { _id: ObjectId; }> {
        return await this.dbHelper.upsertDataItem(DbCollectionNames.Projects, project);
    }

    async getProjectById(projectId: ObjectId) {
        return await this.dbHelper.findDataItem<Project & { _id: ObjectId; }, { _id: ObjectId; }>(
            DbCollectionNames.Projects,
            { _id: projectId },
            { findOne: true }
        );
    }

    // ... CRUD methods, plus aggregation methods using makeCallWithCollection for complex pipelines.
}
```

### Express setup

**`setup-express.ts`** exports `initializeExpressApp(container: Container): Promise<Application>`. It:

1. Creates the `Application`.
2. Sets up CORS using `config.corsAllowed`.
3. Adds `bodyParser.json()`.
4. Adds **ID-conversion middleware** — Mongo's `ObjectId` instances aren't natural in JSON, so request bodies are walked: hex strings that look like ObjectIds become `ObjectId` instances, and outgoing responses convert ObjectIds back to strings. (This is a small middleware family: `bodyStringsToObjectIdsMiddleware`, `bodyObjectIdsToStringMiddleware`, `bodyStringsToDatesMiddleware`.)
5. Registers an unauthenticated-API-call logger.
6. Resolves all DB and app services from the container (this is the only place `container.getAsync` runs for routes).
7. Mounts `createAuthRouter(...)` **before** `authMiddleware` (login/register are public).
8. Adds `authMiddleware`, then an authenticated-API-call logger.
9. Mounts every other route via its factory: `app.use(createProjectRouter(projectDbService, chatCoreService))`, etc.
10. Adds a 404 fallback.
11. Adds the **global error handler** as the last `app.use` (must have 4 args for Express to recognize it as an error handler):
    ```typescript
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error(`Unhandled error on ${req.method} ${req.path}:`, err);
        loggingService.logMessage({ level: 'error', message: `Unhandled error: ${message}`, data: { path: req.path, method: req.method } }).catch(() => {});
        if (!res.headersSent) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });
    ```

### Route factory pattern

**Routes never import services from globals.** Each route module exports a factory function that takes its dependencies as plain parameters:

```typescript
// src/server/project.server.ts
export function createProjectRouter(projectDbService: ProjectDbService, chatCoreService: ChatCoreService) {
    const projectRouter = express.Router();

    projectRouter.get('/project-listings', async (req, res) => {
        try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const projectListings = await projectDbService.getProjectListings(userId);
            res.json(projectListings);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch project listings' });
        }
    });

    // ...

    return projectRouter;
}
```

- Every handler gets the user ID via `getUserIdFromRequest(req)` (returns `ObjectId | undefined`).
- Every handler `try`/`catch`es. The catch handles known cases (404, 401, 400) and returns the appropriate status. Unhandled throws fall through to the global error handler.
- Returning early from handlers (`res.status(...).json(...); return;`) is the convention — never use `return res.status(...)` (Express handlers should return `void`).

### Auth middleware + JWT

```typescript
// src/auth/auth-middleware.ts
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.headers['authorization'] as string;
    if (!token) {
        res.status(401).json({ message: 'Access denied. No token provided.' });
        return;
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
        res.status(401).json({ message: 'Invalid token.' });
        return;
    }

    (req as any).user = decoded;
    next();
}
```

The token is the raw JWT (no `Bearer ` prefix in this codebase — be aware if interoperating). `verifyToken` returns the `TokenPayload` or `undefined`. The decoded payload is attached to `req.user`.

### Zod request validation

Use `validateBody(schema)` middleware **only on routes accepting user-supplied data** — login, register, project create/update. Other routes can be added incrementally. Validation failures return 400 with field-level error messages:

```typescript
const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required'),
});

projectRouter.post('/project', validateBody(createProjectSchema), async (req, res) => {
    // req.body is now typed and trusted
});
```

The middleware sets `req.body = result.data` after parsing, so handlers see the parsed/coerced version.

### Socket.IO abstraction

Real-time uses a custom `SocketServer` class (in `src/server/socket.server.ts`) that:
- Wraps Socket.IO with consistent observable-based event delivery.
- Authenticates connections via JWT in `socket.handshake.auth.token` — connection is dropped on bad credentials.
- Auto-converts ObjectIds to strings on outgoing events and strings to ObjectIds on incoming.
- Exposes `subscribeToEvent(eventName)` returning an `Observable<SocketServerEvent>` that automatically completes when sockets disconnect.
- Attaches the authenticated `userId` to every event so handlers don't need to look it up.
- Provides helpers: `joinRoom`, `leaveRoom`, `emitEventToRoom`, `emitEventToRoomExceptTo`.

**Per-namespace classes** (e.g. `ChatRoomSocketServer`, `TextDocumentSocketService`) extend a `SocketServiceBase`, are registered with the container, and call `subscribeToEvent(...)` in their `initialize()` method. Their constructors take `SocketServer` plus their needed DB/app services.

**Socket event name constants** are SCREAMING_SNAKE_CASE and live in shared-models alongside their TypeScript message-shape interfaces:

```typescript
// shared-models/.../general-messaging.socket-model.ts
export const ENTER_CHAT_ROOM = 'enter-chat-room';
export interface EnterChatRoomMessage {
    roomId: ObjectId;
}
```

This way the client and server reference the **same constant** for event names — no string-literal drift.

---

## Shared Models Contract

When client and server are in the same workspace, they share a `model/shared-models/` folder. **The folders are kept identical.**

### Rules

1. **Server is the source of truth.** All shared files originate on the server side and are *copied* to the client.
2. The folder structure under `shared-models/` is identical on both sides.
3. Files in `shared-models/` are **interfaces and constants only** — no classes, no logic that depends on Node-only or browser-only globals.
4. **Never modify** `shared-models/` files in the client project without explicit permission. Any change must be made on the server first and then propagated.
5. The client declares the `mongodb` package as an ambient module (no actual dependency installed) and aliases `ObjectId` to `string`. This lets shared interfaces reference `ObjectId` without breaking browser compatibility:
   ```typescript
   // client side: src/types/mongodb.d.ts (or similar)
   declare module 'mongodb' {
       export type ObjectId = string;
   }
   ```
   Use `ObjectId` in all client code that's working with entity IDs — it carries semantic meaning the plain `string` type doesn't.

### Conventions inside `shared-models/`

- **Interfaces** for all data shapes. JSDoc on every property.
- **Operation types:** `NewDbItem<T>` for create payloads (omits `_id`), `UpsertDbItem<T>` for upsert payloads (`_id` optional). Defined once in `shared-models/db-operation-types.model.ts`.
- **Domain split:** group related models into a sub-folder (`shared-models/chat-core/`, `shared-models/auth/`, etc.).
- **Socket-message models** live under `<domain>/socket-messaging/` and pair the event-name constant with its message interface.

---

## General Philosophy

What unifies these projects:

- **Reactive state on the client, container-managed services on the server.** Both are about keeping ownership of "who knows what" explicit and pushing it to one well-defined place.
- **Composition over inheritance**, *except* for two carefully chosen base classes: `ComponentBase` on the client (lifecycle plumbing) and `DbService` on the server (DB helper plumbing). Both exist to delete repetitive code, not to grow an inheritance hierarchy.
- **Manual wiring with help.** Inversify isn't auto-magic — every binding is written by hand in `container.ts`. The decorators only let the container resolve the parameter types it can already see.
- **Trust at the boundary, not inside.** Validate request bodies with Zod at the entrance to the server. Inside, trust your own types. Don't write defensive code for scenarios that can't happen.
- **Boring, repeatable patterns.** The DB services are boring. The route factories are boring. The components are boring. Boring means a new contributor (or Claude) can predict where things go without asking.
- **Surface area first, polish later.** The codebase has acknowledged rough spots (`ReadonlySubject` is being deprecated; some plugin resolution had post-hoc property assignment until Inversify was introduced). Patterns are revisited when they hurt — not preemptively.

---

## Quick checklists

### Starting a new Angular frontend

- [ ] Pick a non-default dev port; set it in `angular.json`
- [ ] `tsconfig.json`: strict + `experimentalDecorators` + Angular strict mode
- [ ] Create `src/styles.scss`, `src/layout.scss`, `src/buttons.scss`; wire `styles.scss` in `angular.json`
- [ ] Add `:root { --color-* }` design tokens block to `styles.scss`
- [ ] Copy `ComponentBase` from d-talk-client
- [ ] Add `PageSizeService`, `TokenService`
- [ ] Set up `api-client-base.service.ts` + `api-client-internals.ts` + main `ClientApiService`
- [ ] Create `environment.ts` + `environment.development.ts`
- [ ] Add `ObjectId` ambient declaration aliased to `string`
- [ ] Single `app.routes.ts` with auth-guarded subtree

### Starting a new Node/Express backend

- [ ] `tsconfig.json`: `target: ES2022`, `module: commonjs`, strict, `experimentalDecorators`, `emitDecoratorMetadata`
- [ ] `npm install inversify reflect-metadata express cors body-parser zod jsonwebtoken bcrypt mongodb socket.io rxjs`
- [ ] `import 'reflect-metadata';` as the first line of `index.ts`
- [ ] Create `tokens.ts`, `container.ts`, `config.ts`, `mongo-helper.ts`
- [ ] `app-config.json` + `APP-CONFIG.md` + add `app-config.json` to `.gitignore`
- [ ] `getAppConfig()` with env-var override map
- [ ] `DbService` abstract base + per-entity DB services with `@injectable()`
- [ ] `auth/jwt.ts` + `auth/auth-middleware.ts`
- [ ] `validateBody` middleware
- [ ] Route factory pattern from the start — never import from globals
- [ ] Global error handler as the last middleware in `setup-express.ts`
- [ ] Wire CORS to allow the frontend's dev port
