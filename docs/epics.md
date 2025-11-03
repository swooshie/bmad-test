# BMAD Demo NodeJS Project - Epic Breakdown

**Author:** Aditya
**Date:** 2025-01-20
**Project Level:** Level 2 demo
**Target Scale:** Single-team, internal stakeholder demo

---

## Overview

This document provides the detailed epic breakdown for BMAD Demo NodeJS Project, expanding on the high-level epic list in the [PRD](./PRD.md).

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and initial functionality
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

---

## Epic 1 – Foundation & Access Control

### Goal
Establish the secure Node.js/MongoDB foundation so only NYU-authenticated users can access the demo environment.

**Stories**

**Story [E1.1]: Bootstrap Node.js skeleton and config**
As a platform engineer,
I want a modular Node.js service with configuration placeholders for Google OAuth and MongoDB,
So that future auth and data modules slot in cleanly.

**Acceptance Criteria:**
1. Project seeded with Express (or Nest) baseline, linting, and env config loader.
2. Config schema defines Google OAuth client ID/secret, allowed domain, MongoDB URI, and target sheet ID.
3. Health-check endpoint returns service metadata and config validation status.

**Prerequisites:** None

**Story [E1.2]: Implement NYU-restricted Google OAuth flow**
As an internal user,
I want to authenticate via my NYU Google account,
So that only authorized team members can access the demo.

**Acceptance Criteria:**
1. Login initiates Google OAuth using service credentials and restricts to `@nyu.edu` domain.
2. Non-NYU attempts fail closed and record audit log entry.
3. Successful login stores session token (JWT or cookie) with 1-hour expiry.

**Prerequisites:** Story E1.1

**Story [E1.3]: Provision MongoDB collections and indexes**
As a data engineer,
I want base collections and indexes prepared for ingested sheet data and sync logs,
So that downstream pipeline work lands on a stable data foundation.

**Acceptance Criteria:**
1. Create `sheet_rows` collection with indexes on sheet ID and updated timestamp.
2. Create `sync_logs` collection capturing run status, runtime, row counts, and anonymization flag.
3. Seed sample documents for local testing.

**Prerequisites:** Story E1.1

**Story [E1.4]: Protect backend routes with session middleware**
As an authenticated user,
I want all pipeline and UI routes secured behind session validation,
So that only logged-in team members can trigger syncs or view data.

**Acceptance Criteria:**
1. Middleware checks for valid session on API routes used by front-end grid and admin controls.
2. Unauthorized requests return 401 with audit log entry.
3. Session timeout enforced (1 hour) with refresh on activity.

**Prerequisites:** Stories E1.1–E1.3

---

## Epic 2 – Sheets Ingest Pipeline

### Goal
Build a resilient Google Sheets → MongoDB ingest pipeline with anonymization safeguards and logging.

**Stories**

**Story [E2.1]: Create Google Sheets service account and fetch API data**
As a data pipeline developer,
I want a reusable module that reads sheet rows via Google Sheets API,
So that the Node.js service can ingest spreadsheet data on demand.

**Acceptance Criteria:**
1. Service authenticates using configured credentials and target sheet ID.
2. Fetches headers + rows from primary sheet tab and reports row count.
3. Errors (permission, missing sheet, throttling) logged to `sync_logs` with actionable codes.

**Prerequisites:** Epic 1 stories

**Story [E2.2]: Normalize and upsert sheet rows into MongoDB**
As a data pipeline developer,
I want sheet rows persisted in MongoDB with consistent schema,
So that the UI can render uniform records and maintain history.

**Acceptance Criteria:**
1. Transformer maps Google row arrays to key/value documents respecting column types.
2. Upsert operation keyed by sheet row ID (or generated hash) updates changed rows, inserts new ones.
3. Records store `lastSyncedAt` and source sheet metadata.

**Prerequisites:** Story E2.1

**Story [E2.3]: Implement on-demand sync endpoint with logging**
As a demo operator,
I want a "Refresh" endpoint that runs ingest immediately and logs the outcome,
So that I can show real-time updates during presentations.

**Acceptance Criteria:**
1. Authenticated POST /sync triggers fetch + transform + persist pipeline.
2. Response returns summary (rows processed, duration, anonymization status).
3. Log entry written to `sync_logs` with timestamp, status, and error details if failed.

