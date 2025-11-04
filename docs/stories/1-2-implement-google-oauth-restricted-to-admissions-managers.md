# Story 1.2: Implement Google OAuth restricted to admissions managers

Status: drafted

## Story

As an admissions manager,
I want to authenticate with my NYU Google account through an allowlist-enforced OAuth flow,
so that only authorized admissions managers can reach the dashboard during demos.

## Acceptance Criteria

1. Google OAuth flow restricts sign-in to `@nyu.edu` accounts and validates the email against the persisted allowlist before issuing a session token. [Source: docs/epics.md:60][Source: docs/PRD.md:113][Source: docs/stories/1-1-persist-admissions-manager-allowlist.md:13]
2. Successful authentication stores a secure HTTP-only cookie (1-hour TTL with sliding refresh) and attaches manager identity to request context for downstream APIs. [Source: docs/epics.md:60][Source: docs/PRD.md:113][Source: docs/architecture.md:270]
3. Unauthorized or non-allowlisted attempts return 403 with a friendly error page and log the event (email, IP, timestamp) at warn level for audit review. [Source: docs/epics.md:60][Source: docs/PRD.md:135][Source: docs/architecture.md:270]

## Tasks / Subtasks

- [ ] Implement NextAuth v5 Google provider configuration with `hd=nyu.edu` hint and allowlist check against `Config` collection inside the sign-in callback. (AC1) [Source: docs/epics.md:60][Source: docs/architecture.md:270]
  - [ ] Reuse `models/Config.ts` and config access helpers from Story 1-1 for allowlist lookup; ensure missing config triggers clear error path. (AC1) [Source: docs/stories/1-1-persist-admissions-manager-allowlist.md:19][Source: docs/architecture.md:99]
- [ ] Configure session strategy to issue secure HTTP-only cookies with 1-hour expiry and sliding refresh, exposing manager identity on request context. (AC2) [Source: docs/epics.md:60][Source: docs/architecture.md:270]
  - [ ] Add automated test or manual verification steps proving TTL/refresh behavior and identity propagation to protected routes. (AC2) [Source: docs/PRD.md:113]
- [ ] Build failure handling path that redirects unauthorized users to `/access-denied`, captures email/IP/timestamp, and logs at warn level. (AC3) [Source: docs/epics.md:60][Source: docs/architecture.md:270]
  - [ ] Ensure audit log entries surface prerequisite references for governance panel consumption. (AC3) [Source: docs/PRD.md:135]

## Dev Notes

- Integrate allowlist enforcement inside `app/api/auth/[...nextauth]/route.ts` sign-in callback and share logic via `lib/auth.ts` to keep authentication centralized. [Source: docs/architecture.md:99][Source: docs/architecture.md:270]
- Load Google OAuth secrets from Secret Manager at runtime; never embed credentials in repo or scripts. [Source: docs/architecture.md:270]
- Update middleware to attach manager identity to `request` context for downstream API logging and governance tracking. [Source: docs/architecture.md:270]

### Project Structure Notes

- Extend existing auth helpers rather than creating new directories; modifications belong in `lib/auth.ts`, `lib/db.ts`, and `app/api/auth/[...nextauth]/`. [Source: docs/architecture.md:99]
- Reuse audit logging patterns from Story 1-1 to keep event metadata consistent across config and auth flows. [Source: docs/stories/1-1-persist-admissions-manager-allowlist.md:22]

### References

- docs/epics.md:60 — Story A2 requirements and acceptance criteria. [Source: docs/epics.md:60]
- docs/PRD.md:113 — Authentication flow requirements. [Source: docs/PRD.md:113]
- docs/PRD.md:135 — Governance logging expectations. [Source: docs/PRD.md:135]
- docs/architecture.md:99 — Module placement for auth components. [Source: docs/architecture.md:99]
- docs/architecture.md:270 — NextAuth allowlist and session handling details. [Source: docs/architecture.md:270]
- docs/stories/1-1-persist-admissions-manager-allowlist.md:19 — Config schema and tooling to reuse. [Source: docs/stories/1-1-persist-admissions-manager-allowlist.md:19]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- Draft created by Scrum Master workflow (2025-11-04).
