# Requirements Context Summary

- **Governance signal mandate:** Epic C3 requires surfacing devices flagged for offboarding or poor condition directly in the grid so managers can plan handoffs mid-demo; cues must include row badges and filter chips (docs/epics.md:190-196).  
- **PRD traceability:** FR-011 specifies the UI has to highlight `offboardingStatus` and allow filtering these devices, ensuring governance cues are visible alongside inventory data (docs/PRD.md:181-182).  
- **System dependencies:** Story C3 builds on C2’s performant grid foundation and B2’s normalization pipeline so offboarding fields are already in MongoDB and can be visualized without re-fetching Sheets (docs/epics.md:193, docs/architecture.md:127-149).  
- **Architecture anchors:** Feature-first structure keeps governance cues inside `app/(manager)/devices` with potential helpers in `app/(manager)/governance`; data flows through React Query hooks backed by `/api/devices` filters (docs/architecture.md:62-149,259).  
- **Export/audit alignment:** Governance indicators must persist into exports/downloads and structured logs so the audit panel and future Epic D workflows read consistent signals (docs/epics.md:195, docs/PRD.md:151-156, docs/architecture.md:127-195).  

**Story statement:**  
As an NYU admissions manager, I want devices with offboarding flags or poor condition surfaced with clear governance cues so I can plan demo handoffs without leaving the grid (docs/epics.md:190-196, docs/PRD.md:181).

## Structure Alignment Summary

- **Previous story learnings:** Story 3-2 is still `drafted`, so there are no Dev Agent completion notes yet; document all governance-specific patterns introduced here for later reference (docs/stories/3-2-spreadsheet-grid-with-performant-sort-filter.md).  
- **Folder placement:** Extend existing grid components under `app/(manager)/devices`, adding cue-specific components (e.g., `GovernanceBadge.tsx`, `OffboardingFilters.tsx`) while reusing shared hooks; avoid creating a parallel feature root (docs/architecture.md:62-149).  
- **Hook reuse:** Build on the pagination/filter plumbing from C2 (`useDeviceGrid`) by adding query params for `offboardingStatus` and `condition`, preserving React Query cache keys for consistent performance (docs/architecture.md:127-149).  
- **API & schema touchpoints:** Ensure `/api/devices` exposes normalized offboarding fields coming from Mongo schemas (`models/Device.ts`, `schemas/device.ts`) and that exports reuse the same data transformations so cues persist (docs/architecture.md:127-205,259).  
- **Audit/export integration:** When cues trigger (badges, filter chips, export annotations), log events via shared logging utilities and ensure CSV/PDF exports include governance columns to satisfy FR-011 transparency (docs/PRD.md:151-182, docs/architecture.md:167-195).  

## Acceptance Criteria

1. Grid rows with `offboardingStatus` or condition “Poor/Needs Repair” display governance badges plus filter chips so managers can isolate them instantly (docs/epics.md:193-196, docs/PRD.md:181-182).  
2. Hover/tooltip on governance badges summarizes last transfer notes or offboarding metadata pulled from Mongo so managers understand context without leaving the grid (docs/epics.md:193-195, docs/PRD.md:151-182).  
3. Export/download flows (CSV or PDF) preserve governance cues, ensuring flagged devices remain labeled outside the UI and audit logs capture export events with cue metadata (docs/epics.md:195, docs/PRD.md:151-182, docs/architecture.md:167-195).  

## Tasks / Subtasks

- [x] Governance badge rendering (AC: 1)  
  - [x] Extend `useDeviceGrid` response typing to include `offboardingStatus`, `condition`, and derived severity; wire to row badge component (docs/architecture.md:127-205).  
  - [x] Implement filter chips for `offboardingStatus` and condition states, persisting selections via React Query key + URL params (docs/epics.md:193-196, docs/architecture.md:148-149).  
- [x] Contextual tooltips (AC: 2)  
  - [x] Fetch `lastTransferNotes`/`offboardingMetadata` fields and display via accessible tooltip (Radix HoverCard) with keyboard trigger support (docs/PRD.md:151-178).  
  - [x] Ensure tooltips fall back gracefully when metadata absent while still logging governance cues triggered (docs/architecture.md:167-195).  
