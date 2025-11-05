import { z } from "zod";

export const allowlistChangeSchema = z.object({
  operatorId: z.string().min(1),
  timestamp: z.date(),
  emailsAdded: z.array(z.string().email()),
  emailsRemoved: z.array(z.string().email()),
  source: z.enum(["cli", "admin-endpoint"]),
});

export const configSchema = z.object({
  allowlist: z.array(z.string().email()),
  devicesSheetId: z.string().min(1),
  collectionName: z.string().min(1),
  lastUpdatedAt: z.date(),
  updatedBy: z.string().min(1),
  changes: z.array(allowlistChangeSchema),
});

export type ConfigSchema = z.infer<typeof configSchema>;
