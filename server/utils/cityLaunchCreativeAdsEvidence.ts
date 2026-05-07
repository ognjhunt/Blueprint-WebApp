import { promises as fs } from "node:fs";
import path from "node:path";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  type AdStudioRunRecord,
  createPersistedAdStudioMetaDraft,
} from "./ad-studio";
import {
  CITY_LAUNCH_GTM_EVIDENCE_SOURCES,
} from "./cityLaunchExecutionHarness";
import {
  buildCityLaunchBudgetPolicy,
  normalizeCityLaunchBudgetTier,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
} from "./cityLaunchPolicy";
import { resolveCityLaunchProfile, slugifyCityName } from "./cityLaunchProfiles";
import {
  getMetaAdsCliStatus,
  listMetaAdsCampaigns,
  type MetaAdsCliExecutor,
} from "./meta-ads-cli";

export const CITY_LAUNCH_CREATIVE_ADS_EVIDENCE_SCHEMA_VERSION =
  "2026-05-06.city-launch-creative-ads-evidence.v1";

export type CityLaunchCreativeAdsEvidenceStatus =
  | "ready"
  | "blocked"
  | "artifact_only";

export type CityLaunchCreativeAdsLaneStatus =
  | "ready"
  | "blocked"
  | "not_found"
  | "human_gated"
  | "provider_gated"
  | "not_run"
  | "artifact_only";

export type CityLaunchMetaReadOnlyProof = {
  status: CityLaunchCreativeAdsLaneStatus;
  provenanceIds: string[];
  actions: string[];
  blocker: string | null;
};

export type CityLaunchPausedDraftEvidence = {
  status: CityLaunchCreativeAdsLaneStatus;
  provider: "ads_cli";
  campaignId: string | null;
  adSetId: string | null;
  creativeId: string | null;
  adId: string | null;
  provenanceIds: string[];
  ledgerLink: string | null;
  blocker: string | null;
};

export type CityLaunchCreativeAdsEvidenceArtifacts = {
  runDirectory: string;
  jsonPath: string;
  markdownPath: string;
};

export type CityLaunchCreativeAdsEvidence = {
  schemaVersion: typeof CITY_LAUNCH_CREATIVE_ADS_EVIDENCE_SCHEMA_VERSION;
  city: string;
  citySlug: string;
  generatedAt: string;
  windowHours: 72;
  budgetPolicy: CityLaunchBudgetPolicy;
  status: CityLaunchCreativeAdsEvidenceStatus;
  blockers: string[];
  warnings: string[];
  artifacts: CityLaunchCreativeAdsEvidenceArtifacts;
  adStudio: {
    status: CityLaunchCreativeAdsLaneStatus;
    runId: string | null;
    lane: string | null;
    reviewStatus: string | null;
    claimsReviewDecision: string | null;
    promptPackReady: boolean;
    imageHandoffReady: boolean;
    videoHandoffReady: boolean;
    videoProvider: string | null;
    videoModel: string | null;
    videoOutputUris: string[];
    videoReviewStatus: string | null;
    metaDraftStatus: string | null;
    blocker: string | null;
  };
  metaAds: {
    status: ReturnType<typeof getMetaAdsCliStatus>;
    missingEnv: string[];
    readOnlyProof: CityLaunchMetaReadOnlyProof;
    pausedDraft: CityLaunchPausedDraftEvidence;
  };
  evidenceSources: typeof CITY_LAUNCH_GTM_EVIDENCE_SOURCES;
  queryNames: string[];
  nextActions: string[];
};

