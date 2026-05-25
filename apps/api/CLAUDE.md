# API App

HTTP server on port 3000 (configurable via `PORT` env).

## Module Structure

Modules are grouped under `src/app/`:

- **`core/`** — Infrastructure (health, cron, throttler)
- **`domain/`** — Business modules (cases, users, roles, permissions, pipeline-statuses, themes, transition-rules, notifications)
- **`admin/`** — Admin modules (settings)

Each domain module co-locates its DTOs in `dtos/` and interfaces in `interfaces/` (not in `libs/shared`).

## Global Configuration

- `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `forbidUnknownValues: true`, `transform: true`
- `GlobalExceptionFilter` + `PrismaExceptionFilter`: registered via `APP_FILTER` DI token in `CoreModule` — never use `app.useGlobalFilters()`
- Helmet enabled, CORS enabled, global prefix `/api`
- Depends on all 12 libs
- Swagger docs at `/docs` (non-production only)

## Role Hierarchy Guards

Three guards enforce role-level security on admin actions:

- **`@EnforceRoleHierarchy()`** — checks the target **user's** role level is below the actor's. Applied on all user admin endpoints (approve, reject, suspend, etc.)
- **`@EnforceRoleEntityHierarchy()`** — checks the target **role entity's** level. Two modes:
  - Param mode (default): `@EnforceRoleEntityHierarchy()` reads `req.params['id']` — used on `PATCH /roles/:id`, `DELETE /roles/:id`
  - Body mode: `@EnforceRoleEntityHierarchy({ source: 'body', field: 'roleIds' })` reads `req.body['roleIds']` array — used on invite, approve, unreject, reactivate endpoints
- **`@PreventSelfAction('id')`** — prevents admins from performing actions on themselves

## Invitations

- `POST /invitations` creates a pending user + invitation record in one transaction
- `POST /invitations/accept/:token` is public — the invitee sets a password, no role modification possible
- Invited users are blocked from admin user actions (approve/reject/unreject) — use invitations API only
- Invitation list response includes `invitedBy` (id, email, firstName, lastName) of the admin who sent it

## Cases

- `POST /cases` always creates a non-draft case (`isDraft: false`) — the `isDraft` field is NOT accepted in `CreateCaseDTO`
- Drafts have their own dedicated endpoints: `POST /cases/drafts`, `PATCH /cases/drafts/:id`, `POST /cases/drafts/:id/publish`

## Case Attachments

Sub-module at `domain/cases/case-attachments/`. Uses the centralized `StorageObjectService` from `@mediastar/aws`.

**Endpoints:**

- `POST /cases/:caseId/attachments/upload-urls` — batch generate 1-10 presigned upload URLs
- `GET /cases/:caseId/attachments` — list confirmed attachments with download URLs
- `GET /cases/:caseId/attachments/:attachmentId/download-url` — single download URL

**Managed via reconcile pattern:** `attachmentIds` on `PATCH /cases/:id` (same as `agencyIds`/`assigneeIds`). No standalone confirm or delete endpoints — confirmation and removal happen atomically when the case is updated.

**Upload policy:** documents, images, video, audio, presentations up to 500 MB. Defined in `CASE_ATTACHMENT_POLICY` constant.

## Case Note Attachments

Note attachments use the same centralized `StorageObject` system. The old `NoteAttachment` table has been removed.

- **Upload URL:** `POST /cases/:caseId/notes/:noteId/attachments/upload-url`
- **Managed via reconcile pattern:** `attachmentIds` on `POST /cases/:caseId/notes` (create) and `PATCH /cases/:caseId/notes/:noteId` (update)
- **On note deletion:** all note attachments are cleaned up via `deleteUploadsByEntity`

## User Profile Image

`User.profileImageId` is an FK to `StorageObject`. Confirm accepts `uploadId` (StorageObject ID), not raw s3Key.

All three consumers delegate to `StorageObjectService` from `@mediastar/aws`. See `libs/aws/CLAUDE.md` for the centralized upload system documentation.

## Email Share Links

Large outbound attachments (>`EMAIL_LARGE_ATTACHMENT_THRESHOLD_MB`, in `constants/email-size.ts`) are dropped from the SES envelope. Instead the backend mints an opaque token, stores it on `email_attachment_share_links`, and **auto-appends a styled HTML card to the end of the body** at send time. Public `GET /api/email-shares/:token` 302-redirects to a fresh 5-minute S3 presign per click (`SHARE_LINK_REDIRECT_TTL_SECONDS`).

**Backend is the sole authority on share-link placement.** The FE supplies a normal body; the backend decides which attachments become share-links, mints the URLs, and appends the card. The FE does no share-link work and there is no preview endpoint.

### `ShareLinkPlanner` — single source of classification truth

`apps/api/src/app/domain/emails/services/share-link-planner.service.ts` is a **pure** classifier — no DB, no S3, no DI. Given resolved attachment metadata + body, it returns a deterministic `AttachmentPlan[]` describing which uploads are sent inline (`embed`) vs as a share-link, why, and the projected `expiresAt`. Classification is **fully automatic** — no sender override knobs.

Classification rules (in order):

- Inline → always `embed` with reason `inline`.
- `fileSize > EMAIL_LARGE_ATTACHMENT_THRESHOLD_BYTES` → `share-link` / `over-per-file-threshold`.
- Otherwise → `embed` / `within-threshold`.

After per-file classification, the **aggregate-promotion loop** keeps demoting the largest embed-classified non-inline attachment to share-link (tie-broken by input index ASC) until `bodyBytes + Σ embed.fileSize ≤ MAX_RAW_BYTES_PRE_BASE64`. If only inline-classified items remain and the cap is still exceeded, the planner emits `code: 'over-cap-after-promotion'` and the send fails downstream at `assertSesSizeLimit` with a 400. This is the **only** send-time failure mode the FE will see.

### `ShareLinkCardRenderer` — backend-owned markup

`apps/api/src/app/domain/emails/services/share-link-card-renderer.service.ts` produces the appended card. Style constants live in `constants/share-link-card.template.ts`. The renderer is pure (no DI deps) and emits both an HTML block and a plain-text block:

- **HTML**: `<a>`-wrapped `<table>` chip per attachment with inline-styled icon column + filename column (Outlook Word-renderer compat via `valign="middle"` and table width attributes), all CSS inlined (Gmail strips `<style>`), filename HTML-entity-escaped, no flexbox/grid/`position`. The icon is referenced via `<img src="cid:share-link-icon@mediastar.local">` when an `iconCid` option is supplied; renders without an icon if not.
- **Text**: prefixed with `\n---\nAttachments:` then one line per file: `- filename: URL`.

Filenames are CR/LF/tab-stripped and truncated to 80 characters before rendering. The card is appended verbatim to whichever body parts the sender supplied — if `bodyHtml` was `null` the HTML output stays `null` (same for `bodyText`); `bodySnippet` is recomputed afterwards.

### `ShareLinkIconAssetService` — lazy-bootstrapped CID-embedded icon

`apps/api/src/app/domain/emails/services/share-link-icon-asset.service.ts` owns the system asset that backs the card's `<img cid:...>`. On the first share-link send in a fresh environment it fetches the PNG from a hard-coded source URL, uploads it to S3 at `emails/system-assets/share-link-icon.png`, and creates a `CONFIRMED` `StorageObject` row owned by the triggering user. Subsequent calls hit the in-memory cache or the DB lookup by `s3Key`. A P2002 unique-violation on concurrent first-time bootstrap is caught and the losing process re-fetches the winner's row.

The icon is appended to each share-link email as an extra `EmailAttachment` row with `isInline: true`, `isShareLink: false`, `contentId: 'share-link-icon@mediastar.local'` — the queue worker includes it in the SES envelope (it's not filtered) so the recipient's mail client resolves `cid:share-link-icon@mediastar.local` against the embedded MIME part. If the bootstrap fails (network down on first run), the card renders without an `<img>` element and the email still sends.

### FE/BE contract

**FE does no share-link work.** Submit a normal `bodyHtml` / `bodyText`; the backend:

1. Strips any `{{share:<N>}}` tokens from the body via `stripShareLinkPlaceholders` (defensive — FE cannot influence placement).
2. Runs the planner, mints tokens for share-link items (deduped by `s3Key`).
3. Flips `isShareLink: true` on the corresponding `EmailAttachment` rows.
4. Resolves the icon `StorageObject` via `ShareLinkIconAssetService` and appends an inline `EmailAttachment` row referencing it (so the worker emits a `Content-ID: <share-link-icon@mediastar.local>` MIME part).
5. Renders the card via `ShareLinkCardRenderer` and appends it to whichever body parts the sender supplied.
6. Persists tokens to `email_attachment_share_links` inside the same transaction as the email row.

There is no `POST /emails/plan-share-links` endpoint and no body/plan validation — the backend's word is final.

**Draft-send caveat**: `POST /emails/drafts/:id/send` does NOT yet run the share-link planner end-to-end. If a draft's attachments would classify as share-link (per-file > threshold or aggregate > 28 MB), `assertDraftDoesNotRequireShareLinks` throws a 400 directing the user to `POST /emails/send` instead. Drafts with sub-threshold attachments work normally. Full draft-share-link support is tracked as a follow-up ticket.

### Lifecycle (7-day expiry + revoke)

New links are persisted with `expiresAt = createdAt + EMAIL_SHARE_LINK_TTL_DAYS` (default 7 days; constant in `constants/email-size.ts`). The stamp happens at token-mint time via `EmailAttachmentShareLinkService.computeExpiresAt(new Date())`; the row's `createdAt` is server-stamped at insert with `@default(now())`, so the two are within milliseconds of each other. After the window passes, the resolver returns `null` and the public endpoint 404s.

Revocation is the other access-removal mechanism and is **independent of any parent entity.** `POST /emails/:id/share-links/:linkId/revoke` flips `revoked_at` on the share-link row only; it is NOT coupled to case archival, agency-request closure, or any folder transition. Once revoked, `resolveToDownloadUrl` returns `null` and the public endpoint 404s regardless of remaining TTL. Audited via `AuditAction.EmailShareLinkRevoked`.

Sender-controlled TTLs ship in a follow-up ticket; the resolver and cleanup cron already handle non-default `expiresAt` correctly.

### Operational behavior (queue worker + cleanup cron)

- **Queue worker excludes share-link attachments from the SES envelope** (`isShareLink: false` filter on `loadEmailForSend`). The S3 object lives on; only the MIME part is dropped. The inline icon row (`isInline: true, isShareLink: false`) stays in the envelope so the card's `cid:` reference resolves.
- **Cleanup cron only purges rows with `expiresAt < now() - EMAIL_SHARE_LINK_CLEANUP_GRACE_DAYS`** (7-day grace after expiry). With the default 7-day TTL, a typical share-link row is hard-deleted ~14 days after creation. Cascade delete still removes share-link rows when the parent email is hard-deleted by the trash-purge cron.
- **The icon's `StorageObject` is preserved** by the soft-delete reference guard on `StorageObjectService.softDeleteByIds`: the row stays alive as long as any `EmailAttachment` references it (every share-link email references it), so the system asset accumulates persistence without growing per-send storage.

### IMAP-origin forwarded attachments

Inbound IMAP attachments are persisted without a backing `StorageObject` (`storageObjectId: null` on `EmailAttachment`). When a user forwards such a thread, `EmailsService.mintStorageObjectsForOrphanCopies` mints a CONFIRMED `StorageObject` row per non-inline copy — pointed at the destination s3Key the forward will write to, owned by the forwarding user. The `EmailAttachment` rows on the new email then carry the freshly-minted `storageObjectId`, so the planner can classify them identically to the user-uploaded path and the card renderer can build their share-link URLs. Cleanup is wired: if the S3 copy fails OR the email DB write fails after minting, `bestEffortDeleteMintedStorageObjects` soft-deletes the rows so they don't linger as orphans. Inline IMAP copies are skipped (they're never share-linked; cid: refs in the quoted HTML carry them).

### File layout

```
apps/api/src/app/domain/emails/
├── constants/share-link-card.template.ts                ← visual style tokens for the card
├── services/share-link-planner.service.ts               ← classifier + classification enums + plan types
├── services/share-link-card-renderer.service.ts         ← HTML + text card builder
├── services/share-link-icon-asset.service.ts            ← lazy icon bootstrap + SHARE_LINK_CARD_ICON_CID
├── services/email-attachment-share-link.service.ts      ← token mint / persist / resolve / revoke
└── utils/share-link-body.util.ts                        ← stripShareLinkPlaceholders + buildShareLinkUrl
```
