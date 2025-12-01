# Epic Technical Specification: Serial Source Alignment

Date: 2025-11-19
Author: Aditya
Epic ID: 1
Status: Draft

---

## Overview

Serial Source Alignment re-establishes the Google Sheets `serial` column as the authoritative identifier across ingestion, MongoDB persistence, and downstream consumers so the dashboard once again mirrors the source of truth without reconciliation workarounds. The epic satisfies PRD success criteria around serial fidelity, dynamic schema continuity, and downstream trust by combining a hardened sync audit, data migration, and API adjustments anchored in the latest PM mandate. [Source: docs/PRD.md#Implementation-Planning]

## Objectives and Scope

- **In Scope:**
  - Validate every sheet row exposes a non-null `serial` and block ingestion of ambiguous entries through audit/dry-run tooling. [Source: docs/epics.md#Epic-1-Serial-Source-Alignment-FR-001-FR-002]
  - Backfill MongoDB documents so `serial` becomes the primary key while legacy `deviceId` remains readable during the transition. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]
  - Update the sync worker, `/api/devices` endpoint, and dashboard data consumers to operate on `serial`, logging conflicts and preserving demo uptime. [Source: docs/epics.md#Story-EP1-3-Update-Sync-+-API-to-Use-Serial]
- **Out of Scope:**
  - Dynamic column propagation (Epic 2) and observability guardrails (Epic 3); those depend on serial alignment but are separate efforts. [Source: docs/PRD.md#Implementation-Planning]
  - UX redesign beyond grid/heartbeat cues already captured in UX design specification.

## System Architecture Alignment

The epic reinforces the existing Next.js App Router deployment on Google App Engine, MongoDB Atlas with Mongoose, and the Cloud Scheduler → Cloud Tasks → API worker sync loop by upgrading identifiers—not by altering platform primitives. The sync worker in `app/api/sync/run` continues to fetch Google Sheets via `lib/google-sheets.ts`, but it now enforces canonical serial IDs, emits structured logs through Pino, and persists updates using the shared `Device` Mongoose model. API handlers keep using the standardized `{ data, meta, error }` envelope while React Query clients inherit serial-based keys, satisfying the Architecture decision matrix without introducing new services. [Source: docs/architecture.md#Executive-Summary]

## Detailed Design

### Services and Modules

- **Google Sheets Serial Audit (workers/sync/audit.ts):** Invoked as a dry-run or preflight check before ingestion; fetches header + rows, asserts every record has a non-empty `serial`, and emits structured warnings for any violations so ops can fix the sheet before live runs. [Source: docs/epics.md#Story-EP1-1-Audit-Sheet-Serial-Integrity]
- **Serial Migration Task (scripts/backfill-serial.ts):** One-off yet idempotent migration that maps legacy `deviceId` -> `serial`, writes both fields for compatibility, and writes a reconciliation report to `sync_events`. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]
- **Sync Worker (`app/api/sync/run`):** Cloud Task entrypoint that now treats `serial` as the primary identifier, resolves conflicts, and records stats via `sync_events`. Any duplicate serial triggers conflict logging + alert hooks documented in the architecture decisions. [Source: docs/epics.md#Story-EP1-3-Update-Sync-+-API-to-Use-Serial; docs/architecture.md#Sync-Pipeline]
- **API Envelope Utilities (`lib/api-envelope.ts` / `/api/devices` route):** Serve serial-first datasets to the dashboard, still returning legacy `deviceId` as read-only metadata until dependent services migrate. [Source: docs/epics.md#Story-EP1-3-Update-Sync-+-API-to-Use-Serial]
- **React Query Hooks (`app/(manager)/devices/hooks/useDeviceGrid.ts`):** Update cache keys and optimistic updates to rely on `serial`, guaranteeing UI+API alignment and enabling instant filtering on the canonical field. [Source: docs/architecture.md#Front-end-Data-Access]

### Data Models and Contracts

- **Device Schema (`models/Device.ts`):** Adds `serial` as `_id`/unique index, retains `deviceId` as optional string, introduces `legacyIdentifier` subdocument for audit, and stores dynamic columns as `attributes` dictionary so later epics can extend fields without migrations. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]
- **Sync Event Schema (`models/SyncEvent.ts`):** Gains fields for `serialConflicts`, `serialMissingCount`, and `migrationVersion` so ops can audit each run’s health. [Source: docs/architecture.md#Data-Architecture]
- **API Response Contract:** `/api/devices` returns `{ data: { devices: DeviceDTO[], columns }, meta }` where each `DeviceDTO` guarantees `serial` plus legacy identifier and dynamic attributes. This contract must be reflected in `lib/routes.ts` constants and Zod schemas under `schemas/device.ts`. [Source: docs/architecture.md#API-Contracts]

### APIs and Interfaces

- **`POST /api/sync/run`** (scheduler) — validates signed headers, runs serial audit automatically in dry-run mode every Nth invocation, persists results via `sync_events`. Errors return `504` envelope with remediation hints. [Source: docs/architecture.md#API-Contracts]
- **`POST /api/sync/manual`** (manager triggered) — ensures serial migration already applied; if not, rejects with actionable error instructing operator to run migration first. [Source: docs/architecture.md#API-Contracts]
- **`GET /api/devices`** — Accepts filters (`serial`, `status`, `location`) and responds with sorted results keyed by serial plus `columns` metadata so UI renders dynamic fields. [Source: docs/PRD.md#Functional-Requirements]
- **`PATCH /api/devices`** — All update payloads must include `serial` as the identifier; `deviceId` becomes read-only/optional. [Source: docs/epics.md#Story-EP1-3-Update-Sync-+-API-to-Use-Serial]

### Workflows and Sequencing

1. **Serial Audit Loop:** Cloud Scheduler → Cloud Tasks → `/api/sync/run` loads Google Sheet via service account, audits `serial` presence, and logs missing rows before any writes. Operators can run it manually for dry-run validation. [Source: docs/epics.md#Story-EP1-1-Audit-Sheet-Serial-Integrity]
2. **Migration:** Once sheet integrity confirmed, run migration script inside App Engine task or CLI; it backfills MongoDB in batches (e.g., 500 docs), writing progress into `sync_events` with `migrationVersion`. Failures roll back per batch so reruns remain safe. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]
3. **Serial-first Sync:** After migration, the main worker switches to `serial` as `_id`, resolves duplicates via “latest wins” policy, and writes conflict metrics for observability. [Source: docs/epics.md#Story-EP1-3-Update-Sync-+-API-to-Use-Serial]
4. **API / UI Refresh:** `/api/devices` and React Query caches rely on serial-based keys, ensuring dashboards display canonical identifiers and enabling downstream stories (dynamic columns, telemetry). [Source: docs/PRD.md#Success-Criteria]

## Non-Functional Requirements

### Performance

- Sync must continue meeting the ≤60-second sheet→dashboard freshness window using the existing Cloud Scheduler cadence; migration scripts must finish within maintenance windows and stream results to avoid App Engine timeouts. [Source: docs/architecture.md#Performance-Considerations]
- Mongo queries remain indexed on `serial`, ensuring <200 ms endpoint latency for `/api/devices` as required by UX performance principles. [Source: docs/PRD.md#Performance]

### Security

- Maintain NextAuth Google OAuth allowlisting and Secret Manager key storage; migration jobs must pull credentials via the same secure loader rather than embedding secrets. [Source: docs/architecture.md#Security-Architecture]
- Log all serial conflict resolutions with user/service context to maintain governance traceability without exposing sensitive sheet data. [Source: docs/PRD.md#Security]

### Reliability/Availability

- Cloud Tasks retry policy (max 5 attempts) must wrap both audit and write phases so transient Google Sheets issues do not leave sync partially applied. [Source: docs/architecture.md#Sync-Pipeline]
- Migration scripts must be idempotent and resumable, producing checkpoint files so we can recover from mid-run failures without double-writing. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]

### Observability

- Extend `sync_events` logging with counts for rows audited, skipped, migrated, and conflicts, surfacing them via Cloud Logging dashboards highlighted in Architecture doc. [Source: docs/architecture.md#Observability-Audit-Trail]
- Emit structured warnings when any rows lack `serial`, triggering alert thresholds defined under PRD success criterion #2 (dynamic schema continuity). [Source: docs/PRD.md#Success-Criteria]

## Dependencies and Integrations

Key dependencies remain the same but gain explicit serial-aware responsibilities:
- **Google Sheets API v4** — still the upstream source; audit job now fetches header metadata each invocation to guarantee serial fidelity. [Source: docs/PRD.md#Functional-Requirements]
- **MongoDB Atlas + Mongoose** — hosts device documents; indexes on `serial` become mandatory while `deviceId` lingers as informational. [Source: docs/architecture.md#Data-Architecture]
- **Cloud Scheduler + Cloud Tasks** — orchestrate serial audits, migrations, and sync runs with retry/backoff semantics. [Source: docs/architecture.md#Sync-Pipeline]
- **Next.js API + React Query** — downstream consumers that must read/write serial-first payloads; ensures UI parity. [Source: docs/architecture.md#Front-end-Data-Access]

## Acceptance Criteria (Authoritative)

1. **Serial Audit Enforcement:** Sync pipeline logs and skips any sheet row missing `serial`, including dry-run reporting accessible to ops. [Source: docs/epics.md#Story-EP1-1-Audit-Sheet-Serial-Integrity]
2. **Idempotent Serial Migration:** MongoDB documents gain non-null `serial` matching the sheet, retain `deviceId`, and produce a migration report summarizing successes/failures. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]
3. **Serial-Primary Sync:** Ongoing sync jobs treat serial as `_id`, resolving duplicates, and `/api/devices` plus downstream clients use serial as the canonical identifier. [Source: docs/epics.md#Story-EP1-3-Update-Sync-+-API-to-Use-Serial]
4. **Downstream Continuity:** Dashboard renders serial-based rows, conflict alerts show up in heartbeat/audit UI, and no manual reconciliation is needed to trust data. [Source: docs/PRD.md#Success-Criteria]

## Traceability Mapping

| AC | Source Sections | Components / APIs | Test Ideas |
| --- | --- | --- | --- |
| 1 | docs/epics.md#Story-EP1-1 | workers/sync/audit.ts, sync events logging | Unit test audit logic for rows missing serial; integration test dry-run output |
| 2 | docs/epics.md#Story-EP1-2 | scripts/backfill-serial.ts, Device schema | Migration unit tests verifying idempotency + report contents |
| 3 | docs/epics.md#Story-EP1-3; docs/architecture.md#API-Contracts | `/api/sync/run`, `/api/devices`, React Query hooks | Integration test ensuring duplicate serial resolves latest update and API response exposes serial |
| 4 | docs/PRD.md#Success-Criteria; docs/ux-design-specification.md#Core-User-Experience | Device grid components, heartbeat ribbon | Playwright test verifying UI renders serial column + conflict warnings |

## Risks, Assumptions, Open Questions

- **Risks:**
  - Legacy downstream jobs still keyed on `deviceId` may break once `serial` becomes canonical; mitigation is to keep read-only legacy field plus publish migration report. [Source: docs/PRD.md#Functional-Requirements]
  - Sheet rows without `serial` could block ingestion if ops ignore audit reports; propose automated Slack/email alert hook when missing serial count >0. [Source: docs/epics.md#Story-EP1-1-Audit-Sheet-Serial-Integrity]
- **Assumptions:**
  - Google Sheets remains the single source of truth and exposes stable `serial` column names; dynamic columns do not rename `serial`. [Source: docs/PRD.md#Project-Type-Specific-Requirements]
  - App Engine service account already has Secret Manager + Sheets scopes configured per architecture spec.
- **Open Questions:**
  - Should conflict resolution favor most recently updated sheet row or maintain deterministic ordering? Need PM confirmation before enforcing “latest wins”.
  - Do downstream analytics still require `deviceId` long-term, or can we deprecate it post-epic?

## Test Strategy Summary

- **Unit Tests:** Cover audit validator, migration transformers, and `serial` indexing logic via Jest/Vitest. [Source: docs/architecture.md#Testing-Layout]
- **Integration Tests:** Playwright scenario that runs synthetic sync, verifies `/api/devices` returns serial-first payload, and ensures UI grid highlights canonical IDs. [Source: docs/ux-design-specification.md#Core-User-Experience]
- **Migration Dry-Run:** Provide CLI flag to simulate writes, capturing before/after document counts without mutating data—validate against snapshot fixtures. [Source: docs/epics.md#Story-EP1-2-Backfill-MongoDB-with-Serial-Keys]
- **Observability Validation:** Log-based metrics verifying missing-serial alerts fire when thresholds exceeded, aligning with governance expectations. [Source: docs/architecture.md#Observability-Audit-Trail]
