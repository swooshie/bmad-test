# Performance Instrumentation Runbook

This runbook documents how to capture performance telemetry, run Lighthouse audits, and share results with PM stakeholders.

## Prerequisites

- Node.js 20+ and npm
- Chrome/Chromium installed (headless is fine)
- Network access to the deployed Manager Dashboard (`APP_ENGINE_URL` or `LIGHTHOUSE_URL`)

## Instrumentation Flow (Frontend → `/api/metrics`)

1. The dashboard loads `usePerformanceMetrics`, which records:
   - First Contentful Paint (FCP)
   - Interaction to Next Paint (INP)
   - Grid interactions (sort/filter/pagination/export) measured against the 200 ms target
2. Metrics are batched with a `requestId` and anonymization state, then posted to `/api/metrics`.
3. The API validates payloads with Zod and emits structured logs:
   ```json
   {
     "event": "PERFORMANCE_METRIC",
     "metric": "INP",
     "value": 180,
     "threshold": 200,
     "anonymized": true,
     "context": { "interactionId": "abc" }
   }
   ```
4. Cloud Logging can be filtered by `event=PERFORMANCE_METRIC` to create log-based metrics and alerts.

### Alerting Guidance

- Create a log-based metric on `jsonPayload.event="PERFORMANCE_METRIC"` and `jsonPayload.metric="INP"`.
- Set alerts when `value > 200` (INP) or `value > 2000` (FCP) over a 5-minute window.
- Add a separate alert for grid interaction metrics (`metric` prefixed with `grid-`) above 200 ms average.

## Lighthouse Automation

- Command: `npm run perf:lighthouse`
- Environment:
  - `LIGHTHOUSE_URL` (preferred) or `APP_ENGINE_URL` should point to the deployed dashboard.
  - Defaults to `http://localhost:3000` if unset.
- Outputs:
  - HTML and JSON reports under `artifacts/perf/`.
- Threshold: Fails the run if Performance score < 90.

Example:

```bash
LIGHTHOUSE_URL="https://your-app-url" npm run perf:lighthouse
```

## Sharing Results with Stakeholders

- Export the latest HTML report from `artifacts/perf/` and attach it to demo prep threads.
- Share Cloud Logging charts for:
  - FCP trend vs 2 s threshold
  - INP trend vs 200 ms threshold
  - Grid interaction latency (sort/filter/page)
- Sample stakeholder update:
  - Performance score: 93 (Lighthouse)
  - FCP p95: 1.8 s (target 2 s)
  - INP p95: 180 ms (target 200 ms)
  - Grid interactions p95: 160 ms (sort/filter/page)
  - Alerts: none in last 24h

## Troubleshooting

- Metrics not arriving:
  - Check `/api/metrics` responses in the Network tab (expect 200 with `{ recorded: true }`).
  - Ensure ad/tracker blockers aren’t blocking `sendBeacon`.
- Failing Lighthouse run:
  - Verify `LIGHTHOUSE_URL` resolves and the app returns 200.
  - Inspect `artifacts/perf/*.report.json` for specific audits failing.
- High INP:
  - Inspect long tasks in Chrome Performance panel.
  - Validate grid virtualization is intact and filters/sorts are server-side.