**Prerequisites:** Stories E2.1–E2.2

**Story [E2.4]: Add 2-minute scheduled sync job**
As a reliability engineer,
I want automatic sync every 2 minutes during the demo window,
So that the data stays fresh even if no one triggers manual refresh.

**Acceptance Criteria:**
1. Scheduler runs pipeline and respects config toggle for enabling/disabling.
2. Consecutive runs that overlap queue gracefully or skip with log entry.
3. Scheduler metrics (success/failure count) exposed via health endpoint.

**Prerequisites:** Story E2.3

**Story [E2.5]: Apply deterministic anonymization layer**
As a demo leader,
I want sensitive columns masked consistently,
So that managers see real data patterns without revealing private values.

**Acceptance Criteria:**
1. Config defines which columns to mask and placeholder format.
2. Anonymization wraps transform output and records flag in `sync_logs`.
3. Toggle allows disabling anonymization with admin confirmation prompt.

**Prerequisites:** Stories E2.2–E2.3

---

## Epic 3 – Spreadsheet UI Experience

### Goal
Deliver a polished spreadsheet-style interface that showcases BMAD speed and UX quality.

**Stories**

**Story [E3.1]: Scaffold authenticated front-end shell**
As a demo viewer,
I want to access the grid through a secure web UI shell once logged in,
So that the experience feels cohesive and protected.

**Acceptance Criteria:**
1. Front-end checks session status on load and redirects unauthenticated visitors to login.
2. Layout includes header with sync status indicator placeholder.
3. Base styling aligns with BMAD branding guidelines.

**Prerequisites:** Epic 1 stories

**Story [E3.2]: Build spreadsheet grid with sorting and filtering**
As a demo viewer,
I want to browse data using familiar spreadsheet interactions,
So that I can demonstrate BMAD-driven UX speed.

**Acceptance Criteria:**
1. Grid renders MongoDB data with virtualized rows for performance.
2. Column headers support ascending/descending sort.
3. Filter chips allow text filter per column; active filters displayed above grid.

**Prerequisites:** Story E3.1, Story E2.2

**Story [E3.3]: Surface sync status and refresh control**
As a demo viewer,
I want to see when data last synced and trigger updates,
So that I can highlight pipeline responsiveness.

**Acceptance Criteria:**
1. Status badge shows last sync time and status color (success, running, error).
2. "Refresh" button calls on-demand sync endpoint and shows optimistic loading state.
3. Toast/alert displays summary from sync response.

**Prerequisites:** Stories E3.1–E3.2, Story E2.3

**Story [E3.4]: Implement anonymization toggle UI**
As a demo viewer,
I want a clear control to mask/unmask sensitive columns,
So that stakeholders understand data handling safeguards.

**Acceptance Criteria:**
1. Toggle control persists state per session and calls backend when changed.
2. Masked columns display deterministic placeholders with tooltip explaining why.
3. Sync status reflects anonymization state (e.g., icon/badge).

**Prerequisites:** Stories E3.1–E3.3, Story E2.5

**Story [E3.5]: Capture demo interaction metrics**
As a product manager,
I want to capture interaction metrics (sort/filter usage, refresh count),
So that we can quantify engagement when reviewing the demo.

**Acceptance Criteria:**
1. Front-end emits telemetry events with timestamp and user session ID (anonymized).
2. Backend stores events in `demo_metrics` collection with simple analytics endpoint.
3. Basic dashboard/table in admin view lists recent events.

**Prerequisites:** Stories E3.1–E3.4

---

## Epic 4 – Operational Guardrails

### Goal
Ensure the demo runs reliably with observability, admin controls, and fallback scripts.

**Stories**

**Story [E4.1]: Build admin settings panel**
As a demo operator,
I want a simple admin panel to configure sheet ID, schedule toggle, and anonymization settings,
So that I can adapt the demo without code changes.

**Acceptance Criteria:**
1. Auth-protected panel displays current config and allows edits with validation.
2. Changes persist to config store and take effect without service restart.
3. Audit log entry records each change with operator ID.

**Prerequisites:** Epics 1–3 foundations

**Story [E4.2]: Expose observability dashboard**
As a demo operator,
I want quick visibility into sync history and errors,
So that I can troubleshoot mid-demo if needed.

