# Accessibility Audit Checklist

This checklist covers manual validations for the manager dashboard against WCAG 2.1 AA with emphasis on governance surfaces (dashboard shell, devices grid, anonymization toggle, sync controls).

## Keyboard Navigation

1. Tab order follows visual layout across header, filter chips, grid, and audit panel triggers.
2. Focus outlines are visible with 3:1 contrast; focus not trapped in slide-overs or dialogs.
3. Space/Enter activates anonymization toggle, refresh/sync actions, and export controls.
4. Esc closes audit panel and drawers; focus returns to invoking control.
5. Arrow keys move within chips and sortable headers; no hidden focus jumps.

## Screen Reader Labels

1. Anonymization toggle announces state with `aria-pressed` and descriptive label.
2. Sync/refresh controls expose `aria-label` describing action and last sync status.
3. Governance banner message announced via `role="status"` or `aria-live="polite"`.
4. Devices grid columns have `scope="col"` and clear headers; empty states announce purpose.
5. Audit panel buttons include labels for filter toggles and close action.

## High Contrast & Visuals

1. Text and icon contrast meet 4.5:1; banners and badges meet 3:1 against backgrounds.
2. Focus rings remain visible in dark mode; hover states do not remove focus cues.
3. Reduced motion respected (`prefers-reduced-motion`); no blocking animations on focus/blur.
4. Error/alert messages use semantic roles and maintain contrast.
5. Grid zebra striping or halo highlights remain visible against theme colors.

## Artifacts & Logging

1. Capture screenshots of focus states, toggle interactions, and governance banner.
2. Save axe-core and Lighthouse outputs under `artifacts/accessibility/` per run.
3. Record audit log entry via `/api/audit/accessibility` with tester name, target page, tool, pass/fail summary, and artifact paths.
4. Note environment URL, date/time, and dataset used for the run.
5. File checklist updates and links in story File List for traceability.

