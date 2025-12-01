# Data Models – MongoDB Schemas

## Device (`devices` collection)
- **Purpose:** Canonical roster entries hydrated from Google Sheets and enriched with governance metadata.
- **Key Fields:**
  - `deviceId` *(string)* – currently sheet device identifier; upcoming work will align with serial column.
  - `sheetId` *(string)* – Google Sheets row/serial reference.
  - `assignedTo`, `status`, `condition` *(string)* – visible in the UI grid.
  - `offboardingStatus`, `offboardingMetadata` *(object)* – tracks last actor/action/transfer timestamp.
  - `lastTransferNotes`, `lastSeen`, `lastSyncedAt`, `contentHash` – ingestion bookkeeping.
  - `createdAt`, `updatedAt` – managed by `timestamps` option.
- **Indexes:**
  - `{ deviceId: 1, sheetId: 1 }` unique `device_sheet_unique` (must be updated for serial alignment work).
  - `{ assignedTo: 1 }` lookup by owner.
  - `{ lastSyncedAt: -1 }` for recency sorting.

## Config (`config` collection)
- Stores allowlist, sheet metadata, and sync cadence controls.
- Fields: `allowlist[]`, `devicesSheetId`, `collectionName`, `lastUpdatedAt`, `updatedBy`, `changes[]` (per change with operator, timestamps, delta), and `sync` sub-document (enabled flag, interval minutes, timezone).
- Drives governance endpoints under `/api/config` and CLI tools.

## AuditLog (`audit_logs` collection)
- Records governance events (`eventType` ∈ {sync, anonymization, allowlist-change, governance, accessibility}).
- Each entry logs `action`, optional `actor`, `status` (success/error/skipped), optional `errorCode`, and arbitrary `context` payloads.
- Indexes by `createdAt` and `(eventType, createdAt)` for timeline filtering.

## SyncEvent (`sync_events` collection)
- Telemetry stream capturing sync triggers, session anomalies, banner toggles, etc.
- Schema fields: `eventType`, `route`, `method`, `reason`, `requestId`, `ip`, `userEmail`, `metadata`.
- Aggregated by `/api/metrics` to produce per-trigger stats and totals.
- Indexes: `createdAt`, `(eventType, metadata.trigger, createdAt)`, `(metadata.status, createdAt)`.

## SyncLock (`sync_locks` collection)
- Ensures only one ingest worker runs at a time.
- Fields: `key`, `locked`, `lockId`, `lockedAt`, `releaseAt` (defaults to epoch for stale detection).
- Unique index on `key`.

## Secondary Storage
- **Google Sheets** – Source roster with serial column; service account credentials stored externally (`config/local-dev/sheets-service-account.sample.json`).
- **Secret Manager / ENV** – `TELEMETRY_WEBHOOK_*`, `SYNC_SCHEDULER_TOKEN`, NextAuth secrets.

## Upcoming Change Considerations
- Switching Mongo indexes to sheet serial numbers means updating `deviceSchema.index({ deviceId, sheetId })` and verifying CLI `verify-sync-indexes.ts` + sync worker transformations still compute consistent `contentHash`.
- Keep audit coverage by emitting `SyncEvent` entries whenever index migrations or resync operations run.
