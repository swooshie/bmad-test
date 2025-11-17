'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import GovernanceBannerRegion from "./GovernanceBannerRegion";
import IconActionRow from "./IconActionRow";
import SyncStatusBanner from "@/components/SyncStatusBanner";
import IconActionButton from "./IconActionButton";
import { MANAGER_ROUTES } from "@/lib/routes";
import { useReducedMotion } from "@/lib/animation";
import { usePerformanceMetrics } from "@/app/(manager)/devices/hooks/usePerformanceMetrics";

type ResponsiveShellProps = {
  userEmail: string | null;
  userName: string | null;
  children: React.ReactNode;
};

export const ResponsiveShell = ({ userEmail, userName, children }: ResponsiveShellProps) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
  const { startInteraction, recordInteraction } = usePerformanceMetrics();

  useEffect(() => {
    const startedAt = performance.now();
    const end = startInteraction("manager-auth-render", 2000, { source: "manager-layout" });
    requestAnimationFrame(() => {
      recordInteraction("manager-auth-render", performance.now() - startedAt, 2000, {
        source: "manager-layout",
      });
      end();
    });
  }, [recordInteraction, startInteraction]);

  useEffect(() => {
    if (auditOpen && closeRef.current) {
      closeRef.current.focus();
    }
  }, [auditOpen]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
              Authenticated Shell
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-white">Device Roster Dashboard</h1>
            <p className="text-sm text-white/70">
              Session verified for{" "}
              <span className="font-medium text-white">{userEmail ?? userName ?? "manager"}</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm font-semibold sm:flex-row">
            <Link
              href="/"
              className="rounded-xl border border-white/20 px-4 py-2 text-center text-white transition hover:border-white/40 hover:bg-white/5"
            >
              Return to overview
            </Link>
            <Link
              href={MANAGER_ROUTES.devices}
              className="rounded-xl border border-white/20 px-4 py-2 text-center text-white transition hover:border-white/40 hover:bg-white/5"
            >
              Devices grid
            </Link>
            <Link
              href="/api/auth/signout?callbackUrl=/"
              className="rounded-xl bg-white px-4 py-2 text-center text-slate-900 transition hover:bg-slate-100"
            >
              Sign out
            </Link>
          </div>
        </header>

        <div className="my-4 space-y-4 hidden md:block">
          <GovernanceBannerRegion />
          <SyncStatusBanner />
        </div>

        <main className="flex-1 py-8">{children}</main>

        <div className="hidden md:block">
          <IconActionRow />
        </div>

        <section
          aria-label="Bottom dock navigation"
          className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-2xl md:hidden"
        >
          <IconActionButton
            icon={<span className="text-lg" aria-hidden="true">🔍</span>}
            label="Search"
            actionId="search"
            tooltip="Open search-first flow"
            targetHref={`${MANAGER_ROUTES.devices}?intent=search`}
          />
          <IconActionButton
            icon={<span className="text-lg" aria-hidden="true">🎛️</span>}
            label="Filters"
            actionId="filter"
            tooltip="Open filters"
            targetHref={`${MANAGER_ROUTES.devices}?intent=filters`}
          />
          <IconActionButton
            icon={<span className="text-lg" aria-hidden="true">🧭</span>}
            label="Audit"
            actionId="audit"
            tooltip="Open audit slide-over"
            onPress={() => {
              triggerRef.current = document.activeElement as HTMLButtonElement;
              setAuditOpen(true);
            }}
          />
          <IconActionButton
            icon={<span className="text-lg" aria-hidden="true">⤓</span>}
            label="Export"
            actionId="export"
            tooltip="Export devices"
            targetHref={MANAGER_ROUTES.devices}
            onPress={() => {
              recordInteraction("dock-export", 0, 200, { reducedMotion });
            }}
          />
        </section>

        {auditOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Audit and governance slide-over"
            className="fixed inset-0 z-30 flex justify-end bg-slate-950/60 backdrop-blur-sm md:hidden"
            data-reduced-motion={reducedMotion}
          >
            <div
              className="h-full w-full max-w-md bg-slate-900 p-4 shadow-2xl transition-transform"
              style={{
                transform: reducedMotion ? "none" : "translateX(0)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">
                  Audit & Governance
                </p>
                <button
                  ref={closeRef}
                  type="button"
                  className="rounded-lg border border-white/20 px-3 py-1 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                  onClick={() => {
                    setAuditOpen(false);
                    triggerRef.current?.focus();
                    recordInteraction("dock-audit-close", 0, 200, { reducedMotion });
                  }}
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <GovernanceBannerRegion />
                <SyncStatusBanner />
                <p className="text-xs text-white/70">
                  Audit slide-over shares the same session and telemetry state as desktop. Reduced
                  motion keeps transitions instant and labels pinned.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="border-t border-white/10 pt-6 text-xs text-white/60">
          NYU Admissions Demo · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
};

export default ResponsiveShell;
