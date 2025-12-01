# Story 4.2: telemetry-and-sync-health-summaries

Status: review

## Story

As a demo operator,
I want telemetry on sync duration, row counts, and failure trends,
so that I can address issues before stakeholders notice.

## Acceptance Criteria

1. Collect metrics for manual vs scheduled sync (durationMs, rowsProcessed, success/failure). [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
2. Expose `/api/metrics` endpoint returning aggregates for last 12 hours and cumulative totals. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
3. Add optional webhook integration placeholder (Slack/email) for future alerting with configuration notes. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]

## Tasks / Subtasks

- [x] Instrument sync telemetry (AC: 1)
  - [x] Capture durationMs, rowsProcessed, success/failure for manual vs scheduled runs; persist alongside existing sync event identifiers. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
  - [x] Add indices/rollups needed for recent vs cumulative aggregations without slowing sync. [Source: docs/architecture.md#Data-Architecture]
- [x] Implement `/api/metrics` endpoint (AC: 2)
  - [x] Return aggregates for last 12 hours and cumulative totals using existing response envelope and Pino logging. [Source: docs/architecture.md#Technology-Stack-Details]
  - [x] Enforce manager/lead access and record audit/log entries for every metrics fetch. [Source: docs/PRD.md#Functional-Requirements]
- [x] Webhook placeholder and ops notes (AC: 3)
  - [x] Add optional Slack/email webhook scaffold with configuration notes and feature flag defaulting off. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
  - [x] Document retry/backoff expectations and monitoring hooks for webhook delivery. [Source: docs/architecture.md#Observability-&-Audit-Trail]
- [x] Testing & dashboards
  - [x] Add unit/integration tests for metrics aggregation and access control; include fixtures for manual vs scheduled runs. [Source: docs/architecture.md#Testing-Layout]
  - [x] Provide dashboard/query examples (Cloud Logging metrics) and empty/error states for metrics consumers. [Source: docs/architecture.md#Observability-&-Audit-Trail]

## Dev Notes

- Prerequisite: Story B3 (sync pipeline) must be available to source sync events for telemetry. [Source: docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails]
- Reuse existing `sync_events` persistence and Pino logging; keep API response envelope consistent across `/api/*`. [Source: docs/architecture.md#Implementation-Patterns]
- Metrics endpoint should align with FR-010 audit/telemetry expectations and honor manager authentication/allowlist. [Source: docs/PRD.md#Functional-Requirements]
- Optimize aggregations for App Engine + MongoDB: prefer indexed time-window queries and avoid long-running pipelines. [Source: docs/architecture.md#Performance-Considerations]

### Learnings from Previous Story

- **From Story 4-1 (Status: ready-for-dev)** — Audit API groundwork provides logging patterns and governance UI expectations; preserve TTL-disabled audit retention and reuse the standardized envelope for telemetry responses. [Source: stories/4-1-audit-api-and-dashboard-panel.md]

### Project Structure Notes

- API endpoints live under `app/api/*` with Next.js App Router; keep metrics route colocated with sync APIs for shared middleware. [Source: docs/architecture.md#Project-Structure]
- Logging and metrics rely on Pino → Cloud Logging; maintain JSON structure with requestId/userEmail for correlation. [Source: docs/architecture.md#Observability-&-Audit-Trail]
- Tests are colocated (`*.test.tsx` for unit, `tests/integration` for broader flows); add fixtures under `tests/fixtures` for metrics payloads. [Source: docs/architecture.md#Testing-Layout]

### References

- docs/epics.md#Epic-D-–-Governance-&-Observability-Guardrails
- docs/PRD.md#Functional-Requirements
- docs/architecture.md#Observability-&-Audit-Trail
- docs/architecture.md#Performance-Considerations
- stories/4-1-audit-api-and-dashboard-panel.md

## Dev Agent Record

### Context Reference

- docs/stories/4-2-telemetry-and-sync-health-summaries.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

2025-11-17T16:39Z — Generated story context XML and validated against checklist (all checks passed).

### Completion Notes List

- Added role-gated `/api/metrics` GET aggregates for last 12 hours and cumulative windows with standardized envelopes and audit logging.
- Captured sync telemetry rollups via indexed sync_events (trigger/status/createdAt) to support fast time-window queries.
- Added webhook scaffold/config notes (TELEMETRY_WEBHOOK_*) surfaced in metrics response; default disabled.
- Added unit coverage for metrics aggregation/auth and updated sprint status to in-progress → review after passing Vitest.

### File List

- docs/sprint-status.yaml
- nyu-device-roster/src/app/api/metrics/route.ts
- nyu-device-roster/src/models/SyncEvent.ts
- nyu-device-roster/tests/unit/app/api/metrics/route.test.ts
