import { describe, expect, it } from "vitest";

import { deriveHighlightIds } from "@/app/(manager)/devices/hooks/useRowHighlighting";

describe("deriveHighlightIds", () => {
  it("returns a set of device ids for current rows", () => {
    const result = deriveHighlightIds([
      { serial: "a" } as any,
      { serial: "b" } as any,
      { serial: "a" } as any,
    ]);

    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
    expect(result.size).toBe(2);
  });
});
