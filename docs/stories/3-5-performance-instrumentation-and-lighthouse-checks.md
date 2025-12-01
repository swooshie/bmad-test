# Requirements Context Summary

- **Performance proof mandate:** Epic C5 tasks the team with instrumenting the manager dashboard to prove sub-2s load and sub-200 ms interactions, giving stakeholders confidence beyond anecdotal demos (docs/epics.md:205-215,389-398).  
- **PRD commitments:** Key success metrics demand instrumentation for load times and interactions; FR-007/Performance NFRs require real measurements plus health dashboards for proactive insight (docs/PRD.md:41-47,193,237).  
- **Architecture alignment:** Observability stack already standardizes Pino logs and Cloud Logging metrics; this story must extend it with frontend timing hooks, metrics endpoints, and Lighthouse automation (docs/architecture.md:21-283,326).  
- **CI/Test integration:** Lighthouse script should run against the App Engine URL and produce >90 scores, making it runnable before demo day and as part of quality gates (docs/epics.md:209-214).  
- **Documentation expectations:** Story deliverable includes a runbook describing how to execute instrumentation scripts and interpret metrics, enabling PMs to validate performance quickly (docs/epics.md:209-214, docs/PRD.md:67).  

**Story statement:**  
As a product manager, I want automated instrumentation and Lighthouse checks so I can prove the dashboard meets the promised performance targets before demos (docs/epics.md:209-214, docs/PRD.md:41-47,193).  

## Structure Alignment Summary

- **Previous story learnings:** Story 3-4 is `drafted`, so no Dev Agent Record data yet; note any new instrumentation scripts so later governance/perf stories inherit them (docs/stories/3-4-anonymization-toggle-ux-with-deterministic-placeholders.md).  
- **Folder placement:** Performance hooks belong under `app/(manager)/devices` (hooks/helpers) with supporting scripts in `scripts/` or `tests/performance` to follow repo structure (docs/architecture.md:62-149,200-205).  
- **Observability stack reuse:** Extend `lib/logging.ts` or introduce `lib/metrics.ts` so timing data flows through existing pipelines; avoid bespoke logging (docs/architecture.md:21-205,326).  
- **CI/test integration:** Lighthouse automation should sit under `tests/performance/` and hook into npm scripts for repeatable runs locally and in CI (docs/epics.md:209-214).  
- **Documentation hooks:** Add/runbook updates under `docs/` explaining how to run instrumentation scripts, interpret metrics, and meet thresholds (docs/epics.md:209-214, docs/PRD.md:67).  

## Acceptance Criteria

1. Add frontend timing hooks capturing First Contentful Paint, Interaction to Next Paint, and grid interaction latency, piping metrics to a `/api/metrics` endpoint or logging stream for analysis (docs/epics.md:209-214, docs/PRD.md:41-47,193).  
2. Provide a Lighthouse automation script targeting the App Engine URL that consistently scores ≥90 Performance and outputs artifacts for review (docs/epics.md:209-214).  
3. Publish a runbook describing how to execute instrumentation scripts, interpret thresholds, and share results with stakeholders ahead of demo day (docs/epics.md:209-214, docs/PRD.md:67).  

## Tasks / Subtasks

- [ ] Client instrumentation (AC: 1)  
  - [ ] Build `usePerformanceMetrics` hook capturing FCP/INP plus grid interaction timings via `performance.getEntriesByName` or `PerformanceObserver` (docs/PRD.md:41-47,193).  
  - [ ] Send metrics to `/api/metrics` or structured logs, batching with requestId + anonymization state for correlation (docs/architecture.md:21-205,326).  
- [ ] Metrics endpoint / logging (AC: 1)  
  - [ ] Implement `/api/metrics` handler appending readings to Cloud Logging or Cloud Monitoring custom metrics using shared logging helpers (docs/architecture.md:21-205,283).  
  - [ ] Wire alerts/log-based metrics for latency regressions referencing baseline thresholds (docs/epics.md:389-398).  
- [ ] Lighthouse automation (AC: 2)  
  - [ ] Add `tests/performance/lighthouse.ci.mjs` (or similar) running `lighthouse` in CI/headless Chrome against the deployed URL, storing HTML/JSON reports (docs/epics.md:209-214).  
  - [ ] Integrate script into npm command (`npm run perf:lighthouse`) and document required env vars / URLs (docs/PRD.md:41-47).  
- [ ] Runbook delivery (AC: 3)  
  - [ ] Create `docs/performance-runbook.md` summarizing instrumentation commands, acceptance thresholds, and troubleshooting steps (docs/PRD.md:67).  
  - [ ] Include instructions for exporting metrics to PM stakeholders plus sample report template referencing Lighthouse + timing data (docs/epics.md:209-214).  
- [ ] Testing / verification  
  - [ ] Add unit tests for metrics hook fallbacks and endpoint payload validation; ensure CI job fails if Lighthouse score <90 (docs/architecture.md:200-205).  

# Story 3.5: performance-instrumentation-and-lighthouse-checks

Status: review

## Story

As a product manager,
I want automated instrumentation and Lighthouse checks,
so that I can prove the dashboard hits the promised performance targets ahead of demos.

## Acceptance Criteria

1. Add frontend timing hooks capturing First Contentful Paint, Interaction to Next Paint, and grid interaction latency, piping metrics to a `/api/metrics` endpoint or logging stream for analysis (docs/epics.md:209-214, docs/PRD.md:41-47,193).  
2. Provide a Lighthouse automation script targeting the App Engine URL that consistently scores ≥90 Performance and outputs artifacts for review (docs/epics.md:209-214).  
3. Publish a runbook describing how to execute instrumentation scripts, interpret thresholds, and share results with stakeholders ahead of demo day (docs/epics.md:209-214, docs/PRD.md:67).  

