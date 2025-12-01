# Story 3.3: Provide Recovery & Dry-Run Mode

Status: review
Story Key: 3-3-provide-recovery-and-dry-run-mode
Story ID: 3.3 (Epic 3 – Sync Observability & Guardrails)

## Requirements Context

- **Epic objective:** Epic 3 demands a dry-run/safe-mode control so ops can reproduce sync jobs without mutating MongoDB while still reporting would-be mutations; acceptance criteria require a CLI flag or API parameter, parity with column detection/conflict logging, and clear operator guidance. [Source: docs/epics.md]
- **Business mandate:** PRD requirements FR-005 and FR-006 elevate observability and guardrails so the "sheet equals dashboard" expectation never regresses, making proactive dry-run tooling mandatory for stakeholder trust. [Source: docs/PRD.md]
- **System constraints:** Cloud Scheduler → Cloud Tasks → `/api/sync/run` must remain the orchestration backbone, with execution living in `workers/sync`, telemetry via `lib/logging.ts`, and audit trails inside `sync_events`; safe-mode logic cannot bypass structured logging or retries. [Source: docs/architecture.md][Source: docs/source-tree-analysis.md]
- **Operational hooks:** The sync operations runbook outlines serial audits, SyncStatus banner states, and incident reporting tied to reference IDs, so dry-run outputs must still write `sync_events`, surface `SyncStatus` payloads, and document how to toggle runtime flags without pausing cron. [Source: docs/runbook/sync-operations.md]
- **Data dependencies:** Device mutations and telemetry live in `devices`, `sync_events`, `sync_locks`, and future column registries; dry-run mode must avoid committing document updates while persisting diff metrics and requested actions for observability. [Source: docs/data-models.md]
- **Current context:** Story 3-2 is only ready-for-dev and has no Dev Agent Record learnings yet, so this is effectively the first implementation increment for Epic 3 guardrails; upstream sprint-status confirms 3-3 is the next backlog story. [Source: docs/stories/3-2-detect-and-alert-on-schema-changes.md][Source: docs/sprint-status.yaml]

## Structure Alignment Summary

1. Story 3-3 is the first implementation entry within Epic 3, so there are no prior Dev Agent learnings to reuse; treat the sprint-status ordering as authoritative and note that earlier telemetry stories are awaiting development. [Source: docs/sprint-status.yaml]
2. Dry-run execution must stay inside the existing worker surfaces: `workers/sync/index.ts`, `workers/sync/transform.ts`, and helper modules `lib/logging.ts`, `lib/sync-status.ts`, `lib/audit/syncEvents.ts` so the pipeline preserves Cloud Tasks orchestration, locking, and telemetry semantics. [Source: docs/source-tree-analysis.md][Source: docs/architecture.md]
3. The Next.js API routes (`app/api/sync/run`, `/manual`) remain the entry points for scheduled and manual syncs; safe-mode toggles should flow through these endpoints and reuse the shared request envelope plus audit logging. [Source: docs/architecture.md]
4. Observability outputs must continue to flow through `sync_events`, the SyncStatus banner, and structured Pino logs, referencing runbook guidance for status codes, reference IDs, and operator instructions. [Source: docs/runbook/sync-operations.md]

## Story

As an engineer on call,
I want to trigger a dry-run/safe-mode sync that reports would-be mutations without touching MongoDB,
so that I can troubleshoot suspicious sheet changes without risking production data drift.

## Acceptance Criteria

1. Dry-run flag available via CLI and `/api/sync/run`/`/manual` requests enforces safe-mode execution that skips MongoDB writes yet produces the full sync summary (rows added/updated/skipped, serial audit metrics) plus `sync_events` telemetry for every run. [Source: docs/epics.md][Source: docs/runbook/sync-operations.md]
2. Dry-run execution still runs schema/serial audits, header diffing, conflict logging, and SyncStatus banner updates so operators see the same guardrail signals as production runs, with payloads clearly marked `mode: dry-run`. [Source: docs/epics.md][Source: docs/architecture.md]
3. Ops documentation and runbook updates explain how to toggle dry-run vs production (flags, config values, Scheduler guidance) and outline incident steps, ensuring on-call responders can roll forward/back without pausing cron. [Source: docs/runbook/sync-operations.md]
4. Alert + audit outputs (Slack/email, SyncStatus, `sync_events`, Dev Agent Record template) include reference IDs and remediation links per FR-005/FR-006 so observability remains consistent and incidents stay traceable. [Source: docs/PRD.md][Source: docs/architecture.md]

## Tasks / Subtasks

