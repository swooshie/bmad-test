import { describe, expect, it } from "vitest";

import type { SheetHeader, TypedRow } from "@/lib/google-sheets";
import { buildHeaderRegistry, diffHeaderRegistry } from "@/workers/sync/header-map";

describe("header-map", () => {
  const sampleHeaders: SheetHeader[] = [
    { name: "Serial Number", normalizedName: "serial_number", position: 0 },
    { name: "Assigned To", normalizedName: "assigned_to", position: 1 },
    { name: "Custom Column", normalizedName: "custom_column", position: 2 },
  ];
  const sampleRows: TypedRow[] = [
    {
      "Serial Number": "SER-1",
      "Assigned To": "alex",
      "Custom Column": 42,
    },
    {
      "Serial Number": "SER-2",
      "Assigned To": "brooke",
      "Custom Column": 7,
    },
  ];

  it("normalizes header definitions in order", () => {
    const registry = buildHeaderRegistry(sampleHeaders, sampleRows);
    expect(registry).toEqual([
      {
        key: "serial_number",
        label: "Serial Number",
        displayOrder: 0,
        dataType: "string",
        nullable: false,
      },
      {
        key: "assigned_to",
        label: "Assigned To",
        displayOrder: 1,
        dataType: "string",
        nullable: false,
      },
      {
        key: "custom_column",
        label: "Custom Column",
        displayOrder: 2,
        dataType: "number",
        nullable: false,
      },
    ]);
  });

  it("diffs added and removed headers", () => {
    const previous = buildHeaderRegistry(sampleHeaders.slice(0, 2), sampleRows);
    const current = buildHeaderRegistry(sampleHeaders, sampleRows);
    const diff = diffHeaderRegistry(current, previous);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].key).toBe("custom_column");
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(2);

    const reverted = diffHeaderRegistry(previous, current);
    expect(reverted.removed).toHaveLength(1);
    expect(reverted.removed[0].key).toBe("custom_column");
  });

  it("marks nullable columns when samples are missing", () => {
    const registry = buildHeaderRegistry(sampleHeaders, [
      { "Serial Number": "SER-3", "Assigned To": "Casey" },
    ]);
    const custom = registry.find((entry) => entry.key === "custom_column");
    expect(custom?.nullable).toBe(true);
    expect(custom?.dataType).toBe("unknown");
  });
});
