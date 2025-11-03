# BMAD Demo NodeJS Project – Epic Breakdown

**Author:** Aditya  
**Date:** 2025-11-03  
**Project Level:** Level 2 demo  
**Target Scale:** NYU Admissions manager demo (single Google Sheet source, single MongoDB namespace)  
**Source PRD:** docs/PRD.md (updated 2025-11-03)

---

## Overview

This document decomposes the refreshed PRD into thematic epics and bite-sized stories sized for 200k-context development agents. Every story references the functional requirements (FR) defined in the PRD, includes explicit acceptance criteria, and notes prerequisites to preserve traceability and enable efficient handoff to implementation teams.

Epic sequencing emphasizes:

1. Locking down access and configuration so only admissions managers reach the experience.
2. Building a reliable ingest pipeline from Google Sheets into MongoDB with audit-ready signals.
3. Delivering a premium manager dashboard that showcases sync speed, anonymization, and governance cues.
4. Providing observability, audit trails, and operational guardrails for demo readiness.

---

## Epic Structure Summary

1. **Epic A – Secure Access & Configuration**  
   Guard the experience behind NYU admissions manager credentials, manage allowlists, and persist configuration so the demo remains trustworthy from first load. *(FR-001, FR-002, FR-003; supports Security NFR)*

2. **Epic B – Sync Automation & Data Integrity**  
   Implement scheduled and manual ingest from Google Sheets into MongoDB, normalize records, and harden error handling so the roster stays accurate within 60 seconds. *(FR-004, FR-005, FR-006, FR-012; supports Performance & Integration NFRs)*

3. **Epic C – Manager Dashboard Experience**  
   Deliver the responsive spreadsheet-like UI with status banner, anonymization toggle, and governance cues that wow admissions managers during the demo. *(FR-005, FR-007, FR-008, FR-009, FR-011; supports Accessibility & Performance NFRs)*

4. **Epic D – Governance & Observability Guardrails**  
   Provide audit trails, telemetry, and operational safeguards so stakeholders can prove accountability and recover quickly if issues arise. *(FR-010; supports Security, Performance, Scalability NFRs)*

These epics align to the PRD while maintaining independence and 200k-context-friendly scope.

---

## Epic A – Secure Access & Configuration (FR-001, FR-002, FR-003)

### Goal
Ensure only authenticated NYU admissions managers can access the demo while giving operators a safe way to configure sheet targets and manager allowlists.

### Why it matters
The wow moment depends on managers trusting that the roster is exclusive to them. Tight access control also lays the foundation for accurate audit trails required by governance stakeholders.

### Stories

1. **Story [A1]: Persist admissions manager allowlist** *(FR-002, FR-003)*  
   As a demo operator, I want manager emails stored in MongoDB config so we can update access without redeploying.  
   **Acceptance Criteria**  
   1. Create `config` collection schema supporting allowlisted emails, sheet ID, Mongo collection name.  
   2. Provide CLI script or seeded admin endpoint to insert/update allowlist entries.  
   3. Changes replicate within 1 minute and are versioned via timestamp + operator ID.  
   **Prerequisites:** None  
   **Parallel Ready:** Yes

2. **Story [A2]: Implement Google OAuth restricted to admissions managers** *(FR-001)*  
   As an admissions manager, I want to authenticate with my NYU Google account so only our team can view the dashboard.  
   **Acceptance Criteria**  
   1. OAuth flow restricts sign-in to `@nyu.edu` and checks email against allowlist before issuing JWT.  
   2. JWT stored as secure HTTP-only cookie (1-hour expiry) with sliding refresh on activity.  
   3. Unauthorized or non-allowlisted attempts return 403, redirect to friendly error page, and log event with email + IP.  
   **Prerequisites:** Story A1  
   **Parallel Ready:** No (depends on config schema)

