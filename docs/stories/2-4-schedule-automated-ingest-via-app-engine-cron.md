# Story 2.4: Schedule automated ingest via App Engine cron

Status: drafted

## Story

As a reliability engineer, I want an App Engine cron (Cloud Scheduler) job that triggers the Google Sheets → MongoDB ingest pipeline every two minutes so the roster stays current even when no one runs manual refresh.

### Requirements & Context Summary

- Epic B4 mandates a cron entry that calls `/internal/sync`, honors an enable/disable flag, skips overlapping runs gracefully, and records run metadata (runId, status, rows processed, error summary). (docs/epics.md:133-140)
- PRD FR-004 requires scheduled syncs during demo mode: cron hits `/internal/sync`, logs duration/rows processed/anonymization state, and ensures data freshness without manual intervention. (docs/PRD.md:160-174)
- Architecture defines the sync pipeline as Cloud Scheduler → Cloud Tasks → `/api/sync/run`, using service-account headers, `workers/sync` shared logic, structured logging (`requestId`, counts, latency), and `sync_events` persistence for every run. (docs/architecture.md:145-267)
- Config data (`config` collection) stores cadence metadata and feature flags; schedule changes must read from this source so operators can pause/resume cron without redeploying. (docs/architecture.md:227-243)
- Story 2.3 already delivers manual triggers and optimistic status broadcasting—scheduled runs must reuse the exact worker, logging, and audit patterns to avoid split-brain status indicators. (docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md#Implementation-Alignment)

## Acceptance Criteria

1. A Cloud Scheduler/App Engine cron entry fires every 2 minutes (configurable) and authenticates via service token headers, invoking `/internal/sync` (or `/api/sync/run`) which enqueues the shared sync worker. [Source: docs/epics.md:133-134, docs/architecture.md:145-254]
2. Cron respects an enable/disable flag + cadence value stored in the `config` collection; disabling skips new runs (with warning log) while preserving manual refresh capability. [Source: docs/epics.md:134, docs/architecture.md:227-243]
3. Scheduled runs detect overlapping executions—if one is still in-flight, the new run logs a skip with reason and does not start another ingest cycle, preventing double writes. [Source: docs/epics.md:134, docs/architecture.md:247-254]
4. Every cron-triggered run records an entry in `sync_events` with runId, trigger=`scheduled`, duration, rows processed, anonymization state, and any error code, plus emits structured logs for observability dashboards. [Source: docs/epics.md:134, docs/architecture.md:227-254]
5. SLA adherence: cron path shares the same transformer/upsert modules from Stories 2.1–2.3, completes under 60 seconds, and surfaces FR-012 error envelopes to the UI status banner so managers see the latest scheduled outcome. [Source: docs/PRD.md:160-190, docs/architecture.md:247-254]
6. Automated tests (unit + integration) cover config gating, overlap handling, audit logging, and service-account authentication so regressions are caught before deployment. [Source: docs/architecture.md:101-105]

## Tasks / Subtasks

- [ ] Define Cloud Scheduler/App Engine cron configuration (yaml + docs) targeting `/internal/sync` (or `/api/sync/run`) with signed header or service token drawn from Secret Manager. (AC: 1)
  - [ ] Ensure cadence (default 2 minutes) and enable flag are parameterized via `config` collection to avoid redeploys. (AC: 2)
- [ ] Update `/api/sync/run` handler to read config flags, bail early (with log) when disabled, and attach `triggerType=scheduled` metadata when enqueuing the worker. (AC: 1-2)
- [ ] Implement overlap guard (e.g., Redis/memory lock, `sync_events` lookup) so concurrent cron fires skip or queue gracefully, logging `skipped_due_to_inflight`. (AC: 3)
- [ ] Extend `workers/sync` to tag scheduled runs, emit structured logs with runId/counts/duration, and persist `sync_events` with trigger + anonymization snapshot. (AC: 4-5)
- [ ] Add monitoring hooks/metrics for scheduled success rate and latency; update `docs/runbook/sync-operations.md` with instructions for pausing cron and interpreting logs. (AC: 4-5)
- [ ] Testing: add unit tests for config gating + authentication, integration test simulating overlapping runs, and audit-log assertions for scheduled trigger entries. (AC: 6)

## Dev Notes

### Learnings from Previous Story

- **From Story 2-3 (Status: drafted)** – Manual refresh already enqueues the shared worker and broadcasts optimistic status; scheduled runs must reuse the same pipeline (`lib/google-sheets.ts`, `workers/sync/transform.ts`, `models/SyncEvent.ts`) to keep telemetry and audit records consistent. (docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md#Implementation-Alignment)
- Story 2-3 added governance expectations for `sync_events` entries with anonymization state; this story should extend those schemas with `triggerType=scheduled` and reuse the same logging helpers. (docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md#Tasks-/-Subtasks)

### Implementation Alignment

- Declare cron schedule in `cron.yaml` (App Engine) or Cloud Scheduler IaC; target `app/api/sync/run` or dedicated `/internal/sync` route that checks `X-Appengine-Cron` or signed token. (docs/architecture.md:145-254)
- Use `withApiEnvelope` + `AppError` for `/api/sync/run` responses so FR-012 error contracts stay uniform between manual and scheduled runs. (docs/architecture.md:210-264)
- Config gating: extend `models/Config.ts` or `schemas/config.ts` with `sync.enabled`, `sync.intervalMinutes`, and fetch once per request (cache w/ TTL). Document expected fields in runbook. (docs/architecture.md:227-243)
- Overlap guard options: Cloud Tasks queue with `maxDispatchesPerSecond=1`, explicit lock in Mongo/Redis, or `sync_events` lookup for `status=running`. Choose approach aligning with architecture’s “skip overlapping runs gracefully” directive. (docs/epics.md:134, docs/architecture.md:247-254)
- Logging: `lib/logging.ts` should emit `triggerType`, `runId`, `queueLatencyMs`, `rowsProcessed`, and `durationMs` so Cloud Monitoring charts stay accurate. (docs/architecture.md:227-254)

### Project Structure Notes

- Files likely touched: `cron.yaml` (new or updated), `app/api/sync/run/route.ts`, `workers/sync/index.ts`, `models/SyncEvent.ts`, `models/Config.ts`, `docs/runbook/sync-operations.md`, `tests/integration/sync.spec.ts`. (docs/architecture.md:45-155,227-254)
- Secrets: service token/headers for cron should be stored in Secret Manager and injected at deploy; document env var names in `nyu-device-roster/.env.example`.
- Consider adding a CLI/helper script to toggle `sync.enabled` and adjust cadence (or document the Mongo command) for demo operators.

### Testing & Observability

- Unit tests: verify `/api/sync/run` rejects unauthenticated cron calls, honors config flags, and sets `triggerType=scheduled`.
- Integration tests: simulate successive cron invocations to assert overlap guard + audit logging.
- Monitoring: add log-based metrics `scheduled_sync_success_rate`, `scheduled_sync_duration_ms`, and alerts if cron fails twice consecutively. (docs/architecture.md:227-254)

### References

- [Source: docs/epics.md:133-140]
- [Source: docs/PRD.md:160-190]
- [Source: docs/architecture.md:145-267]
- [Source: docs/stories/2-3-implement-manual-sync-endpoint-with-optimistic-status.md]

## Change Log

- _Pending initial implementation._

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
