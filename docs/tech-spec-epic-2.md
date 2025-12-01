# Epic Technical Specification: Dynamic Column Propagation

Date: 2025-11-19
Author: Aditya
Epic ID: 2
Status: Draft

---

## Overview

Epic 2 extends the sync pipeline so every column that operators add to the Google Sheet is reflected automatically in MongoDB, API payloads, and the Next.js dashboard with no code redeployments. This fulfills PRD success criteria around “dynamic schema propagation” and keeps the “sheet equals dashboard” experience intact even as operators customize metadata. [Source: docs/PRD.md:35-112]

## Objectives and Scope

- **In Scope:**
  - Detect Google Sheet headers at runtime, maintain a schema map, and surface column changes to downstream systems. [Source: docs/epics.md:90-122]
  - Persist arbitrarily named columns (up to 100) in MongoDB with deterministic naming, indexing, and metadata describing type/order. [Source: docs/PRD.md:87-105]
  - Expose column definitions via `/api/devices` and update the React grid so UI renders dynamic fields, preserves personalization, and handles dense layouts. [Source: docs/epics.md:126-136][Source: docs/ux-design-specification.md:62-210]
- **Out of Scope:**
  - Serial canonicalization (Epic 1) and future observability guardrails (Epic 3) beyond emitting column-change metrics this epic requires.
  - New dashboard features unrelated to column rendering (drawer, governance banners) except where they need column metadata hooks already defined.

## System Architecture Alignment

Implementation stays within the Next.js App Router monolith deployed on Google App Engine with Cloud Scheduler → Cloud Tasks triggering `/api/sync/run`. Changes extend existing modules (`lib/google-sheets.ts`, `workers/sync/transform.ts`, `/api/devices`, TanStack React Query grid hooks) without introducing new services. MongoDB Atlas remains the persistence layer, and Secret Manager continues supplying credentials; we only layer additional schema metadata and UI behaviors on top. [Source: docs/architecture.md:5-205][Source: docs/source-tree-analysis.md:1-60]

## Detailed Design

### Services and Modules

- **Header Discovery Service (`lib/google-sheets.ts`, new `workers/sync/header-map.ts`):** Enhance `fetchSheetData` to return ordered headers and expose a helper that normalizes names, detects renamed/removed columns, and emits retry-safe metrics. Optional `includeHeaderSnapshot` flag ensures existing consumers stay compatible. [Source: nyu-device-roster/src/lib/google-sheets.ts:1-120]
- **Column Registry (`models/ColumnDefinition.ts`, optional cache in `lib/devices/column-registry.ts`):** Persist the schema map (field key, original header, inferred type, lastSeenAt) alongside diffs so API and UI can request definitions without scanning entire collections. Registry warms from Sheet headers and is versioned per `sheetId`. [Source: docs/epics.md:90-112]
- **Sync Worker Enhancements (`workers/sync/transform.ts`, `workers/sync/index.ts`):** Extend normalization to copy unknown columns into a `dynamicAttributes` dictionary with snake_case keys, update `contentHash` to include dynamic data, and log anomalies when header count exceeds limits. Worker writes the column registry + device rows in a single transaction to keep schema and data aligned. [Source: nyu-device-roster/src/workers/sync/transform.ts:1-180][Source: docs/runbook/sync-operations.md:80-140]
- **API Layer (`app/api/devices/route.ts`, new `/api/devices/columns`):** Augment `queryDeviceGrid` responses with `columns` metadata (id, title, display order, visibility). Provide a lightweight read endpoint so the UI can prefetch definitions for personalization. Ensure envelopes stay `{ data, meta, error }`. [Source: docs/api-contracts.md:1-90]
- **UI/Grid Modules (`app/(manager)/devices/components/*`, `hooks/useDeviceGrid.ts`):** Replace static `DEVICE_COLUMNS` with server-provided definitions, persist user overrides in local storage, and teach `DeviceGridShell`, `GridControls`, and `DeviceRow` to render variable column counts (including virtualization when >30 columns). [Source: nyu-device-roster/src/app/(manager)/devices/hooks/useDeviceGrid.ts:28-200]
- **Governance + Observability Hooks:** Update `SyncStatusBanner`, `useSyncStatus`, and metrics logging so column-change events surface in telemetry (e.g., new `SYNC_COLUMNS_CHANGED` sync_event). [Source: nyu-device-roster/src/lib/sync-status.ts:1-120][Source: docs/architecture.md:240-283]

### Data Models and Contracts

