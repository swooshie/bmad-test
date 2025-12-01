# Story 4.4: rollback-and-data-snapshot-utilities

Status: review

## Story

As a reliability engineer,
I want to reseed MongoDB with baseline anonymized data,
so that the demo recovers quickly after rehearsals.

## Acceptance Criteria

1. Provide script that loads snapshot JSON and restores `devices`, `config`, and `audit_logs` collections. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
2. Successful restore logs audit event with `reset=true` flag and operator identity. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
3. Document how to capture new snapshots after successful demo runs. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]

## Tasks / Subtasks

- [x] Build rollback/snapshot utility (AC: 1)
  - [x] Implement script to load baseline snapshot JSON and restore `devices`, `config`, and `audit_logs` with idempotent upserts. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
  - [x] Ensure anonymization fields and indexes are preserved; verify TTL is disabled where required. [Source: docs/architecture.md#Data-Architecture]
- [x] Audit logging and safety (AC: 2)
  - [x] Emit audit event with `reset=true` and operator identity; include counts per collection and duration. [Source: docs/architecture.md#Observability-&-Audit-Trail]
  - [x] Add confirmation/guardrails to prevent accidental production restores; enforce allowlist/auth. [Source: docs/PRD.md#Security]
- [x] Snapshot capture guidance (AC: 3)
  - [x] Document steps to capture new snapshots post-demo, including export paths and secrets handling. [Source: docs/architecture.md#Development-Environment]
  - [x] Provide checksum/size notes to validate snapshot integrity. [Source: docs/architecture.md#Performance-Considerations]
- [x] Testing & verification
  - [x] Add tests for rollback script using fixtures to ensure collections restore correctly and audit events log. [Source: docs/architecture.md#Testing-Layout]
  - [x] Validate retries/backoff on Mongo operations and confirm no data loss on failure. [Source: docs/stories/2-5-resilient-error-handling-and-rollback-safeguards.md]

## Dev Notes

- Prerequisites: Stories B2 and B5 provide sync ingest and rollback safeguards; align with their schema and error-handling patterns. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
- Reuse existing `sync_events`/audit logging and Pino pipeline; capture reset events with requestId/operator for governance. [Source: docs/architecture.md#Observability-&-Audit-Trail]
- Store snapshots in repo-friendly location (e.g., `nyu-device-roster/data/`) and avoid committing secrets; use Secret Manager for Mongo URI. [Source: docs/architecture.md#Security-Architecture]
- Optimize restore for App Engine limits: stream inserts, avoid full collection drops where possible, and index after bulk load. [Source: docs/architecture.md#Performance-Considerations]

### Learnings from Previous Story

- **From Story 4-3 (Status: ready-for-dev)** — Smoke test patterns cover login/sync/anonymization flows with audit logging; reuse runId/requestId correlation and fixture isolation when restoring snapshots. [Source: stories/4-3-demo-readiness-smoke-test-suite.md]

### Project Structure Notes

- Place rollback script under `scripts/` using tsx; fixtures under `data/` and tests under `tests/unit` or `tests/integration` as appropriate. [Source: docs/architecture.md#Testing-Layout]
- Keep API contracts consistent if exposing an endpoint; otherwise document CLI usage and env vars in runbook. [Source: docs/architecture.md#API-Contracts]
- Maintain logging/test patterns with Pino + Vitest/Playwright stacks. [Source: docs/architecture.md#Testing-Layout]

### References

- docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails
- docs/PRD.md#Security
- docs/architecture.md#Observability-&-Audit-Trail
- docs/architecture.md#Performance-Considerations
- docs/stories/2-5-resilient-error-handling-and-rollback-safeguards.md
- stories/4-3-demo-readiness-smoke-test-suite.md

## Dev Agent Record

### Context Reference

- docs/stories/4-4-rollback-and-data-snapshot-utilities.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-17T16:39Z — Generated story context XML and validated against checklist (all checks passed).
- 2025-11-18T16:36Z — Added rollback utility with snapshot restore, audit logging, and tests using in-memory Mongo snapshot fixture.

### Completion Notes List

- Snapshot restore script (`npm run snapshot:restore -- --confirm --operator you@example.com --snapshot data/snapshots/baseline.json --json artifacts/rollback.json`) performs idempotent upserts for devices/config/audit logs, logs reset=true audit event, and supports explicit confirm/operator guards.
- In-memory Mongo fallback ensures Secret Manager independence during tests; audit/logging capture requestId/operator for governance.
- Added integration coverage verifying restore counts and audit context; sprint/story statuses updated to review.

### How to Run

- Restore: `npm run snapshot:restore -- --confirm --operator you@example.com --snapshot data/snapshots/baseline.json --json artifacts/rollback.json` (set `MONGODB_URI` or Secret Manager path). Requires `RESET_CONFIRM=yes` or `--confirm`.
- Capture new snapshot: export `devices`, `config`, `audit_logs` to JSON and save under `data/snapshots/`; record checksum/size alongside the file. Use existing Pino logs/requestIds for traceability.

### File List

- docs/sprint-status.yaml
- nyu-device-roster/package.json
- nyu-device-roster/scripts/rollback.ts
- nyu-device-roster/data/snapshots/baseline.json
- nyu-device-roster/tests/integration/rollback.test.ts
