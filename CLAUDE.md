# CLAUDE.md

## Project Overview

EWU Media Backend — a NestJS 11 monorepo managed by Nx 22.5, pnpm, Node 24, TypeScript 5.9.
3 apps + 8 libs. PostgreSQL via Prisma. Redis for cache and queue.

See `docs/architecture.md` for full architecture details.
See `docs/commands.md` for the full commands reference.
See `docs/email-sync.md` for the inbound/outbound email pipeline (incl. FOIA passive-receive constraint).
See `.claude/coding-standards.md` for detailed naming, formatting, and coding conventions.

## Quick Commands

| Task            | Command                                      |
| --------------- | -------------------------------------------- |
| Lint affected   | `pnpm exec nx affected --target=lint`        |
| Test affected   | `pnpm exec nx affected --target=test`        |
| Typecheck       | `pnpm exec nx affected --target=typecheck`   |
| Build all       | `pnpm exec nx run-many --target=build --all` |
| Prisma generate | `pnpm prisma:generate`                       |

Docker: `docker compose up -d` (PostgreSQL + Redis)

## After Making Changes

Run lint, test, and typecheck (see Quick Commands above). Fix all failures before committing.

## Architecture (Summary)

- **api** — HTTP server (port 3000), all 8 libs + audit module (inlined)
- **email-sync** / **email-classifier** — Background workers via `bootstrapWorker()`, no HTTP
- **8 libs** in layers L0-L2 enforced by ESLint boundaries (see `eslint.config.mjs`)
- `core` is self-contained (merged from common, config, cache)

## Module Resolution

Uses **`nodenext`** with **package.json `exports`** — NOT tsconfig paths.
Import prefix: `@mediastar/*`. Custom condition `@org/source` resolves to source at dev time.

## Coding Principles

- **No patches or workarounds** — always implement the standard, idiomatic NestJS/TypeScript solution
- **DRY** — extract shared logic into reusable services, utilities, or base classes
- **SOLID principles** — follow SRP, OCP, LSP, ISP, DIP via NestJS DI
- Explicit return types on all controller/service public methods
- `@types/*` packages go in `devDependencies`

## Key Conventions

- **Domain DTOs** co-located in `apps/api/src/app/domain/<module>/dtos/`, implement interfaces, use `class-validator` + `class-transformer`
- **Cross-cutting DTOs** (pagination, api-response, error-response) in `libs/shared/src/lib/dtos/`
- **Domain interfaces** co-located in `apps/api/src/app/domain/<module>/interfaces/`
- **Cross-cutting interfaces** (`IUserContext`, `IRole`, etc.) in `libs/shared/src/lib/interfaces/`
- **Prisma schema** at `libs/database/prisma/schema.prisma`
- **Env validation** via Joi in `libs/core/src/lib/config/validation.ts`
- Required env vars (no defaults): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- Avatar presign TTL: `AWS_S3_PROFILE_IMAGE_PRESIGNED_EXPIRY` (default 604800s / 7 days, SigV4 max). Distinct from `AWS_S3_PRESIGNED_EXPIRY` (default 3600s) which governs one-shot attachment downloads.

## Template Attachments

Agency Templates support inline + normal attachments via the centralized `StorageObject` system.

- **Versioned snapshot, not soft-delete** — `template_attachments` rows are immutable per `templateVersionId`. Removing an attachment from a template means simply not inserting it under the next version's row-set; historical rows stay intact for audit. The model has NO soft-delete columns.
- **Reference (not copy) S3 model** — when a template is used to compose an email, the resulting `EmailAttachment` row reuses the source `s3Key` and `storageObjectId` (no S3 copy on send). The cleanup-cron + soft-delete reference guards on `StorageObjectService` skip rows still referenced by `email_attachments` or `template_attachments` so a single template logo can back many sent emails forever.
- **Stable cross-version identity** — `templateAttachmentGroupId` (UUID) survives version bumps and `replaceGroupId` file swaps. Inline CID is `tpl-{groupId}@template.local` so body `cid:` references never go stale.
- **Optimistic-lock version bump** — body + subject + attachments updates all flow through `AgencyTemplatesRepository.updateBodyAndAttachments` with `where: { id, status: ACTIVE, version: current.version }`. Concurrent PATCH → 409 `TEMPLATE_VERSION_CONFLICT`. No-op PATCH (no diff) does NOT bump version.
- **Restore symmetry** — `restoreVersion` re-snapshots both body AND attachments under the new version, reusing every `templateAttachmentGroupId` and `storageObjectId` so historical body `cid:` references continue to resolve.
- **Compose pins to `templateVersionId`** — `SendEmailDto.templateVersionId` + `templateAttachmentGroupIds` reference an immutable snapshot. The bridge (`TemplateAttachmentBridgeService.materialize`) reads `template_attachments` by `templateVersionId` directly so a soft-deleted template still serves drafts pinned to that version. **The version is a transient compose-time input only — the `Email` row itself stores no template-version reference; the rendered body and materialized `EmailAttachment` rows are the immutable artifact of what was sent.**
- **Combined send caps + 30 MB precheck** — `assertSendAttachmentCaps` and `assertSesSizeLimit` count user uploads + template-derived attachments together (deduped by `storageObjectId`).
- **Cross-tenant guard for clones** — when a future "duplicate template" feature lands, cross-agency clones MUST copy the `StorageObject` and mint fresh group ids; same-agency clones can share `storageObjectId` with new group ids.

