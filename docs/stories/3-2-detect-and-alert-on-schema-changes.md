# Story 3.2: Detect and Alert on Schema Changes

Status: review

Story Key: 3-2-detect-and-alert-on-schema-changes

## Requirements Context

- **Problem signal:** Epic 3.2 requires the sync worker to compare every run’s header snapshot to the previous run and surface Slack/email notifications when columns are added, removed, or renamed so downstream owners can coordinate updates before dashboards drift. [Source: docs/epics.md]
- **Business mandate:** PRD requirements FR-005 and FR-006 elevate observability and schema-change guardrails as the growth/vision pillars that preserve the “sheet equals dashboard” promise, making proactive alerts non-negotiable for stakeholder trust. [Source: docs/PRD.md]
- **System constraints:** Architecture guidance binds schema detection to the existing Cloud Scheduler → Cloud Tasks → `/api/sync/run` pipeline, Pino structured logging, and SyncStatus surfaces, so new detection logic must live alongside `workers/sync`, `lib/logging.ts`, and alert plumbing already wired into Cloud Logging and monitoring policies. [Source: docs/architecture.md]
- **Operations hooks:** The sync operations runbook outlines cron controls, manual override gates, and run-level error codes that alerts must reference, ensuring Slack/email payloads link back to documented remediation steps for operators. [Source: docs/runbook/sync-operations.md]
- **Telemetry storage:** `sync_events` and `devices` schemas already capture trigger metadata, counts, and column registry updates; schema-change detection must leverage these collections for historical comparison without diverging from the canonical audit trail. [Source: docs/data-models.md]

**Story Statement:** As an operations lead, I want the sync job to detect Google Sheet schema changes and push actionable alerts with links to recovery documentation so I can align downstream consumers before data contracts break. [Source: docs/epics.md]

## Structure Alignment Summary

1. Story 3.1 is marked ready-for-dev but implementation has not run yet, so no Dev Agent learnings exist to reuse; treat this story as the first executable telemetry increment in Epic 3. [Source: docs/sprint-status.yaml]
2. Schema-change detection must extend `workers/sync/` and reuse `lib/logging.ts` plus `lib/audit/*` so Cloud Tasks orchestration, SyncStatus banners, and log-based metrics remain consistent with Story 3.1 patterns. [Source: docs/architecture.md][Source: docs/source-tree-analysis.md]
3. Alerts must flow through the existing observability stack (Pino → Cloud Logging metrics → SyncStatus banner + `/api/metrics`) while persisting records in `sync_events` for downstream analytics; do not introduce parallel channels. [Source: docs/architecture.md][Source: docs/runbook/sync-operations.md]
4. Unified project structure demands telemetry code stays in `workers/sync`, API glue in `app/api/sync/*`, and runbook updates inside `docs/runbook/` to keep governance documentation in lockstep. [Source: docs/source-tree-analysis.md][Source: docs/development-guide.md]

## Story

As an operations lead,
I want the sync job to detect schema changes and broadcast actionable alerts,
So that downstream consumers can update integrations before column drift breaks their automations.

## Acceptance Criteria

1. Every sync run MUST diff its current header snapshot against the previous run and persist the structured results (added, removed, renamed columns) to `sync_events` plus Pino logs before concluding the task. [Source: docs/epics.md][Source: docs/runbook/sync-operations.md]
2. When schema diffs exist and automation is active, send Slack/email alerts within the same run containing runId, change summary, and a remediation link to the sync operations runbook; capture alert metadata alongside the diff. [Source: docs/epics.md][Source: docs/runbook/sync-operations.md]
3. SyncStatus banner and `/api/metrics` must flip to a schema-change warning state showing the latest delta summary until a subsequent clean run clears the condition. [Source: docs/architecture.md]
4. Manual overrides (paused sync, dry-run mode) suppress duplicate alert deliveries but MUST continue logging schema diffs so operators see a complete audit trail via `sync_events` or metrics exports. [Source: docs/runbook/sync-operations.md]

## Tasks / Subtasks

- [x] **Task 1: Diff headers and persist schema snapshots for each run (AC1)**
  - [x] Subtask 1.1: Extend `workers/sync/index.ts` (and supporting helpers) to load the prior header registry from `sync_events`/`column_definitions`, compute added/removed/renamed arrays, and store the latest snapshot. [Tests: npm run test]
  - [x] Subtask 1.2: Write schema diff metadata into `sync_events` records plus structured logs (`event=SCHEMA_CHANGE_DETECTED`) so downstream analytics and dashboards can query the change history. [Tests: npm run test]
