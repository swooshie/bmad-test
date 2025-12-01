# Project Overview – NYU Device Roster

## Executive Summary
- **Purpose:** Synchronize NYU admissions device roster data from Google Sheets into MongoDB so analysts can audit assignments, run governance workflows, and expose an interactive Next.js dashboard.
- **Core Capabilities:** Google Sheets ingest worker, MongoDB persistence with audit history, authenticated Next.js UI with anonymization and governance cues, and telemetry endpoints for sync health.
- **Why It Matters:** Replacing manual spreadsheet reviews with a governed roster enables role-gated access, repeatable ingest, and observability for upcoming indexing and schema changes (e.g., migrating `deviceId` indexes to use the sheet serial column).

## Repository Structure
- `nyu-device-roster/` – Application source (Next.js 16 + React 19, TanStack Query, NextAuth, MongoDB models, Playwright/Vitest harness, sync worker, cron config).
- `bmad/` – BMAD workflow bundle (agents, tasks, workflows) used to orchestrate documentation and planning.
- `docs/` – Planning artifacts, PRD, epics, backlog, UX specs, runbooks, and generated documentation (this folder).

## Stakeholders & Workflows
- **Admissions Engineering** – Owns Google Sheets roster, expects MongoDB indexes to align with sheet serial numbers.
- **Governance & Compliance** – Consumes audit logs (`AuditLog`, `SyncEvent`) and anonymization toggles surfaced in UI.
- **Analyst Persona (Mary)** – Runs BMAD workflows such as `document-project`, `workflow-status`, and `product-brief` to coordinate documentation and next steps.

## Technology Stack Highlights
- **Frontend:** Next.js 16 App Router with shared layout (`src/app/layout.tsx`) and management shell under `src/app/(manager)/layout.tsx`; React 19, TanStack Query for data fetching, SyncStatusBanner component for runtime cues.
- **Backend/API:** Next.js Route Handlers under `src/app/api/*` for devices, audit feeds, metrics, session validation, and sync runs; Zod for validation; NextAuth for session middleware; custom `withSession` wrapper ensures RBAC.
- **Data Layer:** MongoDB models defined via Mongoose (`Device`, `Config`, `AuditLog`, `SyncEvent`, `SyncLock`). Google Sheets ingest pipeline (`src/workers/sync`) pulls rows, transforms them, and upserts into Mongo while tracking hashes and audit metadata.
- **Observability:** `logger` + `logPerformanceMetric`, sync telemetry webhooks, `/api/metrics` POST endpoint for external instrumentation, and `SyncEvent` documents for each automation trigger.
- **Automation & Tooling:** Scripts (`scripts/*.ts`) for syncing indexes, smoke tests, rollbacks, and Lighthouse checks. GitHub/CI ready via Playwright + Vitest + Lighthouse scripts.

## Data & Integration Flow
1. **Source of Truth** – Admissions maintains a Google Sheet with device assignments and serial numbers.
2. **Sync Worker (`src/workers/sync`)** – Uses service account credentials (sample under `config/local-dev`) to fetch spreadsheets, transform rows (`transform.ts`), and call Mongo upserts.
3. **MongoDB Models** – Device state (including offboarding metadata), allowlist/config snapshots, sync locks, audit events, and telemetry metrics.
4. **Next.js APIs** – `/api/devices` exposes paginated grids with anonymization toggles; `/api/metrics` aggregates sync throughput; `/api/sync/run` orchestrates manual or cron-triggered ingests; `/api/audit` exposes governance trails.
5. **UI Shell** – Management layout surfaces SyncStatusBanner, anonymization toggle, governance reminders, and interactive grid/backlog features described in docs.

## Current Focus: Index Realignment
- Upcoming change: re-index Mongo `deviceId` to follow the spreadsheet serial column instead of static ID, ensuring query patterns from UI and sync worker stay efficient.
- Impact Areas: `Device` model indexes, ingest transformation logic, and possibly `queryDeviceGrid` sort operations.
- Dependencies: cron job & sync worker must respect any new key so we maintain unique constraints (`device_sheet_unique`).

## Reference Documents
- Product requirements: `docs/PRD.md`
- Backlog & stories: `docs/backlog.md`, `docs/epics.md`, `docs/stories/*.md`
- Architecture baseline: `docs/architecture.md`
- UX direction: `docs/ux-design-specification.md`, `docs/ux-design-directions.html`
- Operational runbooks: `docs/governance-banner-runbook.md`, `docs/performance-runbook.md`, `docs/runbook/*`

Use this overview as the entry point for developers touching ingestion, Mongo indexing, or the governance UI.
