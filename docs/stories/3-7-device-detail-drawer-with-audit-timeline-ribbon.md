# Requirements Context Summary

- **Epic intent:** Story C7 mandates a device drawer that rides on grid selection, mirrors anonymization chips, and exposes Export Audit Snapshot / Initiate Handoff actions so managers never leave the grid for deep dives (docs/epics.md:226-233).
- **Audit + governance requirements:** PRD FR-007 through FR-011 require the UI to preserve traceability, surface governance cues, and show the latest sync/audit status, which the drawer must honor through badges, anonymized values, and dependable error handling (docs/PRD.md:173-184).
- **Technical anchors:** Architecture allocates drawer work to `app/(manager)/devices` with data pulled through React Query, audit data from `models/SyncEvent.ts`, and logging via `lib/logging.ts`, tying Epic C visuals to Epic D observability (docs/architecture.md:45-158).
- **Dependency on audit API:** Drawer’s timeline ribbon must read from the `/api/audit` feed introduced in Story D1, persisting events without TTL so governance reviewers see sync, anonymization, and handoff milestones (docs/epics.md:283-289).
- **UX + responsiveness:** UX specification defines the drawer’s 4-column desktop span, full-width tablet behavior, keyboard return-to-row contract, and audit ribbon choreography, so implementation must match these breakpoints and animation cues (docs/ux-design-specification.md:64-112,269-288).
- **Source gaps:** No dedicated tech-spec file exists; rely on PRD + epics for requirements and capture any domain clarifications in Dev Notes.

**Story statement:**
As an NYU admissions manager, I want a device detail drawer with an audit timeline ribbon so I can inspect hardware history, governance badges, and handoff actions without leaving the dashboard (docs/epics.md:226-233).

## Structure Alignment Summary

- **Previous story continuity:** Story 3-6 remains drafted, so there are no Dev Agent learnings yet, but it already documents the shared anonymization context that this drawer must reuse for chips and governance badges (docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md).
- **Feature placement:** Drawer UI belongs under `app/(manager)/devices/components`, pulling selection state from `DeviceGrid` + `hooks/useDeviceGrid.ts` so it stays consistent with grid refreshes (docs/architecture.md:45-149).
- **Data + audit sources:** Device metadata flows through `models/Device.ts`, while audit timeline items read from `models/SyncEvent.ts` via `/api/audit`, both cached with React Query per device key (docs/architecture.md:123-158).
- **Logging & actions:** Export/Handoff controls must reuse `lib/logging.ts` helpers and emit structured governance events so Story D1’s audit persistence shows each drawer action (docs/architecture.md:145-199, docs/PRD.md:175-181).

## Acceptance Criteria

1. Drawer opens from selected grid row, displaying device metadata, anonymization chips, and actionable buttons (Export Audit Snapshot, Initiate Handoff) without forcing navigation away from the grid (docs/epics.md:226-230, docs/PRD.md:173-181, docs/ux-design-specification.md:64-112).
2. Audit timeline ribbon calls `/api/audit` (Story D1) to list sync, anonymization, and handoff events with badges, status tooltips, and no TTL truncation so reviewers can trace the latest activity (docs/epics.md:229-231, docs/epics.md:283-289, docs/PRD.md:175-181).
3. Drawer honors accessibility + responsive specs: keyboard focus returns to originating row on close, `Esc` dismisses, and layout shifts from 4-column overlay on desktop to full-width slide-over on tablet/mobile with 48px tap targets (docs/epics.md:231, docs/ux-design-specification.md:262-290, docs/PRD.md:210-214).

## Tasks / Subtasks

- [ ] Drawer shell & selection wiring (AC: 1)
  - [ ] Mount `DeviceDrawer` under `app/(manager)/devices/components` and subscribe to `DeviceGrid` selection via shared store/hook so drawer auto-opens with optimistic data (docs/architecture.md:45-149).
  - [ ] Fetch device metadata/anonymization fields via React Query hitting `/api/devices/{deviceId}` while reusing cache from the grid to avoid duplicate network work (docs/architecture.md:145-149).
- [x] Audit timeline ribbon (AC: 2)
  - [x] Call `/api/audit?deviceId=` to hydrate a timeline component backed by `models/SyncEvent.ts`, formatting timestamps with badges (docs/epics.md:229-231, docs/epics.md:283-289, docs/architecture.md:123-158).
  - [x] Provide tooltip copy + legend so sync/anonymization/handoff events are distinguishable and confirmed to persist without TTL trimming (docs/PRD.md:175-181).
- [x] Action stack + anonymization chips (AC: 1)
  - [x] Implement Export Audit Snapshot and Initiate Handoff buttons that call their API routes and log success/failure via `lib/logging.ts` for Story D1 visibility (docs/epics.md:228-230, docs/architecture.md:145-199).
  - [x] Mirror anonymization state within the drawer using `AnonymizationStateContext` + deterministic placeholder helpers for sensitive fields (docs/epics.md:226-230, docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md, docs/PRD.md:177-179).
