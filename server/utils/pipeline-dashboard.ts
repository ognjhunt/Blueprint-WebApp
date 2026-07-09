import { z } from "zod";

/**
 * Next-action semantics are site-type-agnostic robot-deployment decisions, so
 * they are shared across the legacy residential taxonomy and the generalized
 * site taxonomy. (R015: kept as-is; only the *category* set is generalized.)
 */
export const DASHBOARD_NEXT_ACTIONS = [
  "advance to human signoff",
  "recapture",
  "redesign",
  "defer",
] as const;

const dashboardTaskSchema = z.object({
  task_text: z.string(),
  capture_id: z.string(),
  status: z.string(),
  next_action: z.enum(DASHBOARD_NEXT_ACTIONS),
  themes: z.array(z.string()),
  memo_path: z.string(),
  memo_uri: z.string(),
});

const dashboardCategorySchema = z.object({
  counts: z.object({
    ready: z.number().int().nonnegative(),
    risky: z.number().int().nonnegative(),
    not_ready_yet: z.number().int().nonnegative(),
  }),
  tasks: z.array(dashboardTaskSchema),
});

/**
 * Site-level capture anchor. Historically emitted only as `whole_home` for the
 * residential ontology; `site_capture` is the site-type-agnostic alias used by
 * warehouse/factory (and any) sites. Same shape either way.
 */
const dashboardCaptureAnchorSchema = z.object({
  capture_id: z.string(),
  status: z.string(),
  confidence: z.number().nullable(),
  memo_path: z.string(),
  memo_uri: z.string(),
});

/**
 * Scene dashboard summary contract (v1).
 *
 * This is a LIVE, validated contract consumed by the ops dashboard route
 * (`GET /:requestId/pipeline/dashboard`). R015 generalizes it from a
 * home/residential-only ontology to a site-type-agnostic structure so
 * warehouse/factory task groups (tote_transfer, palletize, line_side_delivery,
 * aisle_navigation, ...) can surface in operator dashboards.
 *
 * The change is ADDITIVE and backward compatible:
 *  - Legacy residential producers keep emitting `whole_home` + the fixed
 *    `categories.{pick,open_close,navigate}` shape and still validate exactly.
 *  - Generalized producers set `site_type` and emit `site_summary`, an
 *    open/extensible taxonomy keyed by arbitrary category id, plus an optional
 *    `site_capture` anchor.
 * Both may coexist. A payload must carry at least one task taxonomy (legacy
 * `categories` or generalized `site_summary`) to be valid.
 */
export const sceneDashboardSchema = z
  .object({
    schema_version: z.literal("v1"),
    scene: z.string().min(1),

    // Site-type-agnostic descriptor (e.g. "whole_home", "warehouse",
    // "factory", "micro_fulfillment"). Optional so legacy residential
    // producers that never emitted it stay valid.
    site_type: z.string().min(1).optional(),

    // --- Legacy residential (home) shape: preserved for back-compat ---
    // Optional so a generalized warehouse/factory payload need not carry the
    // home-specific anchor; when present it validates with the original shape.
    whole_home: dashboardCaptureAnchorSchema.optional(),
    categories: z
      .object({
        pick: dashboardCategorySchema,
        open_close: dashboardCategorySchema,
        navigate: dashboardCategorySchema,
      })
      .optional(),

    // --- Generalized site-type-agnostic shape ---
    // Site-agnostic capture anchor mirroring `whole_home`.
    site_capture: dashboardCaptureAnchorSchema.optional(),
    // Open/extensible task taxonomy keyed by arbitrary category id. Each value
    // carries the same per-category shape (counts + tasks) as the legacy
    // categories, so warehouse/factory groups are first-class.
    site_summary: z.record(z.string(), dashboardCategorySchema).optional(),

    theme_counts: z.record(z.string(), z.number().int().nonnegative()),
    action_counts: z.record(z.string(), z.number().int().nonnegative()),
    deployment_summary: z.object({
      total_tasks: z.number().int().nonnegative(),
      ready_now: z.number().int().nonnegative(),
      needs_redesign: z.number().int().nonnegative(),
      outside_robot_envelope: z.number().int().nonnegative(),
    }),
  })
  .superRefine((value, ctx) => {
    const hasLegacyTaxonomy = value.categories !== undefined;
    const hasGeneralizedTaxonomy =
      value.site_summary !== undefined && Object.keys(value.site_summary).length > 0;
    if (!hasLegacyTaxonomy && !hasGeneralizedTaxonomy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Scene dashboard must include a task taxonomy: legacy `categories` or generalized `site_summary`.",
        path: ["site_summary"],
      });
    }
  });

export type SceneDashboardSummary = z.infer<typeof sceneDashboardSchema>;
export type SceneDashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type SceneDashboardTask = z.infer<typeof dashboardTaskSchema>;

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
