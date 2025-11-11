import { describe, expect, it, beforeEach } from "vitest";

import { GET } from "@/app/api/sync/status/route";
import { markSyncRunning, resetSyncStatusForTests } from "@/lib/sync-status";

describe("GET /api/sync/status", () => {
  beforeEach(() => {
    resetSyncStatusForTests();
  });

  it("returns idle state by default", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { state: string } };
    expect(body.data.state).toBe("idle");
  });

  it("returns running state snapshot", async () => {
    markSyncRunning({ runId: "run-123", requestedBy: "lead@nyu.edu" });
    const response = await GET();
    const body = (await response.json()) as { data: { state: string; runId: string } };
    expect(body.data).toMatchObject({ state: "running", runId: "run-123" });
  });
});
