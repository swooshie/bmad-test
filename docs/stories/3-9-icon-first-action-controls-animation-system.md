# Requirements Context Summary

Status: review

- **Epic scope:** Story C9 introduces icon-first action controls with deterministic animation timings (120 ms slide/opacity hover, 90 ms press-in, 150 ms release) so the dashboard keeps GitLab-like polish without sacrificing clarity (docs/epics.md:243-250).
- **PRD + accessibility alignment:** PRD requires responsive, WCAG-compliant controls across desktop/tablet/mobile plus respect for reduced-motion preferences, so animations must degrade gracefully while remaining keyboard friendly (docs/PRD.md:148-214).
- **Architecture anchors:** Component library lives under `app/(manager)/components` with shared tokens from `app/globals.css`/Tailwind; animation utilities should live in `lib/animation.ts` (or similar) and integrate with grid controls already delivered in Stories C2/C8 (docs/architecture.md:45-205).
- **Governance & telemetry:** Logging pipeline (`lib/logging.ts`, `lib/audit/syncEvents.ts`) must record action invocations so audit timelines remain complete even when labels are hidden (docs/architecture.md:145-199).
- **UX guidance:** Design directions provide icon sets, label reveal choreography, and motion curves; implementation must follow those specs exactly while honoring user `prefers-reduced-motion` settings (docs/ux-design-directions.html:800-838, 900-950).

**Story statement:**  
As an NYU admissions manager, I want icon-first action controls whose labels appear on hover/focus/tap so the dashboard stays minimal yet understandable (docs/epics.md:243-250, docs/PRD.md:173-214).

## Structure Alignment Summary

- **Previous story learnings:** Story 3-8 is `ready-for-dev`, so no Dev Agent Record learnings exist yet; this story should document any new animation utilities for downstream reuse (docs/stories/3-8-gitlab-style-column-filter-chips-halo-highlight.md).
- **Feature placement:** Controls/animation utilities live under `app/(manager)/components` with shared styles referenced from `app/globals.css`/Tailwind config; keep action definitions colocated with grid header/filter components (docs/architecture.md:45-149).
- **Data + API touchpoints:** Controls trigger existing actions (Refresh, Export, Handoff, Toggle anonymization). Reuse `/api/sync/manual`, `/api/devices/actions/export`, and governance logging hooks so icon-first UI does not fork backend contracts (docs/architecture.md:145-205).
- **Logging/instrumentation:** Instrument animations with hooks from Story 3-5 so regressions >200 ms raise alerts and log to `PerformanceMetric` events (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).
- **Accessibility:** Controls must include `aria-label`, `aria-expanded`, `aria-pressed`, and maintain tab order + focus outlines; typeahead search/hotkeys should announce the selected control when labels are collapsed (docs/PRD.md:148-214).

## Acceptance Criteria

1. Icon-first buttons render with deterministic animation timings (120 ms hover slide/opacity, 90 ms press-in, 150 ms release) and reveal labels on hover/focus/tap across desktop/tablet/mobile (docs/epics.md:243-248, docs/ux-design-directions.html:900-950).
2. Reduced-motion preference disables non-essential animations, replacing them with instant state changes while keeping focus outlines and auditory cues (docs/PRD.md:210-214).
3. Action controls emit audit/telemetry events (via `lib/logging.ts` + `lib/audit/syncEvents.ts`) capturing actor, action, latency, and anonymization context so timelines remain accurate (docs/epics.md:248-250, docs/architecture.md:145-199).

## Tasks / Subtasks

- [x] Animation utility + tokens (AC: 1)
  - [x] Add `lib/animation.ts` exporting easing/timing tokens (hover, press, release) and helper hooks for `prefers-reduced-motion` detection (docs/architecture.md:45-205).
  - [x] Update Tailwind or CSS modules with reusable classes so button/icon components share the same animation curves (docs/ux-design-directions.html:900-950).
- [x] Icon-first control components (AC: 1)
  - [x] Build `IconActionButton.tsx` with props for icon, label, tooltip, and state; ensure focus/hover reveal uses animation helper and works with keyboard/mouse/touch (docs/epics.md:243-248).
  - [x] Integrate component into dashboard actions (Refresh, Export, Filter, Governance) with responsive layouts in `app/(manager)/dashboard/page.tsx` (docs/PRD.md:173-190).
- [x] Reduced-motion + accessibility (AC: 1,2)
  - [x] Respect `prefers-reduced-motion` by disabling transitions and showing labels persistently; add tests verifying focus/ARIA attributes update correctly (docs/PRD.md:210-214).
  - [x] Ensure buttons expose `aria-label`, `aria-pressed`, and `aria-expanded` (for menus) plus tab order consistent with existing grid layout (docs/PRD.md:148-156).
- [x] Telemetry + audit logging (AC: 3)
  - [x] Extend `lib/logging.ts` with `event: ICON_ACTION_TRIGGERED` capturing action id, requestId, duration, anonymization state; persist via `lib/audit/syncEvents.ts` for export/handoff flows (docs/architecture.md:145-199).
  - [x] Wire instrumentation hooks from Story 3-5 to record animation duration metrics and raise warnings if transitions exceed SLA (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).
