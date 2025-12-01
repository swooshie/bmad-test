# Governance Banner & Device Drawer Runbook

## Icon-first controls & animation tokens
- Dashboard actions (Refresh, Export, Filter, Governance) use shared animation tokens from `src/lib/animation.ts` (hover: 120ms, press: 90ms, release: 150ms) and reveal labels on hover/focus/tap.
- Reduced-motion users keep labels pinned and skip transitions automatically; `prefers-reduced-motion: reduce` is honored by the button helper hook.
- Each icon press emits `ICON_ACTION_TRIGGERED` telemetry (duration, anonymization, reduced-motion) through `/api/audit/icon-action`, feeding audit timelines and perf dashboards.
- Keyboard users: focus outlines remain visible, labels stay expanded, and `Enter/Space` triggers still record timing metrics.

## Focus order and accessibility
1. Grid row selection opens the Device Drawer; focus lands on the drawer refresh control and `Esc` closes the drawer.
2. Focus trap keeps tabbing within Close → Export → Handoff → Refresh; closing returns focus to the originating grid row.
3. Drawer uses `role="dialog"` with aria-label set to the device id; timeline updates are announced through status text in the grid shell.

## Audit ribbon usage
- Drawer timeline calls `/api/audit?deviceId=` to list SyncEvent records (sync/handoff/anonymization/export). Events are badge-colored by type and show timestamp + summary.
- Use the Refresh control in the timeline header to re-fetch events if you ran an action.

## Export Audit Snapshot
1. Select a row so the Device Drawer opens.
2. Click “Export Audit Snapshot” to queue an export; success is logged via SyncEvent `DEVICE_AUDIT_EXPORT`.
3. Check audit timeline for the export entry; use Refresh if needed.

## Initiate Handoff
1. With the drawer open, click “Initiate Handoff”.
2. Action logs `DEVICE_HANDOFF_INITIATED` in SyncEvent; timeline surface will show it after refresh.

## Anonymization chips
- Drawer respects global anonymization state from `AnonymizationStateContext`; toggling in the banner/grid keeps chips in sync and logs `ANONYMIZATION_TOGGLED`.

## Filter chips & halo highlights
- Filter dropdown selections now surface in the chips bar; chips can be reordered with arrow keys or removed with `Delete/Backspace`, and screen readers announce changes via the grid status region.
- Chips mirror the URL query string (including chip order) so deep links reload the same filters; `/api/devices` rejects invalid filter payloads via Zod validation.
- The grid applies a violet halo to rows after filter changes; reduced-motion users still get a static outline while virtualization metrics log any fallback rendering spikes.
- Filter add/remove events emit `FILTER_CHIP_UPDATED` logs and async audit entries (route `/api/devices`), capturing anonymization state and filter payload for governance dashboards.

## Troubleshooting
- No timeline events: confirm `/api/audit?deviceId=` returns data and the deviceId matches SyncEvent metadata; retry Refresh.
- Export/Handoff errors: confirm session is valid; check server logs for `DEVICE_DRAWER_ACTION` or `AUDIT_TIMELINE_FETCH_FAILED`.
