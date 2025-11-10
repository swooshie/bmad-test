# Story 1.4: Secure secrets and configuration loading

Status: drafted

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

- [ ] Implement `lib/secrets.ts` (or expand Secret Manager helper) to fetch Google OAuth credentials, NextAuth signing key, Mongo URI, and Sheets service account JSON with caching + rotation hooks; expose typed accessors for downstream consumers. (AC1) [Source: docs/architecture.md:145][Source: docs/architecture.md:293]
  - [ ] Add unit tests that mock Secret Manager responses to validate retry/backoff, cache invalidation, and rotation updates. (AC1)
- [ ] Extend `lib/config.ts` (or equivalent) to merge Story A1 `config` collection entries (allowlist, sheet ID, collection name) with hydrated secrets, returning a single config object consumed by NextAuth, sync worker, and database modules. (AC2) [Source: docs/PRD.md:165][Source: docs/architecture.md:125]
  - [ ] Add integration checks proving `/api/sync` and NextAuth refuse to bootstrap when merged configuration is incomplete or stale. (AC2)
- [ ] Implement startup guard (`validateConfig()` or server init hook) that halts deployment with actionable error messaging, emits Pino logs, and writes audit entries to `sync_events` when secrets/config records are missing or invalid. (AC3) [Source: docs/epics.md:84][Source: docs/architecture.md:21]
  - [ ] Route missing-secret alerts into governance monitoring (log-based metrics or Cloud Monitoring) so operators can react quickly. (AC3)
- [ ] Refactor consuming modules (`lib/auth.ts`, `lib/google-sheets.ts`, Mongo bootstrap) to import the shared config/secrets module instead of reading process env variables, ensuring a single source of truth. (AC4) [Source: docs/architecture.md:125]

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

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
