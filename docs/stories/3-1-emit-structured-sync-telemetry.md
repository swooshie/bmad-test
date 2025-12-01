# Story 3.1: Emit Structured Sync Telemetry

Status: review

Story Key: 3-1-emit-structured-sync-telemetry

## Requirements Context

- PRD requirement FR-005 mandates structured logs and metrics so operators immediately know when the “sheet equals dashboard” promise is at risk, making telemetry the first safeguard for Epic 3. [Source: docs/PRD.md:138-147]
- Epic 3 Story EP3.1 defines the narrative, acceptance criteria, and FR-005 linkage for emitting sync telemetry with run-level metrics and alerts before downstream confidence erodes. [Source: docs/epics.md:148-164]
- Architecture documentation positions Pino structured logging, Cloud Logging dashboards, and log-based alerts as the canonical observability stack for sync workflows, ensuring new telemetry follows BMAD conventions. [Source: docs/architecture.md:140-190]
- The sync operations runbook explains how workers, manual endpoints, and Cloud Tasks emit `SYNC_*` events, how metrics flow through SyncStatus, and where banner messaging/alerts must surface. [Source: docs/runbook/sync-operations.md:1-160]
- Data models describe the `sync_events` collection schema and indexes, so new telemetry must enrich those documents with counts, durations, trigger metadata, and alert status without breaking existing consumers. [Source: docs/data-models.md:1-60]

## Structure Alignment Summary

1. Epic 3 begins immediately after Epic 2 stories; there is no prior Dev Agent Record context for telemetry, so this story establishes the patterns that subsequent Epic 3 stories inherit. [Source: docs/sprint-status.yaml]
2. Architecture dictates that sync automation lives in `workers/sync`, telemetry flows through `lib/logging.ts` and `models/SyncEvent.ts`, and UI signals appear in SyncStatus components—work must stay within those folders. [Source: docs/architecture.md:120-170][Source: docs/source-tree-analysis.md:1-60]
3. Logging and metrics must use the `{ data, meta, error }` envelope and structured Pino events so Cloud Logging dashboards and `/api/metrics` remain compatible. [Source: docs/architecture.md:150-180][Source: docs/runbook/sync-operations.md:90-150]
4. `sync_events` documents require consistent metadata (`trigger`, `status`, `durationMs`, counts), so schema updates should travel through `models/SyncEvent.ts` and `nyu-device-roster/src/lib/audit/syncEvents.ts`. [Source: docs/data-models.md:25-60]
5. Testing strategy relies on Vitest/Playwright plus `npm run smoke` to verify telemetry endpoints, so implementation must add/update tests in those suites before promotion. [Source: docs/development-guide.md:1-80]

## Story

As an SRE,
I want the sync job to log structured metrics for each run,
so that I can detect failures or long runtimes before users lose faith. [Source: docs/epics.md:148-160]

## Acceptance Criteria

1. Logs include start/end time, rows processed, rows skipped, conflicts, and duration for every scheduled or manual sync run. [Source: docs/epics.md:154-157][Source: docs/runbook/sync-operations.md:1-120]
2. Metrics publish to the existing monitoring stack (SyncStatus banner + Cloud Logging dashboards) with success/failure counters tied to each trigger. [Source: docs/epics.md:154-157][Source: docs/architecture.md:140-180]
3. Alerts fire when a run exceeds 5 minutes or fails twice consecutively, using log-based metrics or SyncEvent telemetry so operators respond before dashboards drift. [Source: docs/epics.md:158-163][Source: docs/runbook/sync-operations.md:120-160]

## Tasks / Subtasks

- [x] Task 1: Instrument sync worker pipeline to emit structured run metrics (AC1)
  - [x] Subtask 1.1: Update `nyu-device-roster/src/workers/sync/index.ts` and `lib/logging.ts` so each run captures start/end timestamps, row counts, skips, conflicts, and duration in Pino logs and `SyncEvent` documents. [Tests: npm run test]
  - [x] Subtask 1.2: Extend `models/SyncEvent.ts` and `lib/audit/syncEvents.ts` with metadata fields (`rowsProcessed`, `rowsSkipped`, `conflicts`, `durationMs`, `trigger`) plus Vitest coverage for serialization. [Tests: npm run test]
- [x] Task 2: Publish metrics to SyncStatus + Cloud Logging dashboards (AC2)
  - [x] Subtask 2.1: Wire new metrics into `nyu-device-roster/src/lib/sync-status.ts` and `/app/api/metrics/route.ts`, ensuring SyncStatus banner shows latest counts/state for scheduled vs manual runs. [Tests: npm run test]
  - [x] Subtask 2.2: Document dashboard queries/log-based metrics in `docs/runbook/sync-operations.md` and add smoke coverage verifying `/api/metrics` reflects success/failure counters. [Tests: npm run smoke]
- [x] Task 3: Configure alerting thresholds for long or failing runs (AC3)
  - [x] Subtask 3.1: Create or update log-based metrics (duration >5 minutes, failure streak ≥2) and ensure alerts propagate through existing notification channels; capture procedures in the runbook. [Tests: manual verification]
  - [x] Subtask 3.2: Add safeguards in SyncStatus banner (e.g., warning state) and Playwright assertions proving alerts surface in the UI when metrics breach thresholds. [Tests: npm run test]

