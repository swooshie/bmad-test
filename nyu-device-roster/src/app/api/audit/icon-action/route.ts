'use server';

import { NextResponse } from "next/server";
import { z as zod } from "zod";

import { logIconAction } from "@/lib/logging";
import { recordIconActionEvent } from "@/lib/audit/syncEvents";

const IconActionSchema = zod.object({
  actionId: zod.string().min(1),
  durationMs: zod.number().nonnegative(),
  anonymized: zod.boolean().optional(),
  reducedMotion: zod.boolean().optional(),
  requestId: zod.string().optional(),
  triggeredAt: zod.string().optional(),
});

export const POST = async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 }
    );
  }

  const parsed = IconActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INVALID_ICON_ACTION_PAYLOAD",
          message: "Icon action payload is invalid",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const requestId = parsed.data.requestId ?? request.headers.get("x-request-id") ?? undefined;
  const anonymized = parsed.data.anonymized ?? false;
  const reducedMotion = parsed.data.reducedMotion ?? false;

  logIconAction({
    event: "ICON_ACTION_TRIGGERED",
    actionId: parsed.data.actionId,
    durationMs: parsed.data.durationMs,
    anonymized,
    requestId,
    reducedMotion,
    triggeredAt: parsed.data.triggeredAt ?? new Date().toISOString(),
  });

  await recordIconActionEvent({
    actionId: parsed.data.actionId,
    durationMs: parsed.data.durationMs,
    anonymized,
    reducedMotion,
    requestId,
    route: "/api/audit/icon-action",
  });

  return NextResponse.json({ data: { recorded: true }, error: null });
};
