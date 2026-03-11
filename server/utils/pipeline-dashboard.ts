import { z } from "zod";

export const sceneDashboardSchema = z.object({
  schema_version: z.literal("v1"),
  scene: z.string().min(1),
  whole_home: z.object({
    capture_id: z.string(),
    status: z.string(),
    confidence: z.number().nullable(),
    memo_path: z.string(),
    memo_uri: z.string(),
  }),
  categories: z.object({
    pick: z.object({
      counts: z.object({
        ready: z.number().int().nonnegative(),
        risky: z.number().int().nonnegative(),
        not_ready_yet: z.number().int().nonnegative(),
      }),
      tasks: z.array(
        z.object({
          task_text: z.string(),
          capture_id: z.string(),
          status: z.string(),
          next_action: z.enum([
            "advance to human signoff",
            "recapture",
            "redesign",
            "defer",
          ]),
          themes: z.array(z.string()),
          memo_path: z.string(),
          memo_uri: z.string(),
        }),
      ),
    }),
    open_close: z.object({
      counts: z.object({
        ready: z.number().int().nonnegative(),
        risky: z.number().int().nonnegative(),
        not_ready_yet: z.number().int().nonnegative(),
      }),
      tasks: z.array(
        z.object({
          task_text: z.string(),
          capture_id: z.string(),
          status: z.string(),
          next_action: z.enum([
            "advance to human signoff",
            "recapture",
            "redesign",
            "defer",
          ]),
          themes: z.array(z.string()),
          memo_path: z.string(),
          memo_uri: z.string(),
        }),
      ),
    }),
    navigate: z.object({
      counts: z.object({
        ready: z.number().int().nonnegative(),
        risky: z.number().int().nonnegative(),
        not_ready_yet: z.number().int().nonnegative(),
      }),
      tasks: z.array(
        z.object({
          task_text: z.string(),
          capture_id: z.string(),
          status: z.string(),
          next_action: z.enum([
            "advance to human signoff",
            "recapture",
            "redesign",
            "defer",
          ]),
          themes: z.array(z.string()),
          memo_path: z.string(),
          memo_uri: z.string(),
        }),
      ),
    }),
  }),
  theme_counts: z.record(z.string(), z.number().int().nonnegative()),
  action_counts: z.record(z.string(), z.number().int().nonnegative()),
  deployment_summary: z.object({
    total_tasks: z.number().int().nonnegative(),
    ready_now: z.number().int().nonnegative(),
    needs_redesign: z.number().int().nonnegative(),
    outside_robot_envelope: z.number().int().nonnegative(),
  }),
});

export type SceneDashboardSummary = z.infer<typeof sceneDashboardSchema>;

export function parseGsUri(uri: string) {
  const trimmed = uri.trim();
  if (!trimmed.startsWith("gs://")) {
    throw new Error("Expected gs:// URI");
  }
  const withoutScheme = trimmed.slice("gs://".length);
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex <= 0) {
    throw new Error("Invalid gs:// URI");
  }
  return {
    bucket: withoutScheme.slice(0, slashIndex),
    objectPath: withoutScheme.slice(slashIndex + 1),
  };
}
