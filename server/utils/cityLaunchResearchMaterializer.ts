import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  recordCityLaunchBudgetEvent,
  recordCityLaunchTouch,
  upsertCityLaunchBuyerTarget,
  upsertCityLaunchProspect,
} from "./cityLaunchLedgers";
import type { CityLaunchBudgetPolicy } from "./cityLaunchPolicy";
import { resolveCityLaunchPlanningState } from "./cityLaunchPlanningState";
import { slugifyCityName } from "./cityLaunchProfiles";
import {
  type CityLaunchResearchParseResult,
} from "./cityLaunchResearchParser";
import { runCityLaunchContactEnrichment } from "./cityLaunchContactEnrichment";
import { resolveHistoricalRecipientEvidence } from "./cityLaunchRecipientEvidence";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEEP_RESEARCH_REPORTS_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/city-launch-deep-research",
);

function toRepoRelative(filePath: string) {
  const absolute = path.resolve(filePath);
  if (!absolute.startsWith(REPO_ROOT)) {
    return absolute;
  }
  return path.relative(REPO_ROOT, absolute).replaceAll(path.sep, "/");
}

export type CityLaunchResearchMaterializationResult = {
  status: "materialized" | "planning_in_progress" | "missing_artifact" | "empty" | "failed";
  city: string;
  citySlug: string;
  sourceArtifactPath: string | null;
  parsed: CityLaunchResearchParseResult | null;
  activationPayloadPresent: boolean;
  activationIssueSeeds: number;
  prospectsUpserted: number;
  buyerTargetsUpserted: number;
  touchesRecorded: number;
  budgetRecommendationsRecorded: number;
  contactEnrichmentStatus?: "enriched" | "no_changes" | "failed";
  contactEnrichmentArtifactPath?: string | null;
  warnings: string[];
};

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveCityLaunchResearchArtifactPath(city: string) {
  const planningState = await resolveCityLaunchPlanningState({ city });
  if (planningState.completedArtifactPath) {
    return planningState.completedArtifactPath;
  }

  const citySlug = slugifyCityName(city);
  const canonicalPlaybookPath = path.join(
    REPO_ROOT,
    "ops/paperclip/playbooks",
    `city-launch-${citySlug}-deep-research.md`,
  );

  if (await fileExists(canonicalPlaybookPath)) {
    return canonicalPlaybookPath;
  }

  const cityReportsRoot = path.join(DEEP_RESEARCH_REPORTS_ROOT, citySlug);
  if (!(await fileExists(cityReportsRoot))) {
    return null;
  }

  const directories = (await fs.readdir(cityReportsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const directory of directories) {
    const candidate = path.join(cityReportsRoot, directory, "99-final-playbook.md");
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function renderMaterializationMarkdown(result: CityLaunchResearchMaterializationResult) {
  return [
    `# ${result.city} Research Materialization`,
    "",
    `- status: ${result.status}`,
    `- city_slug: ${result.citySlug}`,
    `- source_artifact: ${result.sourceArtifactPath || "none"}`,
    `- activation_payload_present: ${result.activationPayloadPresent}`,
    `- activation_issue_seeds: ${result.activationIssueSeeds}`,
    `- prospects_upserted: ${result.prospectsUpserted}`,
    `- buyer_targets_upserted: ${result.buyerTargetsUpserted}`,
    `- touches_recorded: ${result.touchesRecorded}`,
    `- budget_recommendations_recorded: ${result.budgetRecommendationsRecorded}`,
    "",
    "## Warnings",
    "",
    ...(result.warnings.length
      ? result.warnings.map((warning) => `- ${warning}`)
      : ["- none"]),
  ].join("\n");
}

export async function materializeCityLaunchResearch(input: {
  city: string;
  launchId?: string | null;
  budgetPolicy: CityLaunchBudgetPolicy;
  artifactPath?: string | null;
  outputPath?: string | null;
}): Promise<CityLaunchResearchMaterializationResult> {
  const city = input.city.trim();
  const citySlug = slugifyCityName(city);
  const planningState = await resolveCityLaunchPlanningState({ city });
  const sourceArtifactPath = input.artifactPath || (await resolveCityLaunchResearchArtifactPath(city));

  if (!sourceArtifactPath) {
    const status = planningState.status === "in_progress"
      ? "planning_in_progress"
      : "missing_artifact";
    const warnings = planningState.status === "in_progress"
      ? [
          "City-launch planning is still in progress; no completed deep-research playbook is available to materialize yet.",
          ...(planningState.latestArtifactPath
            ? [`Latest partial artifact: ${toRepoRelative(planningState.latestArtifactPath)}`]
            : []),
        ]
      : ["No deep-research playbook was found for this city."];
    const result = {
      status,
      city,
      citySlug,
      sourceArtifactPath: planningState.latestArtifactPath
        ? toRepoRelative(planningState.latestArtifactPath)
        : null,
      parsed: null,
      activationPayloadPresent: false,
      activationIssueSeeds: 0,
      prospectsUpserted: 0,
      buyerTargetsUpserted: 0,
      touchesRecorded: 0,
      budgetRecommendationsRecorded: 0,
      warnings,
    } satisfies CityLaunchResearchMaterializationResult;

    if (input.outputPath) {
      await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
      await fs.writeFile(input.outputPath, JSON.stringify(result, null, 2), "utf8");
      await fs.writeFile(
        input.outputPath.replace(/\.json$/i, ".md"),
        renderMaterializationMarkdown(result),
        "utf8",
      );
    }

    return result;
  }

  try {
    const enrichmentOutputPath = input.outputPath?.replace(/\.json$/i, ".contact-enrichment.json");
    const enrichment = await runCityLaunchContactEnrichment({
      city,
      artifactPath: sourceArtifactPath,
      outputPath: enrichmentOutputPath,
      resolveRecipientEvidence: resolveHistoricalRecipientEvidence,
    });
    const parsed = enrichment.parsed;

    if (!parsed) {
      throw new Error("Contact enrichment did not return a parsed research artifact.");
    }

    if (parsed.errors.length > 0) {
      const warnings = [
        ...enrichment.warnings,
        ...parsed.errors.map((error) => `Contract violation: ${error}`),
      ];
      const result = {
        status: "failed",
        city,
        citySlug,
        sourceArtifactPath: toRepoRelative(sourceArtifactPath),
        parsed,
        activationPayloadPresent: Boolean(parsed.activationPayload),
        activationIssueSeeds: parsed.activationPayload?.issueSeeds.length || 0,
        prospectsUpserted: 0,
        buyerTargetsUpserted: 0,
        touchesRecorded: 0,
        budgetRecommendationsRecorded: 0,
        contactEnrichmentStatus: enrichment.status,
        contactEnrichmentArtifactPath: enrichment.outputPath,
        warnings,
      } satisfies CityLaunchResearchMaterializationResult;

      if (input.outputPath) {
        await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
        await fs.writeFile(input.outputPath, JSON.stringify(result, null, 2), "utf8");
        await fs.writeFile(
          input.outputPath.replace(/\.json$/i, ".md"),
          renderMaterializationMarkdown(result),
          "utf8",
        );
      }

      return result;
    }

    const prospectIdsByName = new Map<string, string>();
    const buyerIdsByName = new Map<string, string>();

    let prospectsUpserted = 0;
    for (const candidate of parsed.captureCandidates) {
      const prospect = await upsertCityLaunchProspect({
        id: candidate.stableKey,
        city,
        launchId: input.launchId ?? null,
        sourceBucket: candidate.sourceBucket,
        channel: candidate.channel,
        name: candidate.name,
        email: candidate.contactEmail,
        status: candidate.status,
        ownerAgent: "city-demand-agent",
        notes: null,
        firstContactedAt: null,
        lastContactedAt: null,
        siteAddress: candidate.siteAddress,
        locationSummary: candidate.locationSummary,
        lat: candidate.lat,
        lng: candidate.lng,
        siteCategory: candidate.siteCategory,
        workflowFit: candidate.workflowFit,
        priorityNote: candidate.priorityNote,
        researchProvenance: {
          ...candidate.provenance,
          artifactPath: toRepoRelative(candidate.provenance.artifactPath),
        },
      });
      prospectIdsByName.set(candidate.name.trim().toLowerCase(), prospect.id);
      prospectsUpserted += 1;
    }

    let buyerTargetsUpserted = 0;
    for (const buyerTarget of parsed.buyerTargets) {
      const stored = await upsertCityLaunchBuyerTarget({
        id: buyerTarget.stableKey,
        city,
        launchId: input.launchId ?? null,
        companyName: buyerTarget.companyName,
        contactName: buyerTarget.contactName,
        contactEmail: buyerTarget.contactEmail,
        status: buyerTarget.status,
        workflowFit: buyerTarget.workflowFit,
        proofPath: buyerTarget.proofPath,
        ownerAgent: "outbound-sales-agent",
        notes: buyerTarget.notes,
        sourceBucket: buyerTarget.sourceBucket,
        researchProvenance: {
          ...buyerTarget.provenance,
          artifactPath: toRepoRelative(buyerTarget.provenance.artifactPath),
        },
      });
      buyerIdsByName.set(buyerTarget.companyName.trim().toLowerCase(), stored.id);
      buyerTargetsUpserted += 1;
    }

    let touchesRecorded = 0;
    for (const touch of parsed.firstTouches) {
      const normalizedReferenceName = touch.referenceName?.trim().toLowerCase() || null;
      const referenceId = normalizedReferenceName
        ? touch.referenceType === "prospect"
          ? prospectIdsByName.get(normalizedReferenceName) || null
          : buyerIdsByName.get(normalizedReferenceName) || null
        : null;

      await recordCityLaunchTouch({
        id: touch.stableKey,
        city,
        launchId: input.launchId ?? null,
        referenceType: touch.referenceType,
        referenceId,
        touchType: touch.touchType,
        channel: touch.channel,
        status: touch.status,
        campaignId: touch.campaignId,
        issueId: touch.issueId,
        notes: touch.notes,
        researchProvenance: {
          ...touch.provenance,
          artifactPath: toRepoRelative(touch.provenance.artifactPath),
        },
      });
      touchesRecorded += 1;
    }

    let budgetRecommendationsRecorded = 0;
    for (const recommendation of parsed.budgetRecommendations) {
      const withinPolicy = recommendation.amountUsd <= input.budgetPolicy.maxTotalApprovedUsd;
      await recordCityLaunchBudgetEvent({
        id: recommendation.stableKey,
        city,
        launchId: input.launchId ?? null,
        category: recommendation.category,
        amountUsd: recommendation.amountUsd,
        note: recommendation.note,
        approvedByRole: null,
        withinPolicy,
        eventType: "recommended",
        researchProvenance: {
          ...recommendation.provenance,
          artifactPath: toRepoRelative(recommendation.provenance.artifactPath),
        },
      });
      budgetRecommendationsRecorded += 1;
    }

    const status =
      prospectsUpserted === 0
      && buyerTargetsUpserted === 0
      && touchesRecorded === 0
      && budgetRecommendationsRecorded === 0
        ? "empty"
        : "materialized";
    const warnings = [...parsed.warnings];
    if (planningState.status === "refresh_in_progress") {
      warnings.push(
        "A newer deep-research refresh is still in progress. Materialized the latest completed playbook.",
      );
    }

    const result = {
      status,
      city,
      citySlug,
      sourceArtifactPath: toRepoRelative(sourceArtifactPath),
      parsed,
      activationPayloadPresent: Boolean(parsed.activationPayload),
      activationIssueSeeds: parsed.activationPayload?.issueSeeds.length || 0,
      prospectsUpserted,
      buyerTargetsUpserted,
      touchesRecorded,
      budgetRecommendationsRecorded,
      contactEnrichmentStatus: enrichment.status,
      contactEnrichmentArtifactPath: enrichment.outputPath,
      warnings,
    } satisfies CityLaunchResearchMaterializationResult;

    if (input.outputPath) {
      await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
      await fs.writeFile(input.outputPath, JSON.stringify(result, null, 2), "utf8");
      await fs.writeFile(
        input.outputPath.replace(/\.json$/i, ".md"),
        renderMaterializationMarkdown(result),
        "utf8",
      );
    }

    return result;
  } catch (error) {
    const result = {
      status: "failed",
      city,
      citySlug,
      sourceArtifactPath: toRepoRelative(sourceArtifactPath),
      parsed: null,
      activationPayloadPresent: false,
      activationIssueSeeds: 0,
      prospectsUpserted: 0,
      buyerTargetsUpserted: 0,
      touchesRecorded: 0,
      budgetRecommendationsRecorded: 0,
      warnings: [error instanceof Error ? error.message : String(error)],
    } satisfies CityLaunchResearchMaterializationResult;

    if (input.outputPath) {
      await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
      await fs.writeFile(input.outputPath, JSON.stringify(result, null, 2), "utf8");
      await fs.writeFile(
        input.outputPath.replace(/\.json$/i, ".md"),
        renderMaterializationMarkdown(result),
        "utf8",
      );
    }

    return result;
  }
}