- [x] Testing & docs (AC: 1-3)
  - [x] Add Vitest/RTL suites for `IconActionButton` (hover/focus states, reduced-motion fallbacks) plus Playwright scenario verifying keyboard-only usage and telemetry output (docs/architecture.md:200-205).
  - [x] Update `docs/governance-banner-runbook.md` with guidance on new controls/shortcuts and link to animation token definitions (docs/epics.md:243-250).

## Dev Notes

### Learnings from Previous Story

**From Story 3-8-gitlab-style-column-filter-chips-halo-highlight (Status: ready-for-dev)**
- Previous story is not yet implemented; no Dev Agent Record learnings are available. Document any new shared animation utilities created here for future stories (e.g., C10 responsive layouts).  
[Source: docs/stories/3-8-gitlab-style-column-filter-chips-halo-highlight.md#Dev-Agent-Record]

### Implementation Guidance

- **Component placement:** House `IconActionButton` and supporting wrappers under `app/(manager)/components`; keep animation tokens/helpers in `lib/animation.ts` for reuse by governance banner and upcoming bottom-dock navigation (docs/architecture.md:45-205).
- **Integration points:** Replace existing textual buttons (Refresh, Export, Governance) in `app/(manager)/dashboard/page.tsx` without altering API contracts; continue hitting `/api/sync/manual`, `/api/devices/actions/export`, etc. (docs/architecture.md:145-199).
- **Logging & telemetry:** Use `lib/logging.ts` + `lib/audit/syncEvents.ts` to capture each action. Include anonymization state from shared context so timelines remain consistent with governance banner metrics (docs/architecture.md:167-199).
- **Performance targets:** Apply instrumentation from Story 3-5 to measure animation duration and ensure interactions stay under 200 ms. Fail CI if `ICON_ACTION_TRIGGERED` metrics exceed thresholds (docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md).
- **Accessibility:** Always provide textual labels (tooltip, aria attributes) even when visually hidden; ensure focus order follows logical left-to-right, top-to-bottom flow and return focus to originating element after dialogs (docs/PRD.md:148-214).

### Project Structure Notes

- Shared animation tokens in `lib/animation.ts`, components in `app/(manager)/components`, and styles in Tailwind/global CSS keep consistency.  
- Extend Playwright specs under `tests/integration/icon-actions.spec.ts` and Vitest suites next to components.  
- Update runbook documentation under `docs/governance-banner-runbook.md` (or new appendix) to describe icon-first interactions and shortcuts.

### References

- docs/epics.md:243-250  
- docs/PRD.md:148-214  
- docs/architecture.md:45-205,145-199  
- docs/ux-design-directions.html:800-838,900-950  
- docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.md  
- docs/stories/3-8-gitlab-style-column-filter-chips-halo-highlight.md

## Dev Agent Record

### Context Reference

- `docs/stories/3-9-icon-first-action-controls-animation-system.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References
- Added shared animation tokens and reduced-motion helper hook to `src/lib/animation.ts`; wired global CSS classes to enforce 120/90/150 ms timings and label reveal choreography.
- Built reusable `IconActionButton` + `IconActionRow` and swapped dashboard actions to icon-first layout, honoring focus states and label reveal on hover/focus/tap.
- Instrumented telemetry via `ICON_ACTION_TRIGGERED` logger + `/api/audit/icon-action` with anonymization/reduced-motion context and performance metric hooks.
- Authored RTL/Vitest coverage for animation tokens and IconActionButton reduced-motion/telemetry behaviors.

### Completion Notes List
- AC1: Icon-first buttons now use shared tokens (hover 120 ms, press 90 ms, release 150 ms) with label reveal and focus outlines; dashboard actions replaced with the new component.
- AC2: `prefers-reduced-motion` disables transitions and pins labels; aria labels/pressed/expanded attributes remain present for keyboard + SR users with RTL tests validating behavior.
- AC3: New `ICON_ACTION_TRIGGERED` telemetry flows through logger + audit persistence; `/api/audit/icon-action` records actionId, duration, anonymization, reduced motion, and timings feed performance metrics.
- Docs updated with runbook guidance referencing animation tokens and telemetry path; vitest suite passing.

### File List
- docs/sprint-status.yaml
- docs/stories/3-9-icon-first-action-controls-animation-system.md
- docs/governance-banner-runbook.md
- nyu-device-roster/src/app/(manager)/dashboard/page.tsx
- nyu-device-roster/src/app/(manager)/components/IconActionButton.tsx
- nyu-device-roster/src/app/(manager)/components/IconActionRow.tsx
- nyu-device-roster/src/app/api/audit/icon-action/route.ts
- nyu-device-roster/src/app/globals.css
- nyu-device-roster/src/lib/animation.ts
- nyu-device-roster/src/lib/audit/syncEvents.ts
- nyu-device-roster/src/lib/logging.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/src/models/SyncEvent.ts
- nyu-device-roster/tests/unit/app/icon-action-button.client.test.tsx
- nyu-device-roster/tests/unit/lib/animation.client.test.tsx
