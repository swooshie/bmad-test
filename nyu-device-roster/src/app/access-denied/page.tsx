import Link from "next/link";
import type { Metadata } from "next";

const REASON_COPY: Record<string, string> = {
  "EMAIL_MISSING": "We could not read an email address from your Google profile.",
  "DOMAIN_REJECTED": "Only @nyu.edu accounts are authorized for this demo environment.",
  "NOT_ALLOWLISTED": "Your NYU email is not on the admissions allowlist maintained by the demo team.",
  "CONFIG_MISSING": "The admissions configuration is unavailable. Please retry after the operators restore connectivity.",
  default:
    "The admissions demo is restricted to approved NYU managers. Reach out to the operator listed in the audit log if you believe this is incorrect.",
};

type AccessDeniedPageProps = {
  searchParams?: {
    reason?: string;
    requestId?: string;
  };
};

export const metadata: Metadata = {
  title: "Access denied",
  description: "Admissions demo access is restricted to NYU managers on the allowlist.",
};

export default function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const reasonKey = searchParams?.reason?.toUpperCase() ?? "default";
  const message = REASON_COPY[reasonKey] ?? REASON_COPY.default;
  const requestId = searchParams?.requestId;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-12 text-slate-900">
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">HTTP 403</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Access denied</h1>
        <p className="mt-4 text-base text-slate-700">{message}</p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Use your NYU admissions Google account.</li>
          <li>Ask the admissions operator to add you to the allowlist.</li>
          <li>
            Provide the request reference if you contact support:
            <span className="ml-1 font-mono text-xs">
              {requestId ?? "unavailable"}
            </span>
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-900 transition hover:border-slate-400"
          >
            Return to dashboard
          </Link>
          <Link
            href="mailto:admissions-demo@nyu.edu?subject=Access%20Request"
            className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Contact demo operator
          </Link>
        </div>
      </section>
    </main>
  );
}