3. **Story [A3]: Session middleware and audit logging for auth failures** *(FR-001)*  
   As an authenticated user, I want protected routes to verify my session so unauthorized actors never reach device data.  
   **Acceptance Criteria**  
   1. Middleware validates JWT on all `/api/*` routes and denies expired/invalid tokens.  
   2. Middleware logs failed validations with reason code and request metadata.  
   3. Successful requests attach manager identity to request context for downstream logging.  
   **Prerequisites:** Story A2  
   **Parallel Ready:** No

4. **Story [A4]: Secure secrets and configuration loading** *(FR-003; Security NFR)*  
   As a platform owner, I want Sheets API credentials and Mongo connection strings stored in Google Secret Manager so secrets never land in code or logs.  
   **Acceptance Criteria**  
   1. App Engine service retrieves secrets at startup with caching and refresh on rotation.  
   2. Configuration loader merges secrets with Mongo config values from Story A1.  
   3. Missing/invalid secrets block startup with actionable error message and audit entry.  
   **Prerequisites:** Story A1  
   **Parallel Ready:** Yes

5. **Story [A5]: Allowlist maintenance endpoint with role gating** *(FR-002; Security NFR)*  
   As a lead manager, I want a protected endpoint to review and update the allowlist so we can manage access during demo prep.  
   **Acceptance Criteria**  
   1. `/api/config/allowlist` (GET/PUT) restricted to JWT claim `managerRole=lead`.  
   2. Updates validate email domain and record actor + timestamp in audit log.  
   3. Endpoint returns diff summary (added, removed) to display in admin console or CLI.  
   **Prerequisites:** Stories A1–A3  
   **Parallel Ready:** No

---

## Epic B – Sync Automation & Data Integrity (FR-004, FR-005, FR-006, FR-012)

### Goal
Synchronize the Devices Google Sheet into MongoDB via both scheduled and manual triggers while ensuring data integrity, normalization, and resilient error handling.

### Why it matters
The PRD promises sheet edits will surface in under 60 seconds. Reliable sync mechanics with deterministic transformation is essential to deliver that performance and to preserve governance history.

### Stories

1. **Story [B1]: Build Google Sheets fetch module** *(FR-006; Integration NFR)*  
   As a data pipeline developer, I want a reusable module that fetches sheet data using service credentials so subsequent stages always receive clean row arrays.  
   **Acceptance Criteria**  
   1. Module authenticates with service account from Secret Manager and reads devices tab by ID.  
   2. Returns headers + rows with typed values (strings, numbers, dates) and handles pagination.  
   3. Converts Sheets API errors into structured codes (`SHEET_NOT_FOUND`, `RATE_LIMIT`, `OAUTH_REVOKED`) for logging.  
   **Prerequisites:** Stories A1, A4  
   **Parallel Ready:** Yes

2. **Story [B2]: Normalize and upsert devices into MongoDB** *(FR-006; Scalability NFR)*  
   As a data pipeline developer, I want sheet rows transformed into Mongo documents with consistent schema so the UI can consume normalized data.  
   **Acceptance Criteria**  
   1. Transformer maps sheet headers to device fields (deviceId, assignedTo, status, condition, offboardingStatus, lastSeen).  
   2. Upsert uses compound key (deviceId + sheetId) and updates `lastSyncedAt` for changed rows.  
   3. Creates indexes on `deviceId`, `assignedTo`, `lastSyncedAt`; seeding script validates index creation.  
   **Prerequisites:** Story B1  
   **Parallel Ready:** No

3. **Story [B3]: Implement manual sync endpoint with optimistic status** *(FR-005, FR-012)*  
   As a manager, I want a “Refresh Now” control that triggers ingest and shows live progress so I can demonstrate responsiveness during the demo.  
   **Acceptance Criteria**  
   1. POST `/api/sync` triggers fetch + transform + upsert pipeline and responds with summary (`rowsProcessed`, `durationMs`, `status`).  
   2. Endpoint sets optimistic “running” state for UI consumers via shared status cache (e.g., Redis or in-memory with TTL).  
   3. Completion writes audit entry with actor, duration, anonymization state, and any error codes.  
   **Prerequisites:** Stories B1–B2, A3  
   **Parallel Ready:** No