**Acceptance Criteria:**
1. Dashboard lists last 20 sync runs with status, duration, and row count.
2. Error details expandable with stack trace snippet and suggested actions.
3. Dashboard auto-refreshes every 30 seconds during demo.

**Prerequisites:** Stories E2.3–E2.5, E3.3

**Story [E4.3]: Implement rollback/failsafe script**
As a reliability engineer,
I want a script to reseed MongoDB with baseline anonymized data,
So that we can reset the demo quickly after experiments.

**Acceptance Criteria:**
1. Script loads snapshot JSON and replaces MongoDB collections safely.
2. Run is logged in `sync_logs` with `reset=true` flag.
3. Documentation covers usage steps and expected runtime.

**Prerequisites:** Story E2.2

**Story [E4.4]: Add smoke test suite for demo readiness**
As a release manager,
I want an automated smoke test that validates OAuth, ingest, and UI endpoints,
So that I can certify the demo is ready before stakeholders join.

**Acceptance Criteria:**
1. Script runs headless checks: login mock, sample sync, grid data fetch.
2. Output reports pass/fail with timestamps; failures block deployment.
3. CI/CD job (or cron) executes nightly with Slack/email alert on failure.

**Prerequisites:** Epics 1–3 stories

**Story [E4.5]: Document demo playbook**
As a demo leader,
I want a concise runbook describing the flow, key talking points, and contingency steps,
So that anyone on the team can deliver a smooth showcase.

**Acceptance Criteria:**
1. Markdown playbook outlines pre-demo checks, live narrative, and recovery steps.
2. Includes screenshots or references to UI sections.
3. Stored under `docs/` and linked from admin panel for quick access.

**Prerequisites:** Completion of prior epic stories for accurate documentation


---

## Implementation Sequence

1. E1.1 → E1.2/E1.3 (parallel) → E1.4
2. E2.1 → E2.2 → E2.3 → (E2.4, E2.5)
3. E3.1 (can start after E1) → E3.2 → E3.3 → E3.4 → E3.5
4. E4.1 (after E2.3 & E3.3) → E4.2 → E4.3 → E4.4 → E4.5

## Development Phases

- **Phase 1: Foundation** – Complete Epic 1 to secure authentication and data stores.
- **Phase 2: Pipeline Core** – Deliver Epic 2 stories to make sync reliable.
- **Phase 3: UX Showcase** – Ship Epic 3 stories for demo-ready interface.
- **Phase 4: Guardrails** – Finish Epic 4 for observability, admin controls, and playbook.

## Dependency Graph Highlights

- Epic 1 unlocks all downstream work; E1.1 is the anchor for E1.2/E1.3.
- Epic 2 depends on Epic 1; scheduler/anonymization stories hinge on E2.3.
- Epic 3 relies on E2.2 data availability and E2.3 refresh endpoint.
- Epic 4 cross-cuts: admin panel waits for Epics 2–3, smoke tests depend on entire stack.

## Story Validation Summary

- **Total stories:** 19
- **Parallel-ready stories:** 7 (E1.2, E1.3, E2.4, E2.5, E3.5, E4.2, E4.3 once prerequisites met)
- **Sequential chains:** 4 primary chains (Epic 1, Epic 2, Epic 3, Epic 4)
- All stories scoped for single-session 200k-context execution with explicit acceptance criteria.

## Implementation Guidance

- **Kickoff:** Finish Epic 1 before touching ingest or UI; validate OAuth against test NYU account early.
- **Pipeline Tips:** Mock Google Sheets locally while refining transforms; record anonymization decisions in config.
- **UI Strategy:** Use virtualized grid components (e.g., React Table + virtualization) to keep UX snappy.
- **Ops Readiness:** Schedule nightly smoke tests and keep rollback snapshot updated after each successful demo.
- **Risks:** OAuth misconfiguration, rate limits on Sheets API, and MongoDB index drift—monitor during Epics 2–4.

---

## Story Guidelines Reference

**Story Format:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Story Requirements:**

- **Vertical slices** - Complete, testable functionality delivery
- **Sequential ordering** - Logical progression within epic
- **No forward dependencies** - Only depend on previous work
- **AI-agent sized** - Completable in 2-4 hour focused session
- **Value-focused** - Integrate technical enablers into value-delivering stories

---

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
