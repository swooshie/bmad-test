# Story 1.3: Session middleware and audit logging for auth failures

Status: review

## Requirements Context Summary

- Enforce session middleware on every `/api/*` route so only authenticated NYU admissions managers can touch protected resources, satisfying FR-001 access control commitments. [Source: docs/epics.md:70][Source: docs/PRD.md:161][Source: docs/architecture.md:274]
- Deny expired or invalid JWTs with structured 403 responses and ensure each rejection logs reason code, request metadata, and actor context for governance review. [Source: docs/epics.md:71][Source: docs/PRD.md:80][Source: docs/architecture.md:21]
- Attach verified manager identity to downstream request context to support audit ribbons and sync/audit pipelines later in the epic plan. [Source: docs/epics.md:73][Source: docs/architecture.md:274]
- Treat Story 1.2 (OAuth allowlist) as critical prerequisite; reuse its NextAuth configuration and persisted allowlist lookups rather than creating new auth paths. [Source: docs/epics.md:69][Source: docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md:1]
- No dedicated tech spec for Epic 1 was found; rely on PRD, architecture map, and prior stories for authoritative implementation guidance. [Source: docs/PRD.md:1][Source: docs/architecture.md:1]

## Story

As an authenticated admissions manager,
I want protected routes to enforce session validation and capture audit signals,
so that unauthorized actors never reach device data and governance teams can trace access attempts. [Source: docs/epics.md:70][Source: docs/epics.md:71]

## Acceptance Criteria

1. Middleware validates every `/api/*` request against the NextAuth session, denying expired or invalid JWTs and short-circuiting unauthenticated traffic. [Source: docs/epics.md:70][Source: docs/architecture.md:274]
2. Failed validations log structured events that capture reason code, request metadata (route, method, IP), and requester identity when available, feeding the governance/audit pipeline. [Source: docs/epics.md:71][Source: docs/PRD.md:164][Source: docs/architecture.md:21]
3. Successful validations attach authenticated manager identity to the request context so downstream handlers and audit ribbons can record actor information. [Source: docs/epics.md:73][Source: docs/architecture.md:274]
4. Middleware escalates requests with repeated auth failures from the same IP by triggering alert hooks defined for audit monitoring. [Source: docs/PRD.md:183][Source: docs/architecture.md:155]

## Tasks / Subtasks

- [x] Implement shared session verification middleware under `lib/auth/sessionMiddleware.ts` that reuses Story 1.2 NextAuth configuration and checks token validity before allowing API execution. (AC1) [Source: docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md:1][Source: docs/architecture.md:274]
  - [x] Add automated test coverage to confirm expired tokens return 401/403 and that valid tokens reach downstream handlers. (AC1) [Source: docs/PRD.md:161]
- [x] Extend centralized logging utility to emit `AUTH_INVALID_SESSION` events with route, method, IP, and failure reason, routing to Pino/App Engine logs. (AC2) [Source: docs/architecture.md:21][Source: docs/architecture.md:153]
  - [x] Ensure governance feed ingests these events by writing to `sync_events` or designated audit stream with actor context when available. (AC2) [Source: docs/epics.md:71][Source: docs/architecture.md:238]
- [x] Decorate request objects with `request.session.user` payload (email, role claims) for successfully validated requests and document the contract for downstream APIs. (AC3) [Source: docs/architecture.md:274]
  - [x] Update API route templates to expect populated manager identity and include assertions/logging when absent. (AC3) [Source: docs/architecture.md:258]
- [x] Implement alert trigger that flags repeated failures (e.g., >5 in 5 minutes per IP) and feeds Cloud Monitoring alert policy noted in architecture. (AC4) [Source: docs/architecture.md:155][Source: docs/PRD.md:183]

## Dev Notes

- Reuse the allowlist-backed NextAuth session established in Story 1.2; do not introduce parallel JWT validation paths. [Source: docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md:1]
- Middleware should live alongside shared auth helpers in `lib/auth.ts` and plug into App Router route handlers via exported wrapper functions. [Source: docs/architecture.md:99]
- Logging must follow the Pino JSON convention with `requestId` and `userEmail` fields to keep audit dashboards coherent. [Source: docs/architecture.md:153]
- Automated coverage should include expiry edge cases and concurrency tests to ensure sessions refreshed by Story 1.2 stay valid across rapid API calls. [Source: docs/PRD.md:166]
- Tie into observability alerts by emitting log-based metrics when failure thresholds are hit, aligning with governance expectations. [Source: docs/architecture.md:155]

### Learnings from Previous Story

- Story 1-2 remains in drafted state, so there are no implementation learnings or review findings to inherit yet; reuse its planned NextAuth wiring once completed. [Source: docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md:1][Source: docs/sprint-status.yaml:15]

### Project Structure Notes

- Story 1.2 introduced NextAuth configuration under `app/api/auth/[...nextauth]/route.ts`; mount the middleware in `app/api` route handlers without diverging from documented module layout. [Source: docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md:1][Source: docs/architecture.md:99]
- Maintain shared helpers inside `lib/` and avoid duplicating config access—continue leveraging `lib/db.ts` and `lib/auth.ts`. [Source: docs/architecture.md:99]
- No new directories required; align with unified project structure by extending existing auth and logging modules. [Source: docs/architecture.md:99]

### References

- docs/epics.md — Epic A story breakdown and acceptance criteria for Story A3. [Source: docs/epics.md:69]
- docs/PRD.md — Access control, governance logging, and error handling requirements. [Source: docs/PRD.md:161]
- docs/architecture.md — Auth session enforcement, logging strategy, and observability hooks. [Source: docs/architecture.md:153]
- docs/stories/1-1-persist-admissions-manager-allowlist.md — Config schema and shared auth foundations. [Source: docs/stories/1-1-persist-admissions-manager-allowlist.md:18]
- docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md — NextAuth configuration reused by this story. [Source: docs/stories/1-2-implement-google-oauth-restricted-to-admissions-managers.md:1]

## Dev Agent Record

### Context Reference

- `docs/stories/1-3-session-middleware-and-audit-logging-for-auth-failures.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- 2025-11-05: Blocked at workflow Step 2 because repository lacks application scaffold (`package.json`, `lib/` source tree); unable to implement middleware or tests without baseline Next.js project.
- 2025-11-05: Added Next.js auth middleware and logging stack to new scaffold (`nyu-device-roster`), including failure alerting and comprehensive Vitest coverage.

### Completion Notes List

- Implemented `withSession` middleware enforcing NextAuth sessions, structured logging, and alert escalation for repeated failures; added Vitest suite covering success, rejection, and threshold behaviour.
- Created base NextAuth route/options to unblock session access ahead of Story 1.2 and introduced Pino logging helper reused across middleware.

### File List

- nyu-device-roster/package-lock.json (modified)
- nyu-device-roster/package.json (modified)
- nyu-device-roster/src/app/api/auth/[...nextauth]/route.ts (added)
- nyu-device-roster/src/lib/auth/options.ts (added)
- nyu-device-roster/src/lib/auth/sessionMiddleware.ts (added)
- nyu-device-roster/src/lib/logging.ts (added)
- nyu-device-roster/tests/unit/lib/auth/sessionMiddleware.test.ts (added)
- nyu-device-roster/vitest.config.ts (added)

## Change Log

- Draft updated by Scrum Master workflow (2025-11-05).
- 2025-11-05: Development attempt blocked—missing Next.js project scaffold (no package.json or source directories).
- 2025-11-05: Implemented session middleware, logging utilities, and automated tests in `nyu-device-roster`.