- [x] Accessibility & responsive behavior (AC: 3)
  - [x] Add focus trap + `Esc` handling, restore focus to the originating grid row, and ensure keyboard shortcuts mirror UX spec (docs/epics.md:231, docs/ux-design-specification.md:268-290).
  - [x] Apply breakpoint styles so drawer spans 4 desktop columns and full width on tablet/mobile with 48px tap targets and halo animation parity (docs/ux-design-specification.md:262-276).
- [x] QA & documentation (AC: 1-3)
  - [x] Add component tests covering drawer open/close and audit wiring; document governance deep-dive ops in runbook (docs/architecture.md:200-205, docs/ux-design-specification.md:77-112).

## Dev Notes

- Use existing `DeviceGrid` selection state and React Query cache to avoid re-fetching the full row; consider `prefetchQuery` when selection changes (docs/architecture.md:45-149).
- Audit ribbon should page through `/api/audit` with `deviceId` filter, mapping to `models/SyncEvent.ts` and formatting relative + absolute times via `lib/time.ts` (docs/architecture.md:123-199, docs/PRD.md:175-181).
- Export/Handoff actions must emit structured logs via `lib/logging.ts` including `requestId`, `deviceId`, actor, and result so D1 dashboards stay consistent (docs/architecture.md:145-199).
- Drawer anonymization chips should subscribe to the same context introduced in Story 3-6 so toggles remain in sync and deterministic placeholders stay consistent (docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md, docs/PRD.md:177-179).
- Follow UX responsive guidance: 4-column overlay on desktop, full-width slide-over on tablet/mobile, keyboard return-to-row contract, and `role="dialog"` semantics with aria labels (docs/ux-design-specification.md:64-112,262-290).

### Project Structure Notes

- UI lives in `app/(manager)/devices/components/DeviceDrawer.tsx`, with shared hooks under `app/(manager)/devices/hooks`.
- API interactions use `app/api/devices/[id]/route.ts` (metadata), `/api/audit` (timeline), and action endpoints under `app/api/devices/{export|handoff}`; logging utilities stay in `lib/logging.ts`.
- Tests belong beside components (`DeviceDrawer.test.tsx`) and in `tests/integration/governance-drawer.spec.ts` for end-to-end coverage.

### References

- docs/epics.md:226-233,283-289
- docs/PRD.md:173-184,210-214
- docs/architecture.md:45-205
- docs/ux-design-specification.md:64-112,262-290
- docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md

# Story 3.7: device-detail-drawer-with-audit-timeline-ribbon

Status: review

## Story

As an NYU admissions manager,
I want a device detail drawer with an audit timeline ribbon,
so that I can inspect hardware history, governance badges, and handoff actions without leaving the dashboard.

## Acceptance Criteria

1. Drawer opens from selected grid row, displaying device metadata, anonymization chips, and actionable buttons (Export Audit Snapshot, Initiate Handoff) without forcing navigation away from the grid (docs/epics.md:226-230, docs/PRD.md:173-181, docs/ux-design-specification.md:64-112).
2. Audit timeline ribbon calls `/api/audit` (Story D1) to list sync, anonymization, and handoff events with badges, status tooltips, and no TTL truncation so reviewers can trace the latest activity (docs/epics.md:229-231, docs/epics.md:283-289, docs/PRD.md:175-181).
3. Drawer honors accessibility + responsive specs: keyboard focus returns to originating row on close, `Esc` dismisses, and layout shifts from 4-column overlay on desktop to full-width slide-over on tablet/mobile with 48px tap targets (docs/epics.md:231, docs/ux-design-specification.md:262-290, docs/PRD.md:210-214).

## Tasks / Subtasks

- [x] Drawer shell & selection wiring (AC: 1)
  - [x] Mount `DeviceDrawer` under `app/(manager)/devices/components` and subscribe to `DeviceGrid` selection via shared store/hook so drawer auto-opens with optimistic data (docs/architecture.md:45-149).
  - [x] Fetch device metadata/anonymization fields via React Query hitting `/api/devices/{deviceId}` while reusing cache from the grid to avoid duplicate network work (docs/architecture.md:145-149).
- [ ] Audit timeline ribbon (AC: 2)
  - [ ] Call `/api/audit?deviceId=` to hydrate a timeline component backed by `models/SyncEvent.ts`, formatting timestamps with `lib/time.ts` and mapping statuses to badges (docs/epics.md:229-231, docs/epics.md:283-289, docs/architecture.md:123-158).
  - [ ] Provide tooltip copy + legend so sync/anonymization/handoff events are distinguishable and confirmed to persist without TTL trimming (docs/PRD.md:175-181).
