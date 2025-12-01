# Requirements Context Summary

- **User story grounding:** Admissions managers need a spreadsheet-grade web grid so they can interrogate live device data with zero ambiguity; Epic C2 mandates virtualized rows, responsive controls, and accessibility compliance before later governance cues can build on top of it (docs/epics.md:181-188).  
- **Business & UX constraints:** PRD FR-007 and performance targets lock interaction latency under 200 ms for sorts, filters, toggle interactions, meaning the UI must avoid full DOM reflows and reuse cached data to retain the “native spreadsheet” feel (docs/PRD.md:41,47,173).  
- **System dependencies:** Story C2 inherits authenticated shell, sync banner, and optimistic refresh plumbing from Story C1, so the grid must plug into existing session gate and `/api/sync/manual` feedback loops rather than recreating them (docs/epics.md:172-179).  
- **Architecture anchors:** React Query-powered hooks under `app/(manager)/devices` hydrate data from `/api/devices`, while Mongo-backed pagination plus API response envelopes enforce consistent filters/metadata for the grid (docs/architecture.md:127-149,259).  
- **Non-negotiable qualities:** Accessibility (keyboard navigation, screen-reader labels) and governance transparency (structured logging, audit-friendly interactions) must be respected even in demo mode, matching the audit/logging standards defined for Epic C (docs/PRD.md:120-178, docs/architecture.md:187-195).  

**Story statement:**  
As an NYU admissions manager, I want a spreadsheet-style device grid with instant sort/filter controls so I can answer hardware inventory questions in real time without leaving the authenticated dashboard (docs/epics.md:181-188, docs/PRD.md:173).

## Structure Alignment Summary

- **Previous story learnings:** Story 3-1 remains in `drafted` state, so no Dev Agent Record insights exist yet; treat C2 as the first implementation touchpoint and document all new patterns for downstream reuse (docs/stories/3-1-authenticated-shell-with-sync-status-banner.md).  
- **Feature folder placement:** Grid work must live under `app/(manager)/devices` with components such as `DeviceGrid.tsx`, `DeviceRow.tsx`, and filter controls colocated per architecture spec to keep feature-first organization intact (docs/architecture.md:100-188).  
- **Hook and data contracts:** Reuse or extend the shared React Query hooks in `app/(manager)/devices/hooks` or `lib/` so later stories (C3+) can consume the same pagination/filter logic without duplicating fetchers (docs/architecture.md:127-149).  
- **Routing & API envelope:** All calls funnel through `/api/devices` with `{ data, meta, error }` envelopes; ensure new filters/sort params stay kebab-case and leverage shared constants in `lib/routes.ts` to avoid drift (docs/architecture.md:167-195,259).  
- **Testing & accessibility conventions:** Follow the repo’s testing layout (component tests beside source, integration tests under `tests/integration`) and enforce keyboard navigation/ARIA labels per PRD accessibility guidance so future governance cues inherit a compliant foundation (docs/PRD.md:120-178, docs/architecture.md:200-205).  

## Acceptance Criteria

1. Grid consumes `/api/devices` with server-backed pagination + virtualization so row rendering, sort, and filter interactions stay under 200 ms on manager hardware (docs/epics.md:184-188, docs/PRD.md:41,173, docs/architecture.md:127-149).  
2. Column sorting, multi-field filtering, and column-visibility toggles provide immediate visual feedback, persist state in query params/local storage, and never require full-page reloads (docs/epics.md:184-186, docs/architecture.md:148-149).  
3. Keyboard navigation (arrow keys, Page Up/Down) and screen-reader semantics (`aria-rowindex`, `aria-sort`, landmark roles) fully cover the grid, ensuring alignment with NYU accessibility targets (docs/epics.md:185-188, docs/PRD.md:120-178).  

## Tasks / Subtasks

- [x] Implement DeviceGrid data plumbing (AC: 1)  
  - [x] Extend `useDeviceGrid` hook with pagination, sorting, and filtering inputs wired to `/api/devices` envelope (docs/architecture.md:127-149,259)  
  - [x] Introduce row virtualization (e.g., `@tanstack/react-virtual`) so scroll performance stays under 200 ms interactions (docs/PRD.md:41,173)  
