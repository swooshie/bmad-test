# Story 1.1: Persist admissions manager allowlist

Status: review

## Story

As a demo operator,
I want to persist admissions manager email allowlists and demo configuration in MongoDB,
so that we can update access between demos without redeploying the application.

## Acceptance Criteria

1. Config collection persists allowlisted manager emails, Devices sheet ID, and Mongo collection name, and changes propagate to the running app within one minute without redeploying. [Source: docs/epics.md:52][Source: docs/PRD.md:135]
2. Allowlist management is exposed through a CLI seeding script or admin endpoint that upserts entries and records timestamp plus operator ID for every change. [Source: docs/epics.md:52][Source: docs/architecture.md:99][Source: docs/architecture.md:270]
3. Authentication flow reads the persisted allowlist to permit only `@nyu.edu` admissions managers and logs rejected sign-ins for audit traceability. [Source: docs/PRD.md:113][Source: docs/architecture.md:270]

## Tasks / Subtasks

- [x] Design Config collection schema capturing allowlisted emails, sheet ID, Mongo collection name, and metadata fields for lastUpdatedAt/updatedBy. [Source: docs/architecture.md:240]
  - [x] Implement schema and validation definitions in `models/Config.ts` and shared Zod schema to keep API and DB aligned. [Source: docs/architecture.md:99][Source: docs/architecture.md:240]
- [x] Build CLI seeding script or admin endpoint to insert/update allowlist entries with operator attribution and idempotent upsert behavior. [Source: docs/epics.md:52][Source: docs/architecture.md:99]
  - [x] Write audit logging hook so script or endpoint records change events with timestamp and operator reference. [Source: docs/epics.md:52][Source: docs/architecture.md:270]
- [x] Wire NextAuth sign-in callback to query the Config schema and enforce allowlist decisions, logging rejections at warn level. [Source: docs/PRD.md:113][Source: docs/architecture.md:270]
  - [x] Add verification step to confirm updated allowlists are consumed by `/api/sync` without redeploy and reflected within one minute. [Source: docs/epics.md:52][Source: docs/PRD.md:135]

## Dev Notes

- Configure `models/Config.ts` with Mongoose schema and aligned Zod validator so API and background workers share the same structure. [Source: docs/architecture.md:99][Source: docs/architecture.md:240]
- Ensure NextAuth sign-in callback queries `config` collection and emits warn-level logs for rejections to satisfy governance requirements. [Source: docs/architecture.md:270]
- Seed script should use Secret Manager credentials when executed in App Engine environments to avoid storing secrets locally. [Source: docs/architecture.md:270]

### Project Structure Notes

- Place allowlist seeding utility under `scripts/seed-allowlist.ts` and share helper imports from `lib/auth.ts` per architecture map. [Source: docs/architecture.md:99]
- Keep configuration access helpers in `lib/auth.ts` and `lib/db.ts` to follow the documented module boundaries. [Source: docs/architecture.md:99]

### References

- docs/epics.md:52 — Story A1 requirements and acceptance criteria. [Source: docs/epics.md:52]
- docs/PRD.md:113 — PRD authentication and governance guardrails. [Source: docs/PRD.md:113]
- docs/PRD.md:135 — Whitelist management success criteria. [Source: docs/PRD.md:135]
- docs/architecture.md:99 — Project structure and file placement guidance. [Source: docs/architecture.md:99]
- docs/architecture.md:240 — Config collection definition. [Source: docs/architecture.md:240]
- docs/architecture.md:270 — NextAuth allowlist enforcement and auditing. [Source: docs/architecture.md:270]

## Dev Agent Record

### Context Reference

- `docs/stories/1-1-persist-admissions-manager-allowlist.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-05T15:39Z — `npm run test` (vitest) all suites passed, covering auth options, session middleware, and config helpers.
- 2025-11-05T15:34Z — Seed workflow dry-run via unit tests validating normalization and audit diff logic.

### Completion Notes List

- AC1 — Created `models/Config.ts` and `schemas/config.ts` with aligned validation, plus cached loader in `lib/config.ts` to expose Mongo-backed config across app layers.
- AC2 — Added `scripts/seed-allowlist.ts` CLI that upserts allowlist entries with operator attribution and emits structured audit logs; change events captured in the config document history.
- AC3 — Enforced allowlist in `lib/auth/options.ts` sign-in callback with warn-level rejections through `logAllowlistRejection`, ensuring `/api/sync` consumers see updates within a 30s cache window.

### File List

- `nyu-device-roster/package.json`
- `nyu-device-roster/package-lock.json`
- `nyu-device-roster/src/lib/db.ts`
- `nyu-device-roster/src/models/Config.ts`
- `nyu-device-roster/src/schemas/config.ts`
- `nyu-device-roster/src/lib/config.ts`
- `nyu-device-roster/src/lib/logging.ts`
- `nyu-device-roster/src/lib/auth/options.ts`
- `nyu-device-roster/scripts/seed-allowlist.ts`
- `nyu-device-roster/tests/unit/lib/auth/sessionMiddleware.test.ts`
- `nyu-device-roster/tests/unit/lib/auth/options.test.ts`
- `nyu-device-roster/tests/unit/lib/config.test.ts`
- `docs/stories/1-1-persist-admissions-manager-allowlist.context.xml`

## Change Log

- Initial draft created by Scrum Master workflow (2025-11-04).
- Implementation pass by Amelia (2025-11-05): added Mongo config model/Zod schema, seeding CLI with audit log hook, allowlist-enforced NextAuth callbacks, and supporting tests.
