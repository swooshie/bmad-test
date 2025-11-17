import { Suspense } from "react";
import Link from "next/link";

import SyncStatusBanner from "../components/SyncStatusBanner";
import IconActionRow from "../components/IconActionRow";
import { MANAGER_ROUTES } from "@/lib/routes";

const checklist = [
  {
    title: "Session assurance",
    body: "Every navigation through this shell revalidates your NextAuth session and allowlist role before exposing roster data.",
  },
  {
    title: "Live sync telemetry",
    body: "Use the banner to monitor scheduled cadences, trigger manual refreshes, and inspect failure guidance without leaving the dashboard.",
  },
  {
    title: "Accessible by design",
    body: "Keyboard focus, aria-live announcements, and WCAG AA color ratios ensure the banner is inclusive for all admissions reviewers.",
  },
];

function Checklist() {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {checklist.map((item) => (
        <li key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
            {item.title}
          </p>
          <p className="mt-2 text-sm text-white/80">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const flaggedQuery = new URLSearchParams({
    condition: ["Poor", "Needs Repair"].join(","),
  });

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="rounded-2xl border border-white/10 px-5 py-4 text-sm text-white/80">Loading sync telemetry…</div>}>
        <SyncStatusBanner />
      </Suspense>
      <IconActionRow />
      <Checklist />
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
              Governance cues
            </p>
            <p className="text-sm text-white/70">
              Jump straight to the grid with risky conditions pre-filtered.
            </p>
          </div>
          <Link
            href={`${MANAGER_ROUTES.devices}?${flaggedQuery.toString()}`}
            className="rounded-full border border-amber-200/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-100 hover:text-white"
          >
            View flagged devices
          </Link>
        </div>
      </section>
    </div>
  );
}
