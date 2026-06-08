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
| Express API | 1073 |

## Design specification
**`application-design.md`** is the canonical design reference — design principles (P0–P8),
the complete data model, canvas/interaction rules, routing, and architecture. It expands
`application-details.md` (the original vision). Read it before implementing features.
Section 13 ("Decisions to Confirm") lists open architectural forks awaiting sign-off.

## Standards reference
See `C:\Users\rolso\.claude\skills\mean-stack-project-setup\references\project-standards.md`
for the full coding standards that govern both projects.
