# Story 4.1: audit-api-and-dashboard-panel

Status: review

## Story

As a lead manager,
I want to review recent sync runs and anonymization toggles via an audit API and dashboard panel,
so that I can confirm governance controls function properly.

## Acceptance Criteria

1. `/api/audit` returns the last 20 events with actor, action, timestamp, status, and error code (if any) (docs/epics.md:276-284).
2. Dashboard panel surfaces audit feed with filters for event type (sync, anonymization, allowlist change) (docs/epics.md:276-284).
3. Events persist in `audit_logs` collection with TTL disabled to retain through the demo (docs/epics.md:276-284).

## Tasks / Subtasks

- [x] Define audit schema and persistence (AC: 1,3)
  - [x] Create/confirm `audit_logs` collection schema covering actor, action, timestamp, status, errorCode, and context.
  - [x] Ensure TTL is disabled; add indexes for timestamp and event type.
- [x] Implement `/api/audit` endpoint (AC: 1)
  - [x] Return last 20 events sorted by timestamp; support filters for event type.
  - [x] Include actor, action, status, errorCode in response envelope; log access for governance.
- [x] Dashboard audit panel (AC: 2)
  - [x] Add UI panel with filters for sync, anonymization, allowlist change; show status badges and timestamps.
  - [x] Wire panel to `/api/audit` with React Query caching and empty/error states.
- [x] Testing & telemetry
  - [x] Add unit/integration tests for API endpoint and UI panel filtering.
  - [x] Log audit fetch and panel interactions via existing logging/telemetry hooks.

## Dev Notes

- Prerequisites: Stories A3 and B3 for auth/session and sync event generation (docs/epics.md:276-284).
- Keep retention by disabling TTL on `audit_logs`; align with governance expectations.
- Reuse standardized API envelope and logging utilities for consistent error handling (docs/architecture.md:145-199).
- Ensure audit UI follows accessibility and performance targets: WCAG AA, sub-200 ms interaction, and screen reader labels (docs/PRD.md:148-214).

### References

- docs/epics.md:276-284
- docs/PRD.md:148-214
- docs/architecture.md:145-199

## Dev Agent Record

### Context Reference

- docs/stories/4-1-audit-api-and-dashboard-panel.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-17T15:37Z — Generated story context XML capturing audit API and dashboard requirements, documentation links, and code/dependency references.
- 2025-11-17T16:34Z — Ran context validation against checklist; one partial (docs count below 5) noted in validation report.
- 2025-11-18T15:25Z — Added audit_logs model with indexes, multi-sink audit log writer, and `/api/audit` filterable feed covering sync, anonymization, and allowlist changes.
- 2025-11-18T15:25Z — Implemented dashboard audit panel with React Query caching, filter toggles, telemetry hooks, and updated device audit timeline to the new feed.
- 2025-11-18T15:39Z — Hardened audit UI/button focus handling, grid scroll guards, and test environments; all Vitest suites now pass (warnings only).

### Completion Notes List

- Status updated to ready-for-dev with context reference recorded for governance traceability.
- Implemented AC1-AC3 with persisted audit logs, filterable API response, dashboard panel UX, and unit coverage; regression suite passing after focus/scroll hardening.
- Stabilized audit action focus return, DeviceGrid scroll guard, and SyncStatusBanner toast accessibility; Vitest suites passing.
- Added audit log mocks for sync cadence/inflight skips to prevent test timeouts; npm test now passes.

### File List

- docs/stories/4-1-audit-api-and-dashboard-panel.md
- docs/sprint-status.yaml
- nyu-device-roster/src/models/AuditLog.ts
- nyu-device-roster/src/lib/audit/auditLogs.ts
- nyu-device-roster/src/lib/audit/syncEvents.ts
- nyu-device-roster/src/lib/audit/deviceDrawerEvents.ts
- nyu-device-roster/src/workers/sync/index.ts
- nyu-device-roster/src/app/api/sync/manual/route.ts
- nyu-device-roster/src/app/api/sync/run/route.ts
- nyu-device-roster/src/app/api/audit/route.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/src/app/(manager)/devices/components/AuditTimeline.tsx
- nyu-device-roster/src/app/(manager)/dashboard/components/AuditPanel.tsx
- nyu-device-roster/src/app/(manager)/dashboard/page.tsx
- nyu-device-roster/src/app/(manager)/components/IconActionButton.tsx
- nyu-device-roster/src/app/(manager)/components/ResponsiveShell.tsx
- nyu-device-roster/src/app/(manager)/components/SyncStatusBanner.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGrid.tsx
- nyu-device-roster/tests/unit/app/api/audit/route.test.ts
- nyu-device-roster/tests/unit/app/api/sync/run/route.test.ts
- nyu-device-roster/tests/unit/app/dashboard/audit-panel.client.test.tsx
- nyu-device-roster/tests/unit/app/responsive-shell.client.test.tsx
- nyu-device-roster/tests/unit/app/manager/sync-status-banner.errors.test.tsx
- nyu-device-roster/tests/unit/app/manager/devices/device-grid.empty-states.test.tsx
- nyu-device-roster/tests/unit/workers/sync/index.test.ts

### Change Log

- Added audit_logs persistence layer with indexed schema and sync-event pipeline integration; introduced filterable `/api/audit` feed returning actor/action/status/errorCode for the latest 20 events.
- Built dashboard audit panel with filters, badges, and cached React Query fetches against the new API; refreshed device audit timeline to the updated response shape.
- Added unit coverage for audit API filtering and audit panel interaction telemetry; resolved prior device-grid/responsive-shell test gaps.
- Hardened audit button focus restoration, DeviceGrid scroll guard, and SyncStatusBanner toast semantics; all Vitest suites now passing (warnings only).
- Added audit log mocks for cron cadence/inflight skip flows to stop sync regression timeouts; full Vitest run passing.
