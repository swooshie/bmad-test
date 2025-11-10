import { headers } from "next/headers";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { ensureRuntimeConfig, loadConfig } from "@/lib/config";
import { logAllowlistAdmit, logAllowlistRejection } from "@/lib/logging";

const ADMISSIONS_DOMAIN_SUFFIX = "@nyu.edu";
const HOSTED_DOMAIN = "nyu.edu";
const SESSION_TTL_SECONDS = 60 * 60;
const SESSION_REFRESH_WINDOW_SECONDS = 10 * 60;
const SESSION_COOKIE_NAME = "__Secure-next-auth.session-token";

type RequestMetadata = {
  ip?: string;
  requestId?: string;
};

const readRequestMetadata = async (): Promise<RequestMetadata> => {
  const headerBag = await headers();
  const forwardedFor = headerBag.get("x-forwarded-for");
  const ipCandidate = forwardedFor?.split(",")[0]?.trim() ?? headerBag.get("x-real-ip") ?? undefined;

  return {
    ip: ipCandidate ?? undefined,
    requestId: headerBag.get("x-request-id") ?? undefined,
  };
};

const timestamp = () => new Date().toISOString();

const buildRejectionPayload = ({
  reason,
  email,
  ip,
  requestId,
  operatorId,
  allowlistRevision,
}: {
  reason: "EMAIL_MISSING" | "DOMAIN_REJECTED" | "CONFIG_MISSING" | "NOT_ALLOWLISTED";
  email?: string | null;
  ip?: string;
  requestId?: string;
  operatorId?: string | null;
  allowlistRevision?: string | null;
}) => ({
  event: "AUTH_ALLOWLIST_REJECTION" as const,
  reason,
  email,
  ip,
  requestId,
  timestamp: timestamp(),
  operatorId: operatorId ?? null,
  allowlistRevision: allowlistRevision ?? null,
});

const runtimeBootstrap = await ensureRuntimeConfig();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: runtimeBootstrap.secrets.googleClientId,
      clientSecret: runtimeBootstrap.secrets.googleClientSecret,
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: {
          prompt: "select_account",
          hd: HOSTED_DOMAIN,
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_TTL_SECONDS,
    updateAge: SESSION_REFRESH_WINDOW_SECONDS,
  },
  secret: runtimeBootstrap.secrets.nextAuthSecret,
  jwt: {
    maxAge: SESSION_TTL_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        maxAge: SESSION_TTL_SECONDS,
      },
    },
  },
  pages: {
    error: "/access-denied",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const rawEmail =
        user?.email ?? (typeof profile?.email === "string" ? profile.email : undefined);
      const email = rawEmail?.trim().toLowerCase();
      const { ip, requestId } = await readRequestMetadata();

      if (!email) {
        logAllowlistRejection(
          buildRejectionPayload({
            reason: "EMAIL_MISSING",
            ip,
            requestId,
          })
        );
        return false;
      }

      if (!email.endsWith(ADMISSIONS_DOMAIN_SUFFIX)) {
        logAllowlistRejection(
          buildRejectionPayload({ reason: "DOMAIN_REJECTED", email, ip, requestId })
        );
        return false;
      }

      const config = await loadConfig();

      if (!config) {
        logAllowlistRejection(
          buildRejectionPayload({ reason: "CONFIG_MISSING", email, ip, requestId })
        );
        return false;
      }

      const operatorId = config.updatedBy ?? null;
      const allowlistRevision = config.lastUpdatedAt?.toISOString() ?? null;

      if (!config.allowlist.includes(email)) {
        logAllowlistRejection(
          buildRejectionPayload({
            reason: "NOT_ALLOWLISTED",
            email,
            ip,
            requestId,
            operatorId,
            allowlistRevision,
          })
        );
        return false;
      }

      logAllowlistAdmit({
        email,
        ip,
        timestamp: timestamp(),
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.toLowerCase();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.email) {
        const normalizedEmail = token.email.toLowerCase();
        const userRecord = session.user as typeof session.user & Record<string, unknown>;
        userRecord.email = normalizedEmail;
        userRecord.role = "admissions-manager";
      }

      return session;
    },
  },
};

export default authOptions;
