'use server';

import { NextResponse } from "next/server";
import { z as zod } from "zod";

import { logPerformanceMetric } from "@/lib/logging";

const MetricsSchema = zod.object({
  metrics: zod
    .array(
      zod.object({
        metric: zod.string().min(1),
        value: zod.number(),
        threshold: zod.number().optional(),
        context: zod.record(zod.union([zod.string(), zod.number(), zod.boolean()])).optional(),
        requestId: zod.string().optional(),
        anonymized: zod.boolean().optional(),
        timestamp: zod.string().optional(),
      })
    )
    .min(1),
  requestId: zod.string().optional(),
  anonymized: zod.boolean().optional(),
});

export const POST = async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 }
    );
  }

  const parsed = MetricsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INVALID_METRIC_PAYLOAD",
          message: "Metrics payload is invalid",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const requestId = parsed.data.requestId ?? null;
  const anonymized = parsed.data.anonymized ?? false;

  parsed.data.metrics.forEach((metric) => {
    logPerformanceMetric({
      event: "PERFORMANCE_METRIC",
      metric: metric.metric,
      value: metric.value,
      threshold: metric.threshold ?? null,
      context: metric.context,
      requestId: metric.requestId ?? requestId,
      anonymized: metric.anonymized ?? anonymized,
      timestamp: metric.timestamp ?? new Date().toISOString(),
    });
  });

  return NextResponse.json({
    data: { recorded: true, count: parsed.data.metrics.length },
    error: null,
  });
};
