# Shared Library

## DTOs

- **Cross-cutting DTOs** live in `src/lib/dtos/`, exported from `@mediastar/shared` (pagination, api-response, error-response, password, populated-user)
- **Domain-specific DTOs** live co-located with their app modules in `apps/api/src/app/domain/<module>/dtos/`
- Must `implement` their corresponding interface (e.g. `OffsetPaginationDTO implements IPaginationParams`)
- Use `class-validator` decorators for validation
- Use `class-transformer` `@Type()` for type coercion (the API's `ValidationPipe` has `transform: true`)
- Optional properties must have `@IsOptional()`

## Interfaces

- **Cross-cutting interfaces** live in `src/lib/interfaces/` (`IUserContext`, `IUserIdentity`, `IRole`, `IAuditLogEntry`, `IPopulatedUser`, `IPopulatedUserWithAvatar`, etc.)
- **Domain-specific interfaces** live co-located with their app modules in `apps/api/src/app/domain/<module>/interfaces/`

## Populated User Primitives

Use these whenever a response embeds a user (creator, assignee, author, supervisor, commenter, invitedBy, etc.). Do not define per-module clones.

- `IPopulatedUser` — `{ id, firstName, lastName, email }`
- `IPopulatedUserWithAvatar` — `IPopulatedUser & { profileImageUrl: string | null }`
- `PopulatedUserDto` / `PopulatedUserWithAvatarDto` — swagger DTOs (use as the `type:` on `@ApiProperty` / `@ApiWrappedResponse`)
- `POPULATED_USER_SELECT` — Prisma select for the base shape
- `POPULATED_USER_WITH_AVATAR_SELECT` — spreads the above and adds `profileImage: { select: { id, s3Key } }` (the raw row used by `PopulatedUserAvatarAssembler` in the api app)

See the **Populated Users & Avatars** section in the root `CLAUDE.md` for the full per-request batching pattern.

## Services

- `PasswordService` lives here (not in auth) — auth only handles token operations

## Utilities

- **Offset Pagination**: `buildPaginationArgs()`, `buildPaginatedResult()` in `src/lib/utils/pagination.util.ts`
- **Cursor Pagination**: `buildCursorPaginationArgs()`, `buildCursorPaginatedResult()`, `encodeCursor()`, `decodeCursor()` in `src/lib/utils/cursor-pagination.util.ts`
- **Search**: `buildSearchWhere()` in `src/lib/utils/search.util.ts`
- **Sort**: `buildSortBy()` in `src/lib/utils/sort.util.ts`