4. **Story [B4]: Schedule automated ingest via App Engine cron** *(FR-004)*  
   As a reliability engineer, I want the roster refreshed every 2 minutes automatically so the demo data stays current even without manual refresh.  
   **Acceptance Criteria**  
   1. Define App Engine cron job hitting `/internal/sync` with service token.  
   2. Scheduler respects enable/disable flag in config and queues overlapping runs gracefully (skip with log).  
   3. Cron run results recorded with runId, status, rows processed, and error summary.  
   **Prerequisites:** Story B3  
   **Parallel Ready:** No

5. **Story [B5]: Resilient error handling and rollback safeguards** *(FR-012; Performance NFR)*  
   As a demo operator, I want sync errors surfaced clearly and last-known-good data preserved so the presentation never fails in front of stakeholders.  
   **Acceptance Criteria**  
   1. Failed sync retains previous dataset and updates status banner with actionable message + error code.  
   2. System captures stack trace reference in logs and links to audit entry.  
   3. Provide command/script to reset MongoDB collections to baseline snapshot for quick recovery.  
   **Prerequisites:** Stories B3–B4  
   **Parallel Ready:** No

---

## Epic C – Manager Dashboard Experience (FR-005, FR-007, FR-008, FR-009, FR-011)

### Goal
Deliver the spreadsheet-grade dashboard that renders instantly, supports rich interactions, and highlights governance cues that admissions managers rely on.

### Why it matters
The demo’s magic moment is the instant confidence managers feel when they see an authenticated dashboard that behaves like a premium spreadsheet while honoring access controls and anonymization rules.

### Stories

1. **Story [C1]: Authenticated shell with sync status banner** *(FR-005, FR-008)*  
   As a manager, I want to land on a dashboard that confirms my authentication and shows when the roster last synced so I can trust the data immediately.  
   **Acceptance Criteria**  
   1. Authenticated layout checks session status on load and redirects unauthorized users to login flow.  
   2. Status banner displays last sync timestamp, current state (success/running/error), and CTA for manual refresh.  
   3. Banner styles meet NYU branding guidelines and achieve WCAG contrast thresholds.  
   **Prerequisites:** Stories A2–A3, B3  
   **Parallel Ready:** No

2. **Story [C2]: Spreadsheet grid with performant sort/filter** *(FR-007; Performance & Accessibility NFRs)*  
   As a manager, I want to explore device records using familiar grid controls so I can answer inventory questions in real time.  
   **Acceptance Criteria**  
   1. Grid renders paginated Mongo data with virtualized rows to keep interactions under 200 ms.  
   2. Column sorting, multi-field filtering, and column visibility toggles provide immediate feedback.  
   3. Keyboard navigation and screen reader labels make the grid accessible.  
   **Prerequisites:** Story C1  
   **Parallel Ready:** No

3. **Story [C3]: Governance cues for offboarding workflows** *(FR-011)*  
   As a manager, I want devices with offboarding flags or poor condition surfaced prominently so I can plan handoffs during the demo.  
   **Acceptance Criteria**  
   1. Grid highlights rows where `offboardingStatus` is set or condition is “Poor/Needs Repair” via badge + filter chip.  
   2. Hover/tooltip summarises last transfer notes sourced from Mongo document.  
   3. Governance cues reflected in export/download (if triggered) to preserve context.  
   **Prerequisites:** Stories B2, C2  
   **Parallel Ready:** Yes (after C2 foundations)

4. **Story [C4]: Anonymization toggle UX with deterministic placeholders** *(FR-009)*  
   As a manager, I need to mask sensitive fields during the demo so I can showcase governance without exposing personal data.  
   **Acceptance Criteria**  
   1. Toggle updates view state instantly and calls backend to persist anonymization choice (for audit).  
   2. Masked columns show deterministic placeholders derived from deviceId so repeated toggles are consistent.  
   3. UI reflects masked state in status banner and ensures analytics log each toggle with actor/time.  
   **Prerequisites:** Stories B3, C2  
   **Parallel Ready:** Yes

