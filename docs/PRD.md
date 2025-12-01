# BMAD Demo NodeJS Project - Product Requirements Document

**Author:** Aditya
**Date:** 2025-11-19
**Version:** 1.0

---

## Executive Summary

Resolving the sheet-to-database sync defect ensures every downstream feature relying on the device registry receives accurate, current identifiers. By pivoting from the outdated `deviceId` column to the authoritative `serial` column in the `Devices` Google Sheet—and dynamically mirroring whatever columns operators maintain there—the internal dashboard regains trustworthy telemetry for all teams that depend on it.

### What Makes This Special

The magic moment is when an operator refreshes the dashboard and instantly sees MongoDB-backed device data align with what is captured in the sheet, without manual reconciliation or schema tweaking.

---

## Project Classification

**Technical Type:** Web dashboard with automated data-sync layer
**Domain:** Internal operations / asset visibility
**Complexity:** Low (surgical bug fix with high blast radius)

This is a focused remediation for an internal-facing web dashboard that aggregates hardware records from MongoDB while respecting the source of truth maintained in Google Sheets. Although the code change is narrow, every dependent service relies on the corrected identifiers and column mappings, giving the fix outsized leverage.

### Project Classification Details

- **Project Type Signals:** dashboard, MongoDB-backed UI, Google Sheets sync layer
- **Domain Signals:** internal operations, hardware inventory, device lifecycle tracking
- **Routing Decisions:** No regulated domain detected; continue in general workflow

---

## Success Criteria

1. **Serial fidelity:** Sync uses the `serial` column as the canonical identifier, ensuring dashboard reads match Google Sheet entries one-to-one.
2. **Dynamic schema propagation:** Any new columns added in the `Devices` sheet appear in dashboard tables automatically without code changes or manual data reshaping.
3. **Business as usual cadence:** Sync continues operating at the existing cadence and uptime with no additional manual intervention.
4. **Downstream trust:** All dependent modules receive accurate device data, eliminating reconciliation workarounds or hotfixes.
5. **Magic continuity:** Operators never lose the intuitive “sheet equals dashboard” expectation—the UI should always feel like a live reflection of the source data.

---

## Product Scope

### MVP - Minimum Viable Product

Serial-based sync deployed with dynamic column propagation so the dashboard mirrors Google Sheets without manual schema tweaks.

### Growth Features (Post-MVP)

Lightweight monitoring and schema-change alerts that notify operators when the sheet layout shifts or sync retries occur.

### Vision (Future)

Unified ingestion framework so any operational source (Sheets, CSV uploads, partner APIs) can become the authoritative dataset while the dashboard remains perfectly aligned.

### Out of Scope

- No new dashboard features beyond dynamic column rendering.
- No changes to authentication/authorization flows beyond existing guards.
- No rewrite of downstream consumers; they only receive corrected data.

---

## Domain-Specific Requirements

None identified; fix operates within general operations context.

---

## Innovation & Novel Patterns

None required for this remediation; emphasis is on correctness and flexibility.

### Validation Approach

Unit/integration tests around sheet ingestion, plus manual dashboard verification after sync.

---

## Project-Type Specific Requirements

The sync service functions as a backend integration bridge between Google Sheets and MongoDB.

- **Data contract:** Treat `serial` as immutable primary key; required columns include `serial`, `status`, `location`, `hwRevision`, and `lastService`. Optional columns (anything else operators add) must be imported as string values without code changes.
- **Conflict handling:** If two sheet rows share the same `serial`, the most recently updated row wins and emits an alert to observability tooling.
- **Downstream consumers:** Device provisioning lambdas, alerting jobs, and the UI dashboard all read from the MongoDB collection; none should require schema updates when new sheet columns appear.
- **Migration expectation:** Existing MongoDB documents referencing `deviceId` must be backfilled with the matching `serial` before the first post-fix sync completes.

### API Specification

- Sheet ingestion process pulls via Google Sheets API v4 using a service account; it must request the entire header row to detect column additions.
- MongoDB collection `devices` stores documents keyed by `serial`; each sheet column maps to a field with snake_case conversion.
- Dashboard backend exposes `/api/devices` which now returns `serial` plus every dynamic field. Response metadata must include a generated `columns` array so the UI can render them.

