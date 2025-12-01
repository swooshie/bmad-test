"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { usePerformanceMetrics } from "@/app/(manager)/devices/hooks/usePerformanceMetrics";
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

const EVENT_TYPE_FILTERS: Array<{ key: AuditEventType; label: string; helper: string }> = [
  { key: "sync", label: "Sync", helper: "Manual + scheduled runs" },
  { key: "anonymization", label: "Anonymization", helper: "Toggle events" },
  { key: "allowlist-change", label: "Allowlist", helper: "Config updates" },
];

const badgeClass = (eventType: AuditEventType) => {
  switch (eventType) {
    case "sync":
      return "bg-emerald-500/20 text-emerald-100 border border-emerald-300/30";
    case "anonymization":
      return "bg-indigo-500/20 text-indigo-100 border border-indigo-300/30";
    case "allowlist-change":
      return "bg-sky-500/20 text-sky-100 border border-sky-300/30";
    default:
      return "bg-slate-500/20 text-slate-100 border border-slate-300/30";
  }
};

const fetchAuditFeed = async (filters: AuditEventType[], recordInteraction: (metric: string, durationMs: number, threshold?: number, context?: Record<string, unknown>) => void): Promise<AuditEvent[]> => {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const response = await fetch(
    API_ROUTES.auditEvents({ eventTypes: filters.length ? filters : undefined }),
    {
      headers: { Accept: "application/json" },
    }
  );
  const payload = (await response.json()) as {
    data?: { events: AuditEvent[] };
    error?: { message?: string };
  };
  const durationMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
  recordInteraction("audit-feed-fetch", durationMs, 200, {
    filters: filters.join(",") || "all",
  });
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Unable to load audit feed");
  }
  return payload.data.events;
};

export function AuditPanel() {
  const [selectedFilters, setSelectedFilters] = useState<AuditEventType[]>([
    "sync",
    "anonymization",
    "allowlist-change",
  ]);
  const { recordInteraction } = usePerformanceMetrics();

  const queryKey = useMemo(
    () => ["audit-feed", ...selectedFilters.sort()],
    [selectedFilters]
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchAuditFeed(selectedFilters, recordInteraction),
    staleTime: 15_000,
  });

  const toggleFilter = (key: AuditEventType) => {
    setSelectedFilters((current) => {
      const next = current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key];
      recordInteraction("audit-filter-toggle", 0, 200, {
        filter: key,
        enabled: next.includes(key),
      });
      return next.length ? next : ["sync", "anonymization", "allowlist-change"];
    });
  };

  const events = useMemo(
    () => (data ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [data]
  );

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">
            Audit feed
          </p>
          <p className="text-sm text-white/70">
            Last 20 events with governance filters and status badges.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <button
            type="button"
            className="rounded-md border border-white/20 px-3 py-1 font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40 hover:bg-white/5"
            onClick={() => void refetch()}
          >
            Refresh
          </button>
          {isFetching ? <span className="text-white/60">Updating…</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3" role="toolbar" aria-label="Audit filters">
        {EVENT_TYPE_FILTERS.map((filter) => {
          const active = selectedFilters.includes(filter.key);
          return (
            <button
              key={filter.key}
              type="button"
              className={`rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                active
                  ? "border-indigo-300/60 bg-indigo-500/10 text-white"
                  : "border-white/20 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10"
              }`}
              onClick={() => toggleFilter(filter.key)}
              aria-pressed={active}
            >
              <span className="block text-sm font-semibold">{filter.label}</span>
              <span className="block text-xs text-white/70">{filter.helper}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-xl bg-white/10"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {(error as Error).message ?? "Unable to load audit feed"}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-slate-900/60 p-4 text-sm text-white/70">
          No audit events yet. Toggle filters to broaden results.
        </div>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${badgeClass(event.eventType)}`}>
                  {event.eventType}
                </span>
                <span className="rounded-md border border-white/20 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80">
                  {event.status}
                </span>
                <span className="text-xs text-white/60">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.timestamp))}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">{event.action}</p>
              <div className="mt-1 text-xs text-white/70">
                {event.actor ? <p>Actor: {event.actor}</p> : null}
                {event.errorCode ? <p>Error: {event.errorCode}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
