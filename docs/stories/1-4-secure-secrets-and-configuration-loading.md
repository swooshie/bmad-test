# Story 1.4: Secure secrets and configuration loading

Status: review

## Requirements Context Summary

- Secrets that power Google OAuth, MongoDB, and Sheets access must live in Google Secret Manager and be fetched by the App Engine runtime at startup, with caching and refresh on rotation so credentials never land in the repo or logs. [Source: docs/epics.md:79][Source: docs/architecture.md:145][Source: docs/architecture.md:289]
- The configuration loader needs to merge those secrets with the allowlist, sheet ID, and collection metadata persisted in Story A1’s `config` collection so `/api/sync` and session enforcement always read the latest operator inputs without redeploying. [Source: docs/epics.md:83][Source: docs/PRD.md:165][Source: docs/architecture.md:125]
- Startup must fail fast—with an actionable error and audit entry—whenever required secrets are missing or invalid, protecting governance expectations and keeping unauthorized deployments from running. [Source: docs/epics.md:84][Source: docs/PRD.md:183]
- App Engine’s service account requires `roles/secretmanager.secretAccessor`, and the Next.js service should surface hydrated secrets through server-only loaders so NextAuth, `lib/google-sheets.ts`, and database clients run with least-privilege credentials. [Source: docs/architecture.md:145][Source: docs/architecture.md:293][Source: docs/architecture.md:302]

## Story

As a platform owner,  
I want Sheets API credentials and MongoDB connection strings stored in Google Secret Manager and loaded into the app configuration at runtime,  
so that sensitive data never lands in code or logs and operators can rotate secrets without redeploying. [Source: docs/epics.md:79]

## Acceptance Criteria

