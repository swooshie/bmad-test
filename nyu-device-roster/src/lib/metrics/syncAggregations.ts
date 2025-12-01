import SyncEventModel from "@/models/SyncEvent";

export type SyncAggregate = {
  trigger: string;
  runs: number;
  success: number;
  failure: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalRows: number;
  rowsSkipped: number;
  conflicts: number;
};

export type SyncAggregateTotals = Omit<SyncAggregate, "trigger">;

export type SchemaChangeAggregate = {
  detectedAt: Date;
  added: string[];
  removed: string[];
  renamed: string[];
  currentVersion?: string | null;
  previousVersion?: string | null;
};

const defaultTotals: SyncAggregateTotals = {
  runs: 0,
  success: 0,
  failure: 0,
  totalDurationMs: 0,
  avgDurationMs: 0,
  totalRows: 0,
  rowsSkipped: 0,
  conflicts: 0,
};

const normalizeAggregate = (entry: Partial<SyncAggregate>): SyncAggregate => ({
  trigger: entry.trigger ?? "system",
  runs: entry.runs ?? 0,
  success: entry.success ?? 0,
  failure: entry.failure ?? 0,
  totalDurationMs: entry.totalDurationMs ?? 0,
  avgDurationMs: entry.avgDurationMs ?? 0,
  totalRows: entry.totalRows ?? 0,
  rowsSkipped: entry.rowsSkipped ?? 0,
  conflicts: entry.conflicts ?? 0,
});

const normalizeTotals = (entry: Partial<SyncAggregateTotals>): SyncAggregateTotals => ({
  runs: entry.runs ?? 0,
  success: entry.success ?? 0,
  failure: entry.failure ?? 0,
  totalDurationMs: entry.totalDurationMs ?? 0,
  avgDurationMs: entry.avgDurationMs ?? 0,
  totalRows: entry.totalRows ?? 0,
  rowsSkipped: entry.rowsSkipped ?? 0,
  conflicts: entry.conflicts ?? 0,
});

export const aggregateSyncMetrics = async (windowStart?: Date) => {
  const matchStage: Record<string, unknown> = { eventType: "SYNC_RUN" };
  if (windowStart) {
    matchStage.createdAt = { $gte: windowStart };
  }

  const projection = {
    trigger: { $ifNull: ["$metadata.trigger", "system"] },
    status: { $ifNull: ["$metadata.status", "success"] },
    durationMs: { $ifNull: ["$metadata.durationMs", 0] },
    rowsProcessed: {
      $ifNull: [
        "$metadata.rowsProcessed",
        {
          $ifNull: [
            "$metadata.rowCount",
            {
              $add: [
                { $ifNull: ["$metadata.added", 0] },
                { $ifNull: ["$metadata.updated", 0] },
                { $ifNull: ["$metadata.unchanged", 0] },
              ],
            },
          ],
        },
      ],
    },
    rowsSkipped: { $ifNull: ["$metadata.rowsSkipped", { $ifNull: ["$metadata.skipped", 0] }] },
    conflicts: { $ifNull: ["$metadata.conflicts", { $ifNull: ["$metadata.serialConflicts", 0] }] },
  };

  const [result] = await SyncEventModel.aggregate([
    { $match: matchStage },
    { $project: projection },
    {
      $facet: {
        perTrigger: [
          {
            $group: {
              _id: "$trigger",
              runs: { $sum: 1 },
              success: {
                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
              },
              failure: {
                $sum: { $cond: [{ $eq: ["$status", "success"] }, 0, 1] },
              },
              totalDurationMs: { $sum: "$durationMs" },
              avgDurationMs: { $avg: "$durationMs" },
              totalRows: { $sum: "$rowsProcessed" },
              rowsSkipped: { $sum: "$rowsSkipped" },
              conflicts: { $sum: "$conflicts" },
            },
          },
          {
            $project: {
              _id: 0,
              trigger: "$_id",
              runs: 1,
              success: 1,
              failure: 1,
              totalDurationMs: 1,
              avgDurationMs: { $round: ["$avgDurationMs", 2] },
              totalRows: 1,
              rowsSkipped: 1,
              conflicts: 1,
            },
          },
          { $sort: { trigger: 1 } },
        ],
        totals: [
          {
            $group: {
              _id: null,
              runs: { $sum: 1 },
              success: {
                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
              },
              failure: {
                $sum: { $cond: [{ $eq: ["$status", "success"] }, 0, 1] },
              },
              totalDurationMs: { $sum: "$durationMs" },
              avgDurationMs: { $avg: "$durationMs" },
              totalRows: { $sum: "$rowsProcessed" },
              rowsSkipped: { $sum: "$rowsSkipped" },
              conflicts: { $sum: "$conflicts" },
            },
          },
          {
            $project: {
              _id: 0,
              runs: 1,
              success: 1,
              failure: 1,
              totalDurationMs: 1,
              avgDurationMs: { $round: ["$avgDurationMs", 2] },
              totalRows: 1,
              rowsSkipped: 1,
              conflicts: 1,
            },
          },
        ],
      },
    },
  ]);

  const latestSchemaChangeDoc = await SyncEventModel.findOne({
    eventType: "SYNC_COLUMNS_CHANGED",
  })
    .sort({ createdAt: -1 })
    .select({
      createdAt: 1,
      metadata: 1,
    })
    .lean();

  const latestSchemaChange =
    latestSchemaChangeDoc && latestSchemaChangeDoc.metadata
      ? {
          detectedAt: latestSchemaChangeDoc.createdAt,
          added: Array.isArray((latestSchemaChangeDoc.metadata as Record<string, unknown>).added)
            ? ((latestSchemaChangeDoc.metadata as Record<string, unknown>).added as string[])
            : [],
          removed: Array.isArray((latestSchemaChangeDoc.metadata as Record<string, unknown>).removed)
            ? ((latestSchemaChangeDoc.metadata as Record<string, unknown>).removed as string[])
            : [],
          renamed: Array.isArray((latestSchemaChangeDoc.metadata as Record<string, unknown>).renamed)
            ? (
                (latestSchemaChangeDoc.metadata as Record<string, unknown>).renamed as Array<
                  string | { from?: string; to?: string }
                >
              ).map((entry) =>
                typeof entry === "string"
                  ? entry
                  : `${entry.from ?? "unknown"} -> ${entry.to ?? "unknown"}`
              )
            : [],
          currentVersion: (latestSchemaChangeDoc.metadata as Record<string, unknown>).currentVersion as
            | string
            | null
            | undefined,
          previousVersion: (latestSchemaChangeDoc.metadata as Record<string, unknown>).previousVersion as
            | string
            | null
            | undefined,
        }
      : null;

  return {
    perTrigger: (result?.perTrigger ?? []).map(normalizeAggregate),
    totals: normalizeTotals(result?.totals?.[0] ?? defaultTotals),
    latestSchemaChange,
  };
};
