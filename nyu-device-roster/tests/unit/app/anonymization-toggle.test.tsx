/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AnonymizationToggle from "@/app/(manager)/devices/components/AnonymizationToggle";
import { API_ROUTES } from "@/lib/routes";
import { __resetForTests } from "@/app/(manager)/devices/state/anonymization-store";

describe("AnonymizationToggle", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
    __resetForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("optimistically toggles and calls API route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { enabled: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const announce = vi.fn();
    render(<AnonymizationToggle announce={announce} />);

    const button = screen.getByRole("button", { name: /enable/i });
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(API_ROUTES.deviceAnonymize, expect.anything()));
    await waitFor(() => expect(screen.getByRole("button", { name: /disable/i })).toBeTruthy());
    expect(announce).toHaveBeenCalledWith("Anonymization enabled");
  });

  it("shows error when API fails and reverts state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: "nope" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnonymizationToggle announce={vi.fn()} />);

    const button = screen.getByRole("button", { name: /enable/i });
    fireEvent.click(button);

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("button", { name: /enable/i })).toBeTruthy();
  });
});