- **Device Model (`models/Device.ts`):** Add `dynamicAttributes: Record<string, string | number | boolean | null>` and optional `columnDefinitions` reference/tag to each document. Introduce hashed index on `dynamicAttributes.<key>` via wildcard indexes or partial indexes for frequently queried fields. Maintain backwards compatibility by keeping existing scalar fields for required columns. [Source: nyu-device-roster/src/models/Device.ts:1-70]
- **ColumnDefinition Model (new collection `column_definitions`):** Fields include `sheetId`, `columnKey`, `headerLabel`, `dataType`, `nullable`, `lastSeenAt`, `displayOrder`, `sourceVersion`. Unique compound index `(sheetId, columnKey)` ensures deterministic references and simplifies diffing vs previous runs.
- **SyncEvent Metadata:** Extend metadata schema to capture column diffs (`added[]`, `removed[]`, `renamed[]`, `totalColumns`) so monitoring dashboards can alert when counts exceed thresholds. [Source: docs/data-models.md:1-60]
- **API DTOs:** Update `/api/devices` response to `{ data: { devices, columns }, meta, error }`. Each `DeviceDTO` includes existing canonical fields plus `dynamicAttributes`; `columns` array contains `{ id, label, width, dataType, anonymizable }`. Add Zod schemas mirroring the new structure under `schemas/device.ts` for server-side validation. [Source: docs/api-contracts.md:1-70]

### APIs and Interfaces

- **`POST /api/sync/run`:** Invokes header discovery before normalization. If column diffs exist, persist registry updates, emit `SYNC_COLUMNS_CHANGED` event, and optionally notify operators (Slack/email). Adds optional query `?dryRun=true` passthrough for existing workflows. [Source: nyu-device-roster/src/app/api/sync/run/route.ts:1-200]
- **`GET /api/devices`:** Returns `columns` metadata plus `devices`. Supports query `?columnsOnly=true` for lighter responses used by UI bootstrapping. Ensures pagination + filters operate on both standard and dynamic fields (via wildcard indexes). [Source: nyu-device-roster/src/app/api/devices/route.ts:1-120]
- **`GET /api/devices/columns` (new):** Authenticated route returning `{ data: { columns, version, lastUpdated } }` sourced from the column registry. Allows UI to listen for updates without reloading the entire grid.
- **`GET /api/sync/status`:** Include latest `columnsVersion` and `columnDiffSummary` when sync events include schema changes so banners can communicate grid refresh cues. [Source: nyu-device-roster/src/lib/sync-status.ts:1-100]

### Workflows and Sequencing

1. **EP2.1 – Capture Dynamic Columns:** Build header discovery + registry, integrate with sync worker, add telemetry when schema changes. Depends on Epic 1 serial alignment to ensure canonical IDs exist. [Source: docs/epics.md:90-112]
2. **EP2.2 – Persist Dynamic Columns in MongoDB:** Introduce `dynamicAttributes`, ensure migrations/indexes cover new data, and store metadata referencing the registry. Includes validation + CLI tooling for schema inspection. [Source: docs/epics.md:113-124]
3. **EP2.3 – Render Dynamic Columns in Dashboard UI:** Update API and React grid to consume column definitions, handle virtualization and personalization, and maintain UX accessibility/performance targets. [Source: docs/epics.md:126-138][Source: docs/ux-design-specification.md:60-280]

## Non-Functional Requirements

### Performance

- Sync cadence and SLA remain ≤60 seconds end-to-end; header discovery must stream metadata within the same Cloud Task execution budget. Column registry writes should be batched with device upserts to avoid extra round trips. [Source: docs/architecture.md:245-283]
- UI rendering must stay under 200 ms interactions even with 100 columns; use virtualization and CSS grid optimizations described in UX specs. [Source: docs/ux-design-specification.md:60-150]

### Security

- Continue to source Google credentials from Secret Manager and forbid storing column metadata that contains secrets or PII beyond existing governance allowances. [Source: docs/runbook/sync-operations.md:1-60]
- `/api/devices/columns` inherits NextAuth allowlist enforcement via `withSession`; responses must respect anonymization toggles (mask flagged fields). [Source: docs/api-contracts.md:1-40]

### Reliability/Availability

- Registry writes and device upserts occur in the same Mongo session so schema/data stay consistent; fallback to copy-on-write snapshots described in the runbook if transactions fail. [Source: docs/runbook/sync-operations.md:90-150]
- Implement idempotent updates so reprocessing the same header set does not generate duplicate column versions; use `upsert` semantics keyed by `(sheetId, columnKey)`. [Source: docs/data-models.md:1-40]

### Observability

- Extend `SyncEvent` logging and Pino metrics to capture `columnsAdded`, `columnsRemoved`, and `totalColumns`. Add dashboards/alerts when column count >100 or when schema changes occur >X times per day. [Source: docs/architecture.md:150-205]
- Update `SyncStatusBanner`/`useSyncStatus` to surface “Columns updated” messaging and prompt managers to refresh the grid when schema changes occur. [Source: nyu-device-roster/src/components/SyncStatusBanner.tsx:1-70]

## Dependencies and Integrations

