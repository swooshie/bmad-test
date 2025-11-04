# Architecture

## Executive Summary

This architecture turns the NYU admissions device roster into a responsive Next.js experience that reads from MongoDB yet stays synchronized with the source Google Sheet within 60 seconds. Cloud Scheduler and Cloud Tasks drive a resilient ingest loop, while React Query and a governance-focused UI give managers anonymization controls, audit cues, and sub-200 ms interactions. The solution keeps security and observability first-class via NextAuth allowlisting, Secret Manager, and structured logging that remains within the zero-cost GCP tier.

## Project Initialization

- Foundation: `npx create-next-app@latest nyu-device-roster --typescript --tailwind --eslint --app --src-dir`
- Provided defaults: App Router structure, SWC/TypeScript pipeline, TailwindCSS utility styling, ESLint + Playwright/Jest hooks.
- Immediate TODO: Translate this command into the first implementation story so engineering can scaffold the repo before wiring data sync.

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
| -------- | -------- | ------- | ------------- | --------- |
| Data Persistence | MongoDB Atlas with Mongoose ODM | MongoDB Node v6.10.0 / Mongoose v8.6.0 | Epics B, D | ODM brings schema validation, middleware for audit logging, Atlas-native integration |
| Authentication | NextAuth.js (App Router) with Google provider + Secret Manager allowlist | next-auth v5.0.0 | Epic A | Integrates seamlessly with Next.js, supports Google-only sign-in and allowlist gating while keeping secrets off the repo |
| Sync Orchestration | Cloud Scheduler → Cloud Tasks → Next.js API worker | @google-cloud/tasks v6.2.1 / googleapis v164.1.0 | Epics B, D | Provides retries, visibility, and unified deployment while meeting 60s refresh SLA |
| API & Deployment | Next.js App Router on Google App Engine (Node 18) | next v16.0.1 | Epics B, C, D | Keeps API + UI cohesive, leverages App Engine scaling, avoids cross-origin complexity |
| Observability | Pino structured logs → App Engine stdout + free Cloud Logging metrics | pino v10.1.0 | Epics C, D | No-cost pipeline using built-in GCP logging, supports governance audit trails |
| Background Scheduling | Shared Cloud Tasks queue for scheduled & manual jobs | @google-cloud/tasks v6.2.1 | Epics B, D | Single queue with priority weighting handles automatic cadence and manual retries without extra services |
| Front-end Data Access | TanStack React Query for grid + governance UI | @tanstack/react-query v5.90.6 | Epics B, C | Provides optimistic updates, caching, and stale-while-revalidate needed for 200 ms interactions |

## Decision Identification

- Total decisions identified: 8
- Covered by starter template: 4 (Next.js app router, TypeScript, TailwindCSS baseline, ESLint/test harness)
- Remaining collaborative decisions: 4 critical, 3 important, 1 nice-to-have

### Critical
1. Data persistence & schema strategy for MongoDB Atlas ingest (Epics B, D)
2. Authentication and allowlist enforcement using Google OAuth + Secret Manager (Epic A)
3. Sync orchestration pattern for Google Sheets → MongoDB (Epics B, D)
4. API and deployment topology across Next.js API routes and Google App Engine (Epics B, C, D)

### Important
1. Background scheduling & retry infrastructure (e.g., Cloud Tasks vs. Cron + worker) (Epics B, D)
2. Observability & audit logging stack (structured logs, dashboards) (Epics C, D)
3. Front-end data access strategy (React Query vs. SWR) to satisfy 200 ms UX target (Epics B, C)

### Nice-to-Have
1. Optional real-time hinting (optimistic refresh indicators vs. WebSocket/Server-Sent Events) for future growth (Epic C)

## Project Structure

