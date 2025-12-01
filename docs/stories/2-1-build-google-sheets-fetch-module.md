# Story 2.1: Build Google Sheets fetch module

Status: review

## Story

As a data pipeline developer, I want a reusable Google Sheets fetch module that authenticates with our service account and returns typed row data so downstream normalization and sync jobs always start from clean, consistent arrays with meaningful error codes.

### Requirements & Context Summary

- Epic B1 mandates a Secret-Manager-backed fetcher that reads the Devices sheet by ID, returns headers plus typed rows, and translates Sheets API failures into structured codes such as `SHEET_NOT_FOUND`, `RATE_LIMIT`, and `OAUTH_REVOKED`. (docs/epics.md:115-121)
- The PRD’s sync requirements (FR-006) and API spec expect `/api/sync` to ingest Google Sheets data within 60 seconds, emitting actionable error codes so demo operators understand failures; this module underpins that SLA. (docs/PRD.md:95-109,171)
- Architecture assigns Google Sheets integration to `lib/google-sheets.ts`, triggered by Cloud Scheduler/Tasks through sync workers, with Secret Manager supplying credentials and structured logging capturing request metadata. (docs/architecture.md:5,18-23,70-83,145-155,227-231,247-264)

## Acceptance Criteria

1. The fetch module loads Google Sheets service account credentials exclusively from Secret Manager (never plaintext), uses them to authenticate with the target sheet ID, and exposes a reusable interface for sync workers. [Source: docs/epics.md:115-118, docs/PRD.md:199, docs/architecture.md:145,293]
2. `fetchSheetData` (or equivalent) returns header metadata plus row arrays with typed values (strings, numbers, dates) while handling pagination transparently so downstream normalization never re-implements paging logic. [Source: docs/epics.md:118-119]
3. Sheets API failures map to structured error codes (`SHEET_NOT_FOUND`, `RATE_LIMIT`, `OAUTH_REVOKED`, etc.) with request context logged through the Pino pipeline to keep `/api/sync` responses and audit logs consistent. [Source: docs/epics.md:120, docs/PRD.md:104-109, docs/architecture.md:227-231]
4. Module surface supports Cloud Scheduler/Tasks retry semantics (idempotent fetch, optional exponential backoff hooks) and exposes performance metrics (duration, row counts) for logging so orchestration layers can enforce the 60-second ingest SLA. [Source: docs/architecture.md:19,70,247-283]
5. Automated tests cover successful fetches, pagination, type conversions, and each structured error path to prevent regressions before later pipeline stories depend on this module. [Source: docs/epics.md:118-120, docs/architecture.md:104-105]

## Tasks / Subtasks

- [x] Define module interface in `lib/google-sheets.ts`, including inputs (sheetId, tab name, credential handle) and structured output shape with headers + typed rows. (AC: 1-2,4)
  - [x] Document usage for `workers/sync` and `app/api/sync/run` so orchestration layers call a single entry point. (AC: 4)
- [x] Implement Secret Manager credential loader (reuse `lib/auth.ts` patterns) to obtain service account key JSON securely at runtime. (AC: 1)
  - [x] Validate configuration (sheetId present, tab name optional) before making API calls; fail fast with descriptive errors. (AC: 1,3)
- [x] Build Google Sheets fetch logic with pagination support, type coercion helpers, and structured error mapping with Pino logging hooks for requestId/sheetId metrics. (AC: 2-4)
  - [x] Include hooks for retry/backoff so Cloud Tasks can plug in policy without duplicating logic. (AC: 4)
- [x] Write unit and integration tests covering success, pagination edge cases, date/number conversions, and each structured error code path. (AC: 5)
  - [x] Add contract tests ensuring downstream transformer receives consistent payload shape. (AC: 2,5)
- [x] Update docs/runbook (`docs/runbook/sync-operations.md`) with instructions for configuring sheet IDs, monitoring logs, and interpreting error codes. (AC: 3-4)

## Dev Notes

### Learnings from Previous Story

- First story in Epic 2 – no predecessor context yet; coordinate directly with Epic A owners for Secret Manager patterns established in config/auth stories. (docs/sprint-status.yaml:46)

### Implementation Alignment

- Keep the module within `lib/google-sheets.ts` and expose it to `workers/sync` plus `app/api/sync/*` as defined in the architecture hierarchy to avoid duplicate implementations when normalization and manual sync tasks call it. (docs/architecture.md:45,70-83,247)
- Use the documented Pino JSON logging convention (`requestId`, `workflow`, `sheetId`) so structured logs feed Cloud Monitoring metrics for sync latency and failure tracking. (docs/architecture.md:227-231)

### Project Structure Notes

- Library placement: `lib/google-sheets.ts` with supporting types; consider `lib/google-sheets/types.ts` if payload contracts grow. (docs/architecture.md:45,82)
- Worker entry point: ensure `workers/sync/index.ts` depends on the new module via dependency injection for easier testing. (docs/architecture.md:95-98,247)
- Tests: add coverage to `tests/integration/sync.spec.ts` or create `tests/unit/lib/google-sheets.test.ts` matching repo conventions. (docs/architecture.md:104-105,204)

### References

- [Source: docs/epics.md:110-121]
- [Source: docs/PRD.md:95-109,171,199]
- [Source: docs/architecture.md:5,18-23,45,70-105,145-155,227-264,293]

## Change Log

- 2025-11-11: Added Google Sheets fetch module, contract tests, sync operations runbook, and advanced story to review after running `npm test`.

## Dev Agent Record

### Context Reference

- docs/stories/2-1-build-google-sheets-fetch-module.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

1. Map module interface + configuration validation in `nyu-device-roster/src/lib/google-sheets.ts`, wiring Secret Manager credentials + logging hooks (AC1, AC4).
2. Implement fetch + pagination + type coercion + structured error codes and retry/backoff hooks in the same module (AC2-4).
3. Cover success/pagination/error/type cases with Vitest (`nyu-device-roster/tests/unit/lib/google-sheets.test.ts`) and seed contract fixtures (AC5).
4. Document orchestrator usage in story + `docs/runbook/sync-operations.md`, then update File List/Change Log before closing tasks (AC3-4).

### Completion Notes List

- Implemented `nyu-device-roster/src/lib/google-sheets.ts` to supply credential loading, pagination, typed rows, metrics logging, and structured `SheetFetchError` codes that satisfy AC1-4.
- Added `nyu-device-roster/tests/unit/lib/google-sheets.test.ts` with coverage for success, pagination, type coercion, retries, and error mapping plus executed `npm test` (Vitest) per AC5.
- Authored `docs/runbook/sync-operations.md` describing worker/API usage, configuration, and operational recovery steps (AC3-4).
- Updated story + sprint tracking files for the ready-for-dev → in-progress → review transitions and documented the work below.

### File List
- nyu-device-roster/src/lib/google-sheets.ts
- nyu-device-roster/tests/unit/lib/google-sheets.test.ts
- docs/runbook/sync-operations.md
- docs/stories/2-1-build-google-sheets-fetch-module.md
- docs/sprint-status.yaml
