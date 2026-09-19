# Worklane 🚀

An Azure Boards-inspired enterprise project management platform built as a high-performance monorepo. Worklane enables software teams to manage work items, backlogs, sprints/iterations, custom Kanban boards, cross-project queries, and real-time team notifications with granular role-based access control.

---

## 🏗️ Architecture Overview

Worklane is designed with a decoupled monorepo architecture powered by **pnpm** and **Turborepo**.

```
                           +------------------------+
                           |  Next.js 16 Web Client |
                           |  React 19 + dnd-kit    |
                           +-----------+------------+
                                       |
                                HTTP / WebSocket
                                       |
                           +-----------v------------+
                           |   NestJS 12 API Engine |
                           | Guard/Authz/Zod/Socket |
                           +-----------+------------+
                                       |
                                 Kysely Query
                                 Builder
                                       |
                           +-----------v------------+
                           |  PostgreSQL 15 Database|
                           +------------------------+
```

- **`apps/web`**: Next.js 16 App Router frontend with React 19, TanStack Query for server state management, `@dnd-kit` for drag-and-drop boards and backlogs, and Tailwind CSS 4.
- **`apps/api`**: NestJS 12 backend REST API and Socket.io WebSocket server, using **Kysely** query builder for type-safe database access with PostgreSQL.

---

## 🛠️ Tech Stack

| Category | Tooling & Frameworks |
| --- | --- |
| **Monorepo & Build System** | pnpm 12, Turborepo |
| **Backend API** | NestJS 12, Express, Socket.io, JWT, bcryptjs, Zod |
| **Database & ORM** | PostgreSQL 15, Kysely (Type-safe SQL query builder) |
| **Frontend UI** | Next.js 16 (App Router), React 19, Tailwind CSS 4, Lucide Icons |
| **State & Drag-and-Drop** | TanStack Query v5, `@dnd-kit` (Core, Sortable) |
| **Testing & Tooling** | Vitest, Playwright (E2E), Oxlint, ESLint |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **pnpm**: `v12.x` (or `corepack enable`)
- **Docker & Docker Compose**: (for local PostgreSQL database)

---

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/surajthaqurie/Worklane.git
   cd Worklane
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Environment Variables**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

4. **Start PostgreSQL Database**
   ```bash
   docker-compose up db -d
   ```

5. **Seed Initial Database Data**
   ```bash
   pnpm seed
   ```
   > Default admin credentials are set via `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `apps/api/.env`.

6. **Run Development Services**
   ```bash
   pnpm dev
   ```
   - **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:4000](http://localhost:4000)

---

## 🐳 Docker Deployment

To run both the PostgreSQL database and API server in containerized environments:

```bash
# Start Database & API server
docker-compose up -d

# Start full stack (Database + API + Web App)
docker-compose --profile full up -d
```

---

## 🧪 Testing & Verification

```bash
# Run unit & integration tests across packages (Vitest)
pnpm test

# Run type checks
pnpm typecheck

# Run linter
pnpm lint

# Run E2E tests (Playwright)
pnpm --filter web test:e2e
```

---

## 🔑 Key Features & Security

- **Fine-Grained Role-Based Access Control (RBAC)**: Centralized authorization service asserting project roles (`OWNER`, `ADMIN`, `MEMBER`) and permissions (`WORK_ITEM_CREATE`, `WORK_ITEM_EDIT`, `WORK_ITEM_DELETE`, etc.).
- **Refresh Token Rotation & Secure Logout**: Dual-token JWT auth with refresh token rotation and revocation.
- **Request Validation & Error Normalization**: Zod validation pipe and unified exception filter.
- **Secure File Attachments**: Validated file type MIME check, size limitation, and path traversal protection.
- **Rate Limiting**: Built-in throttler protecting sensitive authentication endpoints.

---

## 🖼️ Screenshots

| Kanban Board | Sprint Backlog |
| :---: | :---: |
| *(Board Interface)* | *(Iteration Backlog View)* |

---

## 📄 License

This project is licensed under the MIT License.
