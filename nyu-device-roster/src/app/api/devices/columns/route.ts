import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import connectToDatabase from "@/lib/db";
import { ensureRuntimeConfig } from "@/lib/config";
import ColumnDefinitionModel, {
  type ColumnDefinitionAttributes,
} from "@/models/ColumnDefinition";
import { buildDynamicColumns } from "@/app/api/devices/device-query-service";

export const GET = withSession(async () => {
  try {
    await connectToDatabase();
    const runtime = await ensureRuntimeConfig();
    const sheetId = runtime.config.devicesSheetId;
    const registry = sheetId
      ? await ColumnDefinitionModel.find({ sheetId, removedAt: null })
          .sort({ displayOrder: 1 })
          .lean<ColumnDefinitionAttributes[]>()
      : [];
    const { columns, version } = buildDynamicColumns(registry);
    return NextResponse.json(
      {
        data: {
          columns,
          columnsVersion: version,
        },
        meta: {
          columnsVersion: version,
          columnCount: columns.length,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        meta: null,
        error: {
          code: "COLUMN_DEFINITIONS_FAILED",
          message: error instanceof Error ? error.message : "Unable to load column definitions",
        },
      },
      { status: 500 }
    );
  }
});
