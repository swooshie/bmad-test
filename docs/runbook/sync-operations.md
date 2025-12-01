# Sync Operations Runbook

This runbook explains how to configure and operate the Google Sheets ingest pipeline that now relies on the shared fetch module in `nyu-device-roster/src/lib/google-sheets.ts`.

## 1. Configuration Checklist

1. **Secret Manager wiring**
   - Create or reuse a Secret Manager secret that stores the service account JSON (`sheetsServiceAccount`).
   - Expose the resource path via `SECRET_NAME_SHEETS_SERVICE_ACCOUNT`; the runtime never reads plaintext credentials.
2. **Sheet metadata**
   - Record the spreadsheet ID for the production Devices sheet in the deployment config (e.g., `SYNC_SHEET_ID`).
   - Default tab name is `Devices`; override by passing `tabName` into the module if operators rename the worksheet.
3. **Runtime safety checks**
   - Validate `SYNC_SHEET_ID` (and optional tab override) in your env loader before the worker boots.
   - Confirm the service account has the Sheets scope `https://www.googleapis.com/auth/spreadsheets.readonly`.

## 2. Calling the Fetch Module

Both Cloud Tasks workers and manual `/api/sync/run` entry points call the same helper and gain structured metrics + retries automatically.

```ts
import { fetchSheetData } from "@/lib/google-sheets";
import { logger } from "@/lib/logging";

export const loadDevicesFromSheets = async (opts: {
  sheetId: string;
  tabName?: string;
  requestId?: string;
}) => {
  const result = await fetchSheetData({
    sheetId: opts.sheetId,
    tabName: opts.tabName,
    requestId: opts.requestId,
    retry: {
      maxAttempts: 4,
      baseDelayMs: 500,
      onRetry: (ctx) =>
        logger.warn(
          { ...ctx, workflow: "sync-pipeline", requestId: opts.requestId },
          "Retrying Google Sheets fetch"
        ),
    },
  });

  return result;
};
```

### Worker integration (`workers/sync`)

```ts
const { rows, metrics } = await loadDevicesFromSheets({
  sheetId: process.env.SYNC_SHEET_ID,
  requestId: task.correlationId,
});
logger.info({ event: "SYNC_FETCH_ROWS", ...metrics, workflow: "cloud-task" }, "Fetched sheet rows");
```

- Use the returned `rows` array to feed downstream normalization/upsert steps.
- Forward `metrics.durationMs` to Cloud Tasks monitoring to enforce the 60‑second SLA.

### Manual API integration (`app/api/sync/run`)

```ts
const result = await loadDevicesFromSheets({
  sheetId: process.env.SYNC_SHEET_ID!,
  tabName: req.body.tabOverride,
  requestId: req.headers["x-request-id"] as string | undefined,
});

return NextResponse.json({
  status: "ok",
  rows: result.rows.length,
  metrics: result.metrics,
});
```

- Propagate structured errors (see table below) to the API response `{ errorCode, message }`.

### Manual Sync API (`app/api/sync/manual/route.ts`)

1. **Endpoint contract**
   - POST `/api/sync/manual` (NextAuth session required) returns within ~5 seconds with `{ runId, status: "running", requestedBy, sheetId }`.
   - Response indicates the optimistic state only; worker completion is delivered through the sync-status store and audit feed.
2. **Status propagation**
   - Client code subscribes to the `sync-status` helper (`@/lib/sync-status`) to flip banners/buttons immediately and reconcile to success/error once the worker finishes.
   - Status payloads include `runId`, counts, duration, and Sheet/API error codes (`SHEET_NOT_FOUND`, `SYNC_TIMEOUT`, etc.) so UI tooltips can mirror FR-012 wording.
3. **Audit trail**
   - Each manual run writes a `sync_events` document capturing actor email, anonymization state (currently `false` until Story C6 adds presets), duration, and row deltas.
   - Logs emit `MANUAL_SYNC_*` events plus the existing `DEVICE_SYNC_*` entries to keep observability dashboards aligned.

## 2.5 Normalization & Upsert Rules