```
nyu-device-roster/
├─ app/
│  ├─ (manager)/
│  │  ├─ devices/
│  │  │  ├─ actions.ts
│  │  │  ├─ components/
│  │  │  │  ├─ DeviceGrid.tsx
│  │  │  │  ├─ DeviceRow.tsx
│  │  │  │  └─ Filters.tsx
│  │  │  ├─ hooks/
│  │  │  │  └─ useDeviceGrid.ts
│  │  │  ├─ loaders/
│  │  │  │  └─ devicesLoader.ts
│  │  │  └─ page.tsx
│  │  ├─ governance/
│  │  │  ├─ AuditLogPanel.tsx
│  │  │  └─ page.tsx
│  │  ├─ layout.tsx
│  │  └─ loading.tsx
│  ├─ api/
│  │  ├─ auth/
│  │  │  └─ [...nextauth]/route.ts
│  │  ├─ sync/
│  │  │  ├─ run/route.ts
│  │  │  └─ manual/route.ts
│  │  ├─ config/route.ts
│  │  └─ devices/
│  │     ├─ route.ts
│  │     └─ anonymize/route.ts
│  └─ page.tsx
├─ lib/
│  ├─ api-envelope.ts
│  ├─ auth.ts
│  ├─ db.ts
│  ├─ google-sheets.ts
│  ├─ logging.ts
│  ├─ routes.ts
│  └─ time.ts
├─ models/
│  ├─ Config.ts
│  ├─ Device.ts
│  └─ SyncEvent.ts
├─ schemas/
│  ├─ config.ts
│  ├─ device.ts
│  └─ sync-event.ts
├─ workers/
│  └─ sync/
│     ├─ index.ts
│     └─ diff.ts
├─ scripts/
│  ├─ seed-allowlist.ts
│  └─ verify-sync.ts
├─ tests/
│  ├─ fixtures/
│  ├─ integration/
│  │  └─ sync.spec.ts
│  └─ helpers/
├─ docs/
│  └─ runbook/
│     └─ sync-operations.md
├─ config/
│  ├─ env.example
│  └─ logging.json
├─ public/
│  └─ favicon.ico
├─ app.yaml
├─ next.config.js
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Epic to Architecture Mapping

| Epic | Responsibilities | Primary Modules |
| ----- | ---------------- | ---------------- |
| Epic A – Secure Access & Configuration | Manager allowlist, OAuth gating, secret loading | `app/api/auth`, `lib/auth.ts`, `models/Config.ts`, `scripts/seed-allowlist.ts` |
| Epic B – Sync Automation & Data Integrity | Scheduled/manual ingest, normalization, error handling | `workers/sync`, `app/api/sync`, `lib/google-sheets.ts`, `models/Device.ts`, `schemas/device.ts` |
| Epic C – Manager Dashboard Experience | Responsive device grid, governance cues, anonymization UX | `app/(manager)/devices`, `app/(manager)/governance`, `lib/routes.ts`, `lib/time.ts`, `@tanstack/react-query` hooks |
| Epic D – Governance & Observability Guardrails | Audit logs, structured logging, telemetry, manual review | `lib/logging.ts`, `models/SyncEvent.ts`, `app/(manager)/governance`, `tests/integration`, `docs/runbook/sync-operations.md` |

## Technology Stack Details

### Core Technologies

- Next.js v16.0.1 (App Router, TypeScript, TailwindCSS scaffold).
- Node.js 18 runtime on Google App Engine standard environment.
- MongoDB Atlas accessed through Mongoose v8.6.0 / MongoDB driver v6.10.0.
- NextAuth.js v5 managing Google OAuth allowlist and sessions.
- Cloud Scheduler + Cloud Tasks executing sync pipeline with `@google-cloud/tasks` v6.2.1.
- TanStack React Query v5.90.6 powering device grid data and optimistic flows.
- Pino v10 structured logging surfaced in Cloud Logging within free quotas.
- Jest/Vitest + Playwright stack for automated testing.

### Integration Points

- Google Sheets → Sync Worker: `lib/google-sheets.ts` uses Secret Manager credentials to fetch sheet data.
- Cloud Scheduler/Tasks → API: Scheduler enqueues Cloud Task to `/api/sync/run`; manual refresh uses `/api/sync/manual` with signed header.
- API → MongoDB Atlas: `lib/db.ts` exports pooled connection reused by API routes and workers via Mongoose models.
- UI → API: React Query hooks (`hooks/useDeviceGrid.ts`) hit `/api/devices` and `/api/devices/anonymize` with optimistic updates + revalidation.
- Logging → Monitoring: `lib/logging.ts` configures Pino; App Engine ingests stdout into Cloud Logging dashboards + alerts.

### Observability & Audit Trail

- Logging: Pino v10 structured JSON, output via `pino-http` middleware; App Engine captures stdout automatically.
- Metrics: Cloud Logging log-based metrics track sync success ratio, anonymization toggles, and unauthorized access attempts—staying within free quota.
- Dashboards: Cloud Monitoring workspace with charts for sync latency, manual refresh cadence, and audit failures.
- Alerts: Email notifications wired through free Cloud Monitoring policies (threshold-based on log metrics).
- Traceability: Each API request attaches `requestId` and manager identity, persisted in logs and `sync_events` for correlation.

## Novel Pattern Designs

- No novel architectural patterns required; standard BMAD patterns cover the demo scope.

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

- **API Response Envelope**
  - Convention: JSON `{ data, meta, error }`; success sets `error: null`, failures set `data: null` and include `{ code, message, details }`.
  - Example: `{ "data": { "devices": [...] }, "meta": { "count": 10 }, "error": null }`.
  - Enforcement: All API routes wrap responses through `withApiEnvelope(handler)`.

- **Route Naming**
  - Convention: RESTful plural nouns (`/api/devices`, `/api/config`) with kebab-case IDs (`/api/devices/{device-id}`).
  - Example: `/api/sync-events/{event-id}`.
  - Enforcement: Route definitions and client fetch utilities share constants in `lib/routes.ts`.

- **Database Naming**
  - Convention: Collections as snake_case singular (`config`, `sync_events`); document fields camelCase (`lastSeenAt`); foreign keys `<resource>Id`.
  - Example: `devices` document contains `assigneeId`, `hardwareStatus`.
  - Enforcement: Mongoose schemas and Zod validators codify naming.

- **Frontend Structure**
  - Convention: Components PascalCase (`DeviceGrid.tsx`), colocated tests `Component.test.tsx`, feature folders under `app/(manager)/{feature}`.
  - Example: `app/(manager)/devices/page.tsx` with `components/DeviceRow.tsx`.
  - Enforcement: ESLint custom rule warns on improper casing; barrel files in feature folder.

- **Error Handling**
  - Convention: Service layer throws `AppError` `{ kind, message, status, context }`; API handlers convert to envelope; UI displays toast + inline banner.
  - Example: `throw new AppError('SYNC_TIMEOUT', 'Sync exceeded SLA', 504, { taskId })`.
  - Enforcement: Shared `errors/` module consumed by API routes and client hooks.

- **Logging Format**
  - Convention: Pino base fields `{ level, time, requestId, userEmail }`; errors include stack trace and `appContext`.
  - Example: `logger.error({ requestId, userEmail, err }, 'Manual sync failed')`.
  - Enforcement: Middleware decorates Next.js handlers with logger instance.

- **Date/Time Handling**
  - Convention: Persist ISO 8601 UTC (`2025-11-04T20:15:00Z`); client renders via `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })`.
  - Example: `new Date().toISOString()` stored; UI shows `Nov 4, 2025 at 3:15 PM ET`.
  - Enforcement: Utility helpers in `lib/time.ts`.

- **Testing Layout**
  - Convention: Unit tests co-located (`*.test.ts`); integration tests in `tests/integration` (Playwright); fixtures in `tests/fixtures`.
  - Example: `components/DeviceGrid.test.tsx`; `tests/integration/sync.spec.ts`.
  - Enforcement: npm scripts `npm run test:unit`, `npm run test:e2e`.

## Consistency Rules

### Naming Conventions

- API routes remain plural kebab-case, path params lowercase (`/api/sync-events/{event-id}`).
- Mongo collections snake_case singular; fields camelCase; enums uppercase snake (`SYNC_FAILED`).
- React components PascalCase; hooks camelCase prefixed with `use`.

### Code Organization

- Feature-first folders under `app/(manager)` keep UI, hooks, loaders, and components together.
- Shared utilities live under `lib/`; data models under `models/` with schemas mirrored in `schemas/`.
- Workers isolate sync logic to `workers/sync` so background tasks avoid UI dependencies.

### Error Handling

- Central `errors/AppError` class with `kind`, `status`, `message`, `context`.
- API routes catch errors, log via Pino, and emit normalized envelope.
- Client displays toast via shared notifier plus inline banner when grids fail to refresh.

### Logging Strategy

- All logs emit JSON with `requestId`, `userEmail`, and `workflow` tags for correlation.
- Sync worker logs include counts (`added`, `updated`, `unchanged`) and latency metrics.
- Audit-critical events (allowlist rejection, anonymization toggle) log at `warn` level.

## Data Architecture

### Persistence Strategy

- **Primary store:** MongoDB Atlas (existing PRD constraint) accessed through Mongoose ODM v8.6.0 on MongoDB driver v6.10.0.
- **Rationale:** Schema enforcement, pre-save hooks for auditing, discriminators for anonymized projections, and proven compatibility with Google App Engine.
- **Collections:**
  - `config` — allowlist, sheet identifiers, sync cadence metadata.
  - `devices` — normalized device records with history subdocuments.
  - `sync_events` — append-only log of scheduled/manual sync attempts, outcomes, durations, and operator context.
- **Schema governance:** Zod validator mirrors Mongoose schema in shared `schema/` folder for Next.js edge validations.

### Sync Pipeline

- Triggers: Cloud Scheduler (every 2 minutes) enqueues Cloud Task hitting `/api/sync/run`.
- Worker: App Router route authenticates via service account header, pulls latest sheet via `googleapis`, diffs against `devices`, and persists delta with Mongoose transactions.
- Retry policy: Cloud Tasks exponential backoff (max 5 attempts, 2-minute DLQ to Pub/Sub for ops visibility).
- Manual refresh: `/api/sync/manual` secured route enqueues high-priority task.
- Audit: Each run writes `sync_events` entry with counts added/updated, duration, anonymization toggle state.
- Prioritization: Manual tasks carry `dispatchDeadline` 30s and `taskStatus=manual` attribute; scheduler jobs stay at default for fair processing.

## API Contracts

| Endpoint | Method | Purpose | Request Schema | Response |
| -------- | ------ | ------- | -------------- | -------- |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth OAuth callbacks & session management | Managed by NextAuth | Redirects/session cookies |
| `/api/devices` | GET | Fetch anonymized device grid for managers | Query: `search`, `sort`, `page`, `pageSize` | `{ data: { devices, meta }, error: null }` |
| `/api/devices` | PATCH | Apply anonymization toggle or inline updates | Body: `{ deviceId, changes }` validated via Zod | `{ data: { device }, error: null }` |
| `/api/devices/anonymize` | POST | Toggle anonymization state for sensitive columns | Body: `{ enabled: boolean }` | `{ data: { anonymizationState }, error: null }` |
| `/api/sync/run` | POST | Scheduler-triggered sync execution | Header: `X-Appengine-Cron` or signed service header | `{ data: { counts, duration }, error: null }` |
| `/api/sync/manual` | POST | Manager-triggered sync enqueue | Body: `{ reason }`; NextAuth session required | `{ data: { taskId }, error: null }` |
| `/api/config` | GET | Retrieve allowlist + sync settings for governance view | Authenticated managers only | `{ data: { allowlist, cadence }, error: null }` |

## Security Architecture

### Authentication & Allowlist

- Framework: NextAuth.js v5 handlers under `app/api/auth/[...nextauth]/route.ts`.
- Provider: Google OAuth restricted to `@nyu.edu` domain with `hd` hinting.
- Allowlist: `signIn` callback queries `config` collection, rejects non-listed principals, and logs reason into `sync_events`.
- Secrets: Google Secret Manager supplies `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and session signing key via server-only loader.
- Sessions: HTTP-only secure cookie (1h TTL with sliding refresh) backed by NextAuth JWT; middleware attaches manager identity to API handlers.
- Failure responses: 403 redirect to `/access-denied`; event emitter writes audit trail for governance review.

