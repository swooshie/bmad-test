# Brainstorming Session Results

**Session Date:** 2025-11-19
**Facilitator:** Analyst Mary (Business Analyst)
**Participant:** Aditya

## Executive Summary

**Topic:** Align MongoDB device indexing with the Google Sheet serial column

**Session Goals:**
- Question every dependency around `deviceId` before making schema changes
- Explore alternative assumptions (serial column as canonical key)
- Systematically reimagine sync/index steps via SCAMPER
- Stress-test migration with failure scenarios

**Techniques Used:** Question Storming, Assumption Reversal, SCAMPER, Chaos Engineering

**Total Ideas Generated:** 14

### Key Themes Identified:
- Treat the sheet serial as the sole source of truth for uniqueness
- Rename schema fields to match Google Sheet columns to avoid confusion
- Update scripts/tests that may assume synthetic IDs
- Harden sync worker for duplicate serials or partial failures

## Technique Sessions

### Question Storming
- Current `deviceId` is purely synthetic (ingest-generated)
- Sheet serial behaves like a primary key and does not change
- Scripts (`verify-sync-indexes`, `reset-sync`, `smoke`) may assume the old ID structure
- `devices` collection is empty, so migration can start fresh
- Unknown whether `AuditLog` / `SyncEvent` reference `deviceId`
- Need a plan for partial failures during first sync with new indexes

### Assumption Reversal
- Using the sheet serial as canonical key is viable because the column is stable
- If only one sheet exists, `sheetId` adds no value; we can drop it
- Renaming Mongo fields (e.g., `serialNumber`) would make the schema self-explanatory
- Rebuilding the Device schema to mirror the sheet simplifies sync logic and reduces derived data

### SCAMPER Highlights
- **Substitute:** Replace `deviceId` with `serial` everywhere (schema, indexes, APIs)
- **Combine:** Use `serial + lastSyncedAt` in audit logs for traceability
- **Adapt:** Update `verify-sync-indexes` and `reset-sync` scripts to assert serial-based indexes
- **Modify:** Adjust `queryDeviceGrid` sorts/filters to leverage serial when necessary
- **Put to other uses:** Use serial in user-facing audit trails for easier cross-referencing
- **Eliminate:** Remove redundant `sheetId` field, redundant indexes, synthetic ID generation
- **Reverse:** Instead of generating IDs first then syncing, ingest serial-first and only compute derived fields once uniqueness is confirmed

### Chaos Engineering
- Simulate duplicate serials entering the sheet (should produce deterministic errors and skip updates)
- Handle missing serial values gracefully (log and quarantine rows)
- Test replay scenarios where the worker runs twice with overlapping data
- Validate behavior when workers crash mid-run (ensure `SyncLock` and partial updates recover cleanly)

## Idea Categorization

### Immediate Opportunities
- Drop `sheetId` and rename `deviceId` → `serialNumber` in `Device` schema
- Update indexes to `{ serialNumber: 1 }` (unique) plus supporting indexes as needed
- Modify sync worker to map sheet serial directly into Mongo documents
- Audit scripts/tests for assumptions about the old ID structure

### Future Innovations
- Build a lineage report linking sheet rows, Mongo docs, and audit events by serial
- Add proactive validation in the UI to highlight missing serials or duplicate conflicts
- Instrument `SyncEvent` to log serial mismatches for observability

### Moonshots
- Introduce a schema registry that automatically aligns Mongo models with Google Sheet schema definitions
- Implement self-healing sync jobs that auto-resolve duplicate serial conflicts by querying Sheets history

### Insights and Learnings
- Because the collection is empty, the migration risk is low—main effort is aligning code paths
- Aligning field names with sheet columns will reduce future confusion and lower maintenance cost
- Chaos-mode testing should be part of the rollout to catch duplicate/missing serial edge cases

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Rename fields and indexes to serial
- Rationale: Removes synthetic ID confusion and directly mirrors source of truth
- Next steps: Update `Device` model, sync worker transforms, API responses, tests
- Resources needed: Backend engineer, DB admin for index change
- Timeline: 1-2 days including testing

#### #2 Priority: Update scripts/tests for serial-based validation
- Rationale: Ensures `verify-sync-indexes`, `reset-sync`, and smoke tests enforce the new constraint
- Next steps: Search scripts for `deviceId`, rewrite expectations, rerun CI
- Resources needed: Engineer familiar with scripts, CI runner
- Timeline: 1 day

#### #3 Priority: Chaos testing for sync edge cases
- Rationale: Catch duplicates/missing serials before production rollout
- Next steps: Craft test data, run worker under failure scenarios, document results
- Resources needed: QA/engineer, staging environment
- Timeline: 1-2 days

## Reflection and Follow-up

### What Worked Well
- Structured technique flow kept the discussion focused despite the technical nature
- Empty collection simplifies migration, allowing ideas to be more ambitious

### Areas for Further Exploration
- Confirm whether audit logs or future features rely on `deviceId` naming
- Determine if other collections (e.g., `AuditLog`, `SyncEvent`) should store serial references

### Recommended Follow-up Techniques
- Question Storming (re-run) for API response changes once schema updates begin
- Chaos Engineering drills prior to production rollout

### Questions That Emerged
- Do any external clients reference `deviceId` (e.g., exports, reporting tools)?
- How will we detect duplicate serials early in the pipeline?

### Next Session Planning
- **Suggested topics:** API contract updates, audit/log schema alignment, migration plan review
- **Recommended timeframe:** After implementing field renames and script updates
- **Preparation needed:** Draft schema changes, updated scripts, planned test cases

---

_Session facilitated using the BMAD CIS brainstorming framework_
