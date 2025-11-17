import { z } from "zod";

const trimmedString = z
  .string({
    required_error: "Value is required",
    invalid_type_error: "Value must be a string",
  })
  .trim();

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional();

const dateFromUnknown = z
  .any()
  .transform((value) => {
    if (!value) return undefined;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }
    const parsed = new Date(value as string | number);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  })
  .optional();

const offboardingMetadataSchema = z
  .object({
    lastActor: optionalTrimmedString,
    lastAction: optionalTrimmedString,
    lastTransferAt: dateFromUnknown,
  })
  .partial()
  .optional();

export const deviceDocumentSchema = z.object({
  deviceId: trimmedString.min(1, "deviceId is required"),
  sheetId: trimmedString.min(1, "sheetId is required"),
  assignedTo: trimmedString.default("Unassigned"),
  status: trimmedString.default("unknown"),
  condition: trimmedString.default("unknown"),
  offboardingStatus: optionalTrimmedString,
  offboardingMetadata: offboardingMetadataSchema,
  lastTransferNotes: optionalTrimmedString,
  lastSeen: dateFromUnknown,
  lastSyncedAt: z.date(),
});

export type DeviceDocumentSchema = z.infer<typeof deviceDocumentSchema>;
