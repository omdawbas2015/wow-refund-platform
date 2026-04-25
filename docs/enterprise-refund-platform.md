# Enterprise Refund Management Platform

This document defines the target production architecture for the refund platform. The current app is a Vite + React + Express + Prisma implementation; the target architecture can be reached incrementally without throwing away working business logic.

## Product Thesis

Build an operations-first refund platform with the clarity of Google Admin, the transaction confidence of Stripe Dashboard, and the calm system design of Notion. The core model is simple: one refund request can have many refund components, and each component moves through its own lifecycle.

## Target Architecture

```text
apps/
  web/                         React or Next.js app
  api/                         Node API, NestJS-ready
packages/
  database/                    Prisma schema, SQL migrations, seeds
  design-system/               Tokens, shared UI primitives
  shared/                      Types, validation schemas, status rules
  automation/                  Power Automate contracts and webhook payloads
```

## Backend Layers

```text
Controller
  Validates transport concerns, auth, pagination, query params.

Service
  Owns business rules: component splitting, status rollups, SLA checks, automation triggers.

Repository
  Owns SQL/Prisma access, transactions, indexes, and persistence.

Events/Jobs
  Sends emails, queues retries, parses inbound messages, raises escalations.
```

## Core Domain Rules

- Every refund request must contain at least one refund component.
- Internal components: `CARD`, `APPLE_PAY`, `CREDIT_CARD`.
- External components: `KNET`, `AURA`.
- Component completion drives parent status:
  - all components refunded: `REFUNDED`
  - mixed refunded and pending: `PARTIALLY_REFUNDED`
  - none refunded: `PENDING` or `APPROVED`
- Manual overrides must create audit logs.
- Power Automate callbacks must be authenticated with `x-internal-secret`.

## Status Model

### Refund Request

- `PENDING`
- `APPROVED`
- `PARTIALLY_REFUNDED`
- `REFUNDED`

### Refund Component

- `PENDING`
- `REFUNDED`
- `KNET_PENDING`
- `KNET_REFUNDED`
- `AURA_PENDING`
- `AURA_REFUNDED`

## API Structure

```text
POST   /api/auth/login
GET    /api/me

GET    /api/refund-requests
POST   /api/refund-requests
GET    /api/refund-requests/:id
PATCH  /api/refund-requests/:id
POST   /api/refund-requests/:id/submit-approval

GET    /api/refund-components
PATCH  /api/refund-components/:id/status
POST   /api/refund-components/bulk-mark-refunded
POST   /api/refund-components/bulk-send-email

GET    /api/admin/workflows
POST   /api/admin/workflows
PATCH  /api/admin/workflows/:id

GET    /api/admin/templates
POST   /api/admin/templates
PATCH  /api/admin/templates/:id

GET    /api/admin/recipient-groups
POST   /api/admin/recipient-groups

GET    /api/admin/external-teams
POST   /api/admin/external-teams
PATCH  /api/admin/external-teams/:id

GET    /api/admin/automation-rules
POST   /api/admin/automation-rules
PATCH  /api/admin/automation-rules/:id

GET    /api/audit-logs
GET    /api/email-logs

POST   /api/internal/power-automate/refund-batch
POST   /api/internal/power-automate/external-approval
POST   /api/internal/power-automate/email-response
```

## Frontend Experience

### Dashboard

- KPI strip: pending, approved, partially refunded, refunded, delayed.
- Activity feed from audit logs.
- Alerts from SLA and failed automation.
- Low inventory and external team warnings.

### Order Details

- Header: customer, amount, status, country, order number.
- Payment breakdown card: one row per component.
- Timeline: approval, email, external callbacks, manual edits, refund completion.
- Manual override panel visible only to permitted roles.

### Refund Execution

- Smart table built from refund components.
- Filters: status, payment type, internal/external, country, SLA.
- Grouping: internal pending, external pending, delayed, ready to close.
- Bulk actions: send email, mark refunded, escalate, export.

### Enterprise Control

- Modular settings pages:
  - Workflows
  - Email templates
  - Recipients and groups
  - External teams
  - Automation rules
  - Logs and monitoring

## Power Automate Flow Logic

### Approval Batch Flow

1. Scheduled trigger runs daily.
2. Calls `/api/internal/power-automate/refund-batch` with `x-internal-secret`.
3. Receives grouped pending requests by country/manager.
4. Sends approval email using configured template.
5. Posts manager decision to `/api/internal/power-automate/external-approval`.
6. API updates batch, request, components, audit logs, and notifications.

### External Refund Flow

1. Status change to `KNET_PENDING` or `AURA_PENDING`.
2. Automation rule picks template and recipient group.
3. Email is sent and logged.
4. Retry job checks unresolved items after SLA threshold.
5. Escalation email goes to external team manager.
6. Response parsing updates component reference/ARN/status when confirmed.

### Email Parsing Flow

1. Shared mailbox receives external response.
2. Power Automate extracts case number, order number, ARN/reference, status.
3. Calls `/api/internal/power-automate/email-response`.
4. API validates confidence and either updates component or creates review task.

## Deployment Readiness

- PostgreSQL for production.
- SQL migrations committed.
- JWT secret and internal webhook secret required in production.
- Pagination on all list endpoints.
- Queue background work for emails, retries, and parsing.
- WebSocket or SSE for live notifications.
- Audit log every state-changing action.

## Incremental Migration Plan

1. Stabilize current Vite/Express app: production build, typecheck, auth hardening.
2. Move API calls into a shared client and status rules into shared modules.
3. Normalize database toward the SQL schema in `docs/enterprise-schema.sql`.
4. Split `server.ts` into route modules, then service/repository modules.
5. Introduce PostgreSQL migrations and deployment environment.
6. Add real-time notifications and async job processing.
7. Optionally migrate frontend to Next.js and backend to NestJS once the domain is stable.
