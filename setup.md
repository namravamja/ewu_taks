# Local Setup

Follow these steps from a fresh clone to get the API running locally.

---

## 1. Prerequisites

Install these tools before continuing:

| Tool    | Version    | Notes                                         |
| ------- | ---------- | --------------------------------------------- |
| Node.js | 24.x       | Use `nvm` or `fnm` to match the repo version  |
| pnpm    | 10.30.3    | Pinned via `packageManager` in `package.json` |
| Docker  | latest     | Required for Postgres + Redis                 |
| Git     | any recent | -                                             |

Verify:

```bash
node -v        # v24.x
pnpm -v        # 10.30.3
docker -v      # any
```

---

## 2. Install Dependencies

```bash
pnpm install
```

This also runs `prisma generate` automatically via the `postinstall` hook, producing the Prisma client under `libs/database/src/lib/generated/prisma`.

---

## 3. Configure Environment Variables

Copy the template and fill in the required secrets:

```bash
cp .env.example .env
```

Generate the required secrets (each must be ≥64 hex characters):

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "TWO_FACTOR_SECRET=$(openssl rand -hex 32)"
echo "SESSION_MGMT_SECRET=$(openssl rand -hex 32)"
echo "TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Paste each generated value into the matching key in `.env`.

The defaults in `.env.example` for `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, and `FRONTEND_URL` are pre-wired for the Docker setup in step 4 — no change needed for local dev.

---

## 4. Start Infrastructure (Postgres + Redis)

```bash
docker compose up -d
```

This starts:

- **Postgres** (`pgvector/pgvector:pg17`) on `localhost:5432` — user `postgres`, password `postgres`, db `ewu-media`.
- **Redis** (`redis:7-alpine`) on `localhost:6379`.

Optional admin UIs (run only when needed):

```bash
docker compose --profile tools up -d
```

This additionally starts:

- **Adminer** on http://localhost:8080 (Postgres GUI). System: PostgreSQL · Server: `postgres` · User/Pass: `postgres` · Database: `ewu-media`.
- **RedisInsight** on http://localhost:5540.

Verify Postgres is up:

```bash
docker compose ps
```

---

## 5. Apply Migrations and Seed the Database

Run both steps in order:

```bash
pnpm prisma:migrate:dev
pnpm db:seed
```

What each command does:

- **`pnpm prisma:migrate:dev`** — applies the `init` migration and runs the `fix-serial-to-identity` script. Creates all tables (users, roles, permissions, sessions, audit logs, notifications, etc.) on a fresh database.
- **`pnpm db:seed`** — populates baseline data:
  - All built-in **permissions** (≈69 entries)
  - The six built-in **roles** (`owner`, `admin`, `employee`, `contractor`, `attorney`, `user`) with their permission grants
  - The **bootstrap owner accounts** listed in `SEED_OWNER_EMAILS` (assigned the `owner` role)
  - The internal **system bot user** (`system@ewumedia.internal`)

The seed runner is idempotent — re-running it is safe and skips unchanged seeds.

### Seeded Login Credentials (Local Dev Only)

When `NODE_ENV !== 'production'`, the seeder assigns a default password to every bootstrap owner so you can log in immediately. The default emails come from the `SEED_OWNER_EMAILS` env var (defaults below match `.env.example`):

| Email            | Role  | Password      |
| ---------------- | ----- | ------------- |
| `abc@domain.com` | owner | `Owner@12345` |
| `xyz@domain.com` | owner | `Owner@12345` |
| `pqr@domain.com` | owner | `Owner@12345` |

> **Production note:** in production (`NODE_ENV=production`) the seeder writes `passwordHash: null` and these accounts must be activated via the invitation / password-reset flow. The dev default password is **never** applied in production.

To log in via the API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abc@domain.com","password":"Owner@12345"}'
```

If you need to change the seeded emails, edit `SEED_OWNER_EMAILS` in `.env` (comma-separated) and re-run `pnpm db:seed` — newly added emails get the dev password automatically.

---

## 6. Start the API

```bash
pnpm start:api
```

The API listens on http://localhost:3000.

- Health check: http://localhost:3000/api/health
- Swagger docs: http://localhost:3000/docs (non-production only)

---

## 7. Common Verification

Run lint, typecheck, and build to confirm the workspace is healthy:

```bash
pnpm exec nx run-many --target=lint --all
pnpm exec nx run-many --target=typecheck --all
pnpm exec nx run-many --target=build --all
```

All three should succeed with no errors.

---

## Daily Workflow

| Action                       | Command                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Start infra                  | `docker compose up -d`                                                       |
| Stop infra                   | `docker compose down`                                                        |
| Reset DB (destroys all data) | `pnpm exec prisma migrate reset --schema libs/database/prisma/schema.prisma` |
| Open Prisma Studio           | `pnpm prisma:studio`                                                         |
| Regenerate Prisma client     | `pnpm prisma:generate`                                                       |
| Create a new migration       | `pnpm prisma:migrate:dev`                                                    |
| Run seeders                  | `pnpm db:seed`                                                               |
| Clean build artifacts        | `pnpm clean`                                                                 |

---

## Troubleshooting

**`prisma migrate dev` hangs with "Timed out trying to acquire a postgres advisory lock"**
Another Prisma process holds the advisory lock. Kill leftover sessions:

```bash
docker exec ewu-media-backend-staging-postgres-1 psql -U postgres -d ewu-media -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='ewu-media' AND pid <> pg_backend_pid();"
```

**`operator class "gin_trgm_ops" does not exist`**
The `pg_trgm` extension is missing. The schema declares it in the `extensions` block — re-run `pnpm prisma:migrate:dev`, which will create it. If you're hitting this on a fresh DB, make sure the Postgres image is `pgvector/pgvector:pg17` (it ships with the contrib modules), not stock `postgres:alpine`.

**Port 5432 or 6379 already in use**
Stop the local service first (`brew services stop postgresql`, `brew services stop redis`) or change the host port in `docker-compose.yml`.

**`The table public._seed_registry does not exist`**
The Prisma client is stale. Run `pnpm prisma:generate` and rebuild the database lib:

```bash
pnpm prisma:generate
pnpm exec nx run @mediastar/database:build --skip-nx-cache
```

**Migrations fail with foreign-key errors after a destructive change**
Wipe and reapply from scratch:

```bash
pnpm exec prisma migrate reset --schema libs/database/prisma/schema.prisma --force
pnpm db:seed
```

---

## Reference

- Prisma schema: `libs/database/prisma/schema.prisma`
- Env validation rules: `libs/core/src/lib/config/validation.ts`
- Seed data: `libs/database/src/lib/seeders/`
- API source: `apps/api/src/`