1. **Header mapping** – Transformer dynamically reads sheet headers and maps `Serial` (or equivalents) to the canonical `deviceId`, along with `assignedTo`, `status`, `condition`, `offboardingStatus`, `lastSeen` (case-insensitive). Missing serial/deviceId rows are skipped with anomalies emitted to logs and `sync_events`.
2. **Deterministic casting** – Status/condition values are normalized to title case, `assignedTo` defaults to `Unassigned`, and `lastSeen` accepts ISO timestamps or Excel serials. Each record produces a SHA-256 `contentHash` so unchanged rows retain their previous `lastSyncedAt`.
3. **Compound upsert semantics** – Persistence layer enforces unique `(deviceId, sheetId)` (deviceId sourced from the sheet Serial column) plus supporting indexes on `assignedTo` and `lastSyncedAt`. Upserts only bump `lastSyncedAt` when the `contentHash` changes, keeping dashboards free of false-positive updates.
4. **Logging + audit trail** – Every run logs `DEVICE_SYNC_*` events with counts/anomalies and records a `sync_events` document containing `sheetId`, `runId`, and `added/updated/unchanged` metrics.
5. **Column registry + dynamic attributes** – Header snapshots are persisted in `column_definitions` (fields: `columnKey`, `label`, `dataType`, `nullable`, `displayOrder`, `sourceVersion`) during the same Mongo transaction as device upserts. Each device row also records `columnDefinitionsVersion`, letting downstream services reconcile payloads with a specific registry snapshot. Added/removed columns emit `SYNC_COLUMNS_CHANGED` events (with `columnsAdded/columnsRemoved/columnTotal/columnVersion` metadata) and refresh `SyncStatusBanner` so operators see schema churn. Unknown headers become `dynamicAttributes` on each device document, backed by a wildcard index for performant lookups, and surface through `/api/devices` + the grid.

## 3. Scheduled Automation Controls

1. **App Engine Cron declaration**
   - Update `nyu-device-roster/cron.yaml` with the correct region + service token reference. Default cadence is `every 2 minutes synchronized`, targeting `POST /api/sync/run`.
   - Cron headers must include `X-Appengine-Cron: true` and the shared secret header (`X-Internal-Service-Token`) injected via Secret Manager or deployment automation. The `/api/sync/run` route validates both headers before enqueuing work.
2. **Runtime gating via config**
   - `Config.sync.enabled` – flip to `false` in the `config` collection to pause scheduled runs without changing the cron rollout. Manual refresh remains available.
   - `Config.sync.intervalMinutes` – set the desired cadence (integer minutes, default `2`). The API enforces the configured interval by skipping runs that trigger faster than this value.
   - `Config.sync.timezone` – specify the operator-facing timezone for logs and dashboards (default `Etc/UTC`); cron still runs in UTC, but this value is surfaced in observability payloads.
3. **Operational adjustments**
   - To toggle flags quickly, run a Mongo shell update:
     ```js
     db.config.updateOne({}, { $set: { "sync.enabled": false } });
     ```
     Re-enable by setting the field to `true` once the incident is resolved.
   - Document cadence changes in the incident log and Dev Agent Record so downstream teams know why dashboards show different polling spacing.
4. **Monitoring tips**
   - Use log filters `event=CRON_SYNC_REQUESTED` and `event=DEVICE_SYNC_SUMMARY` to verify scheduled triggers are firing.
   - Add alerting around `sync_events.metadata.trigger === "scheduled"` with status `skipped_due_to_config` or `skipped_due_to_inflight` to catch prolonged pauses.
   - Watch for `event=DEVICE_SYNC_COMPLETED` logs to confirm each scheduled run records runId, durationMs, rowCount, anonymization flag, and trigger metadata; these feed Cloud Logging dashboards and the UI status banner.
5. **Structured metrics + dashboards**
   - Every `SYNC_RUN` document now emits `metadata.rowsProcessed`, `metadata.rowsSkipped`, `metadata.conflicts`, `metadata.startedAt`, and `metadata.completedAt`. Cloud Logging queries can slice by trigger:
     ```
     resource.type="k8s_container"
     jsonPayload.event="DEVICE_SYNC_COMPLETED"
     jsonPayload.trigger="manual"
     | stats sum(jsonPayload.rowsProcessed) as rows,
             sum(jsonPayload.conflicts) as conflicts,
             percentile(jsonPayload.durationMs, 95) as p95
     ```
   - `/api/metrics` aggregates the same data every time an operator opens the dashboard. Two windows are returned:
     - `last12h`: rolling 12‑hour view with totals per trigger (runs, success/failure counts, average duration, rows processed/skipped, conflicts).
     - `cumulative`: lifetime totals from the telemetry collection. Both structures live in `data.last12h`/`data.cumulative` and power SLAs on the SyncStatus banner (manual vs scheduled vs system).
   - Smoke tests now call the aggregator directly to guarantee a manual run increments the `manual` trigger counters. If metrics drift, run `npm run smoke` locally to reproduce and inspect the emitted `sync_events` row metadata.
   - To build log-based alerts, create Cloud Monitoring metrics on `sync_events.metadata.durationMs` (threshold > 300000 ms / 5 minutes) and `sync_events.metadata.trigger` grouped by status. Pair one policy with `durationMs` to page when scheduled runs exceed five minutes, and a second policy that counts consecutive `status != "success"` events per trigger (fire when failures ≥ 2 within 15 minutes).
