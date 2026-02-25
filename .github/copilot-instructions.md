# Project Guidelines

## Code Style

- **Biome** for formatting and linting — no Prettier. Run `pnpm check` (or `pnpm lint`/`pnpm format`).
- 2-space indent, single quotes, trailing commas, 100-char line width, LF line endings.
- TypeScript strict mode with `strictNullChecks: false` and `noImplicitAny: false`.
- Path alias: `@/*` → `./src/*`. Always use `@/` imports for src files.
- Named exports for components (`export function MyComponent`). Use `export default` only for Next.js pages/layouts.
- Use `'use client'` directive explicitly on client components.
- Use `import type { ... }` for type-only imports.

## Architecture

**Next.js 15 App Router** with React 19 and Turbopack.

- `src/app/` — Routes. `(main)/` is the authenticated shell, `(collect)/` handles data collection, `api/` has REST endpoints.
- `src/lib/` — Core utilities: auth, request parsing, response helpers, DB abstraction, Zod schemas.
- `src/queries/prisma/` — Prisma CRUD operations (users, teams, websites, etc.).
- `src/queries/sql/` — Analytics queries with dual implementations: PostgreSQL (via Prisma raw SQL) and ClickHouse.
- `src/permissions/` — Authorization functions (`canViewWebsite`, `canUpdateTeam`, etc.). Admin bypasses all checks.
- `src/components/` — UI components using `@umami/react-zen` primitives. Organized: `charts/`, `metrics/`, `input/`, `common/`, `boards/`.
- `src/components/hooks/queries/` — TanStack React Query wrappers via `useApi()` hook.
- `src/store/` — Zustand 5 stores with Immer. Setter functions exported outside the store, not as actions.
- `src/tracker/` — Vanilla JS tracking script, built with Rollup to `public/script.js`.
- **Databases**: PostgreSQL (Prisma 6, primary) + ClickHouse (optional, for analytics scale). Query dispatch in `src/lib/db.ts`.

## Build and Test

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server on :3001 with Turbopack
pnpm build                # Full build (env check → Prisma → tracker → geo → Next.js)
pnpm build-app            # Next.js build only
pnpm build-tracker        # Rollup tracker script
pnpm test                 # Jest unit tests
pnpm lint                 # Biome lint
pnpm check                # Biome check + auto-fix
pnpm seed-data            # Seed database with test data
```

- **Jest**: Tests in `__tests__/` or `*.test.ts`/`*.spec.ts`. Config maps `@/` alias.
- **Cypress**: E2E tests in `cypress/e2e/`. Base URL `http://localhost:3000`, default creds `admin`/`umami`.
- **Docker**: `docker-compose.yml` runs app + PostgreSQL. Requires `DATABASE_URL` and `APP_SECRET` env vars.

## Project Conventions

### API Routes

All API routes follow this exact pattern (see `src/app/api/websites/[websiteId]/route.ts` for reference):

1. Define Zod schema inline for validation.
2. Call `parseRequest(request, schema)` — returns `{ auth, query, body, error }`.
3. Check permissions via `can*` functions from `@/permissions/`.
4. Call query functions from `@/queries/`.
5. Return responses via helpers: `json()`, `ok()`, `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`.
6. `params` is a `Promise` in Next.js 15 — always `await params`.

### Components

- Use `@umami/react-zen` layout primitives (`Grid`, `Row`, `Column`, `Text`, `Button`, `Icon`).
- Icons from `lucide-react`, mapped in `src/components/icons.ts`.
- Data fetching via query hooks in `src/components/hooks/queries/` (e.g., `useWebsiteStatsQuery`).
- Context hooks in `src/components/hooks/context/` (`useWebsite`, `useTeam`, etc.).
- File naming: PascalCase for components, camelCase with `use` prefix for hooks.

### i18n

- `react-intl` (FormatJS). Messages defined in `src/components/messages.ts` using `defineMessages()`.
- Translations in `src/lang/*.json`. Keys use dot notation: `label.save`, `message.confirm-delete`.
- Usage: `const { formatMessage, labels } = useMessages(); formatMessage(labels.save);`
- Compiled messages in `public/intl/messages/` — do not edit directly.

### State Management

- Zustand stores in `src/store/`. Pattern: `create(() => initialState)` with standalone setter functions.
- Use Immer `produce()` for nested state updates (see `src/store/websites.ts`).

## Integration Points

- **PostgreSQL**: Primary DB via Prisma 6 with `@prisma/adapter-pg`. Schema at `prisma/schema.prisma`. Migrations in `prisma/migrations/`.
- **ClickHouse**: Optional analytics DB, enabled by `CLICKHOUSE_URL` env var. Schema at `db/clickhouse/schema.sql`.
- **Redis**: Optional session/cache store via `@umami/redis-client`, enabled by `REDIS_URL`.
- **Tracker → API**: `public/script.js` sends events to `/api/send` (no auth, validated with Zod).
- **Kafka**: Optional event streaming integration when ClickHouse is enabled.

## Security

- JWT-based auth with Bearer tokens. Auth logic in `src/lib/auth.ts`.
- `parseRequest()` validates auth by default — pass `{ skipAuth: true }` only for public endpoints (e.g., `/api/send`).
- Permissions layer in `src/permissions/` is mandatory for all authenticated endpoints.
- CSP and CORS headers configured in `next.config.ts`.
- Passwords hashed with bcryptjs. Secrets via `APP_SECRET` env var.
