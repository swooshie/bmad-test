# Story 1.1: Audit Sheet Serial Integrity

Status: review

Story Key: 1-1-audit-sheet-serial-integrity

## Requirements Context

- FR-001 in the PRD mandates the sync service treat the Google Sheets `serial` column as the immutable key and skip/log any rows missing the field, making a proactive data-quality check mandatory before every ingest. [Source: docs/PRD.md:134]
- Epic 1 Story EP1.1 frames the user need for an operations engineer to verify every sheet row exposes a valid serial so the downstream dashboard never ingests ambiguous devices. [Source: docs/epics.md:38]
- The Epic 1 tech spec defines a dedicated Google Sheets Serial Audit worker that fetches headers/rows, enforces non-empty serials, and emits structured warnings/operators reports, so this story must implement that service. [Source: docs/tech-spec-epic-1.md:32]
- Architecture decisions keep the Cloud Scheduler → Cloud Tasks → Next.js API worker pipeline and `lib/google-sheets.ts` integration as the ingestion backbone, so the audit must run within that scheduling/logging framework without introducing new infrastructure. [Source: docs/architecture.md:5,145]

## Scope

- **In Scope:** Build the Google Sheets serial audit worker, expose dry-run + live execution surfaces, and persist audit telemetry into `sync_events` so downstream teams can act on data-quality issues immediately. [Source: docs/tech-spec-epic-1.md:30-77]
- **Out of Scope:** Serial migration (EP1.2), sync + API changes (EP1.3), and dynamic column propagation (Epic 2) remain separate stories and must not be implemented here beyond feeding them required telemetry. [Source: docs/epics.md:48-74]

## Structure Alignment Summary

- This is the first story under Epic 1, so no previous Dev Agent Record exists to import learnings from; the sprint-status backlog order confirms there is no drafted predecessor to reference. [Source: docs/sprint-status.yaml:38]
- The architecture blueprint expects sync-related workers under `workers/sync/` plus shared utilities in `lib/` and API entrypoints in `app/api/sync/*`, so the audit logic should live alongside these modules to respect the documented project tree. [Source: docs/architecture.md:82-152]
- Unified project structure highlights Mongo models in `models/Device.ts` and shared schemas in `schemas/device.ts`; any new audit reports or metadata should reference these paths to keep future stories aligned. [Source: docs/architecture.md:145-152]

## Story

As an operations engineer,
I want the sync job to verify that every row in the `Devices` sheet includes a valid `serial`,
so that we never ingest ambiguous device records that would break the dashboard magic. [Source: docs/epics.md:38]

## Acceptance Criteria

1. Script fetches the sheet header plus rows and logs any rows missing `serial`. [Source: docs/epics.md:44]
2. Missing-serial rows are excluded from ingest and surfaced in the job report with row indices and metadata for remediation. [Source: docs/epics.md:45]
3. Dry-run mode is supported so operations can fix sheet data before triggering a live sync. [Source: docs/epics.md:46]
4. Audit output feeds structured counts (rows audited, skipped, missing serial) into `sync_events` so downstream telemetry captures the health state. [Source: docs/tech-spec-epic-1.md:30]

## Tasks / Subtasks

- [x] Integrate Google Sheets audit worker (AC: 1,2)
  - [x] Extend `lib/google-sheets.ts` helpers to expose header + row metadata and add retry/backoff logic for audit-only pulls. [Source: docs/architecture.md:145]
  - [x] Implement `workers/sync/audit.ts` to fetch rows, assert non-empty serials, and emit structured log entries per violation (row index, sheet values). [Source: docs/tech-spec-epic-1.md:32]
- [x] Ship dry-run execution surface (AC: 3)
  - [x] Add `/api/sync/audit` endpoint or Cloud Task flag so ops can trigger the audit without writes; returns summary counts and missing-row details. [Source: docs/epics.md:46]
  - [x] Update sprint runbook with steps to run dry-run versus live audit, including access control requirements. [Source: docs/architecture.md:145]
- [x] Persist audit metrics and guard ingest path (AC: 2,4)
  - [x] Ensure main `/api/sync/run` path invokes audit first; if missing serial rows exist, short-circuit ingest and publish report to governance logs. [Source: docs/epics.md:45]
