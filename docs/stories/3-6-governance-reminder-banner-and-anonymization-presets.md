# Requirements Context Summary

- **Governance banner mandate:** Epic C6 introduces a banner that advertises anonymization state, last toggle timestamp, and provides a CTA into preset controls so managers can mask data confidently (docs/epics.md:216-224).  
- **PRD alignment:** Governance cues + anonymization toggle must remain obvious and accessible, with screen-reader labels and logging for each change (docs/PRD.md:60,148-156,213).  
- **Dependency on earlier stories:** Builds on C4’s deterministic anonymization toggle, reusing placeholder logic and audit logging; must also integrate with C3 cues and C5 instrumentation to keep state synchronized (docs/stories/3-4..., docs/epics.md:216-224).  
- **Architecture anchors:** Banner lives in the shared dashboard shell (`app/(manager)/layout.tsx`) and should pull from centralized state (e.g., `AnonymizationStateContext`) plus logging utilities `lib/logging.ts` for event capture (docs/architecture.md:62-205,167-195).  
- **Preset persistence:** Needs API hook to save preset selections, likely under `/api/devices/anonymize` or new route, ensuring deterministic placeholders per column and audit entries for every preset change (docs/epics.md:216-224, docs/PRD.md:201).  

**Story statement:**  
As an NYU admissions manager, I want a governance reminder banner with anonymization presets so I can quickly switch demo-safe views while keeping auditors informed (docs/epics.md:216-224, docs/PRD.md:60,148-156).  

## Structure Alignment Summary

- **Previous story learnings:** Story 3-5 is `drafted`, so no Dev Agent Record learnings yet; banner work should document new files/patterns for Story C7+ (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).  
- **Feature placement:** Banner and preset UI belong in shared layout (`app/(manager)/layout.tsx`) and `app/(manager)/devices/components`, reusing `AnonymizationStateContext` introduced in C4 to avoid duplicate state (docs/architecture.md:62-149).  
- **API touchpoints:** Reuse `/api/devices/anonymize` or add `/api/devices/presets` for storing preset configs; logic should use shared helper under `lib/anonymization.ts` so presets map to deterministic placeholders (docs/architecture.md:127-205,259).  
- **Logging & analytics:** Banner interactions must emit structured logs (via `lib/logging.ts`) and tie into instrumentation metrics from Story C5 to track anonymization runtime (docs/architecture.md:167-195, docs/stories/3-5...).  
- **Accessibility conventions:** Follow PRD guidance for `aria-pressed`, `aria-describedby`, keyboard navigation, and highlight states so governance banner is compliant (docs/PRD.md:148-156,213).  

## Acceptance Criteria

1. Governance banner surfaces anonymization state, last toggle timestamp, and CTA to open presets panel, updating instantly when state changes (docs/epics.md:216-220, docs/PRD.md:60,148-156).  
2. Preset panel offers at least “Demo-safe” and “Full visibility” modes plus per-column overrides, persisting selections via API hook and deterministic placeholders (docs/epics.md:218-222, docs/PRD.md:201).  
3. Controls expose accessible states (`aria-pressed`, `aria-describedby`, focus order) and emit audit log entries for every preset/toggle change (docs/epics.md:223-224, docs/PRD.md:148-156,213).  

## Tasks / Subtasks

- [ ] Banner UI & state wiring (AC: 1)  
  - [ ] Implement `GovernanceBanner` component under `app/(manager)/layout.tsx` binding to shared anonymization state and showing last toggle timestamp + CTA (docs/epics.md:216-220).  
  - [ ] Integrate instrumentation hooks so banner updates feed metrics/logging for runtime observability (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).  
- [ ] Preset panel (AC: 2)  
  - [ ] Build `AnonymizationPresetsPanel` with default presets (“Demo-safe”, “Full visibility”) plus custom column overrides; persist via `/api/devices/anonymize` or `/api/devices/presets` (docs/epics.md:218-222).  
  - [ ] Ensure deterministic placeholder helper is reused so presets produce consistent values across grid/export (docs/PRD.md:201, docs/stories/3-4-anonymization-toggle-ux-with-deterministic-placeholders.md).  
- [ ] Accessibility & audit logging (AC: 3)  
  - [ ] Add `aria-pressed`, `aria-describedby`, and keyboard navigation for banner buttons and preset toggles; verify focus trapping in panel (docs/PRD.md:148-156,213).  
  - [ ] Emit structured logs for every preset change (new state, columns affected) via `lib/logging.ts`, referencing anonymization state + actor (docs/architecture.md:167-195).  
- [ ] Documentation & testing  
  - [ ] Update Dev Notes/runbook with instructions on using presets and interpreting banner signals for demo operators (docs/epics.md:216-224).  
  - [ ] Add component tests for banner and preset panel plus integration test covering API persistence + audit logging (docs/architecture.md:200-205).  

# Story 3.6: governance-reminder-banner-and-anonymization-presets

Status: review

## Story

As an NYU admissions manager,
I want a governance reminder banner with anonymization presets,
so that I can mask sensitive assignments confidently while keeping governance stakeholders informed during demos.

## Acceptance Criteria

1. Governance banner surfaces anonymization state, last toggle timestamp, and CTA to open presets panel, updating instantly when state changes (docs/epics.md:216-220, docs/PRD.md:60,148-156).  
2. Preset panel offers at least “Demo-safe” and “Full visibility” modes plus per-column overrides, persisting selections via API hook and deterministic placeholders (docs/epics.md:218-222, docs/PRD.md:201).  
3. Controls expose accessible states (`aria-pressed`, `aria-describedby`, focus order) and emit audit log entries for every preset/toggle change (docs/epics.md:223-224, docs/PRD.md:148-156,213).  

