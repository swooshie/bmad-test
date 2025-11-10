# Story 1.5: Allowlist maintenance endpoint with role gating

Status: review

## Story

As a lead manager, I want a protected `/api/config/allowlist` endpoint that lets me review and update the admissions manager email list so we can keep demo access synchronized without redeploying and always capture who changed the roster.

### Requirements & Context Summary

- Epic A story A5 defines gated GET/PUT operations on `/api/config/allowlist`, limited to JWTs carrying `managerRole=lead`, with responses that show added/removed emails so the admin console stays trustworthy. Updates must validate `@nyu.edu` addresses and write actor/timestamp entries to the audit log. `Prerequisites: Stories A1–A3.` (docs/epics.md:88)
- FR-002 in the PRD requires allowlist changes to take effect on the next login and mandates an audit reference for every modification, so this endpoint must tie into the config collection and audit trail without manual redeploys. (docs/PRD.md:159)
- The PRD’s auth model issues role-aware JWT claims—lead managers receive elevated rights for configuration and audit APIs—making role-gated access and structured error responses (403 with `{ errorCode, message, details }`) part of the acceptance scope. (docs/PRD.md:101,111)
- Architecture decisions lock in NextAuth with a Secret-Manager-backed allowlist look-up, storing configuration inside the `config` collection that also feeds `/api/config`, so the new endpoint must reuse that persistence layer and Pino-logged audit events. (docs/architecture.md:18,240,264)
- Security architecture enforces domain restriction, signed cookies, and audit logging on allowlist rejections; this story must append events to the same pipeline so governance dashboards surface who changed access and when. (docs/architecture.md:268)

## Acceptance Criteria

1. `/api/config/allowlist` exposes GET and PUT methods that require an authenticated session token containing `managerRole=lead`; non-lead or anonymous calls receive a structured 403 response `{ errorCode, message, details }` logged for governance. [Source: docs/epics.md:88, docs/PRD.md:101-117]
2. Responses include the current allowlist plus a diff summary (`added`, `removed`, `unchanged`) so the admin console or CLI can narrate what changed after each update. [Source: docs/epics.md:88]
3. PUT requests validate that every email ends with `@nyu.edu`, reject invalid entries with descriptive errors, and ensure duplicate addresses are ignored without crashing the request. [Source: docs/epics.md:88, docs/PRD.md:161-165]
4. Successful updates persist to the shared `config` collection and take effect on the very next login attempt without redeploying the app. [Source: docs/PRD.md:159, docs/architecture.md:240]
5. Every change writes an audit entry (actor, timestamp, added/removed lists) into the structured logging pipeline and `sync_events` (or equivalent audit store) at warn level, ensuring governance dashboards show who modified access. [Source: docs/epics.md:88, docs/architecture.md:227,268]

## Tasks / Subtasks

- [x] Design API contract for `/api/config/allowlist` GET/PUT, including error envelope and diff summary schema. (AC: 1-2)
  - [x] Confirm role claim (`managerRole=lead`) propagation through NextAuth session and document response codes. (AC: 1)
- [x] Extend `models/Config.ts` and `schemas/config.ts` with allowlist CRUD helpers plus validation utilities enforcing `@nyu.edu`. (AC: 3-4)
  - [x] Add unit tests covering invalid emails, duplicates, and persistence side effects. (AC: 3)
- [x] Implement `app/api/config/allowlist/route.ts` using shared auth middleware, returning current allowlist and diff summaries after writes. (AC: 1-2,4)
  - [x] Ensure PUT persists to Mongo within a transaction or atomic operation and reuses existing config schema. (AC: 4)
- [x] Instrument Pino logging + `sync_events` appenders capturing actor, timestamp, added/removed lists, and error conditions. (AC: 5)
  - [x] Verify audit entries appear in governance dashboards/log viewers as described in architecture. (AC: 5)
- [x] Add regression tests (API and integration) ensuring GET/PUT enforce role gating, emit structured responses, and update allowlist immediately. (AC: 1-4)

## Dev Notes

- Previous story status is still `drafted`, so there are no downstream learnings, reusable services, or review findings to import yet. Coordinate with the owner of Story 1.4 before touching shared auth/config modules to avoid duplicate implementation work. (docs/sprint-status.yaml:20)
- Reference the unified project structure from `docs/architecture.md` when placing Next.js route files (`app/api/config/allowlist/route.ts`), shared Mongoose models (`models/Config.ts`), and supporting libraries (`lib/auth.ts`, `lib/audit.ts`) so future stories can reuse the same boundaries. (docs/architecture.md:45)
- Audit logging must continue using the Pino JSON pipeline described in the architecture doc—emit warn-level events tagged with `workflow=allowlist-maintenance` and store change metadata in `sync_events` for governance rollups. (docs/architecture.md:227)

### Project Structure Notes

- API route: `app/api/config/allowlist/route.ts` (App Router) with shared helper imported from `lib/routes.ts`. (docs/architecture.md:45)
- Domain logic: Extend `models/Config.ts` for allowlist read/write plus audit metadata, keeping Zod schemas in `schemas/config.ts`. (docs/architecture.md:45)
- Command scripts: If CLI tooling is needed, co-locate updates with existing `scripts/seed-allowlist.ts` to maintain a single administrative entry point. (docs/architecture.md:99)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Context Reference

- docs/stories/1-5-allowlist-maintenance-endpoint-with-role-gating.context.xml (generated 2025-11-10)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

1. Plan (AC1-AC5): Confirm session middleware exposes `managerRole` claims, define `/api/config/allowlist` GET/PUT response envelopes (200 + diff summary / 403 `{ errorCode, message, details }`), and map implementation to shared config/audit helpers so subsequent tasks can build the route, validation, and logging without duplicating logic.
2. Validation (AC1-AC5): Implemented lead-gated route, config/audit helpers, and executed `npm test` (vitest run) to cover schema validation and new `/api/config/allowlist` workflows.

### Completion Notes List

- AC1-AC5: Delivered `/api/config/allowlist` GET/PUT with `managerRole=lead` enforcement, NYU-only validation, diff summaries, warn-level logging plus `sync_events` entries, and documented regression coverage via `npm test`.

### File List

- `docs/sprint-status.yaml`
- `docs/stories/1-5-allowlist-maintenance-endpoint-with-role-gating.md`
- `nyu-device-roster/scripts/seed-allowlist.ts`
- `nyu-device-roster/src/app/api/config/allowlist/route.ts`
- `nyu-device-roster/src/lib/audit/syncEvents.ts`
- `nyu-device-roster/src/lib/auth/sessionMiddleware.ts`
- `nyu-device-roster/src/lib/config.ts`
- `nyu-device-roster/src/lib/logging.ts`
- `nyu-device-roster/src/models/SyncEvent.ts`
- `nyu-device-roster/src/schemas/config.ts`
- `nyu-device-roster/tests/unit/app/api/config/allowlist/route.test.ts`
- `nyu-device-roster/tests/unit/lib/config.test.ts`

## Change Log

- 2025-11-10 — Amelia: Implemented lead-gated `/api/config/allowlist` API, config validation tightening, audit logging hooks, and regression tests; moved story to review.
