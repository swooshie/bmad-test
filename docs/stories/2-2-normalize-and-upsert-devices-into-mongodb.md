# Story 2.2: Normalize and upsert devices into MongoDB

Status: review

## Story

As a data pipeline developer, I want to transform Google Sheets rows into normalized MongoDB documents with reliable upsert semantics so the manager dashboard always reads consistent device data without duplicate keys or stale timestamps.

### Requirements & Context Summary

- Epic B2 requires the transformer to map headers (`deviceId`, `assignedTo`, `status`, `condition`, `offboardingStatus`, `lastSeen`) to the canonical schema, enforce compound upserts on `deviceId + sheetId`, and ensure indexes exist on `deviceId`, `assignedTo`, and `lastSyncedAt`. (docs/epics.md:118-140)
- PRD FR-006 + API spec promise a normalized MongoDB surface powering `/api/devices` and `/api/sync`, emitting actionable error codes when ingest fails so demo operators can narrate outcomes. (docs/PRD.md:95-140,171-199)
- Architecture pins persistence to `models/Device.ts` + `schemas/device.ts`, uses `workers/sync` for orchestration, and mandates Pino-logged counts/latency so Cloud Tasks runs stay within the ≤60 s SLA. (docs/architecture.md:45-105,126-155,227-254)
- Governance docs stress retaining last-known-good data and logging anomalies, meaning transformer failures must short-circuit before clobbering `devices` and must emit audit-friendly metadata for `sync_events`. (docs/PRD.md:120-140, docs/architecture.md:227-243)

## Acceptance Criteria

1. Transformer converts every required sheet column into the canonical device schema (including deterministic casting for enums/dates and `lastSyncedAt` stamps) so downstream `/api/devices` consumers see consistent shapes. [Source: docs/epics.md:124, docs/PRD.md:95-140]
2. Upsert pipeline uses `(deviceId + sheetId)` compound key with change detection: unchanged rows leave `lastSyncedAt` untouched while changed rows update `lastSyncedAt` and emit `added/updated/unchanged` counts for logs. [Source: docs/epics.md:124, docs/architecture.md:233-254]
3. Indexes on `deviceId`, `assignedTo`, and `lastSyncedAt` exist (create if missing) with verification recorded in run output or migration script so grid filters and sort interactions remain <200 ms. [Source: docs/epics.md:124, docs/PRD.md:107, docs/architecture.md:233-243]
4. Transformer emits structured log/audit payloads capturing sheet ID, anomalies (missing columns, duplicate keys), and summary counts, and writes an entry to `sync_events` aligned with observability conventions. [Source: docs/architecture.md:227-243,247-251]
5. Automated tests (unit + integration) cover transformation accuracy (type coercion + anonymization hooks), idempotent upserts, index enforcement, and regression cases for missing headers or conflicting keys. [Source: docs/epics.md:124, docs/architecture.md:101-105]
6. Runbook/docs updated with normalization rules, index prerequisites, and troubleshooting cues so SM/Dev agents can respond when ingest fails mid-demo. [Source: docs/PRD.md:120-140, docs/architecture.md:227-243]

## Tasks / Subtasks

- [x] Define DTO + validation layer (Zod + TypeScript) that maps Sheets headers to canonical schema, including defaulting/anonymization hooks. (AC: 1)
  - [x] Document header-to-field mapping and fallback/error messaging for missing or extra columns. (AC: 1,4,6)
- [x] Build transformer + upsert module in `workers/sync` (or `workers/sync/transform.ts` shared helper) that consumes `fetchSheetData` output, applies change detection, and upserts through `models/Device.ts`. (AC: 1-2)
  - [x] Emit structured logs with `sheetId`, `rowsProcessed`, `added/updated/unchanged`, anomaly list, and duration; ensure `sync_events` entries persist for audit. (AC: 2,4)
- [x] Ensure compound index coverage by migrating or verifying indexes on `deviceId`, `assignedTo`, `lastSyncedAt`; include automation (seed/migration script or `npm run verify-sync`). (AC: 3,6)
- [x] Extend docs/runbook (`docs/runbook/sync-operations.md`) with normalization rules, index requirements, and failure-handling steps so operators can remediate quickly. (AC: 4,6)
- [x] Author unit tests for transformer + index enforcement plus integration tests in `tests/integration/sync.spec.ts` to prove idempotent upserts and accurate metrics. (AC: 5)

## Dev Notes

### Learnings from Previous Story

