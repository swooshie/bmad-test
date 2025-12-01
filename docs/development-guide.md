# Development Guide

## Prerequisites
- Node.js 20+
- npm (or pnpm/yarn/bun) – scripts assume npm but alternatives supported.
- MongoDB instance (local or Atlas) reachable via `MONGODB_URI`.
- Google service account JSON with Sheets access (see `config/local-dev/sheets-service-account.sample.json`).
- NextAuth secrets: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Google OAuth client credentials.
- Optional telemetry env: `TELEMETRY_WEBHOOK_ENABLED`, `TELEMETRY_WEBHOOK_URL`, `TELEMETRY_WEBHOOK_CHANNEL`.

## Environment Setup
1. Copy `.env.local.example` (if present) or create `.env.local` with Mongo URI, Google secrets, NextAuth keys, `SYNC_SCHEDULER_TOKEN`, etc.
2. Install dependencies:
   ```bash
   cd nyu-device-roster
   npm install
   ```
3. Place service account JSON under `config/local-dev/` and point env var `GOOGLE_SERVICE_ACCOUNT_PATH` at it.
4. Seed Mongo collections if needed using `npm run scripts:reset-sync` (or `tsx scripts/reset-sync.ts`).

## Common Commands (`package.json`)
- `npm run dev` – Next.js dev server at http://localhost:3000.
- `npm run build && npm start` – production build & serve.
- `npm run lint` – ESLint 9 + Next lint config.
- `npm run test` – Vitest unit suite; `npm run test:watch` for watch mode.
- `npm run test:accessibility` – Playwright axe + Lighthouse checks.
- `npm run verify-sync-indexes` – Ensures Mongo indexes match schema (especially important while re-keying `deviceId`).
- `npm run reset-sync` – Clears locks/collections for a fresh ingest.
- `npm run smoke` – Orchestrated smoke script hitting key APIs.
- `npm run perf:lighthouse` – Node-based Lighthouse CI checks (desktop + mobile budgets).

## Recommended Workflow
1. Run `npm run dev` and visit `/` to verify UI loads with anonymization toggled off/on.
2. Trigger manual sync via `/api/sync/run` (POST) or UI CTA to ensure Google Sheets credentials work.
3. Inspect `SyncEvent` + `AuditLog` collections for telemetry before modifying indexes.
4. Before merging index changes, run `npm run verify-sync-indexes`, `npm run test`, and `npm run test:accessibility`.

## Troubleshooting Tips
- **Session failures:** Ensure Google OAuth credentials and NextAuth secret exist; check `/api/session` for 401s.
- **Sync stuck:** Inspect `sync_locks` collection; run `npm run reset-sync` to release stale locks.
- **Metrics webhook errors:** Set `TELEMETRY_WEBHOOK_ENABLED=false` in local dev to bypass Slack/Teams missing config.
- **Index migration:** Use `scripts/verify-sync-indexes.ts` and `scripts/reset-sync.ts` before rolling out new keys.

Keep this guide close when onboarding new developers or running the upcoming index realignment project.