- [x] **Task 2: Trigger alerts and SyncStatus warnings when schema changes occur (AC2, AC3)**
  - [x] Subtask 2.1: Update the alert dispatcher (Slack/email hook) to send runId, before/after column lists, and remediation links for any non-zero diff, ensuring delivery completes within the same sync run. [Tests: manual verification]
  - [x] Subtask 2.2: Enhance `lib/sync-status.ts` plus `/app/api/metrics/route.ts` so schema-change events push banner warning state + delta payload to the UI without additional API calls. [Tests: npm run test]
- [x] **Task 3: Respect manual overrides and dry-run mode while logging changes (AC4)**
  - [x] Subtask 3.1: Detect paused-sync or dry-run flags and suppress duplicate alert deliveries while still persisting schema-change records to `sync_events` for auditability. [Tests: npm run test]
  - [x] Subtask 3.2: Document override behavior, log codes, and remediation steps inside `docs/runbook/sync-operations.md` so operators know how alerts behave during pauses. [Tests: documentation review]

## Dev Notes

- Ownership: Extend `workers/sync/index.ts` and `workers/sync/transform.ts` to capture header snapshots, store them in `sync_events`, and compute diffs without loading entire spreadsheets into memory.
- Observability: Use existing Pino logging conventions (`event=SCHEMA_CHANGE_DETECTED`, `{ added, removed, renamed }`) and emit SyncStatus updates via `lib/sync-status.ts` so UI + monitoring stay aligned.
- Alert routes: Reuse the existing Slack/email webhooks configured for telemetry alerts; payload must include `runId`, trigger source, before/after headers, and remediation link (sync operations runbook section 4).
- API/metrics: Update `/app/api/metrics/route.ts` to expose schema-delta metadata and ensure UI stores surface the warning state until a clean run clears it.
- Ops coordination: Document alert codes and manual override behaviors in `docs/runbook/sync-operations.md`, referencing new log entries (e.g., `SCHEMA_ALERT_SUPPRESSED`) for paused or dry-run states.

### Project Structure Notes

- Worker logic: `nyu-device-roster/workers/sync/index.ts` orchestrates Sheets diffs, while `workers/sync/transform.ts` already normalizes headers—extend these files rather than creating new services.
- Telemetry helpers: `lib/logging.ts`, `lib/audit/syncEvents.ts`, and `lib/sync-status.ts` own logging + banner projections; update them to surface schema change payloads.
- API exposure: `/app/api/sync/run` and `/app/api/metrics/route.ts` should remain the only HTTP touchpoints for telemetry; update these routes to include schema delta metadata when returning statuses.
- Documentation: Capture new alert behavior and operator steps within `docs/runbook/sync-operations.md` so the ops team can trace remediation playbooks.

### References

- docs/epics.md#epic-3-sync-observability-guardrails
- docs/PRD.md (FR-005, FR-006)
- docs/architecture.md (observability, logging, sync pipeline)
- docs/runbook/sync-operations.md (alerts, cron controls, error codes)
- docs/data-models.md (sync_events schema)
- docs/source-tree-analysis.md (worker + telemetry module locations)

## Dev Agent Record

### Context Reference

- docs/stories/3-2-detect-and-alert-on-schema-changes.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-12-01: Added schema diff persistence, webhook dispatch (with suppression for dry-run/paused modes), SyncStatus warning state, metrics schemaChange payload, and runbook guidance (AC1-AC4).

### Completion Notes List

- 2025-12-01: Implemented schema change detection (added/removed/renamed), alert dispatch with suppression, SyncStatus banner warning, metrics schemaChange exposure, and ops documentation. Tests: `npm run test`.

### File List

- `docs/sprint-status.yaml`
- `docs/runbook/sync-operations.md`
- `nyu-device-roster/src/workers/sync/header-map.ts`
- `nyu-device-roster/src/workers/sync/index.ts`
- `nyu-device-roster/src/lib/metrics/syncAggregations.ts`
- `nyu-device-roster/src/app/api/metrics/route.ts`
- `nyu-device-roster/src/app/api/sync/run/route.ts`
- `nyu-device-roster/src/app/api/sync/manual/route.ts`
- `nyu-device-roster/src/lib/sync-status.ts`
- `nyu-device-roster/tests/unit/workers/sync/index.test.ts`

## Change Log

- Draft created on 2025-11-26 via *create-story workflow.
- Context generated on 2025-11-26 via *story-context workflow.
- 2025-12-01: Added schema diff persistence/alerts, SyncStatus + metrics warnings, and runbook guidance for suppression/overrides.
