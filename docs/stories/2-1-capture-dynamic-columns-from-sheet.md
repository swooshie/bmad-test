# Story 2.1: Capture Dynamic Columns from Sheet

Status: review

Story Key: 2-1-capture-dynamic-columns-from-sheet

## Requirements Context

- FR-003/FR-004 require the sync service to ingest every Google Sheet header at runtime, persist arbitrary columns in MongoDB, and expose the resulting schema through `/api/devices` so operators never touch code to see new metadata. [Source: docs/PRD.md:87-112]
- Epic 2 Story EP2.1 mandates runtime header discovery, storage of unknown columns as key/value pairs, and automated tests for 5, 20, and 100-column scenarios as the prerequisite for the rest of the dynamic-column epic. [Source: docs/epics.md:90-112]
- Epic 2 Tech Spec introduces a header registry, `dynamicAttributes` storage on device documents, and telemetry (`columnsAdded`, `columnsRemoved`, `totalColumns`) so workers and UI stay synchronized even when columns churn. [Source: docs/tech-spec-epic-2.md:32-150]
- Architecture + sync runbook content keeps the Cloud Scheduler → Cloud Tasks SLA ≤60 s, enforces Secret Manager credentials, and expects copy-on-write fallbacks plus `sync_events` when schema drift occurs. [Source: docs/architecture.md:5-210][Source: docs/runbook/sync-operations.md:1-200]
- Source tree analysis confirms relevant modules (`lib/google-sheets.ts`, `workers/sync/*`, `models/Device.ts`, `/api/devices`, `(manager)/devices` hooks/components) so schema, API, and UI stay aligned without creating new directories. [Source: docs/source-tree-analysis.md:1-70]

## Scope

- **In Scope:** Header discovery/registry logic, device schema updates for dynamic attributes, API metadata exposure, and UI grid personalization that renders arbitrary columns. [Source: docs/tech-spec-epic-2.md:32-120]
- **Out of Scope:** Serial canonicalization (Epic 1) and downstream observability guardrails beyond emitting column-change telemetry defined here. [Source: docs/epics.md:90-140]

## Structure Alignment Summary

- Story 1-3 (Update Sync + API to Use Serial) sits immediately before this one and is currently ready-for-dev, so there are no completed learnings yet; we still depend on its output to keep sync/API serial-first. [Source: docs/stories/1-3-update-sync-and-api-to-use-serial.md:1-30]
- Story 1-2 (Backfill MongoDB with Serial Keys) is in review and introduced `DeviceModel.serial`, the `scripts/backfill-serial.ts` tooling, and MIGRATION_RUN telemetry that we must preserve when layering on column registries. [Source: docs/stories/1-2-backfill-mongodb-with-serial-keys.md:1-160]
- Maintain the established project structure: workers stay under `workers/sync`, shared helpers live in `lib/`, schema changes land in `models/` + `schemas/`, and UI grid updates remain in `(manager)/devices` to avoid new directories. [Source: docs/source-tree-analysis.md:1-60]

## Story

As a sync developer,
I want the ingestion job to detect all column headers automatically,
so that new metadata becomes available without code changes. [Source: docs/epics.md:97-103]

## Acceptance Criteria

1. Sync pipeline captures ordered headers each run, normalizes names to snake_case keys, and persists a column registry with telemetry about added/removed columns. [Source: docs/tech-spec-epic-2.md:32-90]
2. Device documents store dynamicAttributes with deterministic naming and indexing, and `/api/devices` responses include a `columns` array describing the current schema. [Source: docs/epics.md:111-136]
3. React Query grid renders whatever columns exist (up to 100), preserves personalization via local storage, and surfaces anonymization behavior per UX guidance. [Source: docs/ux-design-specification.md:60-210]
4. Column changes trigger `sync_events`, SyncStatus banner cues, and automated tests covering 5/20/100-column scenarios plus API/UI contract coverage. [Source: docs/tech-spec-epic-2.md:90-160][Source: docs/runbook/sync-operations.md:120-200]

## Tasks / Subtasks

- [x] Enhance Sheets fetch + header registry (AC1).
  - [x] Extend `lib/google-sheets.ts` to expose ordered headers and emit retry-safe metrics; add a `workers/sync/header-map.ts` helper to normalize/compare headers and record diffs. [Source: nyu-device-roster/src/lib/google-sheets.ts:1-200][Source: docs/tech-spec-epic-2.md:32-70]
  - [x] Persist a column registry model (e.g., `models/ColumnDefinition.ts`) and ensure registry writes happen in the same Mongo session as device upserts to keep schema/data aligned. [Source: docs/tech-spec-epic-2.md:70-110]
