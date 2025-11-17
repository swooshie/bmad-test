import { describe, expect, it } from "vitest";

import { AppError, mapToAppError } from "@/lib/errors/app-error";

describe("AppError", () => {
  it("provides defaults from catalog", () => {
    const error = new AppError({ code: "MONGO_WRITE_FAILED" });
    expect(error.httpStatus).toBe(500);
    expect(error.recommendation).toMatch(/Mongo/);
  });

  it("maps unknown errors to fallback code", () => {
    const result = mapToAppError(new Error("boom"), "UNKNOWN_FAILURE");
    expect(result.code).toBe("UNKNOWN_FAILURE");
    expect(result.referenceId).toHaveLength(36);
  });
});
