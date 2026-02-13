import { Router, Request, Response } from "express";
import { z } from "zod";

import {
  environmentPolicies,
  marketplaceScenes,
  trainingDatasets,
} from "../../client/src/data/content";
import type {
  MarketplaceSearchRequest,
  MarketplaceSearchResponse,
  MarketplaceSearchManualFilters,
  MarketplaceSearchSort,
} from "../../client/src/types/marketplace-search";

import { parseMarketplaceQuery } from "../utils/marketplaceQueryParser";
import { searchMarketplace } from "../retrieval/marketplaceSearch";

const router = Router();

const requestSchema = z
  .object({
    q: z.string().trim().min(1).max(600),
    limit: z.number().int().positive().max(200).optional(),
    manualFilters: z
      .object({
        itemType: z.enum(["all", "scenes", "training"]).optional(),
        locationType: z.string().trim().min(1).nullable().optional(),
        policySlug: z.string().trim().min(1).nullable().optional(),
        objectTags: z.array(z.string().trim().min(1)).optional(),
        sort: z
          .enum([
            "relevance",
            "newest",
            "price-asc",
            "price-desc",
            "scene-desc",
          ])
          .optional(),
        page: z.number().int().positive().optional(),
      })
      .optional(),
    ignoreParsedKeys: z.array(z.string().trim().min(1)).optional(),
  })
  .passthrough();

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function stripIgnoredKeys(
  obj: Record<string, unknown>,
  ignored: Set<string>,
) {
  for (const key of Object.keys(obj)) {
    if (ignored.has(key)) {
      delete obj[key];
    }
  }
}

function stripIgnoredChips(
  chips: Array<{ key: string; label: string; value: string }>,
  ignored: Set<string>,
) {
  return chips.filter((chip) => !ignored.has(chip.key));
}

function defaultSortForQuery(query: string): MarketplaceSearchSort {
  return query.trim().length >= 4 ? "relevance" : "newest";
}

router.post("/search", async (req: Request, res: Response) => {
  const parsedRequest = requestSchema.safeParse(req.body);
  if (!parsedRequest.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsedRequest.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const payload = parsedRequest.data as MarketplaceSearchRequest;
  const q = (payload.q || "").trim();
  const limit = typeof payload.limit === "number" ? payload.limit : 60;
  const manual = (payload.manualFilters || {}) as MarketplaceSearchManualFilters;
  const ignoredKeys = new Set(
    (payload.ignoreParsedKeys || []).map((key) => key.trim()).filter(Boolean),
  );

  const knownLocationTypes = uniq([
    ...marketplaceScenes.map((s) => s.locationType),
    ...trainingDatasets.map((t) => t.locationType),
  ]);

  const knownObjectTags = uniq([
    ...marketplaceScenes.flatMap((s) => s.objectTags),
    ...trainingDatasets.flatMap((t) => t.objectTags),
  ]);

  const knownPolicies = environmentPolicies.map((policy) => ({
    slug: policy.slug,
    title: policy.title,
  }));

  const parsed = parseMarketplaceQuery(q, {
    knownLocationTypes,
    knownPolicies,
    knownObjectTags,
  });

  // Remove ignored keys from parsed output.
  stripIgnoredKeys(parsed.hard, ignoredKeys);
  stripIgnoredKeys(parsed.soft, ignoredKeys);
  parsed.chips = stripIgnoredChips(parsed.chips, ignoredKeys);

  // Extract hard constraints used by the search backend.
  const hard = {
    minQualityScore:
      typeof (parsed.hard as any).minQualityScore === "number"
        ? ((parsed.hard as any).minQualityScore as number)
        : undefined,
    minEpisodes:
      typeof (parsed.hard as any).minEpisodes === "number"
        ? ((parsed.hard as any).minEpisodes as number)
        : undefined,
  };

  // Parsed filters that map onto manual filters.
  const parsedLocationType =
    typeof (parsed.hard as any).locationType === "string"
      ? ((parsed.hard as any).locationType as string)
      : undefined;
  const parsedPolicySlug =
    typeof (parsed.hard as any).policySlug === "string"
      ? ((parsed.hard as any).policySlug as string)
      : undefined;

  // Merge precedence:
  // - manual overrides parsed when explicitly provided
  // - otherwise fall back to parsed
  const locationType =
    manual.locationType !== undefined ? manual.locationType : parsedLocationType || null;
  const policySlug =
    manual.policySlug !== undefined ? manual.policySlug : parsedPolicySlug || null;

  // If a manual override was applied, drop the parsed chip for the same key to avoid confusion.
  if (manual.locationType !== undefined) {
    delete (parsed.hard as any).locationType;
    parsed.chips = parsed.chips.filter((chip) => chip.key !== "locationType");
  }
  if (manual.policySlug !== undefined) {
    delete (parsed.hard as any).policySlug;
    parsed.chips = parsed.chips.filter((chip) => chip.key !== "policySlug");
  }

  const filters = {
    itemType: manual.itemType || "all",
    locationType,
    policySlug,
    objectTags: Array.isArray(manual.objectTags) ? manual.objectTags : [],
    sort: manual.sort || defaultSortForQuery(q),
  };

  const soft = {
    tabletop: Boolean((parsed.soft as any).tabletop) || undefined,
    policySlugs: Array.isArray((parsed.soft as any).policySlugs)
      ? ((parsed.soft as any).policySlugs as string[])
      : undefined,
    robotModels: Array.isArray((parsed.soft as any).robotModels)
      ? ((parsed.soft as any).robotModels as string[])
      : undefined,
    compatibleWith: Array.isArray((parsed.soft as any).compatibleWith)
      ? ((parsed.soft as any).compatibleWith as string[])
      : undefined,
    objectTags: Array.isArray((parsed.soft as any).objectTags)
      ? ((parsed.soft as any).objectTags as string[])
      : undefined,
  };

  const search = await searchMarketplace({
    query: q,
    limit,
    filters,
    hard,
    soft,
  });

  const warnings = uniq([...(parsed.warnings || []), ...(search.warnings || [])]);

  const appliedParsed: Record<string, unknown> = { ...hard, ...soft };
  if (manual.locationType === undefined && parsedLocationType) {
    appliedParsed.locationType = parsedLocationType;
  }
  if (manual.policySlug === undefined && parsedPolicySlug) {
    appliedParsed.policySlug = parsedPolicySlug;
  }

  const responsePayload: MarketplaceSearchResponse = {
    results: search.results.map((result) => ({
      type: result.type,
      item: result.item,
      score: result.score,
      distance: result.distance,
      reasons: result.reasons,
    })),
    parsed: {
      hard: parsed.hard,
      soft: parsed.soft,
      chips: parsed.chips,
      warnings,
    },
    applied: {
      manual: filters,
      parsed: appliedParsed,
    },
    meta: {
      backend: search.meta.backend,
      embeddingModel: search.meta.embeddingModel,
    },
  };

  return res.status(200).json(responsePayload);
});

export default router;