Template entityType in `StorageObject` polymorphic binding is `'Template'` (`ENTITY_TYPE.TEMPLATE`). Key prefix: `templates/{id}/attachments` (`KEY_PREFIX.TEMPLATE_ATTACHMENTS`). MIME + size policy in `apps/api/src/app/domain/agency-templates/uploads/template-attachments.policy.ts` mirrors the email-attachment policy so a template can be safely materialized into outbound mail.

## Soft Delete

- Prisma extension in `libs/database/src/lib/extensions/soft-delete.extension.ts` auto-injects `isDeleted: false` into all queries for models with `isDeleted`/`deletedAt`/`deletedBy` fields
- Affected models: `User`, `Role`, `PipelineStatus`, `Case`, `CaseAgency`, `AgencyTemplate`
- **Read operations** — `findFirst`, `findFirstOrThrow`, `findMany`, `count`, `aggregate`, `groupBy`, `updateMany` → auto-inject `isDeleted: false` in `where`
- **Unique-key operations** — `findUnique`, `findUniqueOrThrow`, `update`, `upsert` → inject `isDeleted: false` via `AND` clause (unique fields constraint)
- **`delete`** → converted to `update` setting `isDeleted: true`, `deletedAt`, `deletedBy` (requires `deletedBy`)
- **`deleteMany`** → converted to `updateMany` setting `isDeleted: true`, `deletedAt`, `deletedBy` (requires `deletedBy`)
- Escape hatch: pass `{ isDeleted: true }` explicitly to query deleted records
- `HardDeleteService` provides raw `PrismaClient` without the extension for permanent deletes
- Inside `$transaction`, use `as never` cast because `tx` is raw `TransactionClient` without augmented `deletedBy` types — the extension still intercepts at runtime
- **Do NOT manually add `isDeleted: false`** to queries — the extension handles it automatically

## Gotchas

- Never import a lib's internal path (`@mediastar/shared/src/...`) — always use the barrel export
- `DatabaseModule`, `LoggerModule`, and `CacheModule` are `@Global()` — importing them in child modules causes duplicate providers
- Prisma client must be regenerated after schema changes (`pnpm prisma:generate`)
- `GlobalExceptionFilter`, `PrismaExceptionFilter`, and `PrismaValidationExceptionFilter` are registered via `APP_FILTER` DI token in `CoreModule` — never use `app.useGlobalFilters()`
- `PasswordService` is in `@mediastar/shared`, not auth — auth only handles tokens
- `libs/core` depends on `@prisma/client` for `PrismaExceptionFilter` — deliberate exception
- `AppConfigModule` is NOT in core's barrel export (side effects) — import via `@mediastar/core/config`

## Role Assignment

- Endpoints that accept `roleIds` (approve, unreject, reactivate, invite) use a **reconcile pattern** — not delete-all + create
- `syncUserRoles()` in `UsersRepository` fetches current roles, computes diff (toAdd/toRemove), and only creates/deletes the delta — same pattern as `case-assignees` and `case-agencies`
- All role assignments track `assignedBy` (the admin who assigned the role)
- `roleIds` DTOs use: `@IsArray`, `@ArrayMinSize(1)`, `@ArrayMaxSize(20)`, `@ArrayUnique`, `@IsInt({ each: true })`, `@Min(1, { each: true })`, `@Type(() => Number)`
- `@EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })` prevents assigning roles at or above the actor's level
- Invited users (those with a `UserInvitation` record) are blocked from admin actions (approve/reject/unreject) — managed only via the invitations API

