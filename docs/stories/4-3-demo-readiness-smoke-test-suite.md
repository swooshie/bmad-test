# Story 4.3: demo-readiness-smoke-test-suite

Status: review

## Story

As a release manager,
I want a scripted smoke test validating OAuth, ingest, and UI endpoints,
so that I can certify readiness before each presentation.

## Acceptance Criteria

1. Script exercises login (mock), triggers manual sync, fetches grid data, and verifies anonymization toggle. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
2. Output summarises pass/fail with timestamps and highlights blocking issues. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
3. Document how to run the script locally and via CI (optional) with expected runtime < 5 minutes. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]

## Tasks / Subtasks

- [x] Build smoke test script (AC: 1)
  - [x] Exercise mocked login flow, trigger `/api/sync/manual`, fetch grid data, and toggle anonymization; capture runId/requestId for correlation. [Source: docs/architecture.md#API-Contracts]
  - [x] Seed fixtures or stubs so tests run without external Secrets Manager dependencies. [Source: docs/architecture.md#Development-Environment]
- [x] Results and reporting (AC: 2)
  - [x] Emit structured summary (pass/fail, timestamps, blocking issues) to stdout and optional JSON artifact. [Source: docs/architecture.md#Observability-&-Audit-Trail]
  - [x] Include audit log entry for smoke test invocation with operator identity. [Source: docs/architecture.md#Observability-&-Audit-Trail]
- [x] CI/local execution docs (AC: 3)
  - [x] Document local and CI invocation with env vars, expected runtime (<5 minutes), and failure triage steps. [Source: docs/PRD.md#Functional-Requirements]
  - [x] Provide CI job stub or npm script wrapper for reuse. [Source: docs/architecture.md#Testing-Layout]
- [x] Testing & safeguards
  - [x] Add unit/integration coverage for smoke test helpers and anonymization toggle checks. [Source: docs/architecture.md#Testing-Layout]
  - [x] Validate cooldown/cleanup to avoid impacting production data; reuse fixtures from sync tests. [Source: docs/stories/4-2-telemetry-and-sync-health-summaries.md]

## Dev Notes

- Prerequisites: Stories A2–A3, B3, C2, C4 supply auth, sync, grid, and anonymization flows needed for the smoke path. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
- Reuse standardized API envelope and Pino logging; record audit entries for each smoke test step to keep governance traceability. [Source: docs/architecture.md#Implementation-Patterns]
- Keep runtime under 5 minutes by mocking login and using minimal dataset; prefer cached fixtures and short-lived Mongo connections. [Source: docs/architecture.md#Performance-Considerations]
- Ensure anonymization toggle respects allowlist/auth; align with FR-009 and FR-010 expectations for governance cues. [Source: docs/PRD.md#Functional-Requirements]

### Learnings from Previous Story

- **From Story 4-2 (Status: ready-for-dev)** — Telemetry patterns capture sync metrics and audit logging for metrics access; reuse those logging hooks and requestIds to annotate smoke test runs. [Source: stories/4-2-telemetry-and-sync-health-summaries.md]

### Project Structure Notes

- Place smoke script under `scripts/` with tsx runner; integration harness under `tests/integration` with fixtures in `tests/fixtures`. [Source: docs/architecture.md#Testing-Layout]
- API routes live under `app/api/*`; leverage existing sync/manual endpoint and anonymize route for smoke coverage. [Source: docs/architecture.md#Project-Structure]
- Keep logging/tests aligned with Pino + Vitest/Playwright stacks already configured. [Source: docs/architecture.md#Testing-Layout]

### References

- docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails
- docs/PRD.md#Functional-Requirements
- docs/architecture.md#API-Contracts
- docs/architecture.md#Testing-Layout
- docs/architecture.md#Performance-Considerations
- stories/4-2-telemetry-and-sync-health-summaries.md

## Dev Agent Record

### Context Reference

- docs/stories/4-3-demo-readiness-smoke-test-suite.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-17T16:39Z — Generated story context XML and validated against checklist (all checks passed).
- 2025-11-18T16:24Z — Added smoke test harness with mock login, manual sync, grid fetch, anonymization toggle, and audit logging using in-memory Mongo.

### Completion Notes List

- Smoke test script (`npm run smoke`) exercises mocked login, manual sync via worker override rows, grid fetch, anonymization toggle, and emits structured summary + optional JSON output.
- In-memory Mongo fallback wires to sync/anonymization audit hooks; telemetry logs include requestId/operator for governance.
- Integration covers smoke run success path; configured sprint status/story status updated to review.

### How to Run

- Local: `npm run smoke -- --operator your.email@example.com --json artifacts/smoke.json` (runtime < 5 minutes; uses in-memory Mongo via MONGODB_URI fallback).
- CI: add a job step running the same command in test mode; artifacts can capture the JSON output for dashboards or gating.

### File List

- docs/sprint-status.yaml
- nyu-device-roster/package.json
- nyu-device-roster/scripts/smoke.ts
- nyu-device-roster/tests/integration/smoke.test.ts
