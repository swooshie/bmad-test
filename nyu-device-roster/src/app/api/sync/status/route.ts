import { NextResponse } from "next/server";

import { getSyncStatus } from "@/lib/sync-status";

export const GET = () =>
  NextResponse.json({
    data: getSyncStatus(),
    error: null,
  });
