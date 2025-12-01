# Story 3.10: responsive-adaptation-bottom-dock-navigation

Status: review

## Story

As an NYU admissions manager using tablet or mobile,
I want the dashboard to adapt with a slide-over audit spine and bottom dock navigation,
so that I can complete roster tasks comfortably across breakpoints without losing governance cues.

## Acceptance Criteria

1. Tablet breakpoint collapses the audit spine into a slide-over panel accessible via icon trigger; mobile pivots to a search-first flow while preserving access to audit details (docs/epics.md:232-236, docs/ux-design-specification.md:166-198).
2. Bottom dock exposes Search, Filters, Audit, and Export controls with 48px tap targets and icon-first labels that remain readable under reduced-motion settings (docs/epics.md:236-240, docs/ux-design-specification.md:166-198).
3. Focus order, ARIA announcements, and reduced-motion preferences remain consistent across breakpoints; authenticated renders stay under 2 seconds and interactions under 200 ms per PRD targets (docs/PRD.md:134-214).

## Tasks / Subtasks

- [x] Responsive layout scaffolding (AC: 1)
  - [x] Implement breakpoint-aware layout in `app/(manager)/layout.tsx` that swaps the audit spine for a slide-over on tablet and hides it on mobile until invoked.
  - [x] Ensure slide-over uses shared state with governance/audit data so touch interactions reflect current sync/anonymization status.
- [x] Bottom dock navigation (AC: 2)
  - [x] Add bottom dock component with Search, Filters, Audit, Export actions using icon-first labels and 48px targets; respect reduced-motion to keep labels persistent when animations are disabled.
  - [x] Wire actions to existing handlers (`/api/sync/manual`, filter chips, audit drawer, export flow) without forking contracts.
- [x] Accessibility and performance (AC: 3)
  - [x] Verify focus order and ARIA roles (`role="dialog"` for slide-over, descriptive labels on dock buttons); return focus to trigger on close.
  - [x] Instrument render and interaction timings to confirm <2s auth render and <200 ms dock interactions; log via `lib/logging.ts` telemetry hooks.

## Dev Notes

- Responsive behavior must align with UX guidance: desktop keeps grid + audit spine; tablet slide-over; mobile search-first with dock shortcuts (docs/ux-design-specification.md:73-198).
- Reuse existing React Query caches for audit and device data so slide-over and dock actions do not trigger redundant fetches (docs/architecture.md:45-205).
- Respect reduced-motion preference by disabling slide/opacity animations and keeping labels visible on dock buttons (docs/PRD.md:210-214).
- Prior story continuity: Story 3-9 is ready-for-dev; no Dev Agent Record learnings yet—capture any new animation or layout tokens for downstream stories (docs/stories/3-9-icon-first-action-controls-animation-system.md).

## References

- docs/epics.md:232-240
- docs/PRD.md:134-214
- docs/architecture.md:1-205
- docs/ux-design-specification.md:73-198,262-320
- docs/stories/3-9-icon-first-action-controls-animation-system.md

## Dev Agent Record

### Context Reference

- docs/stories/3-10-responsive-adaptation-bottom-dock-navigation.context.xml

### Debug Log References
- Added `ResponsiveShell` client wrapper to swap audit spine into a slide-over on tablet/mobile while keeping desktop banners intact.
- Bottom dock exposes Search/Filters/Audit/Export with icon-first 48px targets; reduced-motion pins labels and skips transitions.
- Audit slide-over reuses governance banner and sync status, restores focus to trigger on close, and honors `role="dialog"` semantics.
- Auth render and dock interactions instrumented via performance hooks to keep within 2s/200ms PRD budgets.

### Completion Notes List
- AC1: Responsive layout now collapses audit spine into slide-over on tablet/mobile with shared governance/sync state.
- AC2: Bottom dock actions wired to existing routes/handlers with icon-first labels and reduced-motion persistence.
- AC3: Focus order and ARIA roles enforced on slide-over; labels remain readable under reduced motion; telemetry logged for latency targets.

### File List
- docs/sprint-status.yaml
- docs/stories/3-10-responsive-adaptation-bottom-dock-navigation.md
- nyu-device-roster/src/app/(manager)/layout.tsx
- nyu-device-roster/src/app/(manager)/components/ResponsiveShell.tsx
- nyu-device-roster/src/app/(manager)/components/IconActionButton.tsx
- nyu-device-roster/tests/unit/app/responsive-shell.client.test.tsx
