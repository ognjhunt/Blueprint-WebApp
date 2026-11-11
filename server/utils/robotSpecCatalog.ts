/**
 * The robot spec catalog: every robot model the site's answer checks, with each
 * published figure and where it was published.
 *
 * Kept by the Pipeline and mirrored here byte for byte
 * (`contracts/pipeline/robot-spec-catalog.v1.json`, pinned by
 * `scripts/pipeline/verify-robot-spec-catalog.ts`). Every figure carries its
 * source URL and the words it was read from; a figure the source does not give
 * is null, and stays unknown.
 */
import { z } from "zod";

import catalogJson from "../../contracts/pipeline/robot-spec-catalog.v1.json";

const figureSchema = z.object({
  value: z.union([z.number().finite(), z.array(z.number().finite())]),
  unit: z.string().min(1),
  source_url: z.string().url(),
  quote: z.string().min(1),
  conversion: z.string().nullable(),
}).strict();
export type SpecFigure = z.infer<typeof figureSchema>;

const figures = z.record(z.string(), figureSchema.nullable());

const modelSchema = z.object({
  model_id: z.string().regex(/^[a-z0-9_]{1,80}$/),
  recipe_id: z.string().nullable().optional(),
  manufacturer: z.string().min(1),
  name: z.string().min(1),
  body_type: z.enum(["fixed_arm", "mobile_manipulator", "humanoid"]),
  mounting: z.array(z.string()).optional(),
  figures,
  unknown_figures: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
}).passthrough();
export type SpecModel = z.infer<typeof modelSchema>;
export type BodyType = SpecModel["body_type"];

const catalogSchema = z.object({
  schema_version: z.literal("robot_spec_catalog.v1"),
  retrieved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  default_tool: z.object({ tool_id: z.string(), name: z.string(), figures, unknown_figures: z.record(z.string(), z.string()).optional() })
    .passthrough(),
  models: z.array(modelSchema).min(1),
}).passthrough().refine((catalog) => new Set(catalog.models.map((model) => model.model_id)).size === catalog.models.length,
  "duplicate model_id");
export type RobotSpecCatalog = z.infer<typeof catalogSchema>;

/** Validate a catalog; throws on a malformed one. */
export function parseRobotSpecCatalog(raw: unknown): RobotSpecCatalog {
  return catalogSchema.parse(raw);
}

let cached: RobotSpecCatalog | null = null;

/** The mirrored catalog, validated once per process. */
export function robotSpecCatalog(): RobotSpecCatalog {
  if (!cached) cached = parseRobotSpecCatalog(catalogJson as unknown);
  return cached;
}

/** A figure with its source, or null when the source gives none. */
export function specFigure(owner: { figures: Record<string, SpecFigure | null> }, name: string): SpecFigure | null {
  return owner.figures[name] ?? null;
}

/** A scalar figure's value, or null when it is missing or not one number. */
export function figureValue(owner: { figures: Record<string, SpecFigure | null> }, name: string): number | null {
  const value = specFigure(owner, name)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Where a figure was published, or null. */
export function figureSource(owner: { figures: Record<string, SpecFigure | null> }, name: string): string | null {
  return specFigure(owner, name)?.source_url ?? null;
}
