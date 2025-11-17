import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { recordAuthFailureEvent } from "@/lib/audit/syncEvents";
import { authOptions } from "@/lib/auth/options";
import { logAuthFailure, logAuthSuccess, type AuthFailureLog } from "@/lib/logging";

type RequireManagerSessionOptions = {
  route?: string;
  method?: string;
};

type SessionWithRole = Session & {
  user: Session["user"] & {
    managerRole?: "manager" | "lead";
  };
};

const extractClientIp = (forwardedFor: string | null, realIp: string | null) => {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return undefined;
};

export const requireManagerSession = async (
  options?: RequireManagerSessionOptions
): Promise<SessionWithRole> => {
  const headerStore = await headers();
  const route = options?.route ?? "/dashboard";
  const method = options?.method ?? "GET";
  const ip = extractClientIp(
    headerStore.get("x-forwarded-for"),
    headerStore.get("x-real-ip")
  );
  const requestId = headerStore.get("x-request-id") ?? undefined;

  const session = await getServerSession(authOptions);

  const persistFailure = async (reason: AuthFailureLog["reason"]) => {
    await recordAuthFailureEvent({
      route,
      method,
      reason,
      requestId,
      ip,
      userEmail: session?.user?.email ?? null,
    });
    logAuthFailure({
      event: "AUTH_INVALID_SESSION",
      route,
      method,
      reason,
      requestId,
      ip,
      userEmail: session?.user?.email ?? undefined,
    });
  };

  if (!session) {
    await persistFailure("SESSION_MISSING");
    redirect("/access-denied");
  }

  if (!session.user) {
    await persistFailure("USER_MISSING");
    redirect("/access-denied");
  }

  logAuthSuccess({
    route,
    method,
    userEmail: session.user.email ?? null,
  });

  return session as SessionWithRole;
};
