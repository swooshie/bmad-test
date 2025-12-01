# Story 2.2: Persist Dynamic Columns in MongoDB

Status: review

Story Key: 2-2-persist-dynamic-columns-in-mongodb

## Requirements Context

- FR-003 in the PRD requires the ingest service to treat `serial` as the immutable key while mirroring every optional Google Sheet column into MongoDB and `/api/devices`, ensuring the dashboard never needs code changes for new metadata. [Source: docs/PRD.md:83-138]
- Epic 2 Story EP2.2 specifies that MongoDB must persist dynamic columns using deterministic snake_case keys, attach optional `columnDefinitions`, and keep queries performant through new indexes as the sheet evolves. [Source: docs/epics.md:85-135]
- The Epic 2 tech spec extends `lib/google-sheets.ts`, `workers/sync/transform.ts`, and a new column registry so header diffs, `dynamicAttributes`, and `/api/devices` columns stay synchronized up to 100 fields with observability hooks. [Source: docs/tech-spec-epic-2.md:10-140]
- Architecture guidance keeps everything in the existing Next.js monolith on App Engine, using Cloud Scheduler → Cloud Tasks for sync, MongoDB Atlas via Mongoose, React Query data access, and structured logging that records schema drift via `sync_events`. [Source: docs/architecture.md:5-283]
- Data models and the sync runbook document current `devices` indexes, header-mapping, deterministic casting, and transaction/rollback expectations, so dynamic columns must extend those invariants without regressing the audit trail. [Source: docs/data-models.md:1-44][Source: docs/runbook/sync-operations.md:1-150]
- Source tree analysis and API contracts constrain changes to existing folders (`lib`, `models`, `workers/sync`, `app/api/devices`, `(manager)/devices`) while preserving the `{ data, meta, error }` envelope and SyncStatus telemetry wiring. [Source: docs/source-tree-analysis.md:1-77][Source: docs/api-contracts.md:1-36]

## Scope

- **In Scope:** Extend the sync worker, Mongo device schema, and `/api/devices` outputs so dynamic columns are normalized to snake_case, persisted via a column registry, indexed for 100-column scenarios, and surfaced to the React grid with telemetry hooks. [Source: docs/tech-spec-epic-2.md:30-160][Source: docs/epics.md:90-135]
- **Out of Scope:** Serial migration tasks from Epic 1, guardrail workflows under Epic 3, and UI drawer/governance enhancements unrelated to dynamic column rendering. [Source: docs/epics.md:80-145]

## Structure Alignment Summary

1. Sprint order indicates Story 2-1 is drafted while Story 2-2 remains backlog; no prior Dev Agent Record learnings are ready for reuse yet, but serial-first features from Epic 1 must remain intact to avoid conflicting migrations. [Source: docs/sprint-status.yaml:28-45]
2. Implementation must stay within existing folders documented in the architecture and source tree references (`lib/`, `models/`, `workers/sync/`, `app/api/devices/`, `(manager)/devices`) so the Next.js monolith, MongoDB models, and React grid keep their established ownership. [Source: docs/architecture.md:45-220][Source: docs/source-tree-analysis.md:1-77]
3. MongoDB index changes have to preserve transaction/rollback safeguards plus the deterministic hashing rules described in the runbook and data-model docs to keep ingest reliability and auditability intact. [Source: docs/runbook/sync-operations.md:90-200][Source: docs/data-models.md:1-44]
4. API responses must continue emitting `{ data, meta, error }` envelopes, columns metadata, and SyncStatus telemetry events so downstream UI and governance tooling remain backward compatible while gaining dynamic column awareness. [Source: docs/api-contracts.md:1-36][Source: docs/architecture.md:255-284]

## Story

As a data engineer,
I want MongoDB to store dynamic columns with consistent naming conventions,
so that downstream services can rely on predictable keys even as the sheet evolves. [Source: docs/epics.md:108-118]

## Acceptance Criteria