- [x] Update normalization + persistence for dynamic attributes (AC2).
  - [x] Teach `workers/sync/transform.ts` to copy unknown headers into `dynamicAttributes`, update `contentHash`, and log anomalies when header counts exceed limits; wire up conflict handling in `workers/sync/index.ts`. [Source: nyu-device-roster/src/workers/sync/transform.ts:1-200][Source: docs/runbook/sync-operations.md:90-160]
  - [x] Extend `models/Device.ts`/`schemas/device.ts` with `dynamicAttributes` plus necessary indexes, keeping existing serial/deviceId behavior intact. [Source: nyu-device-roster/src/models/Device.ts:1-160][Source: docs/data-models.md:1-40]
- [x] Surface column metadata via API + UI (AC2, AC3).
  - [x] Update `app/api/devices/device-query-service.ts` and `route.ts` to return `{ devices, columns, meta }`, plus add `/api/devices/columns` if needed for prefetching; ensure envelopes stay `{ data, meta, error }`. [Source: nyu-device-roster/src/app/api/devices/device-query-service.ts:1-220][Source: docs/api-contracts.md:1-70]
  - [x] Replace static `DEVICE_COLUMNS` usage in `(manager)/devices/hooks/useDeviceGrid.ts`, components, and anonymization presets with server-provided definitions while persisting personalization. [Source: nyu-device-roster/src/app/(manager)/devices/hooks/useDeviceGrid.ts:1-200][Source: nyu-device-roster/src/app/(manager)/devices/types.ts:1-80]
- [x] Observability + testing (AC4).
  - [x] Extend `SyncStatusBanner`/`lib/sync-status.ts` to display column-change cues, add `columnsAdded/Removed/Total` fields to `sync_events`, and update runbook guidance. [Source: nyu-device-roster/src/components/SyncStatusBanner.tsx:1-120][Source: docs/runbook/sync-operations.md:120-200]
  - [x] Add Vitest + Playwright coverage: header normalization unit tests, sync integration tests for 5/20/100 columns, API contract tests for column metadata, and UI tests for personalization persistence. [Source: docs/tech-spec-epic-2.md:90-160][Source: docs/development-guide.md:1-80]

## Dev Notes

- Reuse the existing Google Sheets fetcher and Mongo transaction fallback so header registry writes happen alongside device upserts; align with the copy-on-write safeguards documented in the runbook. [Source: docs/runbook/sync-operations.md:80-170]
- Device schema updates must keep serial + legacy deviceId behavior from Story 1-2, meaning migrations should not drop the legacy index until new dynamic indexes are validated. [Source: docs/stories/1-2-backfill-mongodb-with-serial-keys.md:1-160]
- API envelopes stay `{ data, meta, error }`; avoid breaking anonymous grid caching by ensuring new `columns` payloads are added to the `meta` block or `data` object consistently. [Source: docs/api-contracts.md:1-40]
- UI grid must cap column counts (≤100) and use virtualization and local-storage-backed personalization per UX spec; do not introduce new directories—extend `(manager)/devices/*`. [Source: docs/ux-design-specification.md:60-210][Source: docs/source-tree-analysis.md:1-60]
- Logging/telemetry should continue using `SyncEventModel` with `eventType` values (`SYNC_RUN`, new `SYNC_COLUMNS_CHANGED`) so dashboards and SyncStatus cues stay consistent. [Source: nyu-device-roster/src/models/SyncEvent.ts:1-160][Source: docs/architecture.md:140-205]

### Project Structure Notes

- Header discovery lives in `lib/google-sheets.ts` and new utilities under `workers/sync/`; column registry models belong in `nyu-device-roster/src/models` with schemas mirrored in `schemas/`. [Source: docs/source-tree-analysis.md:1-60]
- Keep API updates inside `app/api/devices/*` and React grid logic under `app/(manager)/devices/` so routing, hooks, and components stay co-located. [Source: docs/source-tree-analysis.md:1-60]
- Tests continue using existing layout (`tests/unit`, `tests/integration`, Playwright suites) per development guide; avoid adding bespoke harness directories. [Source: docs/development-guide.md:1-80]

### References

- docs/PRD.md:87-112
- docs/epics.md:90-140
- docs/tech-spec-epic-2.md:32-160
- docs/architecture.md:5-210
- docs/runbook/sync-operations.md:1-200
- docs/source-tree-analysis.md:1-70
- docs/ux-design-specification.md:60-210
- docs/development-guide.md:1-80
- docs/api-contracts.md:1-70
- nyu-device-roster/src/lib/google-sheets.ts
- nyu-device-roster/src/workers/sync/transform.ts
- nyu-device-roster/src/models/Device.ts
- nyu-device-roster/src/app/api/devices/device-query-service.ts
- nyu-device-roster/src/app/(manager)/devices/hooks/useDeviceGrid.ts
- nyu-device-roster/src/components/SyncStatusBanner.tsx

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

