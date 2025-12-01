# API Contracts – Next.js Route Handlers

All routes live under `src/app/api`. `withSession` middleware enforces NextAuth session plus admissions allowlist unless noted.

## /api/devices (GET)
- **Purpose:** Return paginated roster grid with TanStack Query metadata.
- **Query Params:** derived from `grid-query` helpers; include `page`, `pageSize`, `sort`, `search`, and filter arrays (`status`, `condition`, `offboardingStatus`).
- **Validation:** `filterSchema` (Zod) ensures arrays/strings stay bounded; invalid filters return `400 { error.code: "INVALID_FILTERS" }`.
- **Response:** `{ data: { devices: Device[] }, meta: { total, totalPages, page, pageSize }, error: null }`.
- **Telemetry:** `logFilterChipUpdate` + `recordFilterChipUpdatedEvent` produce logs + `SyncEvent` records; anonymization cookie toggles deterministic masking before returning rows.

## /api/metrics
- **GET (session required):** Aggregates `SyncEvent` documents (eventType = `SYNC_RUN`) to show per trigger stats (`runs`, `success`, `failure`, `duration`, `rowCount`). Optional `windowStart` query narrows range.
- **POST (no session; ingest webhook):** Accepts batches of metrics with schema `{ metrics: [{ metric, value, threshold?, context? }], requestId?, anonymized? }`. Valid payloads emit `logPerformanceMetric`, optionally call Slack/webhook, and create `AuditLog` entries. Invalid JSON or schema -> `400` with descriptive code.

## /api/sync
- **POST /api/sync/run:** Trigger ingest job. Requires either authenticated manager session or cron header `X-Appengine-Cron` plus `X-Internal-Service-Token` (see `cron.yaml`). Enqueues worker (`src/workers/sync/index.ts`), acquires `SyncLock`, streams progress via `SyncEvent`.
- **GET /api/sync/status:** Returns derived state from `SyncLock` + `SyncEvent` for SyncStatusBanner.

## /api/audit (GET)
- Lists latest `AuditLog` entries filtered by event type or timeframe. Used by governance panel for transparency.

## /api/config
- **GET:** Returns allowlist + sync settings (`Config` model) for admin UI.
- **POST:** Updates allowlist entries. Payload validated via `schemas/config.ts`; emits `AllowlistChange` entry with operator metadata, writes `AuditLog` event, and refreshes `SyncEvent` for metrics.

## /api/session (GET)
- Heartbeat used by TanStack Query to check session validity. Returns `200` with user identity or `401` if NextAuth session expired.

## Auth Helpers
- `withSession(requestHandler)` wraps Next.js handlers, injecting `request.session` and rejecting unauthorized roles with `403` (rendered by `app/access-denied`).
- Service-to-service interactions (cron, telemetry webhooks) rely on signed headers/secret tokens rather than NextAuth cookies.

## Error Handling Patterns
- All handlers return `{ data, error }` envelopes with `error.code` enumerations (e.g., `DEVICE_GRID_QUERY_FAILED`, `INVALID_METRIC_PAYLOAD`).
- Logger (`lib/logging.ts`) attaches `requestId` when provided; metrics endpoints also log anonymization flag to ensure GDPR compliance.

Use this contract summary when updating indexes, ingestion logic, or governance endpoints so you can trace how API changes ripple through SyncEvent telemetry and the UI grid.
