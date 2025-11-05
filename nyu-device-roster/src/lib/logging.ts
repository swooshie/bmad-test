import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
  base: undefined,
});

export type AuthFailureLog = {
  event: "AUTH_INVALID_SESSION";
  route: string;
  method: string;
  reason: string;
  requestId?: string;
  ip?: string;
  userEmail?: string;
};

export type AllowlistRejectionLog = {
  event: "AUTH_ALLOWLIST_REJECTION";
  email?: string | null;
  reason: "EMAIL_MISSING" | "DOMAIN_REJECTED" | "CONFIG_MISSING" | "NOT_ALLOWLISTED";
  requestId?: string;
};

export const logAuthFailure = (payload: AuthFailureLog) => {
  logger.warn(payload, "Auth failure detected");
};

export const logAuthAlert = (payload: AuthFailureLog & { count: number }) => {
  logger.error(payload, "Repeated auth failure threshold reached");
};

export const logAuthSuccess = (meta: {
  route: string;
  method: string;
  userEmail?: string | null;
}) => {
  logger.debug(meta, "Session validated");
};

export const logAllowlistRejection = (payload: AllowlistRejectionLog) => {
  logger.warn(payload, "Allowlist rejection");
};

export const logAllowlistAdmit = (payload: { email: string }) => {
  logger.debug(payload, "Allowlist admission");
};

export default logger;