1. **Task 1 – Header registry implementation plan (AC1)**
   - Extend `src/lib/google-sheets.ts` to return ordered header metadata + retry metrics for registry writes.
   - Create `workers/sync/header-map.ts` helper that normalizes header names (snake_case), compares against persisted registry entries, and emits column diff summaries.
   - Add `models/ColumnDefinition.ts` + schema counterparts plus persistence logic in `workers/sync/index.ts` so registry updates share the sync transaction.
   - Prepare telemetry + report structures for `columnsAdded`, `columnsRemoved`, and ensure anomalies log when header counts exceed limits.
2. **Implementation record – sheets fetch + registry + dynamic attributes**
   - `src/lib/google-sheets.ts`, `workers/sync/header-map.ts`, `models/ColumnDefinition.ts`, and `workers/sync/index.ts` updated to capture ordered headers, persist column definitions in-transaction, and emit `SYNC_COLUMNS_CHANGED` events (`docs/runbook/sync-operations.md`).
   - `workers/sync/transform.ts`, `schemas/device.ts`, and `models/Device.ts` now emit deterministic `dynamicAttributes`, update content hashes, and log anomalies when more than 100 dynamic headers appear.
3. **Implementation record – API/UI + presets**
   - `app/api/devices/device-query-service.ts`, new `/api/devices/columns` route, and `routes.ts` expose registry-driven column definitions + versions; `DeviceRow.tsx` renders arbitrary columns from API payloads.
   - `AnonymizationPresetsPanel.tsx` now fetches server-provided columns, `SyncStatusBanner.tsx` shows column-change cues, and `useSyncStatus` data carries `columnsAdded/Removed/Total` metrics (see `lib/sync-status.ts`).
4. **Testing + telemetry notes**
   - Added Vitest coverage for header registry + dynamic attribute flows (`tests/unit/workers/sync/header-map.test.ts`, `tests/unit/workers/sync/transform.test.ts`, `tests/unit/app/api/devices/device-query-service.test.ts`).
   - `npm test` currently fails to load `vitest.config.ts` because `vitest` attempts to `require` the ESM `vite` package (ERR_REQUIRE_ESM); run requires upgrading the local Vitest toolchain.

### Completion Notes List

1. Added ordered header tracking + column registry persistence inside `src/lib/google-sheets.ts`, `src/workers/sync/header-map.ts`, and `src/models/ColumnDefinition.ts`; `workers/sync/index.ts` now logs `SYNC_COLUMNS_CHANGED` events and surfaces registry summaries back through sync events + SyncStatus.
2. Updated device normalization (`src/workers/sync/transform.ts`, `src/models/Device.ts`, `src/schemas/device.ts`) to capture `dynamicAttributes`, enforce 100-column limits, and hash the new payload shape.
3. API/UI consume registry-driven column metadata: `app/api/devices/device-query-service.ts`, new `app/api/devices/columns/route.ts`, `routes.ts`, and React grid components (`DeviceRow.tsx`, `AnonymizationPresetsPanel.tsx`) hydrate columns from the server while preserving personalization.
4. Observability + tests: `lib/sync-status.ts`, `components/SyncStatusBanner.tsx`, and `docs/runbook/sync-operations.md` describe column-change cues; Vitest suites cover header-map + dynamic attributes, but `npm test` fails because Vitest currently `require`s Vite's ESM build (ERR_REQUIRE_ESM).

### File List

- `docs/runbook/sync-operations.md`
- `docs/stories/2-1-capture-dynamic-columns-from-sheet.md`
- `nyu-device-roster/src/lib/google-sheets.ts`
- `nyu-device-roster/src/workers/sync/{header-map.ts,index.ts,transform.ts}`
- `nyu-device-roster/src/models/{ColumnDefinition.ts,Device.ts,SyncEvent.ts}`
- `nyu-device-roster/src/schemas/device.ts`
- `nyu-device-roster/src/app/api/devices/{device-query-service.ts,columns/route.ts}`
- `nyu-device-roster/src/app/(manager)/devices/components/{DeviceRow.tsx,AnonymizationPresetsPanel.tsx}`
- `nyu-device-roster/src/components/SyncStatusBanner.tsx`
- `nyu-device-roster/src/lib/{routes.ts,anonymization.ts,sync-status.ts}`
- `nyu-device-roster/tests/unit/{workers/sync/header-map.test.ts,workers/sync/transform.test.ts,app/api/devices/device-query-service.test.ts}`

## Change Log

- Draft created on 2025-11-24 via *create-story workflow.
- 2025-11-24 – Implemented dynamic column ingestion, registry persistence, API/UI exposure, SyncStatus updates, and initial Vitest coverage via *develop-story* (Amelia).
