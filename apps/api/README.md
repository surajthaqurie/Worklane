# Worklane API ⚡

The NestJS 12 backend engine for Worklane.

## Features
- **Monorepo Architecture**: Module-based NestJS service using Kysely for type-safe PostgreSQL interactions.
- **Security & RBAC**: Centralized authorization guard, JWT refresh token rotation, rate limiting via `@nestjs/throttler`.
- **Real-Time Updates**: Socket.io integration for instant notification broadcasting.
- **Validation & Exception Handling**: Standardized Zod validation pipes and unified exception filters.

## Local Setup & Commands

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run database migrations / seed
pnpm seed

# Start API in development mode
pnpm --filter api dev

# Run Vitest unit & integration tests
pnpm --filter api test

# Build for production
pnpm --filter api build
```