- [x] **Task 1: Add dry-run flag handling to worker + APIs (AC1)**
  - [x] Subtask 1.1: Extend `/app/api/sync/run` and `/manual` routes plus Cloud Tasks payloads to accept `mode=dry-run`, plumb flag through request envelope, and persist to `sync_events`. [Tests: npm run test]
  - [x] Subtask 1.2: Update `workers/sync/index.ts` + persistence helpers so dry-run branches log diffs and metrics but skip Mongo transactions, returning structured results to callers. [Tests: npm run test]
- [x] **Task 2: Preserve telemetry + guardrails in safe mode (AC2, AC4)**
  - [x] Subtask 2.1: Ensure serial audit, header diffing, conflict detection, and SyncStatus banner updates execute identically in dry-run while tagging payloads `mode=dry-run`; keep Slack/email dispatch and `sync_events` entries aligned. [Tests: npm run test]
  - [x] Subtask 2.2: Add structured logging + alert metadata (referenceId, remediation link) to dry-run summaries so monitoring channels stay actionable. [Tests: npm run test]
- [x] **Task 3: Document operator workflow (AC3)**
  - [x] Subtask 3.1: Update `docs/runbook/sync-operations.md` with dry-run flag instructions, Scheduler header guidance, and incident flowchart for switching modes. [Tests: documentation review]
  - [x] Subtask 3.2: Add Dev Notes checklist snippet referencing dry-run usage and expectations for future stories. [Tests: documentation review]

## Dev Notes

- Cloud Scheduler → Cloud Tasks → `/api/sync/run` remains the execution spine; dry-run flag must propagate through these layers without bypassing existing auth headers or retry semantics. [Source: docs/architecture.md]
- Worker logic confined to `workers/sync/index.ts` and helpers (`transform.ts`, `lib/logging.ts`, `lib/audit/syncEvents.ts`); apply safe-mode decisions at the persistence boundary so upstream fetch/diff logic stays identical. [Source: docs/source-tree-analysis.md]
- Observability stack (`sync_events`, Pino logs, SyncStatus, Slack/email alerts) must continue emitting FR-005/FR-006 metrics; mark mode explicitly and attach reference IDs per runbook requirements. [Source: docs/runbook/sync-operations.md][Source: docs/PRD.md]
- No previous story learnings exist for Epic 3; treat this as foundational guardrail work and document new patterns in Dev Agent Record for downstream stories. [Source: docs/sprint-status.yaml]
- Testing: cover CLI/API handlers plus worker branches via existing npm test suites; leverage dry-run unit cases to assert no Mongo writes occur while telemetry still records counts. [Source: docs/development-guide.md]

### Project Structure Notes

- Keep dry-run orchestration inside existing directories: API routes under `app/api/sync/*`, worker code under `workers/sync/`, telemetry helpers in `lib/`, and documentation updates in `docs/runbook/`. [Source: docs/source-tree-analysis.md]
- Ensure new CLI or script flags align with current `scripts/*.ts` conventions and reuse shared logging + config loaders to avoid duplicating entry points. [Source: docs/development-guide.md]

### References

- docs/epics.md#epic-3-sync-observability-guardrails
- docs/PRD.md (FR-005, FR-006)
- docs/architecture.md (Sync pipeline, observability, Cloud Tasks)
- docs/source-tree-analysis.md (module locations)
- docs/runbook/sync-operations.md (operations guidance)
- docs/development-guide.md (testing + scripts)
- docs/sprint-status.yaml (story ordering)


## Dev Agent Record

### Context Reference

- docs/stories/3-3-provide-recovery-and-dry-run-mode.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-12-01: Enabled dry-run flag across scheduler/manual sync routes, worker pipeline, metrics, and SyncStatus; dry-run skips device/column writes while emitting full telemetry and schema alerts with suppression metadata.

### Completion Notes List

- 2025-12-01: Implemented dry-run/safe-mode plumbing (API headers/body + env), worker persistence bypass with telemetry intact, SyncStatus mode flagging, metrics schemaChange exposure, and runbook instructions. Tests: `npm run test`.

### File List

- `docs/sprint-status.yaml`
- `docs/runbook/sync-operations.md`
- `nyu-device-roster/src/app/api/sync/run/route.ts`
- `nyu-device-roster/src/app/api/sync/manual/route.ts`
- `nyu-device-roster/src/workers/sync/index.ts`
- `nyu-device-roster/src/workers/sync/header-map.ts`
- `nyu-device-roster/src/lib/sync-status.ts`
- `nyu-device-roster/src/lib/metrics/syncAggregations.ts`
- `nyu-device-roster/tests/unit/app/api/sync/run/route.test.ts`
- `nyu-device-roster/tests/unit/app/api/sync/manual/route.test.ts`
- `nyu-device-roster/tests/unit/workers/sync/index.test.ts`
## Change Log

- Initial draft generated via *create-story