## Dev Notes

- Use Pino structured logging with request IDs and workflow metadata; follow the `{ data, meta, error }` response envelope even for telemetry endpoints so monitoring scripts stay backward compatible. [Source: docs/architecture.md:150-200]
- `workers/sync`, `lib/logging.ts`, and `models/SyncEvent.ts` own telemetry plumbing—do not scatter logging logic into unrelated modules; keep identifiers consistent with existing `DEVICE_SYNC_*` events. [Source: docs/source-tree-analysis.md:1-60][Source: docs/runbook/sync-operations.md:1-160]
- Metrics must write through Cloud Logging log-based metrics and `/api/metrics`; update dashboards/alert policies per runbook guidance and ensure `sync_events` indexes still capture new fields. [Source: docs/runbook/sync-operations.md:90-160][Source: docs/data-models.md:25-60]
- Testing expectations: Vitest for worker/logging utilities, Playwright for SyncStatus banner states, `npm run smoke` to confirm `/api/metrics` + SyncStatus reflect telemetry before marking ready-for-dev. [Source: docs/development-guide.md:1-80]

### Project Structure Notes

- Telemetry work should touch `nyu-device-roster/src/workers/sync/`, `src/lib/logging.ts`, `src/models/SyncEvent.ts`, and `src/lib/sync-status.ts` as mapped in the source tree guide. [Source: docs/source-tree-analysis.md:1-60]
- Documentation updates belong in `docs/runbook/sync-operations.md` and, if alerts change, in any downstream SRE guides; keep folder conventions (kebab-case file names, markdown anchors) intact. [Source: docs/runbook/sync-operations.md:1-120]

### References

- [Source: docs/PRD.md]
- [Source: docs/epics.md]
- [Source: docs/architecture.md]
- [Source: docs/runbook/sync-operations.md]
- [Source: docs/data-models.md]
- [Source: docs/development-guide.md]
- [Source: docs/source-tree-analysis.md]

## Dev Agent Record

### Context Reference

- docs/stories/3-1-emit-structured-sync-telemetry.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-02-14: `workers/sync/index.ts`, `lib/logging.ts`, and `models/SyncEvent.ts` now emit `rowsProcessed`, `rowsSkipped`, `conflicts`, `startedAt`, and `completedAt` for every `SYNC_RUN` event (AC1).
- 2025-02-14: Added sync metrics aggregation module + smoke coverage to back `/api/metrics` and SyncStatus banner differentiating manual vs scheduled triggers (AC2).
- 2025-02-14: Introduced SyncStatus warning state + runbook alert procedures for >5 minute runs and ≥2 failure streaks (AC3).

### Completion Notes List

- 2025-02-14: Implemented structured telemetry pipeline, SyncStatus trigger-aware UI, and alerting docs + smoke coverage. Tests: `npm run test -- tests/unit/lib/sync-status.test.ts tests/unit/app/api/metrics/route.test.ts tests/unit/app/api/sync/run/route.test.ts tests/unit/app/api/sync/manual/route.test.ts tests/unit/app/manager/sync-status-banner.errors.test.tsx`.
- 2025-12-01: Hardened sync event persistence to avoid transaction validation errors and fixed audit test mocking for serial audit telemetry. Tests: `npm run test`.

### File List

- `docs/sprint-status.yaml`
- `docs/runbook/sync-operations.md`
- `nyu-device-roster/src/lib/logging.ts`
- `nyu-device-roster/src/models/SyncEvent.ts`
- `nyu-device-roster/src/lib/audit/syncEvents.ts`
- `nyu-device-roster/src/lib/metrics/syncAggregations.ts`
- `nyu-device-roster/src/workers/sync/index.ts`
- `nyu-device-roster/src/lib/sync-status.ts`
- `nyu-device-roster/src/app/api/metrics/route.ts`
- `nyu-device-roster/src/app/api/sync/run/route.ts`
- `nyu-device-roster/src/app/api/sync/manual/route.ts`
- `nyu-device-roster/src/app/(manager)/components/SyncStatusBanner.tsx`
- `nyu-device-roster/scripts/smoke.ts`
- `nyu-device-roster/tests/unit/lib/sync-status.test.ts`
- `nyu-device-roster/tests/unit/app/api/metrics/route.test.ts`
- `nyu-device-roster/tests/unit/app/api/sync/run/route.test.ts`
- `nyu-device-roster/tests/unit/app/api/sync/manual/route.test.ts`
- `nyu-device-roster/tests/unit/app/manager/sync-status-banner.errors.test.tsx`
- `nyu-device-roster/tests/unit/lib/audit/syncEvents.test.ts`
- `nyu-device-roster/tests/unit/workers/sync/audit.test.ts`

## Change Log

- Draft created on 2025-11-25 via *create-story workflow.
- 2025-02-14: Added structured sync telemetry, SyncStatus trigger awareness, metrics aggregation module, smoke/test coverage, and alerting documentation per AC1-AC3.
- 2025-12-01: Stabilized sync event writes under transactions and refreshed audit telemetry tests.
