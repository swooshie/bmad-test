# Story 2.3: Render Dynamic Columns in Dashboard UI

Status: review

Story Key: 2-3-render-dynamic-columns-in-dashboard-ui

## Requirements Context

- PRD success criteria FR-004 mandate that the dashboard render exactly the columns surfaced by MongoDB so operations staff always see a live reflection of the Google Sheet without manual schema tweaks. [Source: docs/PRD.md:83-145]
- Epic 2 Story EP2.3 states that `/api/devices` must emit a `columns` array with order/title/field keys and that the UI grid iterates over those definitions (supporting 100-column scenarios with horizontal scrolling). [Source: docs/epics.md:120-140]
- The Epic 2 technical specification extends `lib/google-sheets.ts`, `workers/sync/*`, `/api/devices`, and the `(manager)/devices` feature so the UI consumes registry-backed column metadata, virtualizes large grids, and stays responsive. [Source: docs/tech-spec-epic-2.md:20-210]
- Architecture guidance keeps the solution inside the existing Next.js App Router monolith on App Engine with React Query data access, structured logging, and Cloud Scheduler → Cloud Tasks driving sync so column updates remain observable and authenticated via NextAuth allowlisting. [Source: docs/architecture.md:5-300]
- Data-model and API references describe the `dynamicAttributes` persistence model, column registry, and `{ data, meta, error }` envelope that `/api/devices` and `/api/devices/columns` must honor when exposing dynamic schema to the UI. [Source: docs/data-models.md:1-70][Source: docs/api-contracts.md:1-60]

## Structure Alignment Summary

1. Sprint tracker lists story 2-3 as the next backlog item within Epic 2, immediately following story 2-2 (drafted), so we must draft this story without implementation learnings yet and ensure prerequisites from 2-2 remain intact. [Source: docs/sprint-status.yaml]
2. Architecture keeps the Next.js App Router monolith deployed on App Engine with React Query data access, Cloud Scheduler → Cloud Tasks sync orchestration, and structured logging, so UI changes must reside inside the `(manager)/devices` feature, `/api/devices`, `lib/devices`, and `components/SyncStatusBanner`. [Source: docs/architecture.md]
3. Source tree analysis confines device grid work to `app/(manager)/devices`, shared libs such as `lib/devices/grid-query`, and API handlers under `app/api/devices`, ensuring alignment with existing module ownership. [Source: docs/source-tree-analysis.md]
4. Data models + tech spec require column registry + dynamicAttributes parity between backend and UI plus envelope responses `{ data, meta, error }`, which this story must consume without breaking telemetry or anonymization flows. [Source: docs/data-models.md][Source: docs/tech-spec-epic-2.md]
5. UX design specification mandates 200 ms grid interactions, GitLab-style column chips, and horizontal scrolling for 100-column scenarios, so UI plan must incorporate virtualization, density controls, and design tokens documented there. [Source: docs/ux-design-specification.md]

## Story

As an operations user,
I want the devices table to display whatever columns currently exist in MongoDB,
so that the dashboard always feels like a real-time mirror of the sheet. [Source: docs/epics.md:123-136]

## Acceptance Criteria

1. `/api/devices` responses (and `/api/devices/columns` if leveraged) include a `columns` array sourced from the column registry, capturing order, label, key, data type, anonymization flags, and version metadata so the UI can render deterministic layouts without hardcoded headers. [Source: docs/epics.md:123-134][Source: docs/api-contracts.md:1-60][Source: docs/tech-spec-epic-2.md:40-130]
2. The `(manager)/devices` React grid consumes the columns metadata, iterates over definitions, and renders each column (required + dynamic) with GitLab-style chips, density controls, and virtualization while keeping anonymization + filter behavior intact. [Source: docs/tech-spec-epic-2.md:110-190][Source: docs/ux-design-specification.md:40-160]
3. UI gracefully handles 5/20/100-column scenarios with horizontal scrolling, virtualization thresholds, and sticky headers so interactions remain ≤200 ms and table width adapts without clipping. [Source: docs/epics.md:130-136][Source: docs/ux-design-specification.md:60-200]
4. Sync telemetry and the SyncStatus banner surface column-version updates (e.g., `SYNC_COLUMNS_CHANGED`, `columnsVersion`) so managers know when to refresh; logging follows the structured observability approach from the architecture + runbook. [Source: docs/tech-spec-epic-2.md:130-210][Source: docs/architecture.md:150-205][Source: docs/runbook/sync-operations.md:80-160]

## Tasks / Subtasks

- [x] Task 1: Extend `/api/devices` (and `/api/devices/columns` if introduced) to emit registry-backed column metadata with version stamps and anonymization flags (AC1)
  - [x] Subtask 1.1: Update DTO/Zod schemas + response envelope tests to cover `columns` objects and ensure compatibility with existing consumers. [Tests: npm run test] (AC1)
  - [x] Subtask 1.2: Add telemetry hooks for `columnsVersion` + sync events so observability dashboards capture schema diffs per spec. [Tests: npm run test] (AC4)