- [x] Build grid controls (AC: 2)  
  - [x] Add column sort toggles with visual + live-region feedback and persist selection in URL query params (docs/epics.md:184-186, docs/PRD.md:41)  
  - [x] Implement multi-field filter panel plus column visibility switches; ensure optimistic UI updates without full reload (docs/epics.md:184-186, docs/architecture.md:148-149)  
- [x] Accessibility & input coverage (AC: 3)  
  - [x] Define keyboard navigation map (arrow navigation, Page Up/Down, Home/End) with focus management across virtualized rows (docs/PRD.md:120-178)  
  - [x] Apply `aria` attributes (`aria-rowindex`, `aria-colindex`, `aria-sort`, `aria-label`) and ensure screen readers announce active filters/sorts (docs/epics.md:185-186, docs/PRD.md:145)  
- [x] Testing & documentation  
  - [x] Write component tests for sorting/filtering handlers plus integration test covering pagination + accessibility roles (docs/architecture.md:200-205)  
  - [x] Document grid controls, keyboard map, and API dependencies in story Dev Notes for downstream stories (docs/architecture.md:100-188)  

# Story 3.2: Spreadsheet grid with performant sort/filter

Status: approved
_Status updated from ready-for-dev on 2025-11-12 to unblock develop-story workflow._

## Story

As an NYU admissions manager,
I want a spreadsheet-style device grid with instant sorting, filtering, and column control,
so that I can answer inventory questions in real time without leaving the authenticated dashboard.

## Acceptance Criteria

1. Grid consumes `/api/devices` with server-backed pagination + virtualization so row rendering, sort, and filter interactions stay under 200 ms on manager hardware (docs/epics.md:184-188, docs/PRD.md:41,173, docs/architecture.md:127-149).  
2. Column sorting, multi-field filtering, and column-visibility toggles provide immediate visual feedback, persist state in query params/local storage, and never require full-page reloads (docs/epics.md:184-186, docs/architecture.md:148-149).  
3. Keyboard navigation (`aria-rowindex`, `aria-sort`, landmark roles) ensures grid remains screen-reader friendly and aligns with NYU accessibility targets (docs/epics.md:185-188, docs/PRD.md:120-178).  

## Tasks / Subtasks

- [x] Implement DeviceGrid data plumbing (AC: 1)  
  - [x] Extend `useDeviceGrid` hook with pagination, sorting, and filtering inputs wired to `/api/devices` envelope (docs/architecture.md:127-149,259).  
  - [x] Introduce row virtualization (e.g., `@tanstack/react-virtual`) so scroll performance stays under 200 ms interactions (docs/PRD.md:41,173).  
- [x] Build grid controls (AC: 2)  
  - [x] Add column sort toggles with visual + live-region feedback and persist selection in URL query params (docs/epics.md:184-186, docs/PRD.md:41).  
  - [x] Implement multi-field filter panel plus column visibility switches; ensure optimistic UI updates without full reload (docs/epics.md:184-186, docs/architecture.md:148-149).  
- [x] Accessibility & input coverage (AC: 3)  
  - [x] Define keyboard navigation map (arrow navigation, Page Up/Down, Home/End) with focus management across virtualized rows (docs/PRD.md:120-178).  
  - [x] Apply `aria` attributes (`aria-rowindex`, `aria-colindex`, `aria-sort`, `aria-label`) and ensure screen readers announce active filters/sorts (docs/epics.md:185-186, docs/PRD.md:145).  
- [x] Testing & documentation  
  - [x] Write component tests for sorting/filtering handlers plus integration test covering pagination + accessibility roles (docs/architecture.md:200-205).  
  - [x] Document grid controls, keyboard map, and API dependencies in story Dev Notes for downstream stories (docs/architecture.md:100-188).  

## Dev Notes