6. **Dry-run / safe mode**
   - Set `SYNC_MODE=dry-run` (or send `X-Sync-Mode: dry-run` on `/api/sync/run`, or `{ "mode": "dry-run" }` body on `/api/sync/manual`) to skip Mongo writes while still running audits, header diffing, and emitting `sync_events`/SyncStatus updates. Device/column persistence is bypassed; telemetry remains identical and includes `mode: dry-run`.
   - Re-enable live writes by omitting the header/body flag or setting `SYNC_MODE=live`. Cron runs inherit the env value; manual runs can override per request.
   - Alerts follow normal rules; if webhook dispatch is disabled or paused, suppression reasons appear in `schemaChange.suppressionReason`, but diffs still persist for auditability.
6. **Schema-change detection & alerts**
   - Each run diffs the current header registry against the previous snapshot and records the results in `schemaChange` metadata on `SYNC_RUN` plus a dedicated `SYNC_COLUMNS_CHANGED` entry (fields: `added[]`, `removed[]`, `renamed[]`, `previousVersion`, `currentVersion`, `detectedAt`). `/api/metrics` surfaces the latest change under `data.schemaChange`.
   - Alerts reuse the telemetry webhook scaffold (`TELEMETRY_WEBHOOK_ENABLED=true` with `TELEMETRY_WEBHOOK_URL` and `TELEMETRY_WEBHOOK_CHANNEL`). When the webhook is disabled or `SCHEMA_ALERTS_PAUSED=true`, the worker logs `SCHEMA_CHANGE_DETECTED` with `alertStatus: suppressed` but still persists the diff.
   - Dry-run or paused-sync modes suppress webhook delivery while keeping the audit trail intact. Suppression reasons appear in `schemaChange.suppressionReason`; operators should still review the diff and remediate before re-enabling alerts.

## 4. Error Codes & Monitoring

| Code                    | Trigger                                                                                 | Operator Action                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `SHEET_NOT_FOUND`       | Spreadsheet deleted, moved, or service account lost access                              | Verify the sheet ID and sharing settings in Config + Secret Manager             |
| `SHEETS_RATE_LIMIT`     | Google API 429 / throttling                                                              | Reduce cron cadence or Sheet polling via `Config.sync.intervalMinutes`          |
| `SHEETS_AUTH_REVOKED`   | Service account credentials revoked/expired                                              | Rotate the Sheets service secret (`SECRET_NAME_SHEETS_SERVICE_ACCOUNT`)         |
| `INVALID_SYNC_CONFIGURATION` | Missing sheetId/tabName or malformed Secret Manager resource path               | Fix deployment config / config collection entry before retrying                 |
| `SYNC_TIMEOUT`          | Worker exceeded the 60s SLA (Cloud Tasks reported timeout)                               | Inspect Cloud Tasks logs, look for hotspots in fetch/transform/upsert sections  |
| `MONGO_WRITE_FAILED`    | Mongo transaction or copy-on-write fallback failed (dataset preserved automatically)    | Check Mongo logs, rerun sync once root cause fixed                              |
| `UNAUTHORIZED_CRON`     | `/api/sync/run` missing required scheduler headers                                       | Update Cloud Scheduler task headers to match `syncSchedulerToken`               |
| `ROLLBACK_FAILED`       | CLI rollback utility could not restore baseline snapshot                                 | Validate `SYNC_BASELINE_PATH`, file format, and Mongo permissions               |
| `UNKNOWN_FAILURE`       | Network or unexpected platform failures                                                  | Check Pino logs (`event=DEVICE_SYNC_*` + referenceId) and investigate           |

- Each `AppError` now includes a `referenceId`; search logs by that value to find the stack trace.
- Status banner payloads expose `{ errorCode, recommendation, referenceId }` so operators know the next action without opening logs.
- Log-based metrics:
  - `event=DEVICE_SYNC_FAILURE` / `MANUAL_SYNC_FAILURE` – alert when 2+ failures occur in 10 minutes.
  - `event=DEVICE_SYNC_TRANSACTION_FALLBACK` – indicates Mongo transactions aren’t available; ensure copy-on-write fallback succeeded.
  - `event=SYNC_ROLLBACK_*` – audit entries for baseline restores (see below).
- The module’s retry hook still emits `SHEETS_FETCH_RETRY`; dashboards should alert if retries exceed 2 attempts per task.

### Serial Audit Worker & Dry-Run Surface (`app/api/sync/audit`)