- [x] Export & audit alignment (AC: 3)  
  - [x] Update export pipeline (CSV/PDF) to annotate rows with governance state columns/badges matching UI semantics (docs/epics.md:195, docs/architecture.md:127-195).  
  - [x] Emit structured audit log entry when exports include flagged devices, capturing counts by offboarding status for governance review (docs/PRD.md:151-182, docs/architecture.md:167-195).  
- [x] Testing & documentation  
  - [x] Add component tests covering badge states, tooltip content, and filter chip behavior; add integration test verifying export includes governance columns (docs/architecture.md:200-205).  
  - [x] Document governance cue patterns in Dev Notes plus update story references for reuse in C4+ (docs/architecture.md:62-149).  

# Story 3.3: governance-cues-for-offboarding-workflows

Status: review
_Status updated to review on 2025-11-15 after AC validation._

## Story

As an NYU admissions manager,
I want devices flagged for offboarding or degraded condition highlighted with governance cues,
so that I can prioritize demo handoffs without leaving the dashboard grid.

## Acceptance Criteria

1. Grid rows with `offboardingStatus` or condition “Poor/Needs Repair” display governance badges plus filter chips so managers can isolate them instantly (docs/epics.md:193-196, docs/PRD.md:181-182).  
2. Hover/tooltip on governance badges summarizes last transfer notes or offboarding metadata pulled from Mongo so managers understand context without leaving the grid (docs/epics.md:193-195, docs/PRD.md:151-182).  
3. Export/download flows (CSV or PDF) preserve governance cues, ensuring flagged devices remain labeled outside the UI and audit logs capture export events with cue metadata (docs/epics.md:195, docs/PRD.md:151-182, docs/architecture.md:167-195).  

## Tasks / Subtasks

- [x] Governance badge rendering (AC: 1)  
  - [x] Extend `useDeviceGrid` response typing to include `offboardingStatus`, `condition`, and derived severity; wire to row badge component (docs/architecture.md:127-205).  
  - [x] Implement filter chips for `offboardingStatus` and condition states, persisting selections via React Query key + URL params (docs/epics.md:193-196, docs/architecture.md:148-149).  
- [x] Contextual tooltips (AC: 2)  
  - [x] Fetch `lastTransferNotes`/`offboardingMetadata` fields and display via accessible tooltip (Radix HoverCard) with keyboard trigger support (docs/PRD.md:151-178).  
  - [x] Ensure tooltips fall back gracefully when metadata absent while still logging governance cues triggered (docs/architecture.md:167-195).  
- [x] Export & audit alignment (AC: 3)  
  - [x] Update export pipeline (CSV/PDF) to annotate rows with governance state columns/badges matching UI semantics (docs/epics.md:195, docs/architecture.md:127-195).  
  - [x] Emit structured audit log entry when exports include flagged devices, capturing counts by offboarding status for governance review (docs/PRD.md:151-182, docs/architecture.md:167-195).  
- [x] Testing & documentation  
  - [x] Add component tests covering badge states, tooltip content, and filter chip behavior; add integration test verifying export includes governance columns (docs/architecture.md:200-205).  
  - [x] Document governance cue patterns in Dev Notes plus update story references for reuse in C4+ (docs/architecture.md:62-149).  

## Dev Notes

- **Data plumbing:** Extend `app/(manager)/devices/hooks/useDeviceGrid.ts` to request `offboardingStatus`, `lastTransferNotes`, and `conditionSeverity` fields and to accept filter params (status, condition) while preserving cached queries (docs/architecture.md:127-149).  
- **Governance badge components:** Co-locate cue components under `app/(manager)/devices/components/GovernanceBadge.tsx` with variants for `offboardingStatus` vs. condition degrade; tokens pull from UX design spec for consistent colors (docs/architecture.md:62-149, docs/PRD.md:151-178).  
- **Tooltip content:** Use Radix HoverCard/Tooltip with focusable trigger so keyboard users can open cues; include last transfer actor, timestamp, and notes sourced from Mongo documents (docs/PRD.md:151-182).  
- **Export alignment:** Update export service in `app/(manager)/devices/actions.ts` (or equivalent) so generated CSV/PDF adds `governanceBadge`, `offboardingStatus`, and `condition` columns; log exports via `lib/logging.ts` with counts (docs/architecture.md:167-195).  
- **Audit & logging:** Every filter activation or export with flagged devices should emit Pino logs containing requestId, userEmail, counts per status to support governance dashboards (docs/architecture.md:167-195).  
- **Testing:** Add component tests for badges/tooltips plus integration test covering filter chip + export pipeline; ensure snapshots capture exported columns for regression safety (docs/architecture.md:200-205).  

