import { NextResponse } from "next/server";

import { withSession } from "@/lib/auth/sessionMiddleware";
import connectToDatabase from "@/lib/db";
import DeviceModel, { type DeviceAttributes } from "@/models/Device";
import { deriveGovernanceCue } from "@/lib/governance/cues";
import type { SerializedOffboardingMetadata } from "../device-query-service";
import { logger } from "@/lib/logging";

const serializeMetadata = (doc: DeviceAttributes): SerializedOffboardingMetadata | undefined => {
  if (!doc.offboardingMetadata) {
    return undefined;
  }
  return {
    lastActor: doc.offboardingMetadata.lastActor ?? null,
    lastAction: doc.offboardingMetadata.lastAction ?? null,
    lastTransferAt: doc.offboardingMetadata.lastTransferAt
      ? doc.offboardingMetadata.lastTransferAt.toISOString()
      : null,
  };
};

export const GET = withSession<{ params: { deviceId: string } }>(async (_request, { params }) => {
  const deviceId = params.deviceId;
  if (!deviceId) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "DEVICE_ID_REQUIRED", message: "Device identifier is required." },
      },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const doc = await DeviceModel.findOne({ deviceId }).lean<DeviceAttributes>().exec();
    if (!doc) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "DEVICE_NOT_FOUND",
            message: `Device ${deviceId} was not found.`,
          },
        },
        { status: 404 }
      );
    }

    const governanceCue = deriveGovernanceCue({
      offboardingStatus: doc.offboardingStatus ?? null,
      condition: doc.condition,
    });

    return NextResponse.json(
      {
        data: {
          device: {
            deviceId: doc.deviceId,
            assignedTo: doc.assignedTo,
            condition: doc.condition,
            offboardingStatus: doc.offboardingStatus ?? null,
            governanceCue,
            lastTransferNotes: doc.lastTransferNotes ?? null,
            offboardingMetadata: serializeMetadata(doc),
            updatedAt: doc.updatedAt.toISOString(),
          },
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      {
        event: "DEVICE_DETAIL_FETCH_FAILED",
        route: "/api/devices/[deviceId]",
        deviceId,
        error:
          error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      },
      "Unable to load device governance metadata"
    );
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "DEVICE_DETAIL_FETCH_FAILED",
          message: "Unable to load device details right now. Please retry shortly.",
        },
      },
      { status: 500 }
    );
  }
});