## Tasks / Subtasks

- [x] Client instrumentation (AC: 1)  
  - [x] Build `usePerformanceMetrics` hook capturing FCP/INP plus grid interaction timings via `performance.getEntriesByName` or `PerformanceObserver` (docs/PRD.md:41-47,193).  
  - [x] Send metrics to `/api/metrics` or structured logs, batching with requestId + anonymization state for correlation (docs/architecture.md:21-205,326).  
- [x] Metrics endpoint / logging (AC: 1)  
  - [x] Implement `/api/metrics` handler appending readings to Cloud Logging or Cloud Monitoring custom metrics using shared logging helpers (docs/architecture.md:21-205,283).  
  - [x] Wire alerts/log-based metrics for latency regressions referencing baseline thresholds (docs/epics.md:389-398).  
- [x] Lighthouse automation (AC: 2)  
  - [x] Add `tests/performance/lighthouse.ci.mjs` (or similar) running `lighthouse` in CI/headless Chrome against the deployed URL, storing HTML/JSON reports (docs/epics.md:209-214).  
  - [x] Integrate script into npm command (`npm run perf:lighthouse`) and document required env vars / URLs (docs/PRD.md:41-47).  
- [x] Runbook delivery (AC: 3)  
  - [x] Create `docs/performance-runbook.md` summarizing instrumentation commands, acceptance thresholds, and troubleshooting steps (docs/PRD.md:67).  
  - [x] Include instructions for exporting metrics to PM stakeholders plus sample report template referencing Lighthouse + timing data (docs/epics.md:209-214).  
- [x] Testing / verification  
  - [x] Add unit tests for metrics hook fallbacks and endpoint payload validation; ensure CI job fails if Lighthouse score <90 (docs/architecture.md:200-205).  

## Dev Notes

- **Instrumentation hook:** Place `usePerformanceMetrics` under `app/(manager)/devices/hooks` to record FCP/INP and grid interaction deltas; use `PerformanceObserver` with `buffered` flag so metrics capture cold + warm loads (docs/PRD.md:41-47,193).  
- **Metrics endpoint:** Create `/api/metrics` route using `lib/logging.ts` or new `lib/metrics.ts` to emit structured payload `{ metric, value, threshold, anonymizedState }`, enabling Cloud Logging filters and log-based metrics (docs/architecture.md:21-205,326).  
- **Lighthouse automation:** Add `tests/performance/lighthouse.ci.mjs` leveraging the official CLI, parameterized with deployment URL; store HTML/JSON outputs under `artifacts/perf` and fail if score <90 (docs/epics.md:209-214).  
- **Runbook content:** `docs/performance-runbook.md` should outline prerequisites (Chrome, Node), commands (`npm run perf:lighthouse`, metrics collector), interpreting dashboards, and presenting results to stakeholders (docs/PRD.md:67).  
- **Alerting guidance:** Document how to configure Cloud Logging metrics/alerts for INP >200 ms or Lighthouse score dips, referencing architecture’s monitoring patterns (docs/architecture.md:21-205,283).  
- **Testing:** Unit-test metrics hook fallbacks, add API tests for `/api/metrics`, and wire CI to call `npm run perf:lighthouse`, failing the build on regressions (docs/architecture.md:200-205).  

### Project Structure Notes

- Hooks/components stay under `app/(manager)/devices`; API route under `app/api/metrics`.  
- Shared helpers (hashing, metrics formatting) belong in `lib/`.  
- Place Lighthouse assets in `tests/performance` with outputs stored under `artifacts/perf` (gitignored if necessary).  

### References

- docs/epics.md:205-215,389-398  
- docs/PRD.md:41-47,193,237  
- docs/architecture.md:21-205,283,326  

## Dev Agent Record

### Context Reference

- `docs/stories/3-5-performance-instrumentation-and-lighthouse-checks.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

- Implemented instrumentation: added `usePerformanceMetrics` to capture FCP/INP and grid interactions, batching with requestId/anonymization flags and auto-flushing to `/api/metrics`.
- Added `/api/metrics` route + `logPerformanceMetric` helper emitting structured PERFORMANCE_METRIC events for Cloud Logging/alerts.
- Shipped Lighthouse CI script + npm command and a performance runbook; added unit tests for the hook fallbacks and API validation.

### Completion Notes List

- AC1: usePerformanceMetrics records FCP/INP + grid interactions, sends batched payloads with anonymized flag to `/api/metrics` and logs as PERFORMANCE_METRIC.
- AC2: Added headless Lighthouse script `tests/performance/lighthouse.ci.mjs` and npm script `perf:lighthouse` failing below score 90; reports saved to `artifacts/perf/`.
- AC3: Authored `docs/performance-runbook.md` describing instrumentation usage, thresholds, Lighthouse execution, and alert/reporting guidance.

### File List

- nyu-device-roster/src/app/(manager)/devices/hooks/usePerformanceMetrics.ts
- nyu-device-roster/src/app/(manager)/devices/components/DeviceGridShell.tsx
- nyu-device-roster/src/app/api/metrics/route.ts
- nyu-device-roster/src/lib/logging.ts
- nyu-device-roster/src/lib/routes.ts
- nyu-device-roster/tests/unit/app/usePerformanceMetrics.test.ts
- nyu-device-roster/tests/unit/app/api/metrics/route.test.ts
- nyu-device-roster/tests/performance/lighthouse.ci.mjs
- nyu-device-roster/package.json
- nyu-device-roster/.gitignore
- docs/performance-runbook.md
- docs/sprint-status.yaml