5. **Story [C5]: Performance instrumentation and lighthouse checks** *(Performance NFR)*  
   As a product manager, I want instrumentation proving the UI meets sub-2-second load and sub-200 ms interaction goals so reviewers trust the performance claims.  
   **Acceptance Criteria**  
   1. Add frontend timing hooks (First Contentful Paint, interaction timings) and expose metrics endpoint.  
   2. Ship Lighthouse script configured for App Engine URL capturing baseline scores (>90 Performance).  
   3. Document how to run instrumentation checks before demo day.  
   **Prerequisites:** Stories C1–C2  
   **Parallel Ready:** No

---

## Epic D – Governance & Observability Guardrails (FR-010 + NFRs)

### Goal
Provide the audit views, telemetry, and operational safeguards that admissions leadership expects before trusting the demo as an authoritative source.

### Why it matters
Without evidence of accountability and monitoring, the demo cannot prove readiness for broader rollout. These guardrails justify confidence in the system’s integrity.

### Stories

1. **Story [D1]: Audit API and dashboard panel** *(FR-010)*  
   As a lead manager, I want to review recent sync runs and anonymization toggles so I can confirm governance controls function properly.  
   **Acceptance Criteria**  
   1. `/api/audit` returns last 20 events with actor, action, timestamp, status, and error code (if any).  
   2. Dashboard panel surfaces audit feed with filters for event type (sync, anonymization, allowlist change).  
   3. Events persisted in `audit_logs` collection with TTL configuration disabled (retain through demo).  
   **Prerequisites:** Stories A3, B3  
   **Parallel Ready:** No

2. **Story [D2]: Telemetry and sync health summaries** *(Performance NFR)*  
   As a demo operator, I want telemetry on sync duration, row counts, and failure trends so I can address issues before stakeholders notice.  
   **Acceptance Criteria**  
   1. Collect metrics for manual vs scheduled sync (durationMs, rowsProcessed, success/failure).  
   2. Expose `/api/metrics` endpoint returning aggregates for last 12 hours and cumulative totals.  
   3. Add optional webhook integration placeholder (Slack/email) for future alerting with configuration notes.  
   **Prerequisites:** Story B3  
   **Parallel Ready:** Yes

3. **Story [D3]: Demo readiness smoke test suite** *(Security & Performance NFRs)*  
   As a release manager, I want a scripted smoke test validating OAuth, ingest, and UI endpoints so I can certify readiness before each presentation.  
   **Acceptance Criteria**  
   1. Script exercises login (mock), triggers manual sync, fetches grid data, and verifies anonymization toggle.  
   2. Output summarises pass/fail with timestamps and highlights blocking issues.  
   3. Document how to run the script locally and via CI (optional) with expected runtime < 5 minutes.  
   **Prerequisites:** Stories A2–A3, B3, C2, C4  
   **Parallel Ready:** No

4. **Story [D4]: Rollback and data snapshot utilities** *(FR-012; Scalability NFR)*  
   As a reliability engineer, I want to reseed MongoDB with baseline anonymized data so the demo recovers quickly after rehearsals.  
   **Acceptance Criteria**  
   1. Provide script that loads snapshot JSON and restores `devices`, `config`, and `audit_logs` collections.  
   2. Successful restore logs audit event with `reset=true` flag and operator identity.  
   3. Document how to capture new snapshots after successful demo runs.  
   **Prerequisites:** Stories B2, B5  
   **Parallel Ready:** Yes

---

## Story Validation

- **Total stories:** 19  
- **Parallel-ready stories:** 7 (A1, A4, C3, C4, D2, D4, plus post-foundation pipeline tasks once prerequisites met)  
- **Sequential dependency chains:** 4 primary chains (Epic A auth setup, Epic B pipeline, Epic C UI foundation, Epic D guardrails)  
- **FR coverage:** FR-001 through FR-012 mapped to at least one story; cross-referenced in story headers  
- **NFR coverage:** Security, Performance, Accessibility, Scalability, and Integration addressed within relevant stories  
- **Vertical slicing:** Each story delivers measurable functionality, acceptance criteria, and test hooks suitable for 200k-context execution  
- **Traceability:** Audit trail, anonymization, and governance requirements appear in both PRD and epic stories to prevent orphaned FRs