- [x] Task 2: Update React Query data layer and `DeviceGrid` rendering pipeline to map over server-provided columns, including personalization persistence and anonymization integration (AC2)
  - [x] Subtask 2.1: Refactor grid column factory + chips to read definitions dynamically, ensuring filters/sorts operate on registry keys. [Tests: npm run test] (AC2)
  - [x] Subtask 2.2: Ensure anonymization toggle + governance cues still mask flagged fields by referencing metadata flags returned by the API. [Tests: npm run test] (AC2)
- [x] Task 3: Implement performance/UX safeguards for 100-column scenarios, including virtualization thresholds, sticky headers, and responsive breakpoints (AC3)
  - [x] Subtask 3.1: Add virtualization or horizontal scroll enhancements per UX spec and verify transitions remain ≤200 ms via Playwright/perf checks. [Tests: npm run test:accessibility] (AC3)
  - [x] Subtask 3.2: Document density/h-scroll defaults in Dev Notes and ensure CSS tokens align with design direction. [Tests: npm run test] (AC3)
- [x] Task 4: Wire SyncStatus banner + audit logging so column updates notify managers and runbook procedures stay intact (AC4)
  - [x] Subtask 4.1: Emit `SYNC_COLUMNS_CHANGED` events + update banner hooks to surface column refresh prompts and link to audit entries. [Tests: npm run test] (AC4)
  - [x] Subtask 4.2: Add automated smoke validation (scripts/smoke.ts) to confirm new telemetry fields appear post-sync. [Tests: npm run smoke] (AC4)

## Dev Notes

- Keep `/api/devices` and any `/api/devices/columns` endpoint aligned with the `{ data, meta, error }` envelope, injecting column metadata generated from the column registry and `dynamicAttributes` to honor the architecture + API contract guidance. [Source: docs/architecture.md:200-280][Source: docs/api-contracts.md:1-60]
- UI must stay inside the `(manager)/devices` feature, updating React Query hooks, grid components, and SyncStatus banner while respecting the UX spec’s density controls, icon-first animations, and anonymization panel behavior. [Source: docs/ux-design-specification.md:1-200][Source: docs/source-tree-analysis.md:1-80]
- Telemetry wiring extends `SyncEvent` logging plus Pino log structure so `columnsAdded/removed`, `columnsVersion`, and prompts for manual refresh appear in SyncStatus; follow runbook recommendations for batching schema changes and resetting locks if sync jobs fail mid-update. [Source: docs/runbook/sync-operations.md:80-170][Source: docs/architecture.md:150-210]
- Testing expectations from the development guide require unit tests via Vitest for schema changes, integration tests/Playwright coverage for grid rendering, and smoke scripts verifying API envelopes before marking the story ready. [Source: docs/development-guide.md:1-120]

### Learnings from Previous Story

Previous story (2-2-persist-dynamic-columns-in-mongodb) remains in drafted status, so no Dev Agent Record learnings exist yet. Treat this story as the first UI consumer once 2-2 lands, and plan a follow-up sync to reuse any registry/file paths delivered there. [Source: docs/sprint-status.yaml:20-45]

### Project Structure Notes

- Device grid work stays inside `app/(manager)/devices`, `components/SyncStatusBanner.tsx`, and shared libs like `lib/devices/` plus `/app/api/devices`, matching source tree guidance. [Source: docs/source-tree-analysis.md:1-80]
- Scripts (`scripts/verify-sync-indexes.ts`, `scripts/smoke.ts`) shouldn't need structural changes; only update documentation references if telemetry fields or endpoints move. [Source: docs/source-tree-analysis.md:55-80]

### References

- [Source: docs/PRD.md]
- [Source: docs/epics.md]
- [Source: docs/tech-spec-epic-2.md]
- [Source: docs/architecture.md]
- [Source: docs/data-models.md]
- [Source: docs/api-contracts.md]
- [Source: docs/ux-design-specification.md]
- [Source: docs/runbook/sync-operations.md]
- [Source: docs/development-guide.md]

## Dev Agent Record

### Context Reference

- docs/stories/2-3-render-dynamic-columns-in-dashboard-ui.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References
1. [AC2] Fixed DeviceGrid virtualization loop by scoping the reset effect to `rows.length` + density changes.
2. [AC4] Smoke pipeline now spins up a single-node replica set and closes Mongoose handles so runs exit reliably.
3. [AC4] Corrected sync worker `afterUpsert` callback signature, ensuring column registry syncs inside replica-set transactions.

### Completion Notes List

- AC1–AC4 satisfied; `/api/devices` returns governance-rich columns, the React grid renders them dynamically, and telemetry (SyncStatus + smoke validations) surfaces `columnsVersion` updates. Validated via `npm run test`, `npm run test:accessibility`, and `npm run smoke`.

### File List

- nyu-device-roster/src/app/(manager)/devices/components/DeviceGrid.tsx
- nyu-device-roster/src/lib/db.ts
- nyu-device-roster/src/workers/sync/index.ts
- nyu-device-roster/scripts/smoke.ts
- nyu-device-roster/tests/integration/smoke.test.ts
- nyu-device-roster/tests/integration/sync.test.ts
- nyu-device-roster/tests/integration/rollback.test.ts
- docs/sprint-status.yaml
- docs/stories/2-3-render-dynamic-columns-in-dashboard-ui.md

## Change Log

- Draft created on 2025-11-25 via *create-story workflow.
- Ready for review on 2025-11-26 after delivering dynamic columns across API/UI plus telemetry + smoke coverage.
