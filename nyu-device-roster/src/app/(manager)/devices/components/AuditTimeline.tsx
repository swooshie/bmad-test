"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { API_ROUTES } from "@/lib/routes";
import type { AuditEventType, AuditStatus } from "@/models/AuditLog";

type AuditEvent = {
  id: string;
  eventType: AuditEventType;
  action: string;
  status: AuditStatus;
  actor: string | null;
  errorCode?: string | null;
  timestamp: string;
  context?: Record<string, unknown>;
};

const fetchAuditEvents = async (serial: string): Promise<AuditEvent[]> => {
  const response = await fetch(API_ROUTES.auditEvents({ serial }), {
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as {
    data?: { events: AuditEvent[] };
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Unable to load audit events");
  }
  return payload.data.events;
};

const badgeClass = (eventType: AuditEventType) => {
  switch (eventType) {
    case "governance":
      return "bg-amber-500/20 text-amber-100 border border-amber-300/30";
    case "allowlist-change":
      return "bg-sky-500/20 text-sky-100 border border-sky-300/30";
    case "anonymization":
      return "bg-indigo-500/20 text-indigo-100 border border-indigo-300/30";
    case "sync":
      return "bg-emerald-500/20 text-emerald-100 border border-emerald-300/30";
    default:
      return "bg-slate-500/20 text-slate-100 border border-slate-300/30";
  }
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );

export function AuditTimeline({ serial }: { serial: string }) {
  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["audit-events", serial],
    queryFn: () => fetchAuditEvents(serial),
    enabled: Boolean(serial),
    staleTime: 15_000,
  });

  const sorted = useMemo(
    () => (events ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [events]
  );

  if (isLoading) {
    return <p className="text-sm text-white/60">Loading audit timeline…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-rose-200">
        {(error as Error).message ?? "Unable to load audit timeline"}
      </p>
    );
  }
  if (!sorted.length) {
    return <p className="text-sm text-white/60">No audit events yet for this device.</p>;
  }

  return (
    <ol className="space-y-3">
      {sorted.map((event) => (
        <li
          key={event.id}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3"
        >
          <div
            className={`mt-1 h-3 w-3 rounded-full border border-white/30 shadow-sm ${badgeClass(event.eventType)}`}
            aria-hidden="true"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${badgeClass(event.eventType)}`}>
                {event.eventType}
              </span>
              <span className="text-xs text-white/60">{formatDateTime(event.timestamp)}</span>
              <span className="rounded-md border border-white/20 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80">
                {event.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{event.action}</p>
            {event.actor && <p className="text-xs text-white/70">Actor: {event.actor}</p>}
            {event.errorCode && (
              <p className="text-xs text-rose-200">Error: {String(event.errorCode)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