---

## Implementation Guidance

### Getting Started

- **Phase 1 – Secure Access & Configuration:** Deliver Stories A1–A4 sequentially to unlock authenticated plumbing. Run smoke tests on OAuth before continuing.  
- **Phase 2 – Sync Automation:** Complete Stories B1–B5. Focus on manual sync (B3) before adding cron (B4) to unblock UI integration.  
- **Phase 3 – Manager Dashboard:** Execute Stories C1–C5, starting with authenticated shell then grid features. Keep Lighthouse script handy to verify performance claims.  
- **Phase 4 – Governance Guardrails:** Build audit panel (D1) and telemetry (D2), then finish with smoke tests (D3) and rollback tooling (D4).

### Domain Guidance

- Restrict demo accounts to admissions managers; verify allowlist before every rehearsal.  
- Mask any FERPA-adjacent fields by default; only reveal via anonymization toggle when safe.  
- Preserve audit logs for the full demo cycle; do not enable TTL cleanup until after showcase.

### Technical Notes

- Sheets API quotas: Batch requests where possible and implement exponential backoff (B1/B3).  
- Mongo index considerations: monitor `lastSyncedAt` index size; prune test data after validating pipeline.  
- Frontend performance: Virtualized grid and status banner updates must avoid unnecessary re-render loops.  
- Secret management: Document rotation steps for service account keys to avoid last-minute failures.

### Risk Mitigation

- OAuth misconfiguration (Stories A2–A3): keep fallback service account credentials and test in staging before demo.  
- Sheets rate limits (Story B5): throttle manual refresh to prevent hitting API caps; communicate error codes clearly.  
- UI performance regressions (Story C5): run instrumentation script after every major UI change.  
- Audit data loss (Story D1): enable backups for `audit_logs` collection or export after each session.

### Success Metrics Checkpoints

- After Epic B: Manual and scheduled sync complete within 60 seconds of sheet change.  
- After Epic C: Dashboard loads under 2 seconds; anonymization toggle responds under 200 ms.  
- After Epic D: Audit panel shows complete event history; smoke test script greenlights demo readiness.

---

## Implementation Sequence

1. **Secure Foundations:** A1 → A2 → A3 → A4 → A5  
2. **Pipeline Core:** B1 → B2 → B3 → B4 → B5  
3. **Experience Layer:** C1 → C2 → (C3, C4 in parallel) → C5  
4. **Guardrails:** D1 → (D2, D4 in parallel) → D3

---

## Development Phases

- **Phase 1: Access & Config Hardening** – Ship Epic A to guarantee only admissions managers can reach the dashboard.  
- **Phase 2: Sync & Data Integrity** – Complete Epic B to honor 60-second freshness and resilient error handling.  
- **Phase 3: Manager Experience** – Build Epic C to deliver the polished dashboard and anonymization wow factor.  
- **Phase 4: Governance & Operations** – Finish Epic D to provide audit evidence, telemetry, and recovery playbooks.

---

## Dependency Highlights

- Epic A unlocks all downstream work—complete allowlist and OAuth before touching ingest or UI.  
- Epic B pipeline powers all UI stories; UI development can scaffold once B2 provides normalized data.  
- Epic C depends on audit-ready status from Epic B; anonymization toggle ties back to sync state.  
- Epic D reads from both pipeline and UI artifacts (audit events, telemetry), so schedule after earlier phases.  
- Smoke test suite (D3) depends on the full stack and should be the last story before demo sign-off.

---

## Story Guidelines Reference

```
**Story [EPIC.N]: [Story Title]** (FR: FR-XYZ[, FR-ABC])

As a [user], I want [goal], so that [value].

**Acceptance Criteria**
1. ...
2. ...
3. ...

Prerequisites: [Stories or “None”]
Parallel Ready: [Yes/No]
```

All stories above follow this format to keep implementation agents aligned with the refreshed PRD.

---
