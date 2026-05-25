# EWU Media Backend

NestJS 11 monorepo for email media processing — 3 apps, 11 shared libs. Managed by Nx 22.5 with pnpm.

## Prerequisites

- **Node 24** (`.nvmrc` included — run `nvm use`)
- **pnpm**
- **PostgreSQL**
- **Redis** (for cache and queue)

## Getting Started

```sh
git clone <repo-url> && cd ewu-media-backend
nvm use
pnpm install
cp .env.example .env
# Fill in required values: DATABASE_URL, JWT_SECRET
pnpm start:api
```

The API will be available at `http://localhost:3000/api`.

## Project Structure

### Apps

| App                | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `api`              | HTTP server (port 3000, `/api` prefix, CORS enabled) |
| `email-sync`       | Background worker for email synchronization          |
| `email-classifier` | Background worker for AI email classification        |

### Libs

11 shared libraries in `libs/`, organized in dependency layers (L0–L4) enforced by ESLint module boundaries:

| Layer | Libraries                           |
| ----- | ----------------------------------- |
| L0    | `common`                            |
| L1    | `config`                            |
| L2    | `core`, `shared`                    |
| L3    | `database`, `queue`, `cache`, `aws` |
| L4    | `auth`, `ai`, `realtime`            |

All libraries use the `@mediastar/*` import prefix (e.g. `import { CommonModule } from '@mediastar/common'`).

## Scripts

| Script                        | Command                       |
| ----------------------------- | ----------------------------- |
| Start API                     | `pnpm start:api`              |
| Start email-sync worker       | `pnpm start:email-sync`       |
| Start email-classifier worker | `pnpm start:email-classifier` |
| Build all                     | `pnpm build:all`              |
| Test all                      | `pnpm test:all`               |
| Lint all                      | `pnpm lint:all`               |
| Format (write)                | `pnpm format`                 |
| Format (check)                | `pnpm format:check`           |
| Dependency graph              | `pnpm dep-graph`              |

## Architecture

- **api** — `NestFactory.create` with global `ValidationPipe` (whitelist + transform). Port from `PORT` env (default 3000), `/api` prefix, CORS enabled.
- **email-sync** — `NestFactory.createApplicationContext` (no HTTP). Runs email synchronization in the background.
- **email-classifier** — `NestFactory.createApplicationContext` (no HTTP). Runs AI-powered email classification in the background.

Shared libraries are layered so that lower layers never depend on higher ones. This is enforced at lint time via ESLint module boundary rules defined in `eslint.config.mjs`.

## Docker Services

The project includes a `docker-compose.yml` with **PostgreSQL**, **Redis**, and **Adminer** (optional).

```sh
# PostgreSQL + Redis
docker compose up -d

# + Adminer (web DB UI on http://localhost:8080)
docker compose --profile tools up -d

# Stop all services
docker compose --profile tools down
```

| Service  | Host        | Port   | Credentials             |
| -------- | ----------- | ------ | ----------------------- |
| Postgres | `localhost` | `5432` | `postgres` / `postgres` |
| Redis    | `localhost` | `6379` | _(no auth)_             |
| Adminer  | `localhost` | `8080` | _(connect via web UI)_  |

Set in your `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ewu-media
REDIS_HOST=localhost
```

## Environment Variables

See `.env.example` for all available variables. Configuration is Joi-validated at startup.

## Local Multi-Environment Setup

Switch between local dev, staging, and prod-like backends without changing any files — just pass `--env`.

### Env Files

| File              | Environment         | Gitignored |
| ----------------- | ------------------- | ---------- |
| `.env`            | Local dev (default) | Yes        |
| `.env.staging`    | Staging backend     | Yes        |
| `.env.production` | Prod-like local     | Yes        |

Copy the matching example file to get started:

```sh
# Staging
cp .env.staging.example .env.staging
# Fill in staging secrets, then run:
pnpm start:api --env=stag
```

### Usage

```sh
# Local dev (reads .env)
pnpm start:api

# Staging backend (reads .env.staging)
pnpm start:api --env=stag
pnpm start:api --env=staging       # same

# Prod-like (reads .env.production)
pnpm start:api --env=prod
pnpm start:api --env=production    # same

# Workers support the same flag
pnpm start:email-sync --env=stag
pnpm start:email-classifier --env=prod
```

### How It Works

`scripts/serve.mjs` parses `--env`, resolves short aliases (`stag` → `staging`, `prod` → `production`), sets `ENV_FILE=.env.<env>`, and spawns `nx serve`. NestJS `ConfigModule` reads `ENV_FILE` to load the correct dotenv file. Missing file → Zod validation reports which required vars are absent.
