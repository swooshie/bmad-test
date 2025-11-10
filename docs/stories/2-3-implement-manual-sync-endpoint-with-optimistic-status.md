# Story 2.3: Implement manual sync endpoint with optimistic status

Status: drafted

## Story

As an NYU admissions manager, I want a “Refresh Now” endpoint that immediately kicks off the Google Sheets → MongoDB ingest pipeline and broadcasts optimistic status updates so I can confidently narrate live data freshness during demos without waiting for the scheduled job.

### Requirements & Context Summary

- Epic B3 defines POST `/api/sync` as the manager-triggered hook that runs the same fetch → transform → upsert pipeline as scheduled syncs, returns counts/duration, sets an optimistic “running” flag, and logs the attempt with actor metadata. (docs/epics.md:120-140)
- PRD FR-005 demands a manual refresh that completes within ~5 seconds, updates the status banner immediately, and records an audit entry so stakeholders can trust the demo timeline; FR-012 adds the requirement to surface actionable error codes when runs fail. (docs/PRD.md:150-190)
- Architecture routes manual refresh through `app/api/sync/manual/route.ts`, authenticates via the manager’s session, enqueues a high-priority Cloud Task, and requires structured logging plus `sync_events` persistence for every run. (docs/architecture.md:146-264)
- Previous Story 2.2 delivered the normalized transformer/upsert module and index guarantees—this endpoint must reuse that pipeline (not duplicate logic) and surface its row counts, anomalies, and latency via `lib/logging.ts`. (docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md#Story)

## Acceptance Criteria

1. Authenticated managers can call POST `/api/sync/manual`, which validates session/allowlist via NextAuth middleware and immediately enqueues or invokes the shared sync worker so the response returns `{taskId or summary, rowsProcessed, durationMs, status}`. [Source: docs/epics.md:133, docs/architecture.md:146-254]
2. Endpoint sets an optimistic status entry (e.g., in-memory cache, Redis stub, or React Query state) that flips the UI banner/button to “Running” within 1 second, then resolves to success/error based on worker output. [Source: docs/epics.md:133, docs/PRD.md:150-190]
3. Every manual run writes a `sync_events` document capturing actor email, anonymization state, duration, row delta counts, and any structured error code so governance dashboards stay compliant. [Source: docs/epics.md:133, docs/architecture.md:227-254]
4. Manual runs reuse Story 2.1/2.2 modules (`lib/google-sheets.ts`, `workers/sync/transform.ts`) without duplicating fetch/transform logic, and they inherit the same structured logging + AppError handling so FR-012 error messaging remains consistent. [Source: docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md#Implementation-Alignment, docs/architecture.md:227-254]
5. Endpoint enforces SLA guardrails: request returns within 5 seconds (fire-and-forget task acknowledgment), worker completion under 60 seconds, and client receives actionable error codes (`SHEET_NOT_FOUND`, `SYNC_TIMEOUT`, etc.) mapped from the pipeline. [Source: docs/PRD.md:169, docs/architecture.md:247-254]
6. Automated tests cover authenticated/unauthenticated access, optimistic status transitions, audit log creation, and error propagation so regressions are caught before sprint demos. [Source: docs/PRD.md:150-190, docs/architecture.md:101-105]

## Tasks / Subtasks

- [ ] Implement `app/api/sync/manual/route.ts` handler that verifies NextAuth session, enforces allowlist claims, and enqueues the Cloud Task (or invokes worker) with request metadata and anonymization flag. (AC: 1,5)
  - [ ] Return immediate JSON envelope containing task identifier plus optimistic status token to satisfy the 5-second PRD SLA. (AC: 1,5)
- [ ] Build/extend shared status broadcaster (e.g., `lib/sync-status.ts` + React Query mutation) so UI consumers flip to “running” and later reconcile with worker completion. (AC: 2)
  - [ ] Expose hook/event emitter so status banner and governance panel stay in sync without page reloads. (AC: 2)
- [ ] Ensure worker invocation reuses `lib/google-sheets.ts` + `workers/sync/transform.ts`, emits structured logs via `lib/logging.ts`, and propagates AppError codes back to the caller/an audit record. (AC: 4,5)
- [ ] Persist each manual run in `models/SyncEvent.ts` with actor email, anonymization state, counts, status, duration, and error code; update governance view if necessary. (AC: 3)
- [ ] Testing: add unit tests for the API route (auth + payload), integration test for optimistic state transitions and audit log creation, and contract test ensuring error codes mirror worker outcomes. (AC: 6)
- [ ] Documentation/runbook: describe manual refresh flow, optimistic status expectations, and troubleshooting steps for failed runs in `docs/runbook/sync-operations.md`. (AC: 2,3,5)

## Dev Notes

### Learnings from Previous Story

- **From Story 2-2 (Status: drafted)** – The normalized transformer and index enforcement live under `workers/sync/transform.ts`, `models/Device.ts`, and related helpers; manual sync must call into that module rather than adding bespoke persistence logic. Reuse the structured logging patterns (`requestId`, `sheetId`, `added/updated/unchanged`) and ensure audit outputs remain aligned. (docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md#Implementation-Alignment)
- Story 2-2 emphasized documenting normalization rules in the runbook—extend that same doc with manual refresh guidance so SM agents can cross-reference during demos. (docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md#Tasks-/-Subtasks)

### Implementation Alignment

- API route should live under `app/api/sync/manual/route.ts`, leverage `withApiEnvelope` + `AppError`, and delegate to `workers/sync` via Cloud Tasks to avoid blocking the request thread. (docs/architecture.md:146-264)
- Status propagation can reuse React Query’s optimistic update pattern plus a lightweight cache (in-memory map or Redis placeholder) so both the status banner and governance feed reflect the “running → success/error” lifecycle. (docs/architecture.md:146-211)
- Logging/audit: use `lib/logging.ts` to emit JSON with `requestId`, `userEmail`, `taskType=manual`, and reuse `models/SyncEvent.ts` for persistence so `/api/audit` can surface manual runs immediately. (docs/architecture.md:227-254)
- Error handling should bubble worker failures (Sheets errors, validation faults) into FR-012-friendly envelopes while retaining last-known-good data (handled downstream by Story B5). (docs/PRD.md:169, docs/architecture.md:227-254)

### Project Structure Notes

- Key files: `app/api/sync/manual/route.ts`, `workers/sync/index.ts`, `workers/sync/transform.ts`, `lib/google-sheets.ts`, `lib/logging.ts`, `models/SyncEvent.ts`, `docs/runbook/sync-operations.md`, `tests/integration/sync.spec.ts`. (docs/architecture.md:45-155,227-254)
- Consider extracting a reusable `triggerSync` helper that both `/api/sync/run` and `/api/sync/manual` call, ensuring configuration (sheetId, anonymization state) stays centralized. (docs/architecture.md:247-254)
- Ensure environment variables/Secret Manager handles (service tokens, queue names) remain documented in `nyu-device-roster/.env.example` if adjustments are required.

### Testing & Observability

- Unit tests for API handler: session required, unauthorized returns 401/403, authorized path enqueues job and returns expected envelope.
- Integration tests: simulate manual trigger, verify optimistic state flips, confirm `sync_events` entry contains actor email/anonymization flag and matches worker counts.
- Monitoring: add/extend log-based metric for `manual_sync_latency_ms` and `manual_sync_failure_rate` so governance dashboards highlight issues during demos. (docs/architecture.md:227-254)

### References

- [Source: docs/epics.md:120-140]
- [Source: docs/PRD.md:150-190]
- [Source: docs/architecture.md:146-264]
- [Source: docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md]

## Change Log

- _Pending initial implementation._

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
