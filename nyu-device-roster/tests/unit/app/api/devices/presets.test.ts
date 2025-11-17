import { describe, expect, it, vi, beforeEach } from "vitest";

import * as logging from "@/lib/logging";

vi.mock("@/lib/auth/sessionMiddleware", () => ({
  withSession: (handler: (request: any) => Promise<Response> | Response) => handler,
}));

const buildRequest = (body?: unknown, cookie?: string) =>
  new Request("http://localhost/api/devices/presets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("POST /api/devices/presets", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(logging, "logAnonymizationPresetChange").mockImplementation(() => undefined);
  });

  it("handles invalid payloads gracefully", async () => {
    const { POST } = await import("@/app/api/devices/presets/route");

    const response = await POST(buildRequest({ presetId: "" }) as never);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { presetId: string } };
    expect(payload.data.presetId).toBe("demo-safe");
  });

  it("saves preset and logs the change", async () => {
    const { POST, GET } = await import("@/app/api/devices/presets/route");

    const response = await POST(
      buildRequest({ presetId: "demo-safe", overrides: { assignedTo: true } }) as never
    );

    if (response.status !== 200) {
      const payload = await response.json();
      throw new Error(`unexpected status ${response.status}: ${JSON.stringify(payload)}`);
    }
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { presetId: string } };
    expect(payload.data.presetId).toBe("demo-safe");
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ presetId: "demo-safe", overrides: { assignedTo: true } })
    );

    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("nyu-device-roster-preset");

    expect(response.headers.get("set-cookie")).toBeTruthy();
  });
});
