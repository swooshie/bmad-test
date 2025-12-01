# Story 1.3: Update Sync + API to Use Serial

Status: in-progress

Story Key: 1-3-update-sync-and-api-to-use-serial

## Requirements Context

- FR-001 and FR-002 in the PRD require the sync pipeline to treat the Google Sheets `serial` column as the canonical identifier, with downstream APIs returning serial-first payloads while legacy `deviceId` remains readable during the transition. [Source: docs/PRD.md:87-140]
- Epic 1 Story EP1.3 mandates updating the sync worker and `/api/devices` endpoint to read/write serial as the primary key, logging conflicts, and ensuring downstream consumers automatically trust refreshed datasets. [Source: docs/epics.md:71-78]
- The Epic 1 tech spec describes serial-first pipeline expectations, API envelope updates, React Query cache alignment, and telemetry requirements (conflict logging, sync_events). [Source: docs/tech-spec-epic-1.md:30-70]
- Architecture and runbook guidance outlines how Cloud Scheduler → Cloud Tasks → `/api/sync/run` orchestrates ingestion, how `/api/devices` should expose metadata, and how UI components (SyncStatusBanner, DeviceGrid) consume status/column definitions. [Source: docs/architecture.md:240-300][Source: docs/source-tree-analysis.md:1-60]
- Story 1-2 (serial migration) is now ready-for-dev; this story depends on its output so that the database already contains canonical `serial` fields before sync/API changes ship. [Source: docs/stories/1-2-backfill-mongodb-with-serial-keys.md:1-140][Source: docs/sprint-status.yaml:38-44]

## Scope

- **In Scope:**
  - Modify sync workers (Cloud Tasks worker + manual API) to treat `serial` as `_id`, handle duplicates, and log conflict telemetry. [Source: docs/epics.md:71-75]
  - Update `/api/devices` (and supporting query services) to return serial-first payloads plus a backward-compatible `deviceId` field for the transition period. [Source: docs/epics.md:75-77][Source: docs/api-contracts.md:1-70]
  - Ensure React Query caches, anonymization helpers, and grid components reference serial keys and updated column metadata. [Source: docs/tech-spec-epic-1.md:32-56][Source: docs/ux-design-specification.md:60-210]
- **Out of Scope:**
  - Data migration scripts (Story 1-2) and dynamic column propagation (Epic 2); this story assumes migration completed successfully and focuses solely on runtime behavior.

## Structure Alignment Summary

- Previous story 1-2 is ready-for-dev (no Dev Agent completion notes yet), so no implementation learnings exist to import beyond using its migration/checkpoint outputs. [Source: docs/stories/1-2-backfill-mongodb-with-serial-keys.md:1-140]
- Story 1-1 (audit) and Story 1-2 (migration) establish prerequisites; run audit + migration before enabling serial-first sync, and reuse modules introduced there (`workers/sync/audit.ts`, `scripts/backfill-serial.ts`).

## Story

As an internal platform engineer,
I want the sync pipeline and `/api/devices` endpoint to read/write `serial` as the canonical key,
so that every consuming feature automatically trusts the refreshed dataset. [Source: docs/epics.md:71-74]

## Acceptance Criteria

1. The sync worker writes Mongo documents keyed by `serial`, detects duplicates, and logs conflicts/anomalies with actionable metadata. [Source: docs/epics.md:75]
2. `/api/devices` responses expose `serial` plus legacy `deviceId` (read-only) and include `columns` metadata so downstream UI/components render serial-first grids without hardcoded headers. [Source: docs/epics.md:75-77][Source: docs/PRD.md:96-105]
3. Dashboard queries, React Query caches, and downstream jobs consume serial-first identifiers (cache keys, anonymization hooks, governance logging), ensuring no manual adjustments are required post-migration. [Source: docs/epics.md:77][Source: docs/tech-spec-epic-1.md:32-56]
4. Telemetry (`sync_events`, Pino logs, SyncStatus) records serial adoption metrics (conflicts resolved, serial mismatches, API usage) so operators can monitor rollout. [Source: docs/tech-spec-epic-1.md:32-70][Source: docs/architecture.md:150-205]

## Tasks / Subtasks

- [ ] Update sync worker (`nyu-device-roster/src/workers/sync/index.ts`). (AC1, AC4)
  - [ ] Replace `deviceId` composite keys with serial-first keys, adjusting `applyDeviceUpserts` filters, duplicate detection, and `contentHash` calculations. [Source: nyu-device-roster/src/workers/sync/index.ts:360-460][Source: docs/tech-spec-epic-1.md:30-40]
  - [ ] Extend conflict logging + sync_events metadata to include serial collisions and remediation hints; update `SyncStatus` snapshots when conflicts halt progression. [Source: nyu-device-roster/src/lib/sync-status.ts:1-120]
- [ ] Adjust normalization + models. (AC1, AC2)
  - [ ] Teach `normalizeSheetRows` to treat serial as canonical, lowercasing values, and populate `legacyDeviceId` when needed. [Source: nyu-device-roster/src/workers/sync/transform.ts:1-180]
  - [ ] Update `models/Device.ts`/`schemas/device.ts` to declare `serial` as the unique key (matching Story 1-2 schema) and ensure `dynamicAttributes` remain intact for future Epic 2 work. [Source: docs/tech-spec-epic-1.md:40-50]
