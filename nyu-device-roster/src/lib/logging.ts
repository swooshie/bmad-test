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
  ip?: string;
  timestamp: string;
  operatorId?: string | null;
  allowlistRevision?: string | null;
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

export const logAllowlistAdmit = (payload: { email: string; ip?: string; timestamp: string }) => {
  logger.debug(payload, "Allowlist admission");
};

type AllowlistDiffLog = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

export const logAllowlistEndpointEvent = (payload: {
  actorEmail?: string | null;
  actorRole?: string | null;
  requestId?: string;
  ip?: string;
  outcome: "granted" | "denied";
  reason?: string;
  diff?: AllowlistDiffLog;
}) => {
  logger.warn(
    {
      event: "ALLOWLIST_ENDPOINT",
      workflow: "allowlist-maintenance",
      actorEmail: payload.actorEmail ?? null,
      actorRole: payload.actorRole ?? null,
      requestId: payload.requestId ?? null,
      ip: payload.ip ?? null,
      outcome: payload.outcome,
      reason: payload.reason ?? null,
      diff: payload.diff,
    },
    payload.outcome === "denied"
      ? "Allowlist endpoint access denied"
      : "Allowlist endpoint accessed"
  );
};

export type SecretManagerLog = {
  event: "SECRET_MANAGER_FAILURE";
  secretKey: string;
  reason: string;
  attempt?: number;
  action?: string;
  metadata?: Record<string, unknown>;
};

export const logSecretManagerAlert = (payload: SecretManagerLog) => {
  logger.error(payload, "Secret Manager failure");
};

export const logConfigValidationFailure = (payload: {
  reason: string;
  metadata?: Record<string, unknown>;
}) => {
  logger.error(
    {
      event: "CONFIG_VALIDATION_FAILURE",
      ...payload,
    },
    "Runtime configuration validation failed"
  );
};

export default logger;