export type CityLaunchCreativeAdsEvidenceDeps = {
  readAdStudioRunForCity: (input: {
    city: string;
    adStudioRunId?: string | null;
  }) => Promise<AdStudioRunRecord | null>;
  getMetaStatus: typeof getMetaAdsCliStatus;
  runMetaReadOnlyProof: (input: {
    city: string;
    launchId?: string | null;
    ledgerLink?: string | null;
    executor?: MetaAdsCliExecutor | null;
  }) => Promise<CityLaunchMetaReadOnlyProof>;
  createPausedDraft: (input: {
    runId: string;
    launchId?: string | null;
    accountId?: string | null;
    pageId?: string | null;
    campaignName: string;
    objective: string;
    dailyBudgetMinorUnits: number;
    primaryText: string;
    headline: string;
    destinationUrl: string;
    mediaPath: string;
    mediaType?: "image" | "video" | null;
    callToAction?: string | null;
    executor?: MetaAdsCliExecutor | null;
  }) => Promise<CityLaunchPausedDraftEvidence>;
  mkdir: typeof fs.mkdir;
  writeFile: typeof fs.writeFile;
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizePositiveUsd(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMediaType(value: unknown): "image" | "video" | null {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === "image" || normalized === "video" ? normalized : null;
}

function normalizedArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function mapStoredAdStudioRun(
  id: string,
  data: Record<string, unknown>,
): AdStudioRunRecord {
  const claimsLedger = (data.claims_ledger || {}) as AdStudioRunRecord["claimsLedger"];
  const review = (data.review || {}) as AdStudioRunRecord["review"];
  const metaDraft = (data.meta_draft || {}) as AdStudioRunRecord["metaDraft"];
  return {
    id,
    lane: normalizeString(data.lane) === "buyer" ? "buyer" : "capturer",
    audience: normalizeString(data.audience),
    cta: normalizeString(data.cta),
    budgetCapUsd: Number(data.budget_cap_usd) || 0,
    city: normalizeString(data.city) || null,
    aspectRatio: normalizeString(data.aspect_ratio),
    status: (normalizeString(data.status) || "draft_requested") as AdStudioRunRecord["status"],
    claimsLedger: {
      allowedClaims: Array.isArray(claimsLedger.allowedClaims) ? claimsLedger.allowedClaims : [],
      blockedClaims: Array.isArray(claimsLedger.blockedClaims) ? claimsLedger.blockedClaims : [],
      evidenceLinks: Array.isArray(claimsLedger.evidenceLinks) ? claimsLedger.evidenceLinks : [],
      reviewDecision: claimsLedger.reviewDecision || "pending",
      reviewNotes: Array.isArray(claimsLedger.reviewNotes) ? claimsLedger.reviewNotes : [],
    },
    brief: (data.brief as AdStudioRunRecord["brief"]) || null,
    promptPack: (data.prompt_pack as AdStudioRunRecord["promptPack"]) || null,
    assets: Array.isArray(data.assets) ? (data.assets as AdStudioRunRecord["assets"]) : [],
    imageExecutionHandoff:
      (data.image_execution_handoff as AdStudioRunRecord["imageExecutionHandoff"]) || null,
    videoTask: (data.video_task as AdStudioRunRecord["videoTask"]) || null,
    review: {
      status: review.status || "pending",
      reasons: Array.isArray(review.reasons) ? review.reasons : [],
      headline: normalizeString(review.headline) || null,
      primaryText: normalizeString(review.primaryText) || null,
    },
    metaDraft: {
      campaignId: normalizeString(metaDraft.campaignId) || null,
      adSetId: normalizeString(metaDraft.adSetId) || null,
      creativeId: normalizeString(metaDraft.creativeId) || null,
      adId: normalizeString(metaDraft.adId) || null,
      status: metaDraft.status || "not_created",
      provider: metaDraft.provider || null,
      provenanceIds: Array.isArray(metaDraft.provenanceIds) ? metaDraft.provenanceIds : [],
      ledgerLink: normalizeString(metaDraft.ledgerLink) || null,
    },
    createdAtIso: normalizeString(data.created_at_iso),
    updatedAtIso: normalizeString(data.updated_at_iso),
  };
}

export async function readLatestAdStudioRunForCity(input: {
  city: string;
  adStudioRunId?: string | null;
}) {
  if (!db) {
    throw new Error("Database not available");
  }
  const collection = db.collection("ad_studio_runs");
  const runId = normalizeString(input.adStudioRunId);
  if (runId) {
    const doc = await collection.doc(runId).get();
    return doc.exists
      ? mapStoredAdStudioRun(doc.id, (doc.data() as Record<string, unknown>) || {})
      : null;
  }
  const snapshot = await collection
    .where("city", "==", input.city)
    .orderBy("updated_at_iso", "desc")
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? mapStoredAdStudioRun(doc.id, (doc.data() as Record<string, unknown>) || {}) : null;
}

export async function runMetaAdsReadOnlyProof(input: {
  city: string;
  launchId?: string | null;
  ledgerLink?: string | null;
  executor?: MetaAdsCliExecutor | null;
}): Promise<CityLaunchMetaReadOnlyProof> {
  const campaigns = await listMetaAdsCampaigns(
    {
      limit: 5,
      city: input.city,
      launchId: input.launchId || null,
      ledgerLink: input.ledgerLink || null,
    },
    input.executor || undefined,
  );
  return {
    status: "ready",
    provenanceIds: [campaigns.provenance.id],
    actions: ["campaign_list"],
    blocker: null,
  };
}

async function createPausedMetaAdsDraftEvidence(input: {
  runId: string;
  launchId?: string | null;
  accountId?: string | null;
  pageId?: string | null;
  campaignName: string;
  objective: string;
  dailyBudgetMinorUnits: number;
  primaryText: string;
  headline: string;
  destinationUrl: string;
  mediaPath: string;
  mediaType?: "image" | "video" | null;
  callToAction?: string | null;
  executor?: MetaAdsCliExecutor | null;
}): Promise<CityLaunchPausedDraftEvidence> {
  const result = await createPersistedAdStudioMetaDraft(
    input.runId,
    {
      provider: "ads_cli",
      accountId: input.accountId || null,
      campaignName: input.campaignName,
      objective: input.objective,
      dailyBudgetMinorUnits: input.dailyBudgetMinorUnits,
      primaryText: input.primaryText,
      headline: input.headline,
      videoId: "",
      mediaPath: input.mediaPath,
      mediaType: input.mediaType || null,
      destinationUrl: input.destinationUrl,
      pageId: input.pageId || null,
      launchId: input.launchId || null,
      callToAction: input.callToAction || "learn_more",
    },
    { cliExecutor: input.executor || undefined },
  );
  return {
    status: "ready",
    provider: "ads_cli",
    campaignId: result.metaDraft.campaignId,
    adSetId: result.metaDraft.adSetId,
    creativeId: result.metaDraft.creativeId || null,
    adId: result.metaDraft.adId,
    provenanceIds: result.metaDraft.provenanceIds || [],
    ledgerLink: result.metaDraft.ledgerLink || null,
    blocker: null,
  };
}

const defaultDeps: CityLaunchCreativeAdsEvidenceDeps = {
  readAdStudioRunForCity: readLatestAdStudioRunForCity,
  getMetaStatus: getMetaAdsCliStatus,
  runMetaReadOnlyProof: runMetaAdsReadOnlyProof,
  createPausedDraft: createPausedMetaAdsDraftEvidence,
  mkdir: fs.mkdir,
  writeFile: fs.writeFile,
};

function buildCreativeAdsEvidencePaths(input: {
  city: string;
  reportsRoot?: string | null;
  timestamp?: string | null;
}) {
  const citySlug = slugifyCityName(input.city);
  const runDirectory = path.join(
    input.reportsRoot
      ? input.reportsRoot
      : path.join(process.cwd(), "ops/paperclip/reports/city-launch-creative-ads"),
    citySlug,
    input.timestamp?.trim() || timestampForFile(),
  );
  const base = path.join(runDirectory, `city-launch-${citySlug}-creative-ads-evidence`);
  return {
    runDirectory,
    jsonPath: `${base}.json`,
    markdownPath: `${base}.md`,
  } satisfies CityLaunchCreativeAdsEvidenceArtifacts;
}

function evaluateAdStudioRun(input: {
  run: AdStudioRunRecord | null;
  requireVideoHandoff?: boolean | null;
}) {
  const run = input.run;
  if (!run) {
    return {
      status: "not_found" as const,
      blocker: "No Ad Studio run was found for this city.",
      warnings: [],
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!run.promptPack) {
    blockers.push("Ad Studio prompt_pack is missing.");
  }
  if (!run.claimsLedger.allowedClaims.length || !run.claimsLedger.blockedClaims.length) {
    blockers.push("Ad Studio claims ledger must include allowed and blocked claims.");
  }
  if (run.review.status !== "draft_safe" || run.claimsLedger.reviewDecision !== "approved") {
    blockers.push("Ad Studio claims review must be draft_safe and approved.");
  }
  if (!run.imageExecutionHandoff) {
    blockers.push("Ad Studio image execution handoff is missing.");
  }
  const video = evaluateVideoHandoff(run.videoTask);
  if (!video.present) {
    if (input.requireVideoHandoff) {
      blockers.push("Ad Studio video/Higgsfield handoff is missing.");
    } else {
      warnings.push(
        "Video/Higgsfield handoff is not present; this remains optional unless provider auth and first-frame provenance are available.",
      );
    }
  } else if (!video.ready) {
    if (input.requireVideoHandoff) {
      blockers.push(`Ad Studio video/Higgsfield handoff is incomplete: ${video.issues.join(" ")}`);
    } else {
      warnings.push(
        `Video/Higgsfield handoff exists but is not complete proof: ${video.issues.join(" ")}`,
      );
    }
  }

  return {
    status: blockers.length > 0 ? "blocked" as const : "ready" as const,
    blocker: blockers.length > 0 ? blockers.join(" ") : null,
    warnings,
  };
}

function providerAuthReady(value: string | null | undefined) {
  const normalized = normalizeString(value).toLowerCase();
  return Boolean(
    normalized
    && !["missing", "unconfigured", "unknown", "blocked", "failed"].includes(normalized),
  );
}

function reviewGateReady(value: string | null | undefined) {
  const normalized = normalizeString(value).toLowerCase();
  return ["approved", "draft_safe", "reviewed", "human_reviewed"].includes(normalized);
}

function evaluateVideoHandoff(videoTask: AdStudioRunRecord["videoTask"]) {
  if (!videoTask) {
    return {
      present: false,
      ready: false,
      issues: ["missing video task."],
    };
  }

  const outputUris = normalizedArray(videoTask.outputUris);
  const issues: string[] = [];
  if (!normalizeString(videoTask.provider)) {
    issues.push("provider is missing.");
  }
  if (!normalizeString(videoTask.model)) {
    issues.push("model is missing.");
  }
  if (!providerAuthReady(videoTask.providerAuthStatus)) {
    issues.push("provider auth status is missing or not ready.");
  }
  if (!normalizeString(videoTask.promptText)) {
    issues.push("motion prompt is missing.");
  }
  if (!normalizeString(videoTask.firstFrameUrl) && !normalizeString(videoTask.firstFrameProvenance)) {
    issues.push("first-frame provenance is missing.");
  }
  if (outputUris.length === 0) {
    issues.push("output URI is missing.");
  }
  if (!reviewGateReady(videoTask.humanReviewStatus)) {
    issues.push("human review gate is not approved.");
  }

  return {
    present: true,
    ready: issues.length === 0,
    issues,
  };
}

function missingMetaEnv(status: ReturnType<typeof getMetaAdsCliStatus>) {
  const missing: string[] = [];
  if (!status.enabled) {
    missing.push("META_ADS_CLI_ENABLED=1");
  }
  if (!status.accessTokenConfigured) {
    missing.push("META_ADS_ACCESS_TOKEN or META_MARKETING_API_ACCESS_TOKEN");
  }
  if (!status.adAccountConfigured) {
    missing.push("META_ADS_AD_ACCOUNT_ID or META_AD_ACCOUNT_ID");
  }
  return missing;
}

function defaultPausedDraftEvidence(
  status: CityLaunchCreativeAdsLaneStatus,
  blocker: string | null,
): CityLaunchPausedDraftEvidence {
  return {
    status,
    provider: "ads_cli",
    campaignId: null,
    adSetId: null,
    creativeId: null,
    adId: null,
    provenanceIds: [],
    ledgerLink: null,
    blocker,
  };
}

function firstCopyOption(run: AdStudioRunRecord, field: "headlineOptions" | "primaryTextOptions") {
  const value = run.promptPack?.[field]?.[0];
  return typeof value === "string" ? value.trim() : "";
}

export async function buildCityLaunchCreativeAdsEvidence(input: {
  city: string;
  budgetTier?: CityLaunchBudgetTier | string | null;
  budgetMaxUsd?: number | null;
  windowHours?: number | null;
  reportsRoot?: string | null;
  timestamp?: string | null;
  adStudioRunId?: string | null;
  requireVideoHandoff?: boolean | null;
  runMetaReadOnly?: boolean | null;
  founderApprovedPausedDraft?: boolean | null;
  launchId?: string | null;
  metaAccountId?: string | null;
  metaPageId?: string | null;
  mediaPath?: string | null;
  mediaType?: "image" | "video" | string | null;
  destinationUrl?: string | null;
  dailyBudgetUsd?: number | null;
  callToAction?: string | null;
  executor?: MetaAdsCliExecutor | null;
  deps?: Partial<CityLaunchCreativeAdsEvidenceDeps>;
}) {
  const deps = { ...defaultDeps, ...(input.deps || {}) };
  const profile = resolveCityLaunchProfile(input.city);
  const requestedWindowHours = Number(input.windowHours ?? 72);
  if (requestedWindowHours !== 72) {
    throw new Error("City launch creative/ad evidence requires --window-hours 72.");
  }
  const windowHours = 72 as const;
  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: normalizeCityLaunchBudgetTier(input.budgetTier) || "lean",
    maxTotalApprovedUsd: input.budgetMaxUsd,
  });
  const artifacts = buildCreativeAdsEvidencePaths({
    city: profile.city,
    reportsRoot: input.reportsRoot,
    timestamp: input.timestamp,
  });
  const blockers: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  let run: AdStudioRunRecord | null = null;
  try {
    run = await deps.readAdStudioRunForCity({
      city: profile.city,
      adStudioRunId: input.adStudioRunId || null,
    });
  } catch (error) {
    blockers.push(
      `Unable to query ad_studio_runs for ${profile.city}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const adStudioEvaluation = evaluateAdStudioRun({
    run,
    requireVideoHandoff: input.requireVideoHandoff,
  });
  const videoHandoff = evaluateVideoHandoff(run?.videoTask || null);
  if (adStudioEvaluation.blocker) {
    blockers.push(adStudioEvaluation.blocker);
    nextActions.push(
      "Create or update an Ad Studio run for this city with prompt_pack, approved claims review, and image execution handoff before paid acquisition readiness is claimed.",
    );
  }
  warnings.push(...adStudioEvaluation.warnings);

  const metaStatus = deps.getMetaStatus();
  const missingEnv = missingMetaEnv(metaStatus);
  let readOnlyProof: CityLaunchMetaReadOnlyProof = {
    status: "not_run",
    provenanceIds: [],
    actions: [],
    blocker: null,
  };

  if (!budgetPolicy.allowPaidAcquisition) {
    readOnlyProof = {
      status: "artifact_only",
      provenanceIds: [],
      actions: [],
      blocker: "Budget tier does not allow paid acquisition.",
    };
  } else if (missingEnv.length > 0) {
    const blocker = `Meta Ads CLI read-only proof is provider-gated by missing env/account fields: ${missingEnv.join(", ")}.`;
    readOnlyProof = {
      status: "provider_gated",
      provenanceIds: [],
      actions: [],
      blocker,
    };
    blockers.push(blocker);
    nextActions.push("Configure Meta Ads CLI read-only credentials before claiming Meta proof.");
  } else if (normalizeBoolean(input.runMetaReadOnly)) {
    try {
      readOnlyProof = await deps.runMetaReadOnlyProof({
        city: profile.city,
        launchId: input.launchId || null,
        ledgerLink: run ? `ad_studio_runs/${run.id}` : null,
        executor: input.executor || null,
      });
    } catch (error) {
      readOnlyProof = {
        status: "blocked",
        provenanceIds: [],
        actions: ["campaign_list"],
        blocker: error instanceof Error ? error.message : String(error),
      };
      blockers.push(`Meta Ads CLI read-only proof failed: ${readOnlyProof.blocker}`);
    }
  } else {
    const blocker = "Meta Ads CLI read-only proof was not run in this closeout.";
    readOnlyProof = {
      status: "not_run",
      provenanceIds: [],
      actions: [],
      blocker,
    };
    blockers.push(blocker);
    nextActions.push("Rerun with --run-meta-read-only after Meta CLI env/account access is configured.");
  }

  let pausedDraft = defaultPausedDraftEvidence(
    "not_run",
    "Paused Meta draft was not attempted.",
  );
  if (!budgetPolicy.allowPaidAcquisition) {
    pausedDraft = defaultPausedDraftEvidence(
      "artifact_only",
      "Budget tier does not allow paid acquisition; no Meta draft should be created.",
    );
  } else if (!normalizeBoolean(input.founderApprovedPausedDraft)) {
    pausedDraft = defaultPausedDraftEvidence(
      "human_gated",
      "Founder-approved paused-draft/budget posture is not recorded for this command.",
    );
    blockers.push(pausedDraft.blocker as string);
    nextActions.push(
      "Record founder approval for city posture, budget envelope, and paused Meta draft creation before using --founder-approved-paused-draft.",
    );
  } else if (!run || adStudioEvaluation.status !== "ready") {
    pausedDraft = defaultPausedDraftEvidence(
      "blocked",
      "Paused draft creation requires a draft-safe Ad Studio run.",
    );
    blockers.push(pausedDraft.blocker as string);
  } else {
    const destinationUrl = normalizeString(input.destinationUrl);
    const mediaPath = normalizeString(input.mediaPath);
    const dailyBudgetUsd = normalizePositiveUsd(input.dailyBudgetUsd)
      || Math.min(Math.max(1, budgetPolicy.operatorAutoApproveUsd || 1), 50);
    const headline = run.review.headline || firstCopyOption(run, "headlineOptions");
    const primaryText = run.review.primaryText || firstCopyOption(run, "primaryTextOptions");
    const draftBlockers = [
      !destinationUrl ? "destination URL" : null,
      !mediaPath ? "local media path" : null,
      !headline ? "headline" : null,
      !primaryText ? "primary text" : null,
    ].filter((entry): entry is string => Boolean(entry));

    if (draftBlockers.length > 0) {
      pausedDraft = defaultPausedDraftEvidence(
        "blocked",
        `Paused draft creation is missing ${draftBlockers.join(", ")}.`,
      );
      blockers.push(pausedDraft.blocker as string);
    } else {
      try {
        pausedDraft = await deps.createPausedDraft({
          runId: run.id,
          launchId: input.launchId || null,
          accountId: normalizeString(input.metaAccountId) || null,
          pageId: normalizeString(input.metaPageId) || null,
          campaignName: `Blueprint ${profile.city} ${run.lane} paused draft`,
          objective: "OUTCOME_TRAFFIC",
          dailyBudgetMinorUnits: Math.round(dailyBudgetUsd * 100),
          primaryText,
          headline,
          destinationUrl,
          mediaPath,
          mediaType: normalizeMediaType(input.mediaType),
          callToAction: normalizeString(input.callToAction) || "learn_more",
          executor: input.executor || null,
        });
      } catch (error) {
        pausedDraft = defaultPausedDraftEvidence(
          "blocked",
          error instanceof Error ? error.message : String(error),
        );
        blockers.push(`Paused Meta draft creation failed: ${pausedDraft.blocker}`);
      }
    }
  }

  const queryNames = CITY_LAUNCH_GTM_EVIDENCE_SOURCES
    .filter((source) => source.collection === "ad_studio_runs" || source.collection === "meta_ads_cli_runs")
    .map((source) => source.query_name);

  const status: CityLaunchCreativeAdsEvidenceStatus = blockers.length > 0
    ? "blocked"
    : !budgetPolicy.allowPaidAcquisition
      ? "artifact_only"
      : "ready";

  return {
    schemaVersion: CITY_LAUNCH_CREATIVE_ADS_EVIDENCE_SCHEMA_VERSION,
    city: profile.city,
    citySlug: slugifyCityName(profile.city),
    generatedAt: input.timestamp || new Date().toISOString(),
    windowHours,
    budgetPolicy,
    status,
    blockers,
    warnings,
    artifacts,
    adStudio: {
      status: adStudioEvaluation.status,
      runId: run?.id || null,
      lane: run?.lane || null,
      reviewStatus: run?.review.status || null,
      claimsReviewDecision: run?.claimsLedger.reviewDecision || null,
      promptPackReady: Boolean(run?.promptPack),
      imageHandoffReady: Boolean(run?.imageExecutionHandoff),
      videoHandoffReady: videoHandoff.ready,
      videoProvider: run?.videoTask?.provider || null,
      videoModel: run?.videoTask?.model || null,
      videoOutputUris: normalizedArray(run?.videoTask?.outputUris),
      videoReviewStatus: run?.videoTask?.humanReviewStatus || null,
      metaDraftStatus: run?.metaDraft.status || null,
      blocker: adStudioEvaluation.blocker,
    },
    metaAds: {
      status: metaStatus,
      missingEnv,
      readOnlyProof,
      pausedDraft,
    },
    evidenceSources: CITY_LAUNCH_GTM_EVIDENCE_SOURCES,
    queryNames,
    nextActions: Array.from(new Set(nextActions)),
  } satisfies CityLaunchCreativeAdsEvidence;
}

export function renderCityLaunchCreativeAdsEvidenceMarkdown(
  evidence: CityLaunchCreativeAdsEvidence,
) {
  const lines = [
    `# ${evidence.city} Creative And Meta Ads Evidence`,
    "",
    `- status: ${evidence.status}`,
    `- city_slug: ${evidence.citySlug}`,
    `- generated_at: ${evidence.generatedAt}`,
    `- window_hours: ${evidence.windowHours}`,
    `- budget_tier: ${evidence.budgetPolicy.tier}`,
    `- budget_max_usd: ${evidence.budgetPolicy.maxTotalApprovedUsd}`,
    `- json_path: ${evidence.artifacts.jsonPath}`,
    `- markdown_path: ${evidence.artifacts.markdownPath}`,
    "",
    "## Evidence Boundary",
    "- Generated creative is marketing material, not captured site truth.",
    "- Meta Ads evidence is read-only proof or paused-draft provenance only; this report never claims live spend or active campaign performance.",
    "- Founder approval is required before live sends, live spend, city posture changes, or rights/privacy exceptions.",
    "",
    "## Blockers",
    ...(evidence.blockers.length > 0 ? evidence.blockers.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Warnings",
    ...(evidence.warnings.length > 0 ? evidence.warnings.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Ad Studio",
    `- status: ${evidence.adStudio.status}`,
    `- run_id: ${evidence.adStudio.runId || "missing"}`,
    `- lane: ${evidence.adStudio.lane || "missing"}`,
    `- review_status: ${evidence.adStudio.reviewStatus || "missing"}`,
    `- claims_review_decision: ${evidence.adStudio.claimsReviewDecision || "missing"}`,
    `- prompt_pack_ready: ${evidence.adStudio.promptPackReady}`,
    `- image_handoff_ready: ${evidence.adStudio.imageHandoffReady}`,
    `- video_handoff_ready: ${evidence.adStudio.videoHandoffReady}`,
    `- video_provider: ${evidence.adStudio.videoProvider || "missing"}`,
    `- video_model: ${evidence.adStudio.videoModel || "missing"}`,
    `- video_output_uris: ${evidence.adStudio.videoOutputUris.join(", ") || "missing"}`,
    `- video_review_status: ${evidence.adStudio.videoReviewStatus || "missing"}`,
    `- meta_draft_status: ${evidence.adStudio.metaDraftStatus || "missing"}`,
    `- blocker: ${evidence.adStudio.blocker || "none"}`,
    "",
    "## Meta Ads CLI",
    `- enabled: ${evidence.metaAds.status.enabled}`,
    `- access_token_configured: ${evidence.metaAds.status.accessTokenConfigured}`,
    `- ad_account_configured: ${evidence.metaAds.status.adAccountConfigured}`,
    `- business_id_configured: ${evidence.metaAds.status.businessIdConfigured}`,
    `- provenance_collection: ${evidence.metaAds.status.provenanceCollection}`,
    `- missing_env: ${evidence.metaAds.missingEnv.length > 0 ? evidence.metaAds.missingEnv.join(", ") : "none"}`,
    "",
    "## Read-Only Proof",
    `- status: ${evidence.metaAds.readOnlyProof.status}`,
    `- actions: ${evidence.metaAds.readOnlyProof.actions.join(", ") || "none"}`,
    `- provenance_ids: ${evidence.metaAds.readOnlyProof.provenanceIds.join(", ") || "none"}`,
    `- blocker: ${evidence.metaAds.readOnlyProof.blocker || "none"}`,
    "",
    "## Paused Draft",
    `- status: ${evidence.metaAds.pausedDraft.status}`,
    `- provider: ${evidence.metaAds.pausedDraft.provider}`,
    `- campaign_id: ${evidence.metaAds.pausedDraft.campaignId || "missing"}`,
    `- ad_set_id: ${evidence.metaAds.pausedDraft.adSetId || "missing"}`,
    `- creative_id: ${evidence.metaAds.pausedDraft.creativeId || "missing"}`,
    `- ad_id: ${evidence.metaAds.pausedDraft.adId || "missing"}`,
    `- provenance_ids: ${evidence.metaAds.pausedDraft.provenanceIds.join(", ") || "none"}`,
    `- ledger_link: ${evidence.metaAds.pausedDraft.ledgerLink || "missing"}`,
    `- blocker: ${evidence.metaAds.pausedDraft.blocker || "none"}`,
    "",
    "## Firestore/Admin Evidence Sources",
    "| Collection | Query name | Query | Purpose |",
    "| --- | --- | --- | --- |",
    ...evidence.evidenceSources
      .filter((source) => source.collection === "ad_studio_runs" || source.collection === "meta_ads_cli_runs")
      .map((source) =>
        `| ${source.collection} | ${source.query_name} | \`${source.query}\` | ${source.purpose.replace(/\|/g, "/")} |`,
      ),
    "",
    "## Next Actions",
    ...(evidence.nextActions.length > 0 ? evidence.nextActions.map((entry) => `- ${entry}`) : ["- none"]),
  ];
  return lines.join("\n");
}

export async function writeCityLaunchCreativeAdsEvidence(input: Parameters<typeof buildCityLaunchCreativeAdsEvidence>[0]) {
  const deps = { ...defaultDeps, ...(input.deps || {}) };
  const evidence = await buildCityLaunchCreativeAdsEvidence({
    ...input,
    deps,
  });
  await deps.mkdir(path.dirname(evidence.artifacts.markdownPath), { recursive: true });
  await deps.writeFile(
    evidence.artifacts.jsonPath,
    JSON.stringify(evidence, null, 2),
    "utf8",
  );
  await deps.writeFile(
    evidence.artifacts.markdownPath,
    renderCityLaunchCreativeAdsEvidenceMarkdown(evidence),
    "utf8",
  );
  return evidence;
}