- [x] Write `sync_events` entries capturing `rowsAudited`, `missingSerialCount`, and `skippedRows` array so observability dashboards reflect data-quality status. [Source: docs/tech-spec-epic-1.md:30,77]

## Dependencies & Integrations

- Google Sheets API v4 via `googleapis` client plus service-account credentials already configured for the sync worker; reuse existing auth plumbing to fetch headers/rows. [Source: docs/architecture.md:145]
- Cloud Scheduler → Cloud Tasks pipeline using `@google-cloud/tasks` v6.2.1 orchestrates both audit dry-runs and live sync jobs. [Source: docs/architecture.md:19]
- MongoDB Atlas + Mongoose (driver v6.10.0 / ODM v8.6.0) remain authoritative storage for synced results and `sync_events` audit records. [Source: docs/architecture.md:20]
- Next.js API routes and React Query clients consume the API envelope; any audit endpoints must emit `{ data, meta, error }` responses so downstream tooling can parse them uniformly. [Source: docs/tech-spec-epic-1.md:34]

## Dev Notes

- Cloud Scheduler → Cloud Tasks → `/api/sync/run` remains the orchestration pattern; integrate the audit module as a preflight within that route to avoid new cron services. [Source: docs/architecture.md:5,53]
- Data access should keep using the existing `lib/google-sheets.ts` abstractions and Secret Manager credentials—avoid duplicating Google API auth or hardcoding spreadsheet IDs. [Source: docs/architecture.md:145]
- Audit output must log via the shared Pino logger (`lib/logging.ts`) and persist to `models/SyncEvent.ts` so observability dashboards capture missing-serial counts automatically. [Source: docs/tech-spec-epic-1.md:33,77]
- Treat dry-run mode as a Cloud Task flag; ensure the API envelope communicates missing rows without marking sync as failed so operators can remediate quickly. [Source: docs/architecture.md:46]
- Testing: add Jest unit tests for the audit validator and Playwright integration to cover dry-run endpoint plus UI surfacing of missing-serial warnings. [Source: docs/tech-spec-epic-1.md:97-121]
- Performance/NFRs: keep the ≤60-second sheet→dashboard freshness window and reuse Pino logging + Cloud Tasks retries for reliability; ensure audit does not block the SLA by running within the same Task execution budget. [Source: docs/architecture.md:60-79]
- Security: respect NextAuth/Secret Manager configuration—no new secrets or scopes, and restrict audit endpoints to service accounts documented in architecture. [Source: docs/architecture.md:170-210]

### Project Structure Notes

- Place the audit worker under `workers/sync/audit.ts` with shared types in `schemas/device.ts` so future stories (migration, dynamic columns) can reuse the metadata. [Source: docs/architecture.md:82-152]
- Update `lib/api-envelope.ts` if new API responses carry audit summaries to keep the response contract centralized. [Source: docs/tech-spec-epic-1.md:34]
- Ensure new files adopt the repo’s TypeScript + Next.js conventions (PascalCase components, camelCase hooks) documented in Architecture decisions; no new folders unless required. [Source: docs/architecture.md:90-118]

### References

- docs/PRD.md:134 (FR-001 Serial Canonicalization)
- docs/epics.md:38-47 (Story EP1.1 user story and ACs)
- docs/tech-spec-epic-1.md:30-103 (Epic design, services, ACs, traceability)
- docs/architecture.md:5-152 (Sync orchestration, project structure, API patterns)

## Traceability

| AC | Source Sections | Components / APIs | Test Coverage |
| --- | --- | --- | --- |
| 1 | docs/epics.md:44; docs/tech-spec-epic-1.md:32 | `lib/google-sheets.ts`, `workers/sync/audit.ts` | Jest audit validator tests + integration dry-run | 
| 2 | docs/epics.md:45; docs/tech-spec-epic-1.md:33 | `/api/sync/run`, `lib/logging.ts`, `models/SyncEvent.ts` | Integration test verifying ingest short-circuit & log contents |
| 3 | docs/epics.md:46; docs/tech-spec-epic-1.md:51 | `/api/sync/audit` or Cloud Task flag, CLI scripts | Playwright/API test ensuring dry-run returns counts and no writes |
| 4 | docs/tech-spec-epic-1.md:77; docs/architecture.md:151 | `models/SyncEvent.ts`, dashboards/reporting pipeline | Unit tests for event persistence + log-based metrics assertion |

