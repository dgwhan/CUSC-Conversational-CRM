# CUSC Recruitment CRM

An enterprise-grade Recruitment and Customer Relationship Management system built with NestJS, Fastify, React, TypeScript, and PostgreSQL within a pnpm monorepo architecture.

---

## Table of Contents

- [System Overview](#system-overview)
- [Architecture and Tech Stack](#architecture-and-tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Testing Suite](#testing-suite)
- [Database Management and Persistence](#database-management-and-persistence)
- [Operational Runbook and Troubleshooting](#operational-runbook-and-troubleshooting)

---

## System Overview

CUSC Recruitment CRM is designed to streamline candidate intake, multi-channel communication (e.g., messaging integrations), customer records management, and recruitment workflows.

The system is organized into a decoupled monorepo containing:
- **Backend Service (`apps/api`)**: High-throughput NestJS API using the Fastify adapter, structured with clean architecture principles and runtime configuration validation via Zod.
- **Frontend Application (`apps/web`)**: Single-page application using React 19, TypeScript, and Vite.
- **Database Engine**: PostgreSQL 16 containerized with persistent Docker volume storage and integrated readiness healthchecks.

---

## Architecture and Tech Stack

| Layer | Technologies | Specifications |
| :--- | :--- | :--- |
| **Monorepo Management** | pnpm workspaces | Package filtering, shared dependency deduplication |
| **API Server** | NestJS v12, Fastify, TypeScript | Global `/api` prefix, graceful shutdown hooks, Fastify HTTP adapter |
| **Configuration Validation** | `@nestjs/config`, Zod v4 | Strict fail-fast schema validation at startup |
| **Database** | PostgreSQL 16 Alpine | Managed via Docker Compose, isolated network, named volume |
| **Frontend** | React 19, Vite 8, TypeScript | Modular component architecture, Fast HMR |
| **Testing** | Vitest, Supertest | Unit testing, validation test suites, and end-to-end testing |
| **Containerization** | Docker, Docker Compose | Multi-stage Dockerfile utilizing `pnpm deploy`, non-root user security |

---

## Repository Structure

```text
crm-system/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema/                  # base.prisma, messaging.prisma, leads.prisma ...
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/                        # integration tests
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── platform/                # config, database, queue, scheduler, logger
│   │       ├── common/                  # guards chung, filters, interceptors, decorators
│   │       └── modules/
│   │           ├── messaging/           # đủ 4 lớp
│   │           │   ├── domain/          # Message, port ChannelAdapter
│   │           │   ├── application/     # use case ReceiveInboundMessage
│   │           │   ├── infrastructure/  # adapters (facebook, zalo, manual-import), repo
│   │           │   ├── presentation/    # webhook controller + signature guard
│   │           │   ├── index.ts         # API công khai
│   │           │   └── messaging.module.ts
│   │           ├── classification/      # đủ 4 lớp, domain/ thuần (hàm chấm điểm)
│   │           ├── leads/               # đủ 4 lớp (trạng thái, SLA, phân công)
│   │           ├── customers/           # đơn giản
│   │           ├── identity/            # đơn giản (hoặc gộp vào customers)
│   │           ├── cases/               # giai đoạn 2
│   │           ├── iam/                 # staff, role, đăng nhập
│   │           ├── notifications/       # Telegram, email
│   │           └── reporting/           # chỉ đọc
│   └── web/
│       └── src/
│           ├── app/                     # providers, router
│           ├── components/ui/           # thành phần giao diện dùng chung
│           ├── lib/                     # api client, query client
│           └── modules/
│               ├── inbox/  customers/  leads/  cases/  dashboard/  auth/  settings/
│               #  mỗi module: api/ components/ hooks/ types/
├── packages/
│   └── contracts/                       # Zod schemas, DTO, enum dùng chung
├── tests/
│   ├── architecture/                    # dependency-cruiser
│   └── e2e/
├── docs/adr/
├── package.json  pnpm-workspace.yaml  tsconfig.base.json
├── docker-compose.yml  .env.example  .nvmrc
```

---

## Prerequisites

Ensure the target host environment meets the following minimum requirements:

- **Node.js**: Version 20.18.0 LTS or later (tested on Node.js 22 and 24)
- **pnpm**: Version 9.0 or later (installed globally via `npm install -g pnpm` or accessed via `npx pnpm`)
- **Docker Engine**: Version 24.0 or later
- **Docker Compose**: Compose V2 (`docker compose`)

---

## Quick Start with Docker

The fastest and most reliable way to instantiate the entire backend environment on a clean machine is via Docker Compose.

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd CUSC-Recruitment-CRM
```

### Step 2: Initialize Environment Variables

Create the local `.env` configuration file from the provided template:

```bash
# On Linux, macOS, or Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

### Step 3: Launch Containers

Execute the compose orchestrator in detached mode:

```bash
docker compose up --build -d
```

Compose executes the following sequence:
1. Provisions the PostgreSQL container (`crm_postgres`) and mounts the `crm_postgres_data` volume.
2. Runs periodic `pg_isready` health checks until PostgreSQL is fully initialized.
3. Builds the production API image using multi-stage compilation and starts `crm_api` once the database dependency is healthy.

### Step 4: Verify Deployment

Check service health status:

```bash
docker compose ps
```

Send a GET request to the health check endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected HTTP 200 response:

```json
{"status":"ok"}
```

---

## Local Development Setup

To run services natively on the host machine during feature development:

### 1. Install Dependencies

Install workspace dependencies from the repository root:

```bash
pnpm install
```

### 2. Start PostgreSQL Container

Run only the database container in the background:

```bash
docker compose up postgres -d
```

### 3. Configure Local Environment File

Verify that the `.env` file at the repository root contains valid local connection parameters:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recruitment_crm?schema=public
```

### 4. Run the API Service

Start the backend in watch mode (hot reload enabled):

```bash
pnpm --filter api start:dev
```

The API service initializes at `http://localhost:3000/api`.

### 5. Run the Web Frontend

Start the Vite development server in a separate terminal:

```bash
pnpm --filter web dev
```

The frontend application will be accessible at `http://localhost:5173`.

---

## Environment Configuration

The application implements a strict fail-fast validation mechanism. During startup, `@nestjs/config` executes Zod schema validation defined in `apps/api/src/platform/config/env.schema.ts`.

If any mandatory variable is missing or formatted incorrectly, process execution halts immediately with a diagnostic report.

### Variable Specification

| Variable | Type | Requirement | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | Optional | `development` | Target execution environment (`development`, `production`, `test`) |
| `PORT` | Number | Optional | `3000` | Port on which the HTTP server listens |
| `DATABASE_URL` | String | **Required** | None | Full PostgreSQL connection string (must not be empty) |
| `POSTGRES_USER` | String | Optional | `postgres` | Database superuser account |
| `POSTGRES_PASSWORD` | String | Optional | `postgres` | Database superuser password |
| `POSTGRES_DB` | String | Optional | `recruitment_crm` | Application database name |
| `POSTGRES_PORT` | Number | Optional | `5432` | Exposed host port for the database container |
| `POSTGRES_HOST` | String | Optional | `postgres` | Database network address (`postgres` inside Docker, `localhost` on host) |

### Missing Variable Error Output

If `DATABASE_URL` is omitted, the application logs the following diagnostic and terminates:

```text
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] ERROR [ExceptionHandler] Error: 
============================================================
ENVIRONMENT CONFIGURATION ERROR:
  - [DATABASE_URL]: DATABASE_URL is required
============================================================
```

---

## Testing Suite

All tests are implemented using Vitest.

### Execute Unit Tests

Run unit tests across the API application (including schema validation tests):

```bash
pnpm --filter api test
```

### Execute End-to-End Tests

Run end-to-end integration tests:

```bash
pnpm --filter api test:e2e
```

### Type Checking and Linting

Run static type inspection without emitting artifacts:

```bash
pnpm --filter api typecheck
```

Run linter checks:

```bash
pnpm --filter api lint
```

---

## Database Management and Persistence

### Connection Parameters

Direct database access (via DBeaver, pgAdmin, or CLI):
- **Host**: `localhost`
- **Port**: `5432`
- **Username**: `postgres`
- **Password**: `postgres`
- **Database**: `recruitment_crm`

### Data Persistence

PostgreSQL data is persisted in a named Docker volume (`crm_postgres_data`). Data remains intact across:
- Container stop and start operations (`docker compose stop`, `docker compose start`)
- Container removal (`docker compose down`)

### Complete Data Reset

To permanently wipe all PostgreSQL data and recreate a blank database:

```bash
docker compose down -v
docker compose up -d
```

### How to work with Prisma

Reset database và nạp lại dữ liệu mẫu (Seed)
```bash
pnpm db:reset
```

Khởi tạo Prisma Client (TypeScript Types)
```bash
pnpm --filter api prisma:generate
```

Tạo Migrations (Khi thay đổi schema)
```bash
pnpm --filter api prisma:migrate
```

Mở giao diện quản trị dữ liệu trực quan (Prisma Studio)
```bash
pnpm --filter api prisma:studio
```
Đảm bảo postgre đã bật

Chạy SQL bằng Prisma Client
```typescript
// apps/api/src/app.service.ts
import { PrismaClient } from '@prisma/client';

// Tạo 1 PrismaClient local dùng trực tiếp cho các file .ts thuần
const prisma = new PrismaClient();

// Hoặc có thể dùng trong Module bằng @InjectModel
@Injectable()
export class MyService {
  constructor(private readonly prisma: PrismaClient) {}
  // ... dùng this.prisma ...
}
```

Chạy Migration trong Docker
```bash
# Chỉ chạy migrate mà không cần vào shell
docker compose run --rm api pnpm --filter api prisma:migrate

# Vào shell container để debug
docker compose exec api sh
# داخل container:
prisma migrate dev
# Exit container
exit
```

Khi nào cần Prisma generate? Khi bạn thay đổi file schema.prisma. Sau khi chạy lệnh này, Prisma sẽ tự động tạo ra thư mục src/generated/prisma (hoặc node_modules/.prisma) chứa các file TypeScript interface và client tương ứng với database.

---

## Operational Runbook and Troubleshooting

### 1. Windows Execution Policy Restrictions

**Symptom**: `File ...\npm.ps1 cannot be loaded because running scripts is disabled on this system.`

**Remedy**: Open PowerShell with administrative privileges and permit signed script execution for the current user:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Alternatively, invoke commands via the command-prompt shim:

```powershell
npm.cmd run dev
npx.cmd pnpm --filter api start:dev
```

### 2. Port Binding Conflicts

**Symptom**: `listen EADDRINUSE: address already in use 0.0.0.0:3000` or `bind: address already in use 0.0.0.0:5432`

**Remedy**: Another process on the host machine is occupying port 3000 or 5432. Update the host port mappings in `.env`:

```env
PORT=3001
POSTGRES_PORT=5433
```

Then restart the services:

```bash
docker compose up -d
```

### 3. Inspecting Real-Time Service Logs

To monitor log streams from running containers:

```bash
# Monitor API logs
docker compose logs -f api

# Monitor PostgreSQL logs
docker compose logs -f postgres
```

### 4. Forcing Clean Image Rebuilds

To force Docker to ignore cache layers after dependency changes:

```bash
docker compose build --no-cache api
docker compose up -d
```