- [ ] Enhance API + query layer. (AC2, AC3)
  - [ ] Update `app/api/devices/route.ts`, `device-query-service`, and associated Zod schemas to return serial-first payloads plus `columns` metadata, and ensure React Query caches use serial-based keys. [Source: nyu-device-roster/src/app/api/devices/route.ts:1-120][Source: docs/tech-spec-epic-1.md:34-50]
  - [ ] Modify UI hooks (`useDeviceGrid.ts`, `DeviceGridShell`, anonymization helpers) to treat serial as the row key, preserving user personalization/local storage behavior. [Source: nyu-device-roster/src/app/(manager)/devices/hooks/useDeviceGrid.ts:28-200]
- [ ] Update telemetry + observability. (AC4)
  - [ ] Emit new sync_event fields (e.g., `serialConflicts`, `legacyIdsUpdated`, `columnsVersion`) and ensure `SyncStatusBanner` surfaces “Serial migration active/completed” cues. [Source: nyu-device-roster/src/components/SyncStatusBanner.tsx:1-70][Source: docs/architecture.md:150-205]
  - [ ] Add log-based metrics + dashboards to alert when serial conflicts exceed thresholds or when API consumers still reference missing serials.

## Dependencies & Integrations

- Google Sheets audit + migration outputs (Stories 1-1, 1-2) to provide clean serial data before sync/API rollout. [Source: docs/stories/1-1-audit-sheet-serial-integrity.md:1-110][Source: docs/stories/1-2-backfill-mongodb-with-serial-keys.md:1-140]
- MongoDB Atlas + Mongoose for schema/index enforcement. [Source: docs/architecture.md:240-300]
- Next.js API routes, React Query hooks, and UI components to consume serial-first data. [Source: nyu-device-roster/src/app/api/devices/route.ts:1-120][Source: nyu-device-roster/src/app/(manager)/devices/components/*]
- Telemetry stack (`lib/logging.ts`, `SyncEventModel`, dashboards) for conflict monitoring. [Source: docs/architecture.md:150-205]

## Dev Notes

- Ensure migration (Story 1-2) completes and serial audit passes before flipping sync worker defaults; provide feature flag/ENV to toggle serial-first behavior during rollout if needed.
- Maintain backward compatibility by keeping `deviceId` field accessible for downstream services until they migrate, but treat serial as canonical everywhere else.
- Update README/runbooks with rollout steps: pause worker, run migration, enable serial-first worker, monitor telemetry, re-enable scheduler.
- Coordinate with UI to refresh caches when serial becomes canonical; consider invalidating local storage personalization if necessary.

### Project Structure Notes

- Continue colocating sync logic in `workers/sync/` and shared utilities in `lib/`; avoid duplicating ingestion code.
- API updates should stay within existing App Router handlers (`app/api/devices/route.ts`) and share envelope helpers from `lib/api-envelope.ts`.
- UI updates should reuse `useDeviceGrid` and component structure documented in architecture/UX files; no new directories needed.

### References

- docs/epics.md:71-78 (Story EP1.3 requirements)
- docs/PRD.md:87-140 (Serial canonicalization, dashboard rendering expectations)
- docs/tech-spec-epic-1.md:30-70 (Sync/API serial design)
- docs/architecture.md:240-300 (Sync pipeline, API contracts, telemetry)
- docs/stories/1-1-audit-sheet-serial-integrity.md, docs/stories/1-2-backfill-mongodb-with-serial-keys.md (prerequisite stories)

## Traceability

| AC | Source Sections | Components / APIs | Test Coverage |
| --- | --- | --- | --- |
| 1 | docs/epics.md:71-75; docs/tech-spec-epic-1.md:30-40 | `workers/sync/index.ts`, `applyDeviceUpserts`, `models/Device.ts` | Integration tests verifying serial conflicts + duplicate handling |
| 2 | docs/epics.md:75-77; docs/PRD.md:96-105 | `/api/devices`, `device-query-service`, `schemas/device.ts` | API contract tests ensuring serial + columns metadata returned |
| 3 | docs/epics.md:77; docs/ux-design-specification.md:60-210 | `useDeviceGrid`, `DeviceGridShell`, React Query caches | Playwright/UI tests covering serial-based rendering + personalization |
| 4 | docs/tech-spec-epic-1.md:40-70; docs/architecture.md:150-205 | `SyncEventModel`, `SyncStatusBanner`, logging hooks | Vitest logging tests + smoke tests ensuring telemetry captures conflicts |

## Risks / Assumptions / Questions

- **Risks:** Serial conflicts or missing serials could halt ingestion; need rollback flag + alerting. API consumers may cache old deviceId references; ensure compatibility layer and communication plan.
- **Assumptions:** Story 1-2 completes successfully and indexes already exist for `serial`. Operators can pause scheduled syncs during rollout to avoid data drift.
- **Open Questions:** Do we expose an API param to request legacy `deviceId` removal? How long do we maintain dual identifiers?

## Test Strategy

- **Unit:** Cover normalization changes, duplicate detection, and API DTO transformations via Vitest.
- **Integration:** Extend `tests/integration/sync.test.ts` to run serial-first pipeline end-to-end; add API integration tests verifying response structure and caching behavior.
- **UI/End-to-End:** Playwright scenarios ensuring DeviceGrid renders serial-based keys, persists personalization, and respects anonymization toggles.
- **Observability:** Smoke tests verifying `sync_events` include new serial metrics and SyncStatus surfaces conflict states.

## Dev Agent Record

### Context Reference

- docs/stories/1-3-update-sync-and-api-to-use-serial.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-24 10:28 – Plan: migrate ingestion/models/API/UI to treat serial as canonical (replace deviceId composite keys, store legacy ids, surface new telemetry) and add regression tests before toggling story tasks.

### Completion Notes List

### File List

## Change Log

- Draft created on 2025-11-19 via *create-story workflow.
