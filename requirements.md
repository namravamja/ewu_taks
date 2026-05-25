# Cases & Pipeline — Implementation Task

## Overview

This task covers the full implementation of the Cases and Pipeline Status domains from scratch — schema, API. Two views must be delivered:

- **Kanban board** — cases grouped by pipeline status, with drag-and-drop, per-column pagination, **filtering, sorting, and search**.
- **List view** — a paginated table of cases with **filtering, sorting, and search**.

Both views must support **50,000+ cases per workspace** at production scale. Performance is a hard requirement and must be validated before the task is considered complete.

---

## Getting Started

Before writing any code, follow `[setup.md](./setup.md)` to get the project running locally. It covers prerequisites, environment variables, running Postgres and Redis via Docker, applying the database migration, seeding baseline data, and the seeded login credentials.

The API must be running locally and reachable at [http://localhost:3000](http://localhost:3000) before you start on the task below.

---

## What the Candidate Must Do

### 1. Review the Figma

Review the Figma designs thoroughly before writing any code. Every field, filter, sort option, search input, and interaction shown in the designs is part of the contract.

| Area                        | Link                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Case schema                 | [Open in Figma](https://www.figma.com/design/E7J7B8xpxmJERfZDoJzmM2/Media-Star-Kanban?node-id=11-192622&t=wnrNpxsiBlJ68Nfv-0) |
| Kanban, list, filter & sort | [Open in Figma](https://www.figma.com/design/E7J7B8xpxmJERfZDoJzmM2/Media-Star-Kanban?node-id=11-326046&t=NRc2YBvGtBdsC97o-1) |

### 2. Derive the Schema from the Figma

From the Figma, derive and implement the following Prisma models via a single, descriptively named migration:

- `**PipelineStatus`\*\* — a column on the Kanban board. Status changes are free-form; no transition rules.
- `**Case**` — the core case entity. All fields are derived from the Figma.
- `**CaseAssignee**` — many-to-many join between `Case` and `User`.

The migration must run cleanly from a fresh database with no errors.

### 3. Derive and Implement the API

From the Figma, derive and implement the endpoints, request parameters, and response shapes needed to drive both views. The candidate decides the endpoint set — there is no fixed list. Each endpoint must have a clear, efficient path from the database to the client.

Both the Kanban and the List view must support:

- **Filtering** — multi-field filter contract.
- **Sorting** — constrained sort field paired with a direction value.
- **Search** — text search across the user-visible fields shown in the Figma.

### 4. Performance — 50,000+ Cases

Every endpoint that returns or counts cases must perform acceptably against a workspace of 50,000+ cases. Specifically:

- Every filter / sort / search combination must resolve to an **indexed query path**. No full table scans at any page size.
- The Kanban board view and the List view must both paginate (per-column for the board; standard pagination for the list).
- Please ensure each query is well-optimized and returns only the data the view actually needs.
- Validate performance against a seeded workspace before the task is considered complete.

### 5. Follow Existing Coding Standards and Patterns

The codebase has established conventions for:

- Module structure
- DTO / view-model layout (`dtos/`, `interfaces/`)
- Repository / service / controller separation
- Soft-delete handling (Prisma extension — do not re-implement)
- Auth guards
- Swagger decorators

Match these conventions exactly. Do not introduce new patterns.

---

## Non-Negotiable Constraints

- All endpoints must be protected by the existing auth and permission guards. No new auth patterns.
- Stage-change and board-reorder endpoints must return the updated case row so the frontend can reconcile optimistic updates without a refetch.
- The Kanban and List views must share a **single server-side filter / sort / search translator**. No duplication across views.
- All accepted filter and sort keys must be declared in a single constants file. Unknown keys must be rejected at validation time (`forbidNonWhitelisted: true` is already enforced globally).
- All view models must be flat and JSON-serializable.
- Every endpoint must be fully documented in Swagger — decorated request DTOs, decorated response shapes, and correct HTTP status codes for success and error paths.

---

## Out of Scope

The following are explicitly deferred. If encountered, raise it before proceeding.

- Draft state machine
- Activity / audit timeline
- Embeddings and semantic search
- File attachments
- Stage transition rules
- Teams, agencies, themes, comments, notes, linked emails
- Real-time push notifications

---

## Acceptance Criteria

**Schema**

- `PipelineStatus`, `Case`, and `CaseAssignee` are implemented via a single migration.
- All fields are derived from the Figma.
- The migration runs cleanly from a fresh database.

**API**

- Endpoints, parameters, and responses are derived from the Figma and implemented end-to-end.
- Both Kanban and List views support filtering, sorting, and search.
- All endpoints are protected by the existing auth and permission guards.
- Stage-change and board-reorder endpoints return the updated case row.
- Filter / sort / search logic is implemented via a single shared translator — no duplication across views.
- All filter and sort keys are whitelisted in a constants file; unknown keys are rejected at validation time.
- All view models are flat and JSON-serializable.

**Performance**

- All case endpoints perform acceptably against a seeded workspace of 50,000+ cases.
- Every filter / sort / search combination uses an indexed query path.

**Swagger**

- Every endpoint is documented with decorated request DTOs, response shapes, and HTTP status codes.
- Swagger documentation matches the actual implementation.

**Code Quality**

- Existing coding standards and patterns are followed throughout.
- `pnpm exec nx affected --target=lint,typecheck` passes with no errors.