## Performance Considerations

- Sync SLA: Cloud Tasks triggers every 2 minutes with retries, keeping sheet→UI latency ≤ 60 seconds.
- Page load: Next.js static generation plus edge caching aim for <2 second first contentful paint on shared Wi-Fi.
- Interaction latency: React Query cached reads + optimistic writes target <200 ms anonymization toggles and filter updates.
- Scaling: App Engine min 1 / max 3 instances handle demo spikes; Mongo Atlas M0 tier monitored for connection caps.
- Monitoring: Log-based metrics raise alerts if sync duration exceeds 90 seconds or failure rate >2% over 30 minutes.

## Deployment Architecture

### Platform

- Runtime: Google App Engine standard environment, Node.js 18, single Next.js deployment artifact.
- Build: `next build` produces app bundle deployed via `gcloud app deploy`.
- Scaling: App Engine automatic scaling with min 1 instance, max 3 during demos to ensure snappy first byte; manual commands documented in operations runbook.
- Sync endpoints: `/api/sync/run` and `/api/sync/manual` served by App Router handlers with `runtime: nodejs18` configuration.
- Secret Manager integration: App Engine service account with `roles/secretmanager.secretAccessor`; secrets injected at runtime via environment variables.

## Development Environment

### Prerequisites

- Node.js 18.x (matches App Engine runtime).
- npm 10.x (bundled with Node) or pnpm 8 if team prefers.
- Google Cloud SDK (`gcloud`) authenticated to demo project.
- MongoDB Atlas project with connection string stored in Secret Manager.

### Setup Commands

```bash
npm install
npm run lint
npm run dev
```

Optional validation:

```bash
npm run test:unit
npm run test:e2e
```

## Architecture Decision Records (ADRs)

1. **ADR-001: MongoDB + Mongoose ODM** — chosen for schema enforcement and Atlas compatibility over Prisma or native driver.
2. **ADR-002: NextAuth Allowlist** — Google OAuth with Secret Manager-backed allowlist to satisfy governance without external IdP spend.
3. **ADR-003: Cloud Scheduler → Tasks Pipeline** — queue-based sync guarantees retries and observability versus naive cron.
4. **ADR-004: App Engine Monolith Deployment** — single Next.js artefact avoids cross-origin complexity while meeting demo scale.
5. **ADR-005: React Query Data Layer** — provides optimistic UX and caching necessary for 200 ms interactions.
6. **ADR-006: Pino + Cloud Logging** — free-tier observability with structured logs and log-based metrics.

---

Generated by BMAD Decision Architecture Workflow v1.0
Date: 2025-11-04
For: Aditya
