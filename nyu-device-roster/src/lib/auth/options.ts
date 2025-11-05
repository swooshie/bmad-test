import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { loadConfig } from "@/lib/config";
import { logAllowlistAdmit, logAllowlistRejection } from "@/lib/logging";

const ADMISSIONS_DOMAIN = "@nyu.edu";

/**
 * Base NextAuth configuration with admissions allowlist enforcement.
 * Story 1.3 relies on these helpers to obtain a server-side session.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const rawEmail =
        user?.email ?? (typeof profile?.email === "string" ? profile.email : undefined);
      const email = rawEmail?.trim().toLowerCase();

      if (!email) {
        logAllowlistRejection({ event: "AUTH_ALLOWLIST_REJECTION", reason: "EMAIL_MISSING" });
        return false;
      }

      if (!email.endsWith(ADMISSIONS_DOMAIN)) {
        logAllowlistRejection({
          event: "AUTH_ALLOWLIST_REJECTION",
          reason: "DOMAIN_REJECTED",
          email,
        });
        return false;
      }

      const config = await loadConfig();

      if (!config) {
        logAllowlistRejection({
          event: "AUTH_ALLOWLIST_REJECTION",
          reason: "CONFIG_MISSING",
          email,
        });
        return false;
      }

      if (!config.allowlist.includes(email)) {
        logAllowlistRejection({
          event: "AUTH_ALLOWLIST_REJECTION",
          reason: "NOT_ALLOWLISTED",
          email,
        });
        return false;
      }

      logAllowlistAdmit({ email });
      return true;
    },
    async session({ session, token }) {
      if (session.user && token?.email) {
        session.user.email = token.email.toLowerCase();
      }

      return session;
    },
  },
};

export default authOptions;