## Tasks / Subtasks

- [x] Banner UI & state wiring (AC: 1)  
  - [x] Implement `GovernanceBanner` component under `app/(manager)/layout.tsx` binding to shared anonymization state and showing last toggle timestamp + CTA (docs/epics.md:216-220).  
  - [x] Integrate instrumentation hooks so banner updates feed metrics/logging for runtime observability (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).  
- [x] Preset panel (AC: 2)  
  - [x] Build `AnonymizationPresetsPanel` with default presets (“Demo-safe”, “Full visibility”) plus custom column overrides; persist via `/api/devices/anonymize` or `/api/devices/presets` (docs/epics.md:218-222).  
  - [x] Ensure deterministic placeholder helper is reused so presets produce consistent values across grid/export (docs/PRD.md:201, docs/stories/3-4-anonymization-toggle-ux-with-deterministic-placeholders.md).  
- [x] Accessibility & audit logging (AC: 3)  
  - [x] Add `aria-pressed`, `aria-describedby`, and keyboard navigation for banner buttons and preset toggles; verify focus trapping in panel (docs/PRD.md:148-156,213).  
  - [x] Emit structured logs for every preset change (new state, columns affected) via `lib/logging.ts`, referencing anonymization state + actor (docs/architecture.md:167-195).  
- [x] Documentation & testing  
  - [x] Update Dev Notes/runbook with instructions on using presets and interpreting banner signals for demo operators (docs/epics.md:216-224).  
  - [x] Add component tests for banner and preset panel plus integration test covering API persistence + audit logging (docs/architecture.md:200-205).  

## Dev Notes

- **Banner integration:** Embed `GovernanceBanner` within `app/(manager)/layout.tsx`, consuming anonymization context to display status, timestamp, and CTA; ensure React Query subscription keeps banner real-time (docs/architecture.md:62-149).  
- **Preset state + API:** Extend `/api/devices/anonymize` or add `/api/devices/presets` to accept preset payloads (preset id, per-column overrides) and return normalized state; use `lib/anonymization.ts` helper for deterministic placeholders (docs/architecture.md:127-205,259).  
- **Audit + instrumentation:** Each preset/toggle action should log via `lib/logging.ts` with actor, preset, columns, and anonymized state, and feed performance metrics introduced in Story 3-5 (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).  
- **Accessibility:** Follow PRD specs for `aria-pressed`, `aria-describedby`, focus rings, and reduced-motion toggles when banner transitions states or presets open (docs/PRD.md:148-156,213).  
- **Runbook updates:** Expand `docs/performance-runbook.md` or create `docs/governance-banner-runbook.md` documenting preset usage, expected audit trail, and troubleshooting steps for demo operators (docs/epics.md:216-224).  
- **Testing:** Implement component tests for banner/preset panels and integration tests verifying API persistence + log emission; include snapshot for banner states (“Demo-safe”, “Full visibility”) (docs/architecture.md:200-205).  

### Project Structure Notes

- UI components under `app/(manager)/devices/components` and layout; shared helpers in `lib/`.  
- API updates belong in `app/api/devices/anonymize` or new `app/api/devices/presets`.  
- Documentation assets go under `docs/` for inclusion in story context flows.  

### References

- docs/epics.md:216-224  
- docs/PRD.md:60,148-156,201,213  
- docs/architecture.md:62-205,259  
- docs/stories/3-4-anonymization-toggle-ux-with-deterministic-placeholders.md  
- docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md  

## Dev Agent Record

### Context Reference

- `docs/stories/3-6-governance-reminder-banner-and-anonymization-presets.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Planned approach:
  - Add GovernanceBanner in shared layout bound to anonymization store (state + last toggle + CTA) and emit instrumentation logs.
  - Extend anonymization store with presets/lastToggle metadata; build presets panel + API persistence with deterministic placeholders.
  - Add accessibility (aria-pressed/describedby, focus) and audit logging for every preset/toggle; update runbook and tests.

- Outcomes:
  - GovernanceBanner surfaces anonymization state + last toggle with CTA into presets.
  - Presets persisted via `/api/devices/presets`; logging helper emits `ANONYMIZATION_PRESET_CHANGED`.
  - Added runbook guidance and tests for banner/preset rendering and API validation.

### Completion Notes List

- AC1: GovernanceBanner added to manager layout showing anonymization state, last toggle, and CTA; uses shared store + instrumentation hook for banner actions.
- AC2: AnonymizationPresetsPanel supports Demo-safe/Full visibility with column overrides and persists via `/api/devices/presets`; store holds presetId/overrides.
- AC3: Accessibility included via aria labels/states; structured log helper records preset changes; runbook documents usage; tests added for API and components.

### File List

- nyu-device-roster/src/app/(manager)/layout.tsx
- nyu-device-roster/src/app/(manager)/components/GovernanceBannerRegion.tsx
- nyu-device-roster/src/app/(manager)/devices/components/GovernanceBanner.tsx
- nyu-device-roster/src/app/(manager)/devices/components/AnonymizationPresetsPanel.tsx
- nyu-device-roster/src/app/(manager)/devices/hooks/usePerformanceMetrics.ts
- nyu-device-roster/src/app/(manager)/devices/state/anonymization-store.ts
- nyu-device-roster/src/app/api/devices/presets/route.ts
- nyu-device-roster/src/lib/logging.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/tests/unit/app/api/devices/presets.test.ts
- nyu-device-roster/tests/unit/app/governance-banner.test.tsx
- docs/governance-banner-runbook.md
- docs/sprint-status.yaml