1. **Registry-backed persistence:** Sync worker captures ordered headers, normalizes them to snake_case keys, persists column registry entries (label, key, type, lastSeenAt), and emits `SYNC_COLUMNS_CHANGED` telemetry when diffs occur. [Source: docs/tech-spec-epic-2.md:30-90]
2. **Dynamic device schema:** `models/Device.ts` and `schemas/device.ts` expose a `dynamicAttributes` map plus optional `columnDefinitions` reference, maintain serial uniqueness, and add indexes (wildcard or hashed) that keep queries performant up to 100 columns. [Source: docs/tech-spec-epic-2.md:90-140][Source: docs/data-models.md:1-44]
3. **Transaction-safe upserts:** `workers/sync/index.ts` writes column registry updates and device records in the same Mongo session (with copy-on-write fallback) so schema + data stay consistent on success or rollback. [Source: docs/runbook/sync-operations.md:90-170]
4. **API + telemetry alignment:** `/api/devices` (and `/api/devices/columns` if created) returns `columns` metadata drawn from the registry, updates `columnsVersion`, and records sync events so UI grid personalization and SyncStatus banner cues stay accurate. [Source: docs/api-contracts.md:1-36][Source: docs/tech-spec-epic-2.md:30-160]
5. **Testing + migration coverage:** Vitest + integration suites cover header normalization, registry persistence, dynamic attribute writes, and schema migrations (including 5/20/100 column fixtures), while documentation/runbooks note new maintenance steps. [Source: docs/tech-spec-epic-2.md:120-180][Source: docs/development-guide.md:21-43]

## Tasks / Subtasks