- Story `2-1-build-google-sheets-fetch-module` defines `lib/google-sheets.ts` as the single entry retrieving typed rows and enumerated error codes; this story must reuse that module’s DTO to avoid duplicating pagination or Secret Manager handling. (docs/stories/2-1-build-google-sheets-fetch-module.md#Story)
- Pending tasks in Story 2.1 include formalizing structured error codes (`SHEET_NOT_FOUND`, `RATE_LIMIT`, etc.) and logging hooks—alignment is required so transformer-level anomalies chain into the same envelope without inventing new codes. (docs/stories/2-1-build-google-sheets-fetch-module.md#Acceptance-Criteria)
- No completion notes exist yet because Story 2.1 remains drafted, so coordinate schema contracts (headers, typed payload) before merging to prevent rework.

### Implementation Alignment

- Keep business logic inside `workers/sync` shared helpers so `/api/sync/run` and `/api/sync/manual` call identical pipelines; avoid sprinkling normalization inside API handlers. (docs/architecture.md:70-105,233-254)
- Persist via `models/Device.ts`/`schemas/device.ts` to leverage Mongoose hooks (timestamps, anonymization flags) and keep `sync_events` entries consistent with observability stack. (docs/architecture.md:45-105,233-243)
- Maintain structured logging with `requestId`, manager identity (for manual runs), `sheetId`, and row deltas using `lib/logging.ts` so Cloud Logging dashboards surface ingest health. (docs/architecture.md:227-243)
- Change detection should prefer bulk `bulkWrite` or transactions to keep Atlas latency low while satisfying the 60 s SLA referenced in sync pipeline guidance. (docs/architecture.md:233-254)

### Project Structure Notes

- Add `workers/sync/transform.ts` (new helper) and update `workers/sync/index.ts` plus `lib/google-sheets.ts` integration so pipeline flows `fetch → transform → upsert`. (docs/architecture.md:82,95-105,233-251)
- Extend tests under `tests/unit/workers/sync/transform.test.ts` and `tests/integration/sync.spec.ts`, reusing fixtures in `tests/fixtures/devices.ts` (create if missing) for deterministic payloads. (docs/architecture.md:101-105)
- Provide an index verification script or shared `scripts/verify-sync.ts` update so CI can fail fast when indexes drift; document invocation in README/runbook. (docs/architecture.md:99-101,233-243)

### Testing & Observability

- Unit tests: cover mapping, default handling, anonymization toggles, and compound key collisions.
- Integration tests: simulate manual and scheduled sync flows to validate `sync_events` entries and log fields.
- Monitoring: ensure log-based metrics capture `sync_duration_ms`, `rows_processed`, and anomaly counts for dashboards referenced in governance workflows. (docs/architecture.md:227-243)

### References

- [Source: docs/epics.md:118-140]
- [Source: docs/PRD.md:95-199]
- [Source: docs/architecture.md:45-155,227-254]
- [Source: docs/stories/2-1-build-google-sheets-fetch-module.md]

## Change Log

- 2025-11-11: Added canonical device schema + Mongoose model, built transformer/upsert workflow with logging + sync events, shipped index verification script, runbook updates, and automated tests (unit + integration suite guarded in sandbox).

## Dev Agent Record

### Context Reference

- docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Assess existing `nyu-device-roster` data layer (models, schemas, workers) to confirm there is a Mongo pipeline to extend, then outline transformer/upsert contract (AC1-2).
- Inventory DB/index utilities or scripts to understand how/where to enforce compound indexes and plan verification hook (AC3).
- Map required documentation + runbook updates (normalization rules, index prereqs) so operator guidance stays aligned with new flow (AC4, AC6).

### Completion Notes List

- Created canonical device schema + Device model with `(deviceId, sheetId)` uniqueness, supporting indexes, and DTO validation across `nyu-device-roster/src/schemas/device.ts` + `src/models/Device.ts` (AC1, AC3).
- Implemented normalization + bulk upsert workflow with audit logging (`src/workers/sync/*.ts`) and a `scripts/verify-sync-indexes.ts` helper so operators can enforce index coverage (AC1-4).
- Updated sync runbook/story guidance and executed `npm test`; unit suites pass in-sandbox, while the Mongo-backed integration test is automatically skipped here because `mongodb-memory-server` cannot bind to `0.0.0.0` (documented for local re-run). (AC5-6)

### File List

- nyu-device-roster/package.json
- nyu-device-roster/package-lock.json
- nyu-device-roster/scripts/verify-sync-indexes.ts
- nyu-device-roster/src/models/Device.ts
- nyu-device-roster/src/schemas/device.ts
- nyu-device-roster/src/workers/sync/index.ts
- nyu-device-roster/src/workers/sync/transform.ts
- nyu-device-roster/tests/integration/sync.test.ts
- nyu-device-roster/tests/unit/workers/sync/transform.test.ts
- docs/runbook/sync-operations.md
- docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md
- docs/sprint-status.yaml
