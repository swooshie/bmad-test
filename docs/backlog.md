# Engineering Backlog

This backlog collects cross-cutting or future action items that emerge from reviews and planning.

Routing guidance:

- Use this file for non-urgent optimizations, refactors, or follow-ups that span multiple stories/epics.
- Must-fix items to ship a story belong in that story’s `Tasks / Subtasks`.
- Same-epic improvements may also be captured under the epic Tech Spec `Post-Review Follow-ups` section.

| Date | Story | Epic | Type | Severity | Owner | Status | Notes |
| ---- | ----- | ---- | ---- | -------- | ----- | ------ | ----- |
| 2025-11-10 | 1-2 | 1 | Bug | High | TBD | Open | Return HTTP 403 before redirecting unauthorized admissions logins (`nyu-device-roster/src/lib/auth/options.ts:95-147`) |
| 2025-11-10 | 1-3 | 1 | Bug | High | TBD | Done | Persist `AUTH_INVALID_SESSION` events to `sync_events`/audit store with route/method/IP (`nyu-device-roster/src/lib/auth/sessionMiddleware.ts:78-105`) |
| 2025-11-10 | 1-3 | 1 | Enhancement | Medium | TBD | Done | Wire `withSession` (or App Router middleware) into `/api/*` templates and document session contract (`nyu-device-roster/src/app/api/session/route.ts`) |
