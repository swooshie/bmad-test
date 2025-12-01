import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import { recordAccessibilityAuditLog } from "@/lib/audit/accessibilityAudit";
import logger from "@/lib/logging";

type AccessibilityPayload = {
  tool: "axe" | "lighthouse" | "manual";
  target: string;
  result: "pass" | "fail";
  tester?: string | null;
  summary?: string | null;
  score?: number | null;
  violations?: number | null;
  artifacts?: string[];
};

const isValidPayload = (payload: Partial<AccessibilityPayload>): payload is AccessibilityPayload => {
  const allowedTools = ["axe", "lighthouse", "manual"] as const;
  const allowedResults = ["pass", "fail"] as const;
  return (
    typeof payload.target === "string" &&
    allowedTools.includes(payload.tool as AccessibilityPayload["tool"]) &&
    allowedResults.includes(payload.result as AccessibilityPayload["result"])
  );
};

export const POST = withSession(async (request) => {
  let payload: Partial<AccessibilityPayload> = {};
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tester = payload.tester ?? request.session.user?.email ?? null;

  try {
    await recordAccessibilityAuditLog({
      ...payload,
      tester,
    });
    return NextResponse.json({ recorded: true });
  } catch (error) {
    logger.error(
      {
        event: "ACCESSIBILITY_AUDIT_LOG_FAILED",
        payload,
        err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      },
      "Failed to record accessibility audit log"
    );
    return NextResponse.json({ error: "Unable to record accessibility audit" }, { status: 500 });
  }
});
