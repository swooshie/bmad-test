import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GaxiosResponse } from "gaxios";
import { GaxiosError } from "gaxios";

const mockAuthorize = vi.hoisted(() => vi.fn());
const mockRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/secrets", () => ({
  getSheetsServiceAccount: vi.fn(),
}));

const jwtCtor = vi.hoisted(() =>
  vi.fn(function MockJWT(this: unknown) {
    Object.assign(this as Record<string, unknown>, {
      authorize: mockAuthorize,
      request: mockRequest,
    });
  })
);

vi.mock("google-auth-library", () => ({
  JWT: jwtCtor,
}));

import { fetchSheetData, SheetFetchError } from "@/lib/google-sheets";
import { getSheetsServiceAccount } from "@/lib/secrets";
import { JWT } from "google-auth-library";

const mockedGetSheetsServiceAccount = vi.mocked(getSheetsServiceAccount);

const mockServiceAccount = {
  client_email: "svc@example.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  private_key_id: "fake",
  project_id: "demo",
  token_uri: "https://oauth2.googleapis.com/token",
  type: "service_account",
  client_id: "123",
};

describe("fetchSheetData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue(undefined);
    mockedGetSheetsServiceAccount.mockResolvedValue(mockServiceAccount);
  });

  afterEach(() => {
    mockRequest.mockReset();
  });

  it("retrieves headers and typed rows with pagination", async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: { values: [["deviceId", "lastSync", "active"]] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["alpha-1", "2024-02-01T10:00:00Z", "1"],
            ["alpha-2", "2024-02-01T11:00:00Z", "0"],
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { values: [] },
      });

    const onPage = vi.fn();
    const result = await fetchSheetData({
      sheetId: "abc123",
      tabName: "Devices",
      pageSize: 2,
      maxPages: 2,
      onPage,
    });

    expect(getSheetsServiceAccount).toHaveBeenCalledTimes(1);
    expect(JWT).toHaveBeenCalledWith(
      expect.objectContaining({
        email: mockServiceAccount.client_email,
        key: mockServiceAccount.private_key,
      })
    );
    expect(result.headers).toEqual(["deviceId", "lastSync", "active"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      deviceId: "alpha-1",
      active: 1,
    });
    expect(result.rows[0].lastSync).toBeInstanceOf(Date);
    expect(result.rowMetadata).toHaveLength(2);
    expect(result.rowMetadata[0]).toMatchObject({ rowNumber: 2 });
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(result.metrics.rowCount).toBe(2);
  });

  it("drops empty rows unless includeEmptyRows is true", async () => {
    const rowsPayload = {
      data: {
        values: [
          ["alpha-1", ""],
          ["", ""],
        ],
      },
    };
    const headerPayload = { data: { values: [["deviceId", "owner"]] } };

    mockRequest
      .mockResolvedValueOnce(headerPayload)
      .mockResolvedValueOnce(rowsPayload)
      .mockResolvedValueOnce({ data: { values: [] } });

    const result = await fetchSheetData({
      sheetId: "abc123",
      includeEmptyRows: false,
      pageSize: 2,
      maxPages: 1,
    });

    expect(result.rows).toHaveLength(1);

    mockRequest.mockReset();
    mockAuthorize.mockClear();

    mockRequest
      .mockResolvedValueOnce(headerPayload)
      .mockResolvedValueOnce(rowsPayload)
      .mockResolvedValueOnce({ data: { values: [] } });

    const withEmptyRows = await fetchSheetData({
      sheetId: "abc123",
      includeEmptyRows: true,
      pageSize: 2,
      maxPages: 1,
    });
    expect(withEmptyRows.rows).toHaveLength(2);
  });

  it("retries transient failures and surfaces metrics", async () => {
    const rateLimitError = new GaxiosError(
      "rate limit",
      { url: "url", method: "GET" },
      { status: 429 } as GaxiosResponse
    );

    mockRequest
      .mockResolvedValueOnce({ data: { values: [["deviceId"]] } })
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        data: { values: [["alpha-1"]] },
      })
      .mockResolvedValueOnce({
        data: { values: [] },
      });

    const onRetry = vi.fn();
    const result = await fetchSheetData({
      sheetId: "abc123",
      pageSize: 1,
      retry: { maxAttempts: 3, baseDelayMs: 0, onRetry },
    });

    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        code: "RATE_LIMIT",
      })
    );
    expect(result.rows).toHaveLength(1);
    expect(result.metrics.pageCount).toBe(1);
  });

  it("throws structured errors when the sheet is missing", async () => {
    const notFoundError = new GaxiosError(
      "not found",
      { url: "url", method: "GET" },
      { status: 404 } as GaxiosResponse
    );

    mockRequest.mockResolvedValueOnce({ data: { values: [["deviceId"]] } });
    mockRequest.mockRejectedValueOnce(notFoundError);

    await expect(
      fetchSheetData({
        sheetId: "missing",
        pageSize: 10,
      })
    ).rejects.toMatchObject({
      code: "SHEET_NOT_FOUND",
    });
  });

  it("validates required configuration early", async () => {
    await expect(
      fetchSheetData({
        sheetId: "",
      })
    ).rejects.toBeInstanceOf(SheetFetchError);
  });
});