### Authentication & Authorization

- Service account key for Sheets remains unchanged but must only request readonly scope.
- Dashboard endpoint should continue to require internal auth tokens; no public exposure.

### Platform Support

- Dashboards consumed on desktop browsers; ensure dynamic columns render responsively without column clipping.

### Device Capabilities

- None (dashboard is desktop web); section retained for completeness.

### Multi-Tenancy Architecture

- Single-tenant internal deployment; no tenant-specific branching.

### Permissions & Roles

- Only authenticated internal staff should access `/api/devices`; ensure role-based checks remain intact after schema changes.

---

## User Experience Principles

Clarity and trust: the dashboard should immediately reflect accurate device telemetry without manual intervention, reinforcing the "magic" feeling of sheet and UI moving in lockstep.

### Key Interactions

- Operator opens the dashboard and sees device data synced from MongoDB.
- On refresh, any new sheet columns appear automatically with data populated.

---

## Functional Requirements

- **FR-001 Serial Canonicalization (MVP):** Sync job must treat `serial` as the immutable primary key when reading from Google Sheets and when writing into MongoDB. Any missing `serial` value causes the row to be skipped and logged.
- **FR-002 Backfill & Migration (MVP):** Existing MongoDB documents must be backfilled to include the correct `serial`, and historical `deviceId` fields must remain readable for downstream compatibility until those services migrate.
- **FR-003 Dynamic Column Ingestion (MVP):** The ingestion layer must discover every column header in the sheet and persist each column—even newly added ones—into MongoDB without code deployments.
- **FR-004 Dashboard Rendering (MVP):** The internal dashboard must render whatever columns exist in the API response, generating headers and cells on the fly so operators always see the Google Sheet schema reflected.
- **FR-005 Observability Hooks (Growth):** Sync must emit structured logs/metrics for success, failure, retry count, and schema changes so operators know when magic alignment is at risk.
- **FR-006 Schema-Change Alerting (Vision):** When future ingestion sources change structure, the system should surface proactive alerts and suggested remediation steps, keeping the “sheet-to-dashboard magic” intact even as data sources diversify.

---

## Non-Functional Requirements

### Performance

- Sync should complete within existing operational windows (same cadence as current job) and finish within 5 minutes of sheet change detection.

### Security

- Maintain existing access controls to the sheet and MongoDB; no new exposures. Secrets must stay in the current secret manager and never leak via dynamic column names.

### Scalability

- Must handle increased sheet columns (up to 100 headers) or row counts (up to 10k rows) without code changes, and pagination must keep API responses under 1 MB.

### Accessibility

Not applicable (internal tool).

### Integration

- Ensure downstream services receive consistent column sets via the dashboard API or shared data layer, and update schema metadata endpoint `/api/devices/columns` alongside the main dataset.

- _No additional NFRs identified beyond the above._

---

## Implementation Planning

### Epic Breakdown Required

Requirements must be decomposed into epics and bite-sized stories (200k context limit).

**Epic Overview:**

1. **Serial Source Alignment** – establish `serial` as the canonical key and migrate existing data.
2. **Dynamic Column Propagation** – automatically ingest and render every sheet column.
3. **Sync Observability & Guardrails** – add telemetry, schema change alerts, and recovery tooling.

**Next Step:** Use `docs/epics.md` as the active backlog or re-run `workflow create-epics-and-stories` if scope changes.

---

## References

- Product Brief: Not provided (none shared yet)
- Domain Brief: Not provided (none shared yet)
- Research: None provided

---

## Next Steps

1. **Epic & Story Breakdown** - Run: `workflow epics-stories`
2. **UX Design** (if UI) - Run: `workflow ux-design`
3. **Architecture** - Run: `workflow create-architecture`

---

_This PRD captures the essence of BMAD Demo NodeJS Project - restoring confidence in the dashboard by syncing on serial numbers and dynamic columns._

_Created through collaborative discovery between Aditya and AI facilitator._
