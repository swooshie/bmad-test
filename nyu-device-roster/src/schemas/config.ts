import { z } from "zod";

export const nyuEmailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .transform((value) => value.toLowerCase())
  .refine((value) => value.endsWith("@nyu.edu"), {
    message: "Email must end with @nyu.edu",
  });

export const allowlistChangeSchema = z.object({
  operatorId: z.string().min(1),
  timestamp: z.date(),
  emailsAdded: z.array(nyuEmailSchema),
  emailsRemoved: z.array(nyuEmailSchema),
  source: z.enum(["cli", "admin-endpoint"]),
});

export const configSchema = z.object({
  allowlist: z.array(nyuEmailSchema),
  devicesSheetId: z.string().min(1),
  collectionName: z.string().min(1),
  lastUpdatedAt: z.date(),
  updatedBy: z.string().min(1),
  changes: z.array(allowlistChangeSchema),
});

export type ConfigSchema = z.infer<typeof configSchema>;
