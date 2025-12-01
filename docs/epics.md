# BMAD Demo NodeJS Project - Epic Breakdown

**Author:** Aditya
**Date:** 2025-11-19
**Project Level:** 3
**Target Scale:** Focused remediation (single sprint scope)

---

## Overview

This document provides the detailed epic breakdown for BMAD Demo NodeJS Project, expanding on the high-level epic list in the PRD.

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

### Epic 1: Serial Source Alignment (FR-001, FR-002)

**Goal & Value**

Ensure every pipeline—from sheet ingestion to MongoDB to downstream services—treats `serial` as the canonical identifier so the dashboard once again mirrors the source of truth without manual workarounds.

**Stories**

**Story EP1.1: Audit Sheet Serial Integrity**

As an operations engineer,
I want the sync job to verify that every row in the `Devices` sheet includes a valid `serial`,
So that we never ingest ambiguous device records that would break the dashboard magic.

**Acceptance Criteria:**
1. Script fetches the sheet header + rows and logs any rows missing `serial`.
2. Rows lacking `serial` are skipped and surfaced in the job report.
3. Supports dry-run mode so ops can fix sheet data before the live sync.

**Prerequisites:** None (starting point for the fix).
**Scope:** MVP
**Linked Requirements:** FR-001.

**Story EP1.2: Backfill MongoDB with Serial Keys**

As a data engineer,
I want to migrate existing MongoDB documents to include the correct `serial` as their primary identifier,
So that downstream services immediately receive serial-aligned data after deployment.

**Acceptance Criteria:**
1. Migration script matches sheet rows to Mongo documents using legacy `deviceId` and writes `serial`.
2. Historical `deviceId` remains readable for compatibility until downstream cleanup completes.
3. Migration is idempotent and produces a report summarizing successes/failures.

**Prerequisites:** EP1.1 (audit ensures sheet values are trustworthy).
**Scope:** MVP
**Linked Requirements:** FR-002.

**Story EP1.3: Update Sync + API to Use Serial**

As an internal platform engineer,
I want the sync pipeline and `/api/devices` endpoint to read/write `serial` as the canonical key,
So that every consuming feature automatically trusts the refreshed dataset.

**Acceptance Criteria:**
1. Sync writes Mongo documents keyed by `serial`; duplicates trigger conflict logging.
2. API responses expose `serial` plus legacy `deviceId` (read-only) during deprecation window.
3. Dashboard queries and downstream jobs consume `serial` without manual adjustments.

**Prerequisites:** EP1.2 (database ready for serial primary keys).
**Scope:** MVP
**Linked Requirements:** FR-001, FR-002.

---

### Epic 2: Dynamic Column Propagation (FR-003, FR-004)

**Goal & Value**

Mirror every column that operators add to the Google Sheet inside MongoDB and the dashboard UI so the experience always feels like a live spreadsheet.

**Stories**

**Story EP2.1: Capture Dynamic Columns from Sheet**

As a sync developer,
I want the ingestion job to detect all column headers automatically,
So that new metadata becomes available without code changes.

**Acceptance Criteria:**
1. Sync reads the header row each run and builds a schema map.
2. Any unknown column is stored as a key/value pair within the Mongo document.
3. Unit tests cover scenarios with 5, 20, and 100 columns.

**Prerequisites:** EP1.3 (serial-based sync in place).
**Scope:** MVP
**Linked Requirements:** FR-003.

**Story EP2.2: Persist Dynamic Columns in MongoDB**

As a data engineer,
I want MongoDB to store dynamic columns with consistent naming conventions,
So that downstream services can rely on predictable keys even as the sheet evolves.

**Acceptance Criteria:**
1. Column names convert to snake_case when stored.
2. Optional metadata (`columnDefinitions`) saved alongside each document for downstream introspection.
3. Collection index ensures queries remain performant with additional fields.

**Prerequisites:** EP2.1.
**Scope:** MVP
**Linked Requirements:** FR-003.

**Story EP2.3: Render Dynamic Columns in Dashboard UI**

As an operations user,
I want the devices table to display whatever columns currently exist in MongoDB,
So that the dashboard always feels like a real-time mirror of the sheet.

**Acceptance Criteria:**
1. `/api/devices` response includes a `columns` array describing order, title, and field keys.
2. UI grid iterates over `columns` and renders cells without hardcoded headers.
3. Table gracefully handles 100-column scenarios with horizontal scrolling.

**Prerequisites:** EP2.2.
**Scope:** MVP
**Linked Requirements:** FR-004.

---

### Epic 3: Sync Observability & Guardrails (FR-005, FR-006)

**Goal & Value**

Provide the visibility and guardrails ops teams need to trust that the “sheet equals dashboard” experience keeps working, even as schemas or data sources evolve.

**Stories**

**Story EP3.1: Emit Structured Sync Telemetry**

As an SRE,
I want the sync job to log structured metrics for each run,
So that I can detect failures or long runtimes before users lose faith.

**Acceptance Criteria:**
1. Logs include start/end time, rows processed, rows skipped, conflicts, and duration.
2. Metrics published to existing monitoring stack with success/failure counters.
3. Alerts fire when a run exceeds 5 minutes or fails twice consecutively.

**Prerequisites:** EP2.1 (dynamic schema map provides counts).
**Scope:** Growth
**Linked Requirements:** FR-005.

**Story EP3.2: Detect and Alert on Schema Changes**

As an operations lead,
I want proactive alerts when sheet columns change,
So that I can coordinate downstream consumers without scrambling.

**Acceptance Criteria:**
1. Sync compares current header set to previous run and logs changes.
2. Significant changes trigger Slack/email notification with before/after column lists.
3. Alert payload links to documentation describing how to update dependent automations.

**Prerequisites:** EP3.1 (telemetry plumbing in place).
**Scope:** Vision
**Linked Requirements:** FR-005, FR-006.

**Story EP3.3: Provide Recovery & Dry-Run Mode**

As an engineer on call,
I want a dry-run/safe-mode command to replay the sync without persisting changes,
So that I can troubleshoot issues when the sheet content looks suspicious.

**Acceptance Criteria:**
1. CLI flag or API parameter enables dry-run; job reports would-be mutations.
2. Dry-run respects column detection and conflict logging.
3. Documentation explains how to switch between dry-run and production modes safely.

**Prerequisites:** EP3.1.
**Scope:** Growth
**Linked Requirements:** FR-005.

---

## Development Phasing Overview

- **Phase 1 (Foundation):** EP1.1–EP1.3. Establishes serial canonicalization so every downstream system trusts the data again.
- **Phase 2 (Experience Parity):** EP2.1–EP2.3. Delivers the magical sync feeling where the dashboard instantly mirrors any sheet change.
- **Phase 3 (Guardrails):** EP3.1–EP3.3. Adds observability and recovery tooling to preserve confidence over time.

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
