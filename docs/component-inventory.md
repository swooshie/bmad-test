# Component Inventory – UI Surface

## Layouts
- **`app/layout.tsx`** – Root app shell registering fonts, metadata, and React Query providers.
- **`app/(manager)/layout.tsx`** – Authenticated management layout; renders navigation chrome, `SyncStatusBanner`, and governance cues.

## Pages
- **`app/page.tsx`** – Primary roster experience loading grid data via TanStack Query and applying anonymization / governance banners.
- **`app/access-denied/page.tsx`** – Message shown when allowlist or session middleware blocks access.

## Shared Components
- **SyncStatusBanner (`src/components/SyncStatusBanner.tsx`)**
  - Inputs: sync progress via `useSyncStatus`, governance reminders, anonymization state.
  - Behavior: surfaces ingest state (`idle`, `running`, `error`), CTA buttons for manual sync or governance actions, and optional anonymization toggle warnings.

## Hooks & Utilities
- **`use-sync-status.ts`** – React hook wrapping `/api/sync/status` poller.
- **`lib/devices/grid-query.ts`** – Maintains default filters, merges query params, and feeds TanStack Query keys.
- **`lib/anonymization.ts`** – Device row masking, anonymization cookie parsing.

## Animations & UX
- **`lib/animation.ts`** – Motion tokens that coordinate icon-first controls, column halos, and CTA microinteractions described in UX specs (`docs/ux-design-directions.html`).

## Future Work Hooks
- Color themes (`docs/ux-color-themes.html`) and governance cues tie into `SyncStatusBanner` and future UI components (drawer, audit timeline). Component stubs referenced in stories (drawer, filter chips, bottom dock) can reuse the same grid-query + TanStack Query foundation.

Use this inventory as a roadmap for implementing additional UI primitives (device drawer, filter chips, anonymization toggle) without duplicating plumbing.
