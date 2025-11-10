# Story 3.1: authenticated-shell-with-sync-status-banner

Status: drafted

## Story

As an NYU admissions manager,
I want the dashboard shell to confirm my authenticated session and display the live sync state,
so that I can trust the device roster the moment the page loads.

The shell inherits the security posture from Epic A and the real-time instrumentation from Epic B to create a dashboard landing zone that immediately proves the roster is trustworthy. It must run the NextAuth session gate before rendering any data-bound components, reuse the `/api/sync/manual` optimistic pipeline introduced in Story B3, and highlight the latest sync state in a WCAG-compliant banner that embraces NYU’s brand palette. Because this is the first Epic C deliverable, it also establishes the layout, data hooks, and accessibility scaffolding that later UI stories will extend.

## Acceptance Criteria

1. Authenticated shell runs NextAuth session check on every dashboard load, redirecting any unauthenticated or non-allowlisted visitor to the OAuth flow and logging the rejection per FR-001 (docs/epics.md:172, docs/PRD.md:161, docs/architecture.md:268).
2. Sync status banner consumes latest sync metadata (timestamp, state, operator) and presents success/running/error states with NYU-branded colors that meet WCAG AA contrast while remaining screen-reader announceable (docs/epics.md:172, docs/PRD.md:145, docs/architecture.md:45).
3. Manual refresh CTA surfaces within the banner, calling the `/api/sync/manual` endpoint and reflecting optimistic “running” feedback within 200 ms per FR-005 and performance targets (docs/PRD.md:169, docs/architecture.md:233).
4. Banner gracefully handles failure signals from `sync_events`, retaining last-known-good data while surfacing actionable error summaries aligned with FR-012 (docs/PRD.md:175, docs/architecture.md:233).
5. Implementation documents aria labels, focus order, and responsive breakpoints so desktop and tablet layouts preserve the authenticated shell guarantees from Epic C (docs/PRD.md:120, docs/epics.md:165).

## Tasks / Subtasks

- [ ] Harden authenticated layout
  - [ ] Gate `app/(manager)/layout.tsx` with NextAuth session loader and allowlist check (docs/architecture.md:45, docs/architecture.md:268)
  - [ ] Emit structured audit log on reject using the Pino JSON schema (docs/architecture.md:227)
- [ ] Build sync status banner component
  - [ ] Fetch latest state via React Query hook (reads `sync_events` API) (docs/architecture.md:45, docs/architecture.md:233)
  - [ ] Render success/running/error variants meeting NYU branding and WCAG contrast (docs/PRD.md:145)
  - [ ] Announce updates with `aria-live` and keyboard focus cues (docs/PRD.md:210)
- [ ] Wire manual refresh CTA
  - [ ] Invoke `/api/sync/manual` with optimistic UI update and reconcile once task completes (docs/PRD.md:169, docs/architecture.md:256)
  - [ ] Log CTA usage with actor + timestamp for audit feed (docs/PRD.md:175, docs/architecture.md:227)
- [ ] Failure & fallback handling
  - [ ] Consume error codes from sync pipeline; display actionable guidance without clearing last-known-good data (docs/PRD.md:175, docs/architecture.md:233)
  - [ ] Provide retry guidance and link to operations troubleshooting once available (docs/PRD.md:175)
- [ ] Documentation & tests
  - [ ] Update story notes with component paths, props contract, and accessibility behaviors (docs/architecture.md:45)
  - [ ] Add unit/UI tests covering auth redirect, banner states, and refresh CTA instrumentation (docs/architecture.md:202)

## Dev Notes

- Authentication: NextAuth with Secret Manager allowlist (`app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`). Layout should rely on shared session utilities so redirects and audit logs stay consistent with Epic A stories. (docs/architecture.md:17-24, 268-276)
- Sync telemetry: Use React Query hooks under `app/(manager)/devices/hooks` to poll `/api/sync/run` summary or read from `sync_events`. Keep network fetches cached/stale-while-revalidate to meet sub-200 ms interaction goal. (docs/architecture.md:45-120, 233-254)
- Status banner styling: Reference UX principles for NYU palette, ensure contrast ratios, and reuse Tailwind tokens defined during project bootstrap. Provide responsive adjustments for 1280×800 and 1440×900 breakpoints. (docs/PRD.md:120-155)
- Accessibility: Implement `aria-live="polite"` announcements, restore focus to the manual refresh CTA after redirects, and document keyboard tab order so screen readers mirror visual cues. (docs/PRD.md:145-214)
- Testing: Follow repo layout—unit tests beside banner components, Playwright regression under `tests/integration` validating redirect flow and optimistic status transitions. (docs/architecture.md:202-205)

### Project Structure Notes

- Place shell layout updates under `app/(manager)/layout.tsx` with supporting banner component(s) in `app/(manager)/components/SyncStatusBanner.tsx`.
- Shared hooks like `useSyncStatus` belong in `app/(manager)/devices/hooks` or `lib/` so downstream stories C2+ can reuse them without re-fetching logic. Align file naming with architecture guidance.

### References

- docs/epics.md:172-179
- docs/PRD.md:120-184
- docs/architecture.md:45-284

## Dev Agent Record

### Context Reference

<!-- Story context XML path to be populated by story-context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- None yet (story still in drafting; populate once context workflow runs)

### Completion Notes List

- Pending implementation

### File List

- docs/stories/3-1-authenticated-shell-with-sync-status-banner.md (this document)