## Populated Users & Avatars

Responses that embed a user (creator, assignee, author, supervisor, invitedBy, etc.) use a single shared contract with presigned avatar URLs. Do NOT invent per-module user DTOs.

- **Contract**: `IPopulatedUser` (id, firstName, lastName, email) and `IPopulatedUserWithAvatar` (+ `profileImageUrl: string | null`), both from `@mediastar/shared`. Matching swagger DTOs: `PopulatedUserDto`, `PopulatedUserWithAvatarDto`.
- **Prisma select**: `POPULATED_USER_SELECT` (no avatar) and `POPULATED_USER_WITH_AVATAR_SELECT` (adds `profileImage: { id, s3Key }`) — both from `@mediastar/shared`. Use these in repository select constants instead of hand-picking fields.
- **Avatar assembly**: `PopulatedUserAvatarAssembler` (`apps/api/src/app/domain/users/services/populated-user-avatar.assembler.ts`) batches S3 presign calls and maps rows to DTOs. Inject it in any service that returns user-bearing responses.
- **Per-request batching pattern** — call `resolve()` once with all user rows, then use the resulting `urlMap` via a `toDto(row, urlMap)` resolver passed into mapper functions. Never call the assembler per-row (N+1 S3 presigns).
  ```ts
  const urlMap = await this.avatarAssembler.resolve(rows.flatMap(collectXUserRows));
  const avatars = { toDto: (r) => this.avatarAssembler.toDto(r, urlMap) };
  return rows.map((r) => toXVM(r, avatars));
  ```
- **`collectXUserRows` helpers** live next to each domain's select constants (e.g. `collectCaseListUserRows`, `collectCaseDetailUserRows`) and return every user row in one projection — keeps the presign set deduplicated.
- **Resolver interface per domain** — each domain that maps rows to VMs defines a small `XUserAvatarResolver` interface in its select-constants file (shape: `{ toDto(row): IPopulatedUserWithAvatar | null }`). This keeps mapper functions pure/sync — the assembler is only awaited once at the service boundary.
- **Presign TTL**: governed by `AWS_S3_PROFILE_IMAGE_PRESIGNED_EXPIRY` (default 604800s = 7 days, the SigV4 max). Longer than the default 1h attachment TTL because avatar keys are referenced from cached list responses.
- **Null-image path**: users without `profileImage` get `profileImageUrl: null` with no S3 call — `resolve()` filters null keys up front.
- **Test fixtures** — DB-row-shape fixtures need `profileImage: null` (or the `{ id, s3Key }` object); VM/DTO-shape fixtures need `profileImageUrl: null`. The two are not interchangeable — a failing TS2741 "missing profileImage" vs "missing profileImageUrl" error tells you which shape you're in.

## File Uploads (StorageObject System)

- **Centralized** in `libs/aws/src/lib/uploads/` — all file uploads use `StorageObjectService` from `@mediastar/aws`
- See `libs/aws/CLAUDE.md` for full usage guide, utilities, and security details
- **Model**: `StorageObject` (table: `storage_objects`) — no soft-delete, hard delete only
- **Status lifecycle**: `PENDING` → `CONFIRMED` with `expiresAt` tracking
- **Policy pattern**: consumers pass `IUploadPolicy` with `allowedContentTypes`, `maxFileSize`, `keyPrefix`, `entityType`
- **MIME utilities**: `MIME.IMAGE.JPEG`, `MIME_GROUPS.IMAGE`, `buildContentTypes({ include, exclude, extra })`
- **File size helpers**: `kb()`, `mb()`, `gb()` — use instead of raw byte calculations
- **Key prefix builders**: `KEY_PREFIX.CASE_ATTACHMENTS(caseId)` — never use raw strings for S3 key prefixes
- **S3 key format**: `{prefix}/{sanitizedName}_{shortUUID}.{ext}` — flat structure, no nested directories per upload
- **Cron cleanup**: `STORAGE_OBJECT_CLEANUP` every 6 hours — deletes expired PENDING records (with 1hr grace period)
- **Security**: Content-Disposition: attachment on downloads, IDOR prevention on confirm, headObject verification, key prefix validation

## Testing

- Jest 30 with SWC transform (`.spec.swcrc` per project)
- Config: `jest.config.cts` per project, `jest.preset.js` at root
- `passWithNoTests: true` in preset — do not rely on this, always write tests
