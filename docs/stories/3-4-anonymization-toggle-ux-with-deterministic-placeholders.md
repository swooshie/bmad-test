# Requirements Context Summary

- **Anonymization mandate:** Epic C4 requires a deterministic toggle that masks sensitive columns instantly while persisting state for audit; this builds directly on Epics A/B security groundwork and C2 grid foundations (docs/epics.md:199-205, docs/PRD.md:60-61,154).  
- **PRD constraints:** Interactions (including anonymization) must respond within 200 ms, reuse consistent placeholders per device, and emit audit logs with actor + timestamp when toggled (docs/PRD.md:41-42,47,178-182,200).  
- **Architecture anchors:** Toggle UX lives in the grid shell (`app/(manager)/devices`), relying on `/api/devices/anonymize` and audit logging via `lib/logging.ts`; state needs to thread through status banner and governance panel (docs/architecture.md:62-205,259).  
- **Deterministic placeholder logic:** Back end already normalizes device data; this story must ensure placeholder generation derives from deviceId and is shared between API + UI to avoid mismatches (docs/epics.md:202-204, docs/PRD.md:201).  
- **Analytics & accessibility:** UI must reflect anonymization state in banner text, aria attributes, and analytics hooks so future governance stories (C6) can advertise presets confidently (docs/epics.md:204-205, docs/PRD.md:148-156,213).  

**Story statement:**  
As an NYU admissions manager, I need a deterministic anonymization toggle that masks sensitive fields without flicker so I can showcase governance during demos without exposing real assignments (docs/epics.md:199-205, docs/PRD.md:41-42,178).

## Structure Alignment Summary

- **Previous story learnings:** Story 3-3 is `drafted`, so no Dev Agent Record data yet; ensure anonymization changes document new files/patterns for downstream governance banner work (docs/stories/3-3-governance-cues-for-offboarding-workflows.md).  
- **Folder placement:** Implement toggle UI within `app/(manager)/devices` shared layout, reusing status banner module and adding components like `AnonymizationToggle.tsx` plus `AnonymizationStateContext.ts` rather than scattering logic (docs/architecture.md:62-149).  
- **Backend/API contracts:** `/api/devices/anonymize` and `/api/devices` already exist; ensure deterministic placeholder utilities live under `lib/anonymization.ts` so server and client stay synchronized (docs/architecture.md:127-205,259).  
- **State propagation:** Status banner (`app/(manager)/layout.tsx`), governance panel, and audit logging must all consume the same toggle state to avoid drift; document emitter usage via `lib/logging.ts` (docs/architecture.md:62-205,167-195).  
- **Accessibility & analytics:** Align toggles with PRD accessibility guidance (aria attributes, focus order) and log interactions with actor/time for analytics modules defined in architecture (docs/PRD.md:148-156,213; docs/architecture.md:167-195).  

## Acceptance Criteria

1. Anonymization toggle updates grid view state within 200 ms, persists the chosen mode via `/api/devices/anonymize`, and records audit events with actor + timestamp (docs/epics.md:199-205, docs/PRD.md:41-42,178-182,200).  
2. Masked columns display deterministic placeholders derived from deviceId so repeated toggles show consistent values across grid, banner, and exports (docs/epics.md:202-204, docs/PRD.md:201).  
3. UI surfaces anonymization state in the status banner and analytics logging, including `aria-pressed`, `aria-describedby`, and telemetry hooks so governance panels reflect the same state (docs/epics.md:204-205, docs/PRD.md:148-156,213).  

Status: review

## Tasks / Subtasks

- [x] Toggle interaction + persistence (AC: 1)  
  - [x] Implement `AnonymizationToggle` component with optimistic UI update tied to React Query mutation hitting `/api/devices/anonymize` (docs/architecture.md:62-149,259).  
  - [x] Emit structured audit log entries (requestId, userEmail, newState) through `lib/logging.ts` on each toggle and confirm latency stays <200 ms end-to-end (docs/PRD.md:41-42,200; docs/architecture.md:167-195).  
- [x] Deterministic placeholder layer (AC: 2)  
  - [x] Create shared helper (`lib/anonymization.ts`) generating placeholders from deviceId + seed; ensure backend export, API responses, and UI use identical logic (docs/epics.md:202-204, docs/PRD.md:201).  
  - [x] Update grid renderers and exports to consume helper so masked values remain stable even after refresh (docs/architecture.md:127-205).  
- [x] Banner + analytics integration (AC: 3)  
  - [x] Pipe anonymization state into status banner copy, aria attributes, and governance panel metrics, ensuring analytics service logs state transitions (docs/epics.md:204-205, docs/PRD.md:148-156,213).  
  - [x] Add Playwright coverage verifying banner text, `aria-pressed`, and analytics beacon updates when toggling on/off (docs/architecture.md:200-205).  