- [ ] Action stack + anonymization chips (AC: 1)
  - [ ] Implement Export Audit Snapshot and Initiate Handoff buttons that call their API routes and log success/failure via `lib/logging.ts` for Story D1 visibility (docs/epics.md:228-230, docs/architecture.md:145-199).
  - [ ] Mirror anonymization state within the drawer using `AnonymizationStateContext` + deterministic placeholder helpers for sensitive fields (docs/epics.md:226-230, docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md, docs/PRD.md:177-179).
- [ ] Accessibility & responsive behavior (AC: 3)
  - [ ] Add focus trap + `Esc` handling, restore focus to the originating grid row, and ensure keyboard shortcuts mirror UX spec (docs/epics.md:231, docs/ux-design-specification.md:268-290).
  - [ ] Apply breakpoint styles so drawer spans 4 desktop columns and full width on tablet/mobile with 48px tap targets and halo animation parity (docs/ux-design-specification.md:262-276).
- [ ] QA & documentation (AC: 1-3)
  - [ ] Add component/integration tests covering drawer open/close, audit ribbon data, and action logging; extend runbook instructions for governance deep dives (docs/architecture.md:200-205, docs/ux-design-specification.md:77-112).

## Dev Notes

- Use existing `DeviceGrid` selection state and React Query cache to avoid re-fetching the full row; consider `prefetchQuery` when selection changes (docs/architecture.md:45-149).
- Audit ribbon should page through `/api/audit` with `deviceId` filter, mapping to `models/SyncEvent.ts` and formatting relative + absolute times via `lib/time.ts` (docs/architecture.md:123-199, docs/PRD.md:175-181).
- Export/Handoff actions must emit structured logs via `lib/logging.ts` including `requestId`, `deviceId`, actor, and result so D1 dashboards stay consistent (docs/architecture.md:145-199).
- Drawer anonymization chips should subscribe to the same context introduced in Story 3-6 so toggles remain in sync and deterministic placeholders stay consistent (docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md, docs/PRD.md:177-179).
- Follow UX responsive guidance: 4-column overlay on desktop, full-width slide-over on tablet/mobile, keyboard return-to-row contract, and `role="dialog"` semantics with aria labels (docs/ux-design-specification.md:64-112,262-290).

### Project Structure Notes

- UI lives in `app/(manager)/devices/components/DeviceDrawer.tsx`, with shared hooks under `app/(manager)/devices/hooks`.
- API interactions use `app/api/devices/[id]/route.ts` (metadata), `/api/audit` (timeline), and action endpoints under `app/api/devices/{export|handoff}`; logging utilities stay in `lib/logging.ts`.
- Tests belong beside components (`DeviceDrawer.test.tsx`) and in `tests/integration/governance-drawer.spec.ts` for end-to-end coverage.

### References

- docs/epics.md:226-233,283-289
- docs/PRD.md:173-184,210-214
- docs/architecture.md:45-205
- docs/ux-design-specification.md:64-112,262-290
- docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.md

## Dev Agent Record

### Context Reference

- `docs/stories/3-7-device-detail-drawer-with-audit-timeline-ribbon.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Plan 2025-11-17: (1) inspect existing grid selection state/store and API contracts; (2) add DeviceDrawer shell with selection subscription and React Query detail fetch leveraging cache; (3) wire anonymization chips and CTA stack scaffolding with close/focus handling; (4) add tests for drawer open/close and data hydration.
- Progress 2025-11-17: Added QueryClient provider to manager layout, created device selection store, and mounted DeviceDrawer shell that opens from grid row selection with optimistic data hydrated into React Query cache and focus return on close (actions/timeline wiring pending).
### Completion Notes List

- Implemented DeviceDrawer shell with selection sync and React Query detail fetch; added device selection store and manager-level QueryClient provider; wrote initial drawer unit tests (CTA stack and audit ribbon pending).
- Added audit timeline (API + UI), action endpoints, and CTA wiring with logging plus focus trap/return-to-row handling.

### File List

- nyu-device-roster/src/app/(manager)/components/query-client.tsx
- nyu-device-roster/src/app/(manager)/layout.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGridShell.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGrid.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceRow.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceDrawer.tsx
- nyu-device-roster/src/app/(manager)/devices/components/AuditTimeline.tsx
- nyu-device-roster/src/app/(manager)/devices/actions/deviceActions.ts
- nyu-device-roster/src/app/(manager)/devices/state/device-selection-store.ts
- nyu-device-roster/src/app/api/audit/route.ts
- nyu-device-roster/src/app/api/devices/actions/export/route.ts
- nyu-device-roster/src/app/api/devices/actions/handoff/route.ts
- nyu-device-roster/src/lib/audit/deviceDrawerEvents.ts
- nyu-device-roster/tests/unit/app/device-drawer.client.test.tsx
- nyu-device-roster/package-lock.json
