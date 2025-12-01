# Source Tree Analysis – NYU Device Roster

```
nyu-device-roster/
├── app/ (Next.js entry points)
│   ├── layout.tsx – root shell with font + theme providers
│   ├── (manager)/layout.tsx – authenticated shell rendering SyncStatusBanner + nav
│   ├── page.tsx – device roster landing view
│   └── access-denied/page.tsx – fallback when RBAC fails
├── components/
│   └── SyncStatusBanner.tsx – surfaces ingest state, governance reminders, and CTA links
├── lib/
│   ├── auth/ (NextAuth providers, session middleware)
│   ├── audit/ (audit log + sync event helpers)
│   ├── devices/ (grid query builder, search param parsing)
│   ├── google-sheets.ts – Sheets API client
│   ├── sync-lock.ts / sync-status.ts – distributed lock + state helpers
│   ├── logging.ts – Pino logger + telemetry
│   ├── anonymization.ts – deterministic masking utilities
│   ├── db.ts – Mongo connection bootstrap
│   └── config.ts / secrets.ts – env + Secret Manager helpers
├── models/
│   ├── Device.ts – roster document schema + indexes
│   ├── Config.ts – allowlist + sync settings history
│   ├── AuditLog.ts – governance/audit trail entries
│   ├── SyncEvent.ts – telemetry events for sync pipeline
│   └── SyncLock.ts – ensures single writer for ingest
├── schemas/
│   ├── config.ts – Zod schema for allowlist payloads
│   └── sync.ts – validation for sync trigger inputs
├── workers/
│   └── sync/
│       ├── index.ts – orchestrates Sheets fetch → transformer → Mongo upsert
│       └── transform.ts – normalizes sheet rows into Device model payloads
├── app/api/
│   ├── devices – GET grid endpoint (filtering, pagination, anonymization)
│   ├── metrics – GET/POST telemetry aggregation + ingestion
│   ├── audit – audit feed exposure
│   ├── session – NextAuth session heartbeat
│   ├── auth – login/logout support
│   ├── sync – manual/cron ingestion triggers
│   └── config – allowlist maintenance endpoints
├── scripts/
│   ├── verify-sync-indexes.ts – ensures Mongo indexes match design
│   ├── reset-sync.ts – purges locks + restarts ingest
│   ├── smoke.ts – basic invariants for demo readiness
│   ├── rollback.ts – snapshot restore utilities
│   └── performance/ & tests/ folders – Lighthouse + Playwright automation
├── tests/
│   ├── integration/accessibility.spec.ts – Playwright axe checks
│   └── performance/ – Lighthouse scripts for CI thresholds
├── config/
│   └── local-dev/sheets-service-account.sample.json – service account template
├── cron.yaml – App Engine style scheduler hitting `/api/sync/run`
├── package.json / tsconfig.json / vitest.config.ts – build + tooling
└── README.md – Next.js boilerplate instructions

docs/
├── PRD.md, epics.md, backlog.md – planning artifacts
├── architecture.md – legacy architecture narrative
├── ux-*.md/html – UX concepts
├── runbook/, governance/performance runbooks – ops guidance
└── stories/ – 76 user stories with context XML pairings

bmad/
├── core/ – runtime agents/tasks (workflow executor, validation checklists)
├── bmm/ – reference workflows, documentation router, manifests
└── tools/ – CLI hooks used by BMAD orchestrator
```

### Critical Integration Points
- `app/(manager)/layout.tsx` attaches SyncStatusBanner (from `components/`) and wires session context from `lib/auth`.
- `lib/google-sheets.ts` + `workers/sync` call into `models/Device` and `models/SyncLock` while writing audit entries through `lib/audit/*`.
- `app/api/*` route handlers compose session middleware (`lib/auth/sessionMiddleware`), anonymization helpers, and `lib/devices/grid-query` utilities.
- Scripts in `scripts/` rely on the same `lib/db.ts` connection logic to mutate Mongo indexes or reset data.

Use this map to orient new contributors before diving into targeted modules.