1. **Purpose** – `workers/sync/audit.ts` runs before every ingest to verify the `serial` column is populated. It returns structured metrics (`rowsAudited`, `missingSerialCount`, `skippedRows`) that get persisted to `sync_events` and mirrored to the audit log so operators can remediate sheet issues before data loss occurs.
2. **Dry-run endpoint** – POST `/api/sync/audit` requires a valid NextAuth session (same allowlist as the governance dashboard). Provide an `x-request-id` header for traceability; the endpoint returns immediately with `{ status: "passed" | "blocked", rowsAudited, missingSerialCount, missingSerialRows[] }`.
3. **Live guard** – `/api/sync/run` now invokes the audit worker automatically. If the worker finds missing serials the ingest path short-circuits, writes a `sync_events` entry with `status: skipped` + `reason: serial_audit_blocked`, and returns `SERIAL_AUDIT_FAILED (409)` so cron dashboards show the failure.
4. **Operator guidance** – When dry-run returns `blocked`, use the `missingSerialRows` array (row number + snapshot) to correct the Google Sheet, rerun `/api/sync/audit`, then trigger `/api/sync/manual` or wait for the next scheduled cadence. The runbook should capture the incident reference ID plus the `sync_events` document (search `eventType: SERIAL_AUDIT`).

### Serial Migration CLI (`scripts/backfill-serial.ts`)

1. **Purpose** – Runs immediately after a clean audit to backfill canonical `serial` fields into MongoDB. It reuses the Sheets fetcher (respecting retries), maps legacy `deviceId` → `serial`, and emits a `MIGRATION_RUN` sync_event with summary counts so governance dashboards record the transition.
2. **Flags** – Defaults to dry-run; pass `--apply` to write changes. `--batch-size=<n>` controls Mongo bulk sizes (default 250). `--resume-token=<deviceId>` restarts from a given legacy ID, and `--tab=<name>` overrides the default `Devices` worksheet. Provide `--request-id=<uuid>` to correlate with logs (otherwise auto-generated).
3. **Reports** – Every run writes JSON + Markdown summaries to `docs/stories/reports/serial-migration-*.{json,md}` capturing counts, conflicts, and unresolved rows for operator follow-up. Dry-runs let you review the report before committing.
4. **Execution checklist** – Pause Cloud Tasks/cron triggers, ensure audit output reports zero missing serial rows, run `npx tsx scripts/backfill-serial.ts --apply` (or leave default dry-run first), verify the generated report and `sync_events` entry, then resume scheduled syncs. Roll back via `scripts/reset-sync.ts` if unexpected anomalies appear.

## 5. Rollback / Baseline Reset

1. **Snapshot location**
   - Default baseline lives at `nyu-device-roster/data/devices-baseline.json`. Override per environment via `SYNC_BASELINE_PATH` or the CLI flag `--snapshot=/path/to/file.json`.
   - File format: array of device objects containing `deviceId`, `sheetId`, `assignedTo`, `status`, `condition`, `lastSyncedAt`, and `contentHash`.
2. **CLI utility**
   - Run `npm run reset-sync` (or `npm run reset-sync -- --snapshot=../snapshots/devices.json`) from `nyu-device-roster/`.
   - The script loads `.env.local`, connects to Mongo, deletes the `devices` collection, and re-inserts the baseline inside a Mongo transaction.
   - On success it writes a `sync_events` entry (`status: rollback`) so governance dashboards reflect the manual intervention.
3. **Safety guarantees**
   - Copy-on-write fallback inside `workers/sync` snapshots the previous dataset before mutating. If Mongo rejects the write, the worker restores the snapshot automatically and surfaces `MONGO_WRITE_FAILED`.
   - The CLI utility also records `referenceId` errors so you can correlate rollback attempts with logs.
4. **Post-rollback checklist**
   - Re-run `npm run verify-sync-indexes` to ensure indexes remain intact after the collection swap.
   - Trigger a manual sync to repopulate data with the latest sheet rows once the original issue is resolved.

## 6. Operational Playbook

1. **Before each release**
   - Run `npm test -- google-sheets` inside `nyu-device-roster` to ensure typed-contract coverage passes.
   - Trigger a dry-run by invoking `loadDevicesFromSheets` against the staging sheet to confirm auth and schema stability.
   - Execute `npm run verify-sync-indexes` (runs `scripts/verify-sync-indexes.ts`) to ensure the `(deviceId, sheetId)` unique index and read indexes are present before promoting builds.
2. **During incidents**
   - Check `docs/sprint-status.yaml` for the current story status to confirm whether new code is deployed.
   - Use the Structured Error table to guide remediation, updating the secret or sheet metadata as needed.
3. **After recovery**
   - Capture the incident summary in the Dev Agent Record Completion Notes and attach relevant log excerpts under `docs/runbook/sync-operations.md` for future responders.
   - Re-run `npm run verify-sync-indexes` after manual Mongo interventions to confirm index drift has not occurred.
   - If the rollback utility was used, annotate the `sync_events` entry (referenceId) in your incident report so auditors can trace the restore.