1. App Engine runtime fetches `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, session signing key, Mongo connection string, and Sheets service credentials from Secret Manager at startup with caching plus documented rotation path. [Source: docs/epics.md:82][Source: docs/architecture.md:145][Source: docs/architecture.md:293]
2. Configuration loader merges those secrets with allowlist, sheet ID, and collection metadata from Story A1’s `config` collection so `/api/sync` and NextAuth run using the latest operator inputs without redeploying. [Source: docs/epics.md:83][Source: docs/PRD.md:165][Source: docs/architecture.md:125]
3. Startup fails fast with an actionable error message and audit log entry if any required secret is missing, invalid, or fails decryption, preventing the service from running with partial configuration. [Source: docs/epics.md:84][Source: docs/PRD.md:183][Source: docs/architecture.md:289]
4. Calling services (NextAuth, sync workers, database bootstrap) read from the shared config module and no longer access env vars directly, ensuring a single trustworthy secret source. [Source: docs/architecture.md:125]

## Tasks / Subtasks

- [x] Implement `lib/secrets.ts` (or expand Secret Manager helper) to fetch Google OAuth credentials, NextAuth signing key, Mongo URI, and Sheets service account JSON with caching + rotation hooks; expose typed accessors for downstream consumers. (AC1) [Source: docs/architecture.md:145][Source: docs/architecture.md:293]
  - [x] Add unit tests that mock Secret Manager responses to validate retry/backoff, cache invalidation, and rotation updates. (AC1)
- [x] Extend `lib/config.ts` (or equivalent) to merge Story A1 `config` collection entries (allowlist, sheet ID, collection name) with hydrated secrets, returning a single config object consumed by NextAuth, sync worker, and database modules. (AC2) [Source: docs/PRD.md:165][Source: docs/architecture.md:125]
  - [x] Add integration checks proving `/api/sync` and NextAuth refuse to bootstrap when merged configuration is incomplete or stale. (AC2)
- [x] Implement startup guard (`validateConfig()` or server init hook) that halts deployment with actionable error messaging, emits Pino logs, and writes audit entries to `sync_events` when secrets/config records are missing or invalid. (AC3) [Source: docs/epics.md:84][Source: docs/architecture.md:21]
  - [x] Route missing-secret alerts into governance monitoring (log-based metrics or Cloud Monitoring) so operators can react quickly. (AC3)
- [x] Refactor consuming modules (`lib/auth.ts`, `lib/google-sheets.ts`, Mongo bootstrap) to import the shared config/secrets module instead of reading process env variables, ensuring a single source of truth. (AC4) [Source: docs/architecture.md:125]

## Dev Notes

- Learnings from Story 1-3: the session middleware already consumes Secret Manager-fed NextAuth config; reuse its `lib/auth/sessionMiddleware.ts` patterns and logging hooks instead of inventing new auth plumbing. [Source: docs/stories/1-3-session-middleware-and-audit-logging-for-auth-failures.md:1]
- Pino logging with audit fan-out is mandatory—emit structured events when secrets missing or rotation fails so governance dashboards stay consistent. [Source: docs/architecture.md:153]
- Testing must cover Secret Manager retries and config merge fallbacks using mocked clients to avoid touching live secrets.

### Learnings from Previous Story

**From Story 1-3-session-middleware-and-audit-logging-for-auth-failures (Status: review)** [Source: docs/stories/1-3-session-middleware-and-audit-logging-for-auth-failures.md:1]

- New middleware + logging utilities already exist (`lib/auth/sessionMiddleware.ts`, `lib/logging.ts`, tests under `tests/unit/lib/auth`); reuse these modules when wiring secrets/config rather than duplicating auth or logging code.
- Completion notes highlight structured logging expectations and alert thresholds for repeated auth failures—mirror the same conventions for missing-secret events so governance dashboards stay aligned.
- Pending dependency: Story 1-2 (OAuth allowlist) still drafted; plan to integrate its NextAuth configuration once implementation lands to avoid diverging session handling paths.

### Project Structure Notes

- Follow the architecture map: secrets loader under `lib/` (e.g., `lib/secrets.ts`), configuration merging in `lib/config.ts`, audit logging via `lib/logging.ts`; this keeps components aligned with Epic A’s responsibilities. [Source: docs/architecture.md:125]
- No new directories required; continue extending existing `lib/` modules and ensure API routes under `app/api` import the central config instead of reading environment variables directly.

### References

- docs/epics.md — Story A4 acceptance criteria and prerequisites. [Source: docs/epics.md:79]
- docs/PRD.md — FR-003 sheet registration and governance expectations. [Source: docs/PRD.md:165]
- docs/architecture.md — Secret Manager integration, config modules, and App Engine deployment guardrails. [Source: docs/architecture.md:125][Source: docs/architecture.md:145][Source: docs/architecture.md:293]
- docs/stories/1-3-session-middleware-and-audit-logging-for-auth-failures.md — Prior story learnings about auth scaffolding and logging. [Source: docs/stories/1-3-session-middleware-and-audit-logging-for-auth-failures.md:1]

## Change Log

- Draft updated by Scrum Master workflow (2025-11-05).
- 2025-11-10: Implemented Secret Manager loader, runtime config merge, and startup guard with full Vitest coverage.
- 2025-11-10: Story marked ready for review after completing AC1-AC4 and updating sprint status.

## Dev Agent Record

### Context Reference

- docs/stories/1-4-secure-secrets-and-configuration-loading.context.xml (generated 2025-11-10)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-10: Planned implementation – add `lib/secrets.ts` with Google Secret Manager client plus caching/rotation invalidation, extend `lib/config.ts` with a merged runtime config accessor, wire a startup guard that halts + audits on missing inputs, and refactor consumers/tests to satisfy AC1-AC4.
- 2025-11-10: Built `lib/secrets.ts`, runtime config merge, and startup guard; refactored auth/db consumers plus audit plumbing to ensure fail-fast behavior and single-source secrets.
- 2025-11-10: Executed `npm test` (Vitest) covering new secret loader, config runtime helper, auth options, and session middleware suites.

### Completion Notes List

- Unified runtime secrets: added `src/lib/secrets.ts` with Secret Manager client, caching/rotation hooks, and Vitest coverage for retry/backoff plus env fallbacks, then wired NextAuth/DB consumers through `ensureRuntimeConfig` so AC1/AC4 reuse a single secrets surface.
- Merged Mongo config + hydrated secrets via `loadRuntimeConfig`, added startup guard/audit logging (new `CONFIG_VALIDATION` sync events) to fail fast when config/secrets are missing and emit structured alerts per AC2-AC3.
- Updated auth/session modules, logging, and database helpers to consume the shared runtime config and added comprehensive tests (`npm test`) proving NextAuth allowlist handling, middleware, config merge caching, and Secret Manager edge cases.
### File List

- docs/sprint-status.yaml
- docs/stories/1-4-secure-secrets-and-configuration-loading.md
- nyu-device-roster/package.json
- nyu-device-roster/package-lock.json
- nyu-device-roster/src/lib/secrets.ts
- nyu-device-roster/src/lib/config.ts
- nyu-device-roster/src/lib/db.ts
- nyu-device-roster/src/lib/logging.ts
- nyu-device-roster/src/lib/audit/syncEvents.ts
- nyu-device-roster/src/models/SyncEvent.ts
- nyu-device-roster/src/lib/auth/options.ts
- nyu-device-roster/tests/unit/lib/secrets.test.ts
- nyu-device-roster/tests/unit/lib/config.test.ts
- nyu-device-roster/tests/unit/lib/auth/options.test.ts
- nyu-device-roster/tests/unit/lib/auth/sessionMiddleware.test.ts