- [x] **Implement column registry service (AC: #1, #3).**
  - [x] Extend `lib/google-sheets.ts` and a new `workers/sync/header-map.ts` helper to normalize header keys, detect added/removed/renamed columns, and emit metrics. [Source: docs/tech-spec-epic-2.md:30-80]
  - [x] Add `models/ColumnDefinition.ts` + migration script to persist `{ sheetId, columnKey, label, dataType, lastSeenAt }` with compound indexes and registry versioning. [Source: docs/tech-spec-epic-2.md:70-110]
  - [x] Update `workers/sync/index.ts` to wrap registry writes + device upserts in the same Mongo session with retry/backoff aligned to the runbook. [Source: docs/runbook/sync-operations.md:90-200]
- [x] **Enhance device normalization for dynamic attributes (AC: #2, #3).**
  - [x] Teach `workers/sync/transform.ts` to capture unknown headers into a `dynamicAttributes` dictionary, include them in `contentHash`, and enforce 100-column limits with anomaly logging. [Source: docs/tech-spec-epic-2.md:90-130]
  - [x] Extend `models/Device.ts`/`schemas/device.ts` with `dynamicAttributes` and optional `columnDefinitions` reference, plus wildcard indexes that keep lookups performant. [Source: docs/data-models.md:1-44]
  - [x] Provide migration/backfill scripts ensuring legacy documents get initialized without dropping serial indexes. [Source: docs/runbook/sync-operations.md:140-200]
- [x] **Expose registry metadata via APIs and telemetry (AC: #4).**
  - [x] Update `app/api/devices/device-query-service.ts` to join against column registry, return `columns` metadata, and bump `columnsVersion` when schema changes occur. [Source: docs/api-contracts.md:1-36]
  - [x] Optionally add `/api/devices/columns` endpoint and React Query hook so UI preloads definitions before rendering large grids. [Source: docs/tech-spec-epic-2.md:30-70]
  - [x] Emit `SYNC_COLUMNS_CHANGED` events in `lib/audit/syncEvents.ts` / `SyncStatus` helpers so banner cues surface column diffs automatically. [Source: docs/tech-spec-epic-2.md:120-160][Source: docs/architecture.md:227-284]
- [x] **Testing, docs, and runbook updates (AC: #5).**
  - [x] Add Vitest unit tests for header normalization + registry persistence, integration tests for 5/20/100 column ingestion, and UI contract tests validating column metadata. [Source: docs/development-guide.md:21-43]
  - [x] Update sync runbook + development guide with new maintenance steps (registry migrations, index verification, telemetry cues). [Source: docs/runbook/sync-operations.md:1-200]

## Dev Notes

- Honor the existing serial-first ingest pipeline from Epic 1; `dynamicAttributes` augments, not replaces, canonical fields, so migrations must preserve unique serial indexes and legacy `legacyDeviceId` behavior for rollback safety. [Source: docs/tech-spec-epic-2.md:32-110][Source: docs/data-models.md:1-44]
- Keep all schema writes within the App Engine monolith footprint: workers live in `workers/sync/`, shared helpers in `lib/`, Mongo models in `models/`, API responses under `app/api/devices`, and React grid updates inside `(manager)/devices`. [Source: docs/architecture.md:45-220][Source: docs/source-tree-analysis.md:1-77]
- Registry + device writes must share a Mongo session with copy-on-write fallback so sync_events reflect consistent schema/data snapshots, matching the runbook’s failure-handling strategy. [Source: docs/runbook/sync-operations.md:90-200]
- API envelopes stay `{ data, meta, error }`; when adding `columns`, ensure anonymization + pagination logic reuse existing helpers and update `columnsVersion` so React Query caches bust correctly. [Source: docs/api-contracts.md:1-36]
- Telemetry should continue using `SyncEventModel` with new `SYNC_COLUMNS_CHANGED` events, logging `columnsAdded`, `columnsRemoved`, and `totalColumns` for dashboard alerts. [Source: docs/architecture.md:227-284]
- Testing must reuse the documented tooling (Vitest, integration suites, Playwright) and add fixtures for 5/20/100-column headers to prove registry + UI stay performant. [Source: docs/development-guide.md:21-43][Source: docs/tech-spec-epic-2.md:120-180]

### Project Structure Notes

- Column registry models belong in `nyu-device-roster/src/models` with mirrored schemas under `src/schemas`; workers stay under `workers/sync` and UI logic under `(manager)/devices` to match documented conventions. [Source: docs/source-tree-analysis.md:1-77]
- New scripts (migrations/backfills) should sit in `nyu-device-roster/scripts/` alongside existing maintenance utilities so DevOps processes remain consistent. [Source: docs/architecture.md:45-120]

### References

- docs/PRD.md:83-138
- docs/epics.md:85-140
- docs/tech-spec-epic-2.md:10-160
- docs/architecture.md:5-283
- docs/runbook/sync-operations.md:1-200
- docs/source-tree-analysis.md:1-77
- docs/api-contracts.md:1-36
- docs/data-models.md:1-44
- docs/development-guide.md:21-43

## Dev Agent Record

### Context Reference

- docs/stories/2-2-persist-dynamic-columns-in-mongodb.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

1. **Registry + transaction alignment (AC1, AC3)** – `nyu-device-roster/src/workers/sync/header-map.ts` now infers header data types/nullable flags and emits deterministic registry versions that feed `synchronizeColumnRegistry`. `nyu-device-roster/src/models/ColumnDefinition.ts` stores those attributes plus `sourceVersion`, and `nyu-device-roster/src/workers/sync/index.ts` replays registry bulk writes inside the same Mongo session as device upserts while stamping `columnVersion` telemetry.
2. **Device schema + normalization guardrails (AC2)** – `nyu-device-roster/src/models/Device.ts`, `nyu-device-roster/src/schemas/device.ts`, and `nyu-device-roster/src/workers/sync/transform.ts` add `columnDefinitionsVersion` tracking, include it in SHA-256 `contentHash` calculations, and register a wildcard index on `dynamicAttributes` to keep ≤100 column queries performant. Upsert helpers now persist (or clear) the version for each document.
3. **API telemetry + documentation/tests (AC4, AC5)** – `nyu-device-roster/src/app/api/devices/device-query-service.ts`, `/api/devices/columns/route.ts`, and `src/lib/devices/columns.ts` surface registry-driven columns (with numeric hints) and derive stable versions for the grid. `docs/runbook/sync-operations.md` captures the registry workflow, and new/updated Vitest suites (`tests/unit/workers/sync/*.test.ts`, `tests/unit/app/api/devices/device-query-service.test.ts`) verify the column metadata path.

### Completion Notes List

1. AC1/AC3 – Column registry entries capture `dataType`, `nullable`, `displayOrder`, and `sourceVersion`, with diffs written in-transaction beside device upserts and `SYNC_COLUMNS_CHANGED` metadata now including `columnVersion`.
2. AC2 – Device documents store `columnDefinitionsVersion`, `dynamicAttributes` remain deterministic, and a wildcard index preserves query performance while normalization/content hashes incorporate the new metadata.
3. AC4 – `/api/devices` and `/api/devices/columns` return registry-aware columns (including numeric hints) and React grid metadata derives versions from stored `sourceVersion` fields for personalization caching.
4. AC5 – Runbook normalization guidance documents registry maintenance, and `npm test` (Vitest) exercises the new header profile logic, normalization path, and device grid column builder without regressions.

### File List

- `docs/runbook/sync-operations.md`
- `docs/sprint-status.yaml`
- `docs/stories/2-2-persist-dynamic-columns-in-mongodb.md`
- `nyu-device-roster/src/models/ColumnDefinition.ts`
- `nyu-device-roster/src/models/Device.ts`
- `nyu-device-roster/src/schemas/device.ts`
- `nyu-device-roster/src/workers/sync/{header-map.ts,index.ts,transform.ts}`
- `nyu-device-roster/src/lib/devices/columns.ts`
- `nyu-device-roster/src/app/api/devices/{device-query-service.ts,columns/route.ts}`
- `nyu-device-roster/tests/unit/{workers/sync/header-map.test.ts,workers/sync/transform.test.ts,app/api/devices/device-query-service.test.ts}`

## Change Log

- Draft created on 2025-11-24 via *create-story workflow.
- 2025-11-24 – Persisted column registry metadata, device schema references, API outputs, and regression tests via *develop-story* (Amelia).
