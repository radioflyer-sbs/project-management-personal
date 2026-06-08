# project-management-client — Angular Frontend

## Project purpose
Project Management application. Single user, no login system. Allows managing multiple projects.

## Stack
- **Angular 19** (standalone components — no NgModules)
- **PrimeNG 19** — primary UI component library
- **Bootstrap** — layout utilities only (CDN stylesheet, not component logic)
- **SCSS** for all styling
- **RxJS** for reactive state
- **socket.io-client** for real-time (when needed)

## Dev server
```
ng serve
```
Runs on **http://localhost:54201**

Backend API: `http://localhost:1073/api`

## Key folder map
```
src/
├── app/
│   ├── components/component-base/   — ComponentBase (extend in every component)
│   ├── components/<feature>/        — Feature components go here
│   ├── services/                    — Domain services (state + orchestration)
│   │   └── api-clients/             — HTTP clients (ApiClientBase, ClientApiService)
│   └── routing/                     — Route guards
├── environments/                    — environment.ts (prod) + environment.development.ts (dev)
├── model/shared-models/             — Shared interfaces (IDENTICAL to server's shared-models)
├── types/mongodb.d.ts               — ObjectId ambient alias (string in browser)
├── styles.scss                      — Design tokens + global styles
├── layout.scss                      — Layout utility classes
└── buttons.scss                     — Button shared rules
```

## Critical patterns
- Every component **extends ComponentBase** and calls `super()` in its constructor.
- All RxJS subscriptions use `.pipe(takeUntil(this.ngDestroy$))` — never call `.unsubscribe()` manually.
- Constructor is always the **first member** of a class.
- Components **never call HttpClient directly** — use domain services → API clients.
- State lives in services, exposed as observables (`xxx$`). Components only subscribe.
- `ObjectId` is imported from `'mongodb'` (resolves to `string` via ambient declaration in `src/types/mongodb.d.ts`).

## Shared models rule
`src/model/shared-models/` is an **identical copy** of the server's `src/model/shared-models/`.
- Server is the source of truth. Never modify client-side shared-models without modifying the server first.
- Contains only `interface` and `const` — no classes, no Node-only or browser-only code.
