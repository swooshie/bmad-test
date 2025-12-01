# Deployment Guide

## Hosting Model
- **Next.js App Router** deployed to Vercel or App Engine (current cron config mirrors App Engine flexible/standard conventions).
- **MongoDB Atlas** hosts persistence collections (Device, Config, AuditLog, SyncEvent, SyncLock).
- **Google Sheets** remains upstream source; service account credentials stored in Google Secret Manager or environment-specific vault.
- **Scheduler** hits `/api/sync/run` every 2 minutes using App Engine cron (`cron.yaml`).

## Environment Configuration
- `MONGODB_URI` – connection string with `?replicaSet` for transactions if needed.
- `GOOGLE_SERVICE_ACCOUNT` – JSON or base64 env powering `google-sheets.ts`.
- `NEXTAUTH_*` – NextAuth secret + allowed providers.
- `SYNC_SCHEDULER_TOKEN` – shared secret validated by `/api/sync/run` (sent via `X-Internal-Service-Token`).
- `TELEMETRY_WEBHOOK_*` – optional Slack/Teams webhook metadata for metrics POST ingestion.
- `ALLOWED_EMAIL_DOMAIN / ADMISSIONS_ALLOWLIST` – whichever config values you store around user gating (or rely entirely on Config collection).

Store secrets in the platform’s secret manager (Vercel, GCP Secret Manager, AWS SM). The repo intentionally keeps `.json` samples for local dev only.

## Build & Release Pipeline
1. **CI** – Run `npm run lint`, `npm run test`, Playwright accessibility, and `npm run verify-sync-indexes`.
2. **Artifact** – Next.js production build (`next build`) plus bundling worker scripts.
3. **Deploy** – Promote to staging via Vercel/GCP; ensure environment has cron + secrets configured.
4. **Smoke Tests** – Execute `npm run smoke` or `scripts/smoke.ts` with admissions credentials.
5. **Monitor** – Confirm `/api/metrics` totals update and `SyncStatusBanner` shows healthy state.

## Scheduler & Automation
- **Cron (`cron.yaml`)** triggers `/api/sync/run` every two minutes with retries/backoff (limit 5, 30–300s). Remember to set `X-Internal-Service-Token` in scheduler headers referencing the secret you configure.
- **Sync Worker** runs inside the Next.js runtime (Route Handler) but acquires `SyncLock` to prevent concurrent writes; ensure instance memory/timeout can handle largest Sheets payload.

## Rollback Strategy
- Use `npm run snapshot:restore` / `scripts/rollback.ts --confirm` to restore Mongo snapshots.
- Keep `sync_locks` clear before rollback to avoid stuck states.
- Track `project-scan-report.json` + `docs/index.md` in source control so documentation stays aligned after rollback.

## Observability & Ops
- `logger` writes Pino-formatted logs; pipe to Stackdriver/Datadog.
- `/api/metrics` POST endpoint can forward metrics to Slack/Teams (enable via env flags).
- `AuditLog` + `SyncEvent` collections provide tamper-resistant audit trails—monitor for abnormal spikes.

## Deployment Checklist
- [ ] Secrets rotated and stored in platform vault
- [ ] Cron scheduled with correct headers/token
- [ ] Mongo indexes verified post-migration (`verify-sync-indexes`)
- [ ] Telemetry webhook optional but configured when enabled
- [ ] Document new release in `docs/sprint-status.yaml` or runbook as needed

Use this deployment guide when promoting new Mongo index changes or sync worker updates.