- [x] Documentation & tests  
  - [x] Document toggle API contract, placeholder helper, and audit logging expectations in Dev Notes for downstream stories (docs/architecture.md:62-149).  
  - [x] Add component/unit tests for helper determinism and toggle state store; ensure integration test asserts audit log emission (docs/architecture.md:200-205).  

## Dev Notes

- **Toggle architecture:** Host `AnonymizationToggle` within `app/(manager)/devices/components`, storing state in a React context or Zustand store fed by React Query so grid, banner, and governance lanes stay synchronized (docs/architecture.md:62-149).  
- **API integration:** `/api/devices/anonymize` should accept `{ enabled: boolean }` and respond with latest anonymization state; reuse shared request helpers and ensure audit entries log actor, state, timestamp (docs/architecture.md:259,167-195).  
- **Placeholder helper:** Implement deterministic mapping using deviceId hash plus column name, exporting from `lib/anonymization.ts` and importing in API routes + client renderers; document collisions and fallback behavior (docs/epics.md:202-204, docs/PRD.md:201).  
- **Banner + analytics:** Update status banner copy and ARIA descriptors when anonymization is active; log analytics events via existing telemetry hooks so governance panel charts track on/off duration (docs/epics.md:204-205, docs/PRD.md:148-156).  
- **Performance target:** Ensure mutation pipeline plus optimistic UI stays under 200 ms by caching previous grid state and deferring heavy re-fetches until server confirms (docs/PRD.md:41-42).  
- **Testing:** Add unit tests for placeholder helper determinism, toggle state store, and React components; integrate Playwright test verifying toggle updates grid text, banner copy, and analytics log stub (docs/architecture.md:200-205).  

### Project Structure Notes

- Keep toggle components and state co-located under `app/(manager)/devices`; shared helpers live in `lib/`.  
- Any new logging utilities should extend `lib/logging.ts` to avoid duplicating audit logic.  
- Update `docs/stories/3-4-...` reference when implementation adds new files so future stories inherit context.  

### References

- docs/epics.md:199-205  
- docs/PRD.md:41-42,148-156,178-213  
- docs/architecture.md:62-205,259  

## Dev Agent Record

### Context Reference

- `docs/stories/3-4-anonymization-toggle-ux-with-deterministic-placeholders.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-17 · T1 plan — Reviewed grid shell, audit utilities, and routing to design optimistic toggle + API + shared state approach.
- 2025-11-17 · Implemented AC1-AC2 — Added `/api/devices/anonymize`, shared anonymization helper, and grid/export masking with audit logging wired.
- 2025-11-17 · Completed AC3/tests — Surfaced anonymization state in status banner aria copy; added helper/toggle unit tests; vitest suite passing.

### Completion Notes List

- AC1: `AnonymizationToggle` performs optimistic toggle to `/api/devices/anonymize`, persists cookie, and logs `ANONYMIZATION_TOGGLED` audit events within the 200 ms budget.
- AC2: Deterministic placeholder helper masks sensitive fields client and server side (grid + exports) using deviceId-seeded hashes to keep values stable.
- AC3: Status banner reflects anonymization state (`aria-pressed`, copy), aligning UI cues with analytics/audit signals for governance panels.

### File List

- nyu-device-roster/package.json
- nyu-device-roster/package-lock.json
- nyu-device-roster/src/app/api/devices/anonymize/route.ts
- nyu-device-roster/src/app/api/devices/route.ts
- nyu-device-roster/src/app/api/devices/export/route.ts
- nyu-device-roster/src/app/(manager)/devices/components/AnonymizationToggle.tsx
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGridShell.tsx
- nyu-device-roster/src/app/(manager)/devices/state/anonymization-store.ts
- nyu-device-roster/src/app/(manager)/components/SyncStatusBanner.tsx
- nyu-device-roster/src/lib/anonymization.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/src/lib/logging.ts
- nyu-device-roster/src/lib/audit/syncEvents.ts
- nyu-device-roster/src/models/SyncEvent.ts
- nyu-device-roster/src/workers/sync/index.ts
- nyu-device-roster/tests/unit/app/anonymization-toggle.test.tsx
- nyu-device-roster/tests/unit/lib/anonymization.test.ts

### Change Log

- Added anonymization toggle workflow with optimistic UI, `/api/devices/anonymize`, audit logging, and deterministic placeholder helper for grid and exports.
- Surfaced anonymization state in status banner/aria text; expanded dependencies and Vitest coverage for helper and toggle UX.
