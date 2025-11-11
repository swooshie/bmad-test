import Link from "next/link";

import SyncStatusBanner from "@/components/SyncStatusBanner";

const checklist = [
  "Sign in with your NYU admissions Google account",
  "Verify allowlist status and governance logging",
  "Review live device data after authentication",
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-10 shadow-xl ring-1 ring-slate-100">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          NYU Admissions Demo
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-950">
          Secure roster access for allowlisted admissions managers
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Use your NYU Google account to authenticate through the restricted NextAuth
          flow. Only allowlisted managers receive a session, and unauthorized attempts
          are logged for governance review.
        </p>

        <div className="mt-6">
          <SyncStatusBanner />
        </div>

        <ul className="mt-8 space-y-3 text-base text-slate-700">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/api/auth/signin/google"
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-indigo-600 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Sign in with Google
          </Link>
          <Link
            href="/access-denied"
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 text-base font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            View access policy
          </Link>
        </div>
      </section>
    </main>
  );
}
