# Story 2.5: Resilient error handling and rollback safeguards

Status: drafted

## Story

As a demo operator, I want the sync pipeline to surface friendly, actionable failures while protecting the last-known-good dataset so the admissions roster never breaks during a live walkthrough—even if Google Sheets or MongoDB encounters issues.

### Requirements & Context Summary

- Epic B5 calls for clear error messaging when sync fails, preservation of the previous dataset, stack-trace logging, and tooling to reset MongoDB to a baseline snapshot for quick recovery. (docs/epics.md:133-140)
- PRD FR-012 mandates descriptive error banners with retry guidance, retention of last-known-good data, and governance-ready logging whenever `/api/sync` or `/internal/sync` encounters Sheets/API/secret failures. (docs/PRD.md:160-190)
- Architecture already defines structured logging via `lib/logging.ts`, `sync_events` audit entries, and AppError envelopes for API routes—this story must extend those patterns with consistent error codes, rollback hooks, and monitoring signals. (docs/architecture.md:210-267)
- Previous stories (B1–B4) implemented fetch, transform, manual refresh, and scheduled sync flows; this story wraps those capabilities with defensive guards, fallback data handling, and operator tooling. (docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md, docs/stories/2-4-schedule-automated-ingest-via-app-engine-cron.md)

## Acceptance Criteria

1. Sync pipeline detects failures at each stage (Sheets fetch, transform/upsert, audit persistence) and emits consistent AppError codes (`SHEET_NOT_FOUND`, `SYNC_TIMEOUT`, `MONGO_WRITE_FAILED`, etc.) surfaced to `/api/sync` responses and status banner/tooling. [Source: docs/epics.md:133-140, docs/PRD.md:160-190, docs/architecture.md:210-254]
2. When a failure occurs, the system retains the last successful dataset in MongoDB (no partial writes) and updates the UI status banner to show an actionable message referencing the error code plus next steps. [Source: docs/epics.md:133-140, docs/PRD.md:160-190]
3. Each failed run writes a `sync_events` entry capturing error code, stack trace reference/log pointer, runId, anonymization state, and remediation hints so governance dashboards display accurate history. [Source: docs/architecture.md:227-254]
4. Provide an operator-facing rollback/reset mechanism (script or API) that can restore MongoDB `devices` to a baseline snapshot, along with documentation describing invocation, guardrails, and audit logging. [Source: docs/epics.md:133-140]
5. Extend observability: log-based metrics/alerts fire when failures exceed threshold or specific error codes repeat, and `docs/runbook/sync-operations.md` gains troubleshooting steps for each scenario. [Source: docs/architecture.md:227-254, docs/PRD.md:160-190]
6. Automated tests simulate failure modes (Sheets auth, transform validation, Mongo write) confirming: error codes bubble to API responses, last-known-good data remains, audit entries/logs persist, and rollback tooling functions. [Source: docs/architecture.md:101-105]

## Tasks / Subtasks

- [ ] Define centralized error taxonomy in `errors/AppError` (or new enum) mapping pipeline failures to FR-012-friendly codes/messages. (AC: 1)
  - [ ] Update `/api/sync/manual` and `/api/sync/run` to translate thrown errors into the new envelope sections consumed by status banner + governance logs. (AC: 1-2)
- [ ] Implement transactional/rollback guard in `workers/sync`:
  - [ ] Stage updates (e.g., temp collection, transactions, or two-phase commit) so partial writes never leak; on failure, abort and preserve last-known-good `devices`. (AC: 2)
  - [ ] Emit status banner payload (via cache or API) describing failure + guidance. (AC: 2)
- [ ] Extend `sync_events` schema/logging to capture `errorCode`, `stackTraceRef`, `recommendation`, `triggerType`, and anonymization snapshot. (AC: 3)
- [ ] Create rollback/reset utility (CLI script under `scripts/reset-sync.ts` or admin endpoint) that restores baseline dataset from snapshot (file or fixture) with audit log entry. Document usage in runbook. (AC: 4)
- [ ] Add monitoring hooks: log-based metrics/alerts for repeated failures, Slack/email stub documentation, and runbook troubleshooting table. (AC: 5)
- [ ] Testing: add unit/integration tests covering failure propagation, dataset preservation, audit logging, and rollback tool behavior (including negative tests). (AC: 6)

## Dev Notes

### Learnings from Previous Stories

- Story 2.4 introduced schedule gating and overlap handling. This story must reuse the same `sync_events` schema and logging fields (`triggerType`, `runId`, counts) while layering error metadata to keep dashboards consistent. (docs/stories/2-4-schedule-automated-ingest-via-app-engine-cron.md#Implementation-Alignment)
- Story 2.3 ensured manual runs broadcast optimistic status. Failure messaging from this story has to feed into that same status channel so manual and scheduled modes share identical error narratives. (docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md#Implementation-Alignment)
- Stories 2.1–2.2 established `lib/google-sheets.ts` and `workers/sync/transform.ts`; error handling should never duplicate logic there—wrap the shared pipeline with try/catch instrumentation instead. (docs/stories/2-2-normalize-and-upsert-devices-into-mongodb.md#Implementation-Alignment)

### Implementation Alignment

- Extend `lib/logging.ts` helpers to include `errorCode`, `stackTraceRef`, and `recommendation` fields; ensure logs stay JSON structured for Cloud Logging metrics. (docs/architecture.md:227-254)
- Use Mongo transactions (if cluster tier permits) or fallback to copy-on-write: write to temp collection, swap on success; document whichever approach is chosen. (docs/architecture.md:233-254)
- Rollback utility should leverage existing seeding scripts (e.g., `scripts/seed-allowlist.ts`) pattern for CLI ergonomics; ensure it references Secret Manager or `.env` config for Mongo connection string.
- Update `docs/runbook/sync-operations.md` with a troubleshooting matrix mapping error codes → symptoms → recovery steps (manual retry, toggle anonymization, run rollback script).
- Consider adding `status` field in status banner API (e.g., `syncStatus.latestFailure`) so UI can display last error details without parsing logs.

### Project Structure Notes

- Potential file updates: `errors/AppError.ts`, `lib/logging.ts`, `workers/sync/index.ts`, `workers/sync/transform.ts`, `models/SyncEvent.ts`, `scripts/reset-sync.ts` (new), `docs/runbook/sync-operations.md`, `tests/integration/sync.spec.ts`, `tests/unit/lib/logging.test.ts`.
- Document new env vars (e.g., baseline snapshot path) in `nyu-device-roster/.env.example`.
- Ensure rollback artifacts (baseline JSON/CSV) live under `data/` or `docs/` per repo conventions; update `_cfg` manifests if new docs are introduced.

### Testing & Observability

- Unit tests: verify AppError mapping, logging helpers, rollback script input validation.
- Integration tests: simulate Sheets failure, Mongo write error, and ensure dataset remains unchanged + audit entries generated with codes.
- Observability: add log-based metrics `sync_failure_rate`, `sync_failure_codes`, and optional Slack alert doc; capture screenshot/gif evidence for PR if possible.

### References

- [Source: docs/epics.md:133-140]
- [Source: docs/PRD.md:160-190]
- [Source: docs/architecture.md:210-267]
- [Source: docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md]
- [Source: docs/stories/2-4-schedule-automated-ingest-via-app-engine-cron.md]
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
