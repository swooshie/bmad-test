'use client';

import { useRouter } from "next/navigation";

import IconActionButton from "./IconActionButton";
import { API_ROUTES, MANAGER_ROUTES } from "@/lib/routes";

export const IconActionRow = () => {
  const router = useRouter();

  return (
    <section
      aria-label="Primary dashboard actions"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
    >
      <IconActionButton
        icon={
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 4a8 8 0 1 0 7.48 10.5h-2.14A6 6 0 1 1 12 6v2.5l4-3-4-3z" />
          </svg>
        }
        label="Refresh"
        actionId="refresh"
        tooltip="Trigger manual sync and refresh telemetry"
        onPress={async () => {
          await fetch(API_ROUTES.syncManual, { method: "POST" }).catch(() => {
            /* handled gracefully by SyncStatusBanner retry */
          });
        }}
      />
      <IconActionButton
        icon={
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M5 4h14a1 1 0 0 1 1 1v10.5a.5.5 0 0 1-.8.4l-3.9-2.8-4.3 4.2-2.8-2.9-3.2 2.6a.5.5 0 0 1-.8-.4V5a1 1 0 0 1 1-1Zm13 2H6v8.2l2.6-2.1a.5.5 0 0 1 .7.1l2.7 2.8 4.1-4a.5.5 0 0 1 .7 0l1.2.9V6Z" />
          </svg>
        }
        label="Export"
        actionId="export"
        tooltip="Go to devices and export governance snapshot"
        targetHref={MANAGER_ROUTES.devices}
      />
      <IconActionButton
        icon={
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M10.3 5.3a1 1 0 0 1 1.4 0l7 7a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0l-7-7a1 1 0 0 1 0-1.4l4-4Zm.7 2.12L8.12 10.3 14 16.17 16.88 13.3 11 7.42Zm6 6L15.42 15l-1.41 1.41 1.58 1.59L17 15.41l.71-.71Z" />
          </svg>
        }
        label="Filter"
        actionId="filter"
        tooltip="Jump to device filters"
        targetHref={`${MANAGER_ROUTES.devices}?intent=filters`}
      />
      <IconActionButton
        icon={
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 2a7 7 0 0 1 7 7c0 1.7-.8 3.7-2.5 5.9-.9 1.1-1.9 2.1-2.7 2.8l-.6.6a1 1 0 0 1-1.4 0l-.6-.6c-.8-.7-1.8-1.7-2.7-2.8C5.8 12.7 5 10.7 5 9a7 7 0 0 1 7-7Zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          </svg>
        }
        label="Governance"
        actionId="governance"
        tooltip="Review governance cues and anonymization"
        targetHref={`${MANAGER_ROUTES.devices}#governance`}
        onPress={() => {
          router.prefetch(MANAGER_ROUTES.devices).catch(() => {
            /* optional prefetch */
          });
        }}
      />
    </section>
  );
};

export default IconActionRow;
