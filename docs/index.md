# Project Documentation Index

## Project Overview
- **Type:** Monolith (single Next.js application)
- **Primary Language:** TypeScript / React 19
- **Architecture:** Web application with API route handlers + MongoDB persistence
- **Output Folder:** `docs/`

## Quick Reference
- **Tech Stack:** Next.js 16, React 19, TanStack Query, NextAuth, MongoDB, Google Sheets ingest worker
- **Entry Point:** `nyu-device-roster/src/app/page.tsx`
- **Architecture Pattern:** Layered web app (UI → API route handlers → Mongoose models)

## Generated Documentation
- [Project Overview](./project-overview.md)
- [Architecture (legacy reference)](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)
- [Project Parts Metadata](./project-parts.json)

## Existing Planning Docs
- [PRD](./PRD.md)
- [Epics](./epics.md)
- [Backlog](./backlog.md)
- [Stories Folder](./stories/) (76 files)
- [UX Specification](./ux-design-specification.md)
- [Governance Banner Runbook](./governance-banner-runbook.md)
- [Performance Runbook](./performance-runbook.md)
- [Sprint Status](./sprint-status.yaml)

## Getting Started
1. Review [project-overview.md](./project-overview.md) for context and stakeholders.
2. Use [development-guide.md](./development-guide.md) to set up local env and run tests.
3. Consult [api-contracts.md](./api-contracts.md) and [data-models.md](./data-models.md) before changing Mongo indexes or endpoint contracts.
4. Update this index whenever new documentation is generated so other BMAD workflows (PRD, architecture) can ingest the latest references.