- **Node/Next.js stack:** `next@16.0.1`, `react@19.2.0`, `@tanstack/react-query@5.90.10` power the grid and API layer. [Source: nyu-device-roster/package.json]
- **MongoDB + Mongoose:** Continue using `mongoose@8.19.3` for schema definitions, transactions, and index management. [Source: nyu-device-roster/package.json][Source: docs/data-models.md:1-40]
- **Google Sheets API:** Reuse `google-auth-library` + service account secret for header fetching; ensure scopes remain read-only. [Source: docs/runbook/sync-operations.md:1-50]
- **Pino + SyncStatus utilities:** Telemetry stack uses `pino@10.1.0`, `lib/sync-status.ts`, and `SyncStatusBanner` components. [Source: nyu-device-roster/src/lib/logging.ts:1-120]

## Acceptance Criteria (Authoritative)

1. **Header Discovery & Registry:** Sync pipeline captures ordered headers each run, normalizes to snake_case keys, persists registry entries, and emits column diff telemetry. [Source: docs/epics.md:90-112]
2. **Dynamic Persistence:** Device documents store dynamicAttributes with consistent naming + indexing, and `/api/devices` includes the new data without breaking existing consumers. [Source: docs/epics.md:111-124]
3. **API/UI Column Rendering:** `/api/devices` responses include a `columns` array and the React grid renders whatever columns exist (up to 100) with responsive UX per design specs. [Source: docs/epics.md:126-136][Source: docs/ux-design-specification.md:60-210]
4. **Testing & Observability Hooks:** Column changes trigger sync_events, dashboards/alerts update automatically, and automated tests cover header detection (5, 20, 100 columns) plus UI rendering states. [Source: docs/epics.md:102][Source: docs/architecture.md:150-205]

## Traceability Mapping

| AC | Source Sections | Components / APIs | Test Coverage |
| --- | --- | --- | --- |
| 1 | docs/epics.md:90-112; docs/PRD.md:35-49 | `lib/google-sheets.ts`, `workers/sync/header-map.ts`, column registry model | Vitest unit tests for header normalization + registry upserts; integration test verifying sync_event diffs |
| 2 | docs/epics.md:111-124; docs/data-models.md:1-40 | `models/Device.ts`, `schemas/device.ts`, Mongo indexes | Integration tests in `tests/integration/sync.test.ts` covering dynamicAttributes writes + queries |
| 3 | docs/epics.md:126-136; docs/ux-design-specification.md:60-210 | `/api/devices`, `useDeviceGrid`, `DeviceGridShell` | Playwright UI tests verifying 5/20/100 column renders + personalization persistence |
| 4 | docs/architecture.md:150-205; docs/runbook/sync-operations.md:80-160 | `SyncEventModel`, `SyncStatusBanner`, metrics dashboards | Vitest logging tests + smoke tests ensuring alerts fire when columns change |

## Risks, Assumptions, Open Questions

- **Risks:**
  - Mongo document size growth from unbounded columns; mitigate via attribute whitelists, column count caps (100), and serialization limits. [Source: docs/PRD.md:35-40]
  - UI performance degradation when rendering dozens of columns; require virtualization and layout testing before release. [Source: docs/ux-design-specification.md:60-210]
  - Operators may rename columns frequently, generating noisy diffs; need batching/debounce rules.
- **Assumptions:**
  - Google Sheet remains the single source and retains required baseline columns (`serial`, `status`, `location`), with dynamic fields supplementing them. [Source: docs/PRD.md:87-96]
  - Epic 1 work (serial alignment, audit) is complete before this epic begins, ensuring canonical IDs exist. [Source: docs/epics.md:100]
- **Open Questions:**
  - Should column definitions include inferred data types beyond string (e.g., numeric/date) to assist UI formatting? Need PM/UX input.
  - Does governance require approval before exposing newly added columns, or is automatic surfacing acceptable?

## Test Strategy Summary

- **Unit Tests:**
  - Header normalization + registry diffing (`tests/unit/workers/sync/header-map.test.ts`).
  - Device schema validations ensuring dynamicAttributes enforce snake_case and serialization. [Source: docs/development-guide.md:1-60]
- **Integration Tests:**
  - `tests/integration/sync.test.ts` extended to simulate 5/20/100 column sheets, verifying registry updates, device writes, and sync_events. [Source: nyu-device-roster/tests/integration/sync.test.ts:1-120]
  - API contract tests for `/api/devices` and `/api/devices/columns`. [Source: docs/api-contracts.md:1-70]
- **UI/End-to-End:**
  - Playwright scenarios exercising column personalization, virtualization, and anonymization interplay. [Source: nyu-device-roster/src/app/(manager)/devices/components/DeviceGrid.tsx]
- **Observability Validation:**
  - Log-based metrics + smoke script updates to confirm `columnsAdded/removed` counters flow into dashboards/alerts per runbook guidance. [Source: docs/runbook/sync-operations.md:80-160]
