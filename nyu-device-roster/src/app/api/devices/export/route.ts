import { NextResponse } from "next/server";

import { withSession, type NextRequestWithSession } from "@/lib/auth/sessionMiddleware";
import connectToDatabase from "@/lib/db";
import DeviceModel, { type DeviceAttributes } from "@/models/Device";
import {
  DEFAULT_DEVICE_GRID_STATE,
  mergeDeviceGridState,
  type DeviceGridQueryFilters,
} from "@/lib/devices/grid-query";
import { __private__ as deviceQueryInternal } from "@/app/api/devices/device-query-service";
import { recordGovernanceExportEvent } from "@/lib/audit/syncEvents";
import { logger } from "@/lib/logging";
import type { DeviceGridDevice } from "@/app/api/devices/device-query-service";
import { anonymizeDeviceRow, readAnonymizationCookie } from "@/lib/anonymization";

type ExportRequestBody = {
  filters?: Partial<DeviceGridQueryFilters>;
  format?: "csv" | "pdf";
  onlyFlagged?: boolean;
};

const escapeCsvValue = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsv = (rows: DeviceGridDevice[]) => {
  const header = [
    "Device ID",
    "Assigned To",
    "Status",
    "Condition",
    "Offboarding Status",
    "Governance Severity",
    "Governance Reasons",
    "Governance Summary",
    "Last Transfer Notes",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        escapeCsvValue(row.deviceId),
        escapeCsvValue(row.assignedTo),
        escapeCsvValue(row.status),
        escapeCsvValue(row.condition),
        escapeCsvValue(row.offboardingStatus ?? "—"),
        escapeCsvValue(row.governanceCue.severity),
        escapeCsvValue(row.governanceCue.reasons.join("|") || "none"),
        escapeCsvValue(row.governanceCue.summary),
        escapeCsvValue(row.lastTransferNotes ?? ""),
      ].join(",")
    ),
  ];
  return lines.join("\n");
};

const escapePdfText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildPdf = (rows: DeviceGridDevice[]): Buffer => {
  const now = new Date().toISOString();
  const summaryLines = [
    "NYU Device Governance Export",
    `Generated: ${now}`,
    `Rows: ${rows.length}`,
    "",
  ];
  const dataLines = rows.length
    ? rows.map(
        (row) =>
          `${row.deviceId} · ${row.offboardingStatus ?? "No offboarding"} · Condition: ${
            row.condition
          } · ${row.governanceCue.summary || "Governance clear"}`
      )
    : ["No data to export"];
  const lines = [...summaryLines, ...dataLines];
  const textOps = lines
    .map((line, index) => `${index === 0 ? "" : "T*\n"}(${escapePdfText(line)}) Tj`)
    .join("\n");
  const streamBody = `BT
/F1 10 Tf
72 720 Td
14 TL
${textOps}
ET
`;
  const streamLength = Buffer.byteLength(streamBody, "utf8");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${streamLength} >>\nstream\n${streamBody}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((content, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefPosition = pdf.length;
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n 
`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefPosition}
%%EOF`;

  return Buffer.from(pdf, "utf8");
};

const formatFileName = (format: "csv" | "pdf") =>
  `devices-governance-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;

export const POST = withSession(async (request: NextRequestWithSession) => {
  let body: ExportRequestBody = {};
  try {
    body = (await request.json()) as ExportRequestBody;
  } catch {
    // Default body to empty filters
  }

  const normalizedState = mergeDeviceGridState(DEFAULT_DEVICE_GRID_STATE, {
    filters: body.filters ?? {},
  });

  await connectToDatabase();
  const filter = deviceQueryInternal.buildFilter(normalizedState);
  const sort = deviceQueryInternal.buildSort(normalizedState);

  const records = await DeviceModel.find(filter)
    .sort(sort)
    .lean<DeviceAttributes>()
    .exec();
  const serialized = records.map(deviceQueryInternal.serializeDevice);
  const anonymized = readAnonymizationCookie(request.cookies);
  const datasetWithPrivacy = anonymized
    ? serialized.map((device) => anonymizeDeviceRow(device, true))
    : serialized;

  const dataset = body.onlyFlagged
    ? datasetWithPrivacy.filter((device) => device.governanceCue.reasons.length > 0)
    : datasetWithPrivacy;

  if (!dataset.length) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NO_EXPORT_ROWS", message: "No devices matched the current filters." },
      },
      { status: 404 }
    );
  }

  const flaggedCounts = dataset.reduce<Record<string, number>>((acc, row) => {
    if (!row.governanceCue.reasons.length) {
      return acc;
    }
    const key = row.offboardingStatus ?? "untracked";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const flaggedTotal = Object.values(flaggedCounts).reduce((sum, value) => sum + value, 0);

  const format: "csv" | "pdf" = body.format === "pdf" ? "pdf" : "csv";
  const buffer = format === "pdf" ? buildPdf(dataset) : Buffer.from(buildCsv(dataset), "utf8");
  const fileName = formatFileName(format);
  const contentType = format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8";

  if (flaggedTotal > 0) {
    await recordGovernanceExportEvent({
      route: "/api/devices/export",
      method: "POST",
      userEmail: request.session.user?.email ?? null,
      requestId: request.headers.get("x-request-id") ?? undefined,
      ip: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? undefined,
      flaggedCount: flaggedTotal,
      totalCount: dataset.length,
      countsByStatus: flaggedCounts,
      filters: normalizedState.filters,
    });
  }

  logger.info(
    {
      event: "DEVICE_EXPORT_COMPLETED",
      format,
      totalCount: dataset.length,
      flaggedCount: flaggedTotal,
      filters: normalizedState.filters,
    },
    "Device export completed"
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