- **Data access & caching:** Place primary grid hook inside `app/(manager)/devices/hooks/useDeviceGrid.ts`; use React Query to batch `page`, `sort`, and `filters` parameters into a single key so virtualization reuses cached pages and interactions stay <200 ms (docs/architecture.md:127-149).  
- **Virtualization strategy:** Adopt `@tanstack/react-virtual` or equivalent to window 30-40 rows at a time. Keep row heights deterministic to avoid scroll jumps; expose fallback for reduced-motion users (docs/PRD.md:41,173).  
- **Accessibility:** Wrap grid in `role="grid"` with headers using `scope="col"` + `aria-sort`. Keyboard map should loop focus within the grid, announcing column header and row number as selection changes (docs/PRD.md:120-178, docs/epics.md:185-186).  
- **State persistence:** Mirror active filters/sorts into URL query params so managers can share filtered views; sync with `localStorage` for preserving column visibility between sessions (docs/architecture.md:148-149).  
- **API contract compliance:** `/api/devices` returns `{ data, meta, error }`. On success, map `meta.total`, `meta.page`, `meta.pageSize` into pagination controls; handle `error` by surfacing inline banner plus toast via shared notifier per architecture rules (docs/architecture.md:167-195,259).  
- **Testing:** Co-locate component tests under `components/__tests__` and add Playwright scenario exercising keyboard navigation, virtualization, and filter persistence (docs/architecture.md:200-205).  

### Project Structure Notes

- UI components, hooks, and loaders remain under `app/(manager)/devices`. Column configuration state can live in `app/(manager)/devices/components/GridControls.tsx` or `lib/hooks/useGridPreferences.ts`.  
- Shared utilities (query-key builders, API envelopes) belong in `lib/` so upcoming governance stories reuse them.  
- Any new schemas or types should align with `models/Device.ts` and `schemas/device.ts` to keep API/DB parity (docs/architecture.md:100-188).  

### References

- docs/epics.md:181-188  
- docs/PRD.md:41,47,120-178,173  
- docs/architecture.md:100-205,259  

## Change Log

- 2025-11-14 – Added `/api/devices` with Mongo-backed pagination, built the virtualized DeviceGrid experience under `app/(manager)/devices`, wired keyboard/ARIA affordances, and expanded Vitest coverage for grid query helpers plus accessibility markup.

## Dev Agent Record

### Context Reference

- docs/stories/3-2-spreadsheet-grid-with-performant-sort-filter.context.xml

### Agent Model Used

gpt-5-codex

### Debug Log References

- 2025-11-14 – Launched `/api/devices` and the reusable query service (`src/app/api/devices/**`, `src/lib/devices/grid-query.ts`, `src/lib/routes.ts`) to supply paginated data with metadata envelopes (AC1).
- 2025-11-14 – Built the DeviceGrid shell, controls, and hook set (`app/(manager)/devices/**`) to deliver virtualization, query-param persistence, column toggles, and keyboard focus loops (AC1-AC3).
- 2025-11-14 – Added Vitest coverage for grid-query helpers, device-query pagination, filter utilities, and accessibility markup plus executed `npm test` for regression confidence (AC4).

### Completion Notes List

- 2025-11-14 – `npm test` now passes after wiring `/api/devices`, DeviceGrid UI/accessibility behaviors, and new Vitest suites exercising pagination helpers, filter toggles, and grid roles.

### File List

- nyu-device-roster/src/app/api/devices/route.ts
- nyu-device-roster/src/app/api/devices/device-query-service.ts
- nyu-device-roster/src/lib/devices/grid-query.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/src/app/(manager)/devices/page.tsx
- nyu-device-roster/src/app/(manager)/devices/hooks/useDeviceGrid.ts
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGridShell.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGrid.tsx
- nyu-device-roster/src/app/(manager)/devices/components/GridControls.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceRow.tsx
- nyu-device-roster/src/app/(manager)/devices/types.ts
- nyu-device-roster/src/app/(manager)/devices/utils/virtual-window.ts
- nyu-device-roster/src/app/(manager)/devices/utils/filter-helpers.ts
- nyu-device-roster/src/app/(manager)/layout.tsx
- nyu-device-roster/tests/setup.ts
- nyu-device-roster/tests/unit/app/manager/devices/device-grid.accessibility.test.tsx
- nyu-device-roster/tests/unit/app/manager/devices/filter-helpers.test.ts
- nyu-device-roster/tests/unit/app/api/devices/device-query-service.test.ts
- nyu-device-roster/tests/unit/lib/devices/grid-query.test.ts
- nyu-device-roster/vitest.config.ts