### Project Structure Notes

- Keep governance cue UI under `app/(manager)/devices` to preserve feature cohesion; share state helpers via `lib/hooks/useGridPreferences.ts`.  
- Device schema updates belong in `models/Device.ts`/`schemas/device.ts`; keep naming aligned with Mongo conventions (docs/architecture.md:100-188).  
- Export helpers or logging utilities affecting multiple stories should move into `lib/` for reuse by governance banner and audit task stories.  

### References

- docs/epics.md:190-196  
- docs/PRD.md:151-182  
- docs/architecture.md:62-205  

## Dev Agent Record

### Context Reference

- `docs/stories/3-3-governance-cues-for-offboarding-workflows.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-15 · T1/T1a planning — Confirmed governance data gaps. Will (1) extend Device model/schema + normalization to carry `offboardingMetadata`, `lastTransferNotes`, and derived `governanceSeverity`, (2) update `useDeviceGrid` + `DeviceRow` to pass enriched rows into a new `GovernanceBadge` component, (3) add inline offboarding/condition filter chips above the grid that map to the same React Query filters for instant isolation.
- 2025-11-15 · Implemented AC1-AC2 — Added `lib/governance/cues.ts`, enriched `/api/devices` payloads, rendered badges + tooltips with fetch-on-hover details, wired `Dashboard` CTA plus inline chips, and verified styling stays within Story C2 grid tokens.
- 2025-11-15 · Implemented AC3 & validation — Built `/api/devices/export` with CSV/PDF renderers, `ExportControls` client, structured audit logging (`GOVERNANCE_EXPORT`), and governance runbook doc; vitest suite extended with badge + export coverage (npm test).

### Completion Notes List

- AC1: Grid rows now include severity badges, alternating row accents, and quick chips so risky devices stand out without extra navigation.
- AC2: Hover/focus on a badge fetches Mongo metadata via `/api/devices/{id}`, exposing actor, timestamp, and notes inside an accessible tooltip.
- AC3: Export controls call `/api/devices/export` (CSV/PDF) with governance columns and trigger `GOVERNANCE_EXPORT` events whenever flagged devices leave the UI; docs/governance-banner-runbook.md documents the workflow.

### File List

- docs/governance-banner-runbook.md
- docs/stories/3-3-governance-cues-for-offboarding-workflows.md
- nyu-device-roster/src/lib/governance/cues.ts
- nyu-device-roster/src/models/Device.ts
- nyu-device-roster/src/models/SyncEvent.ts
- nyu-device-roster/src/schemas/device.ts
- nyu-device-roster/src/workers/sync/transform.ts
- nyu-device-roster/src/lib/audit/syncEvents.ts
- nyu-device-roster/src/app/api/devices/device-query-service.ts
- nyu-device-roster/src/app/api/devices/[deviceId]/route.ts
- nyu-device-roster/src/app/api/devices/export/route.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/src/app/(manager)/components/GovernanceBadge.tsx
- nyu-device-roster/src/app/(manager)/components/GovernanceBadgeTooltip.tsx
- nyu-device-roster/src/app/(manager)/components/ExportControls.tsx
- nyu-device-roster/src/app/(manager)/devices/components/GovernanceFilterChips.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceRow.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGridShell.tsx
- nyu-device-roster/src/app/(manager)/devices/page.tsx
- nyu-device-roster/src/app/(manager)/dashboard/page.tsx
- nyu-device-roster/tests/unit/app/manager/devices/device-grid.accessibility.test.tsx
- nyu-device-roster/tests/unit/app/governance-badge.test.tsx
- nyu-device-roster/tests/unit/app/api/devices/export.test.ts

### Change Log

- Added governance data pipeline + UI: badges, tooltips, chips, dashboard CTA, and supporting schema/helpers so AC1–AC2 are satisfied end-to-end.
- Delivered export/audit workflow with CSV & PDF generation, `GOVERNANCE_EXPORT` audit events, new runbook documentation, and regression tests covering badges + exports (AC3).
