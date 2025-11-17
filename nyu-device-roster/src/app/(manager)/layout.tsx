import type { Metadata } from "next";

import { requireManagerSession } from "@/lib/auth/require-manager-session";

import { ManagerSessionProvider } from "./components/manager-session-context";
import { ManagerQueryProvider } from "./components/query-client";
import ResponsiveShell from "./components/ResponsiveShell";

export const metadata: Metadata = {
  title: "NYU Device Roster · Manager Dashboard",
  description:
    "Authenticated shell that verifies admissions sessions and surfaces live sync telemetry.",
};

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireManagerSession({ route: "/dashboard" });
  const userEmail = session.user?.email ?? null;
  const userName = session.user?.name ?? null;

  return (
    <ManagerQueryProvider>
      <ManagerSessionProvider value={{ email: userEmail, name: userName }}>
        <ResponsiveShell userEmail={userEmail} userName={userName}>
          {children}
        </ResponsiveShell>
      </ManagerSessionProvider>
    </ManagerQueryProvider>
  );
}
