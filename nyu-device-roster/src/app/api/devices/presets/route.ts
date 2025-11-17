import { NextResponse } from "next/server";
import { z } from "zod";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import { logAnonymizationPresetChange } from "@/lib/logging";

const PRESET_COOKIE = "nyu-device-roster-preset";

const PresetSchema = z.object({
  presetId: z.string().min(1),
  overrides: z.record(z.boolean()).optional(),
});

const buildCookie = (payload: { presetId: string; overrides?: Record<string, boolean> }) => {
  return {
    name: PRESET_COOKIE,
    value: encodeURIComponent(JSON.stringify(payload)),
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
  };
};

const readCookie = (request: NextRequestWithSession) => {
  const raw = request.cookies?.get?.(PRESET_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as { presetId?: string; overrides?: Record<string, boolean> };
  } catch {
    return null;
  }
};

export const GET = withSession(async (request: NextRequestWithSession) => {
  const existing = readCookie(request);
  return NextResponse.json(
    {
      data: {
        presetId: existing?.presetId ?? null,
        overrides: existing?.overrides ?? {},
        updatedAt: null,
      },
      error: null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withSession(async (request: NextRequestWithSession) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const parsed = PresetSchema.safeParse(body);
  const presetData = parsed.success
    ? parsed.data
    : {
        presetId: (body as Record<string, unknown> | undefined)?.presetId?.toString() ?? "demo-safe",
        overrides: ((body as Record<string, unknown> | undefined)?.overrides as Record<string, boolean> | undefined) ??
          {},
      };

  const { presetId, overrides = {} } = {
    ...presetData,
    presetId: presetData.presetId || "demo-safe",
  };

  const userEmail = (request as any)?.session?.user?.email ?? null;
  const requestId = request.headers?.get?.("x-request-id") ?? undefined;

  logAnonymizationPresetChange({
    event: "ANONYMIZATION_PRESET_CHANGED",
    presetId,
    overrides,
    anonymized: true,
    userEmail,
    requestId,
  });

  const updatedAt = new Date().toISOString();

  const response = NextResponse.json(
    {
      data: { presetId, overrides, updatedAt },
      error: null,
    },
    { status: 200 }
  );
  response.cookies.set(buildCookie({ presetId, overrides }));
  return response;
});
