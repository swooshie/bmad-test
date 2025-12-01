# Story 3.11: error-empty-and-edge-state-blueprint

Status: review

## Story

As a developer,
I want reusable patterns for empty states, no-results, and sync errors,
so that the dashboard never leaves admissions managers confused.

## Acceptance Criteria

1. Provide first-use empty state with illustration and CTA for connecting the Google Sheet; include no-results message that surfaces active filters and a clear reset action. [Source: docs/epics.md#Story-[C11]:-Error,-empty,-and-edge-state-blueprint]
2. Implement inline error banners and toasts wired to sync/anonymization failure codes, with retry CTA and logged audit context; expose `role="alert"` and focus management to the error source. [Source: docs/epics.md#Story-[C11]:-Error,-empty,-and-edge-state-blueprint][Source: docs/ux-design-specification.md#Notification-Patterns]
3. Ensure accessibility and governance resilience: alert patterns meet WCAG contrast, maintain sub-200 ms interaction targets, and preserve 60-second sheet→UI freshness expectations; destructive flows expose undo chips where applicable. [Source: docs/PRD.md#Product-Scope][Source: docs/architecture.md#Performance-Considerations][Source: docs/ux-design-specification.md#UX-Pattern-Decisions]

## Tasks / Subtasks

- [x] Empty and no-results states (AC: 1)
  - [x] Add empty-state component with illustration + CTA to connect the Google Sheet; render when no data or first-use. [Source: docs/epics.md#Story-[C11]:-Error,-empty,-and-edge-state-blueprint]
  - [x] Show no-results message that surfaces active filters and provides a clear reset/expand scope action. [Source: docs/ux-design-specification.md#Empty-States]
- [x] Error states and recovery (AC: 2)
  - [x] Wire inline error banner and toast patterns to sync/anonymization failure codes with retry CTA and audit logging hook. [Source: docs/epics.md#Story-[C11]:-Error,-empty,-and-edge-state-blueprint]
  - [x] Implement focus management to return users to the errored control and expose `role="alert"` for screen readers. [Source: docs/ux-design-specification.md#Accessibility]
  - [x] Add unit/integration tests covering error banner visibility and retry behavior for sync/anonymize endpoints. [Source: docs/architecture.md#Testing-Layout]
- [x] Accessibility, performance, and undo flows (AC: 3)
  - [x] Verify WCAG AA contrast for alert states and ensure interactions remain under 200 ms with instrumentation hooks. [Source: docs/PRD.md#Success-Criteria][Source: docs/architecture.md#Performance-Considerations]
  - [x] Provide undo chip for destructive actions (where applicable) and ensure state logs to audit trail. [Source: docs/ux-design-specification.md#UX-Pattern-Decisions]
  - [x] Add tests for alert `role="alert"`, focus order, and undo chip behavior across breakpoints. [Source: docs/architecture.md#Testing-Layout]

## Dev Notes

### Requirements Context Summary

- Epic C11 targets reusable UI patterns for first-use empty state, no-results feedback, and sync/anonymization error handling, building on Epic C grid and governance work (prereqs C1–C3).
- Non-functional expectations: keep interactions under 200 ms and maintain 60-second sheet→UI freshness; errors should preserve trust via clear retry guidance and logged audit context.
- Architecture guardrails: Next.js App Router with React Query data layer, API envelope + `AppError` structured errors, and Pino logging for audit-friendly traces.
- UX direction: icon-first controls with inline alerts/toasts, undo chips for destructive flows, and accessibility via `role="alert"`, focus management, and WCAG AA contrast for status banners.
- Previous story status: 3-10 is drafted, so no carryover learnings yet; treat this as the first completed story in the chain.

### Project Structure Notes

- Integrate empty/error components within the existing dashboard feature folder (`app/(manager)/dashboard`) alongside grid and audit spine elements to reuse state providers. [Source: docs/architecture.md#Project-Structure]
- Reuse React Query caches and API envelope utilities to avoid duplicating data loaders or error handling wrappers. [Source: docs/architecture.md#Implementation-Patterns]

### Learnings from Previous Story

- From Story 3-10 (Status: ready-for-dev)
  - Responsive behavior and reduced-motion handling are already established for dashboard overlays; preserve the same focus return patterns for error overlays and undo chips. [Source: stories/3-10-responsive-adaptation-bottom-dock-navigation.md]
  - React Query cache reuse was emphasized to prevent redundant fetches; apply identical cache keys for error/empty states to keep grid state consistent after recoveries. [Source: stories/3-10-responsive-adaptation-bottom-dock-navigation.md]

### References

- [Source: docs/epics.md#Story-[C11]:-Error,-empty,-and-edge-state-blueprint]
- [Source: docs/PRD.md#Product-Scope]
- [Source: docs/architecture.md#Architecture]
- [Source: docs/ux-design-specification.md#UX-Pattern-Decisions]

## Dev Agent Record

### Context Reference

- docs/stories/3-11-error-empty-and-edge-state-blueprint.context.xml

### Agent Model Used

Amelia (Dev Implementation)

### Debug Log References

- Planned coverage per AC: empty/no-results UI with CTA/reset, sync/anonymization alert patterns with focus/ARIA, and undo/performance instrumentation.
- Built empty and no-results panels inside device grid, surfacing active filters and reset CTA plus manual refresh CTA for first-use onboarding.
- Added sync/anonymization alert focus management, retry CTAs, toast + metrics logging, and performance tracking for sync interactions.
- Implemented undo chip flow for filter clears with restore + metrics hooks; ensured alerts expose `role="alert"` and focus guidance.

### Completion Notes List

- Implemented empty, no-results, and error/undo patterns per ACs with passing unit tests and instrumentation aligned to 200 ms targets.

### File List

- docs/sprint-status.yaml
- docs/stories/3-11-error-empty-and-edge-state-blueprint.md
- nyu-device-roster/src/lib/use-sync-status.ts
- nyu-device-roster/src/app/(manager)/components/SyncStatusBanner.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGrid.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGridShell.tsx
- nyu-device-roster/tests/unit/app/manager/devices/device-grid.empty-states.test.tsx
- nyu-device-roster/tests/unit/app/manager/devices/device-grid-shell.undo.test.tsx
- nyu-device-roster/tests/unit/app/manager/sync-status-banner.errors.test.tsx

## Change Log

- Implemented Story 3.11 empty/error/edge states with CTA/reset flows, alert focus/undo patterns, and coverage tests; updated status to review.