## Risks / Assumptions / Questions

- **Risk:** Operations may ignore audit warnings and trigger sync anyway; mitigate by halting ingest when missing serial rows exist and emitting Slack/email alerts from `sync_events`. [Source: docs/tech-spec-epic-1.md:108]
- **Assumption:** Google Sheets remains the single source with a stable `serial` column name; dynamic columns do not rename or remove `serial`. [Source: docs/PRD.md:150]
- **Open Question:** Conflict resolution policy (“latest sheet edit wins” vs deterministic ordering) still awaiting PM call; audit should log duplicates but defer to epic-wide resolution once defined. [Source: docs/tech-spec-epic-1.md:113]

## Test Strategy

- **Unit:** Validate header/row parsing, missing-serial detection, and `sync_events` serialization using Jest in `workers/sync/__tests__/audit.test.ts`. [Source: docs/tech-spec-epic-1.md:118]
- **Integration:** Playwright/API tests execute dry-run endpoint, confirm HTTP 200 with counts, and ensure ingest short-circuits when missing rows exist. [Source: docs/tech-spec-epic-1.md:97]
- **Observability:** Add log-based metric assertions verifying `missingSerialCount > 0` raises warning severity in dashboards per architecture observability rules. [Source: docs/architecture.md:151]

## Dev Agent Record

### Context Reference

- docs/stories/1-1-audit-sheet-serial-integrity.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

1. Implementation plan for Integrate Google Sheets audit worker (AC1-AC4):
   - Extend `src/lib/google-sheets.ts` to expose audit-friendly metadata hooks (headers + row indexes) and hardened retry/backoff defaults so the new worker can safely pull empty rows.
   - Build `src/workers/sync/audit.ts` that reuses the shared fetcher to compute missing-serial findings, log row indices + sheet metadata, and persist telemetry (`rowsAudited`, `missingSerialCount`, `skippedRows`) to `sync_events`.
   - Wire the audit summary into `/api/sync/run` to short-circuit ingest when findings exist, create a `/api/sync/audit` dry-run surface returning the structured report, and document dry-run vs live usage in `docs/runbook/sync-operations.md`.

### Completion Notes List

1. Implemented the serial audit pipeline (AC1-AC4): extended `src/lib/google-sheets.ts` with metadata + retry hooks, created `src/workers/sync/audit.ts`, short-circuited `/api/sync/run` when missing serials, surfaced dry-run telemetry via `/api/sync/audit`, and documented ops flow in `docs/runbook/sync-operations.md`.
2. Validation: `npm test` (Vitest) passes for unit suites; MongoMemoryServer-based integration rollback suite continues to skip in this sandbox because the in-memory server cannot bind to 0.0.0.0 (EPERM).

### File List

- docs/runbook/sync-operations.md
- docs/sprint-status.yaml
- docs/stories/1-1-audit-sheet-serial-integrity.md
- nyu-device-roster/src/app/api/sync/audit/route.ts
- nyu-device-roster/src/lib/errors/app-error.ts
- nyu-device-roster/src/lib/google-sheets.ts
- nyu-device-roster/src/models/SyncEvent.ts
- nyu-device-roster/src/workers/sync/audit.ts
- nyu-device-roster/src/workers/sync/index.ts
- nyu-device-roster/tests/unit/app/api/sync/audit/route.test.ts
- nyu-device-roster/tests/unit/lib/google-sheets.test.ts
- nyu-device-roster/tests/unit/workers/sync/audit.test.ts
- nyu-device-roster/tests/unit/workers/sync/index.test.ts

## Change Log

- Draft created on 2025-11-19 via *create-story workflow (new file).
- Story context generated and validated on 2025-11-19; status moved to ready-for-dev.
