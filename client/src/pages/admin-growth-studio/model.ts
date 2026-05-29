import type {
  AdStudioFormState,
  AdStudioMetaDraft,
  AdStudioReviewDraft,
  AdStudioRunRecord,
  CampaignKit,
  CampaignKitFormState,
  CampaignRecord,
  ProviderStatus,
  RunwayTask,
} from "./types";

export const DEFAULT_CAMPAIGN_FORM: CampaignKitFormState = {
  skuName: "Exact-Site Hosted Review",
  audience: "robotics deployment leads",
  siteType: "warehouse",
  workflow: "pre-deployment site review",
  callToAction: "Book a 30-minute exact-site hosted-review scoping call.",
  proofPoints: "One real facility\nCapture-backed package\nHosted review tied to the same site",
  differentiators:
    "Rights and provenance stay explicit\nNo generic synthetic stand-ins\nHuman gates on pricing and legal",
  assetGoal: "landing_page",
  recipientEmails: "",
  imageAspectRatio: "16:9",
  imageSize: "1K",
  thinkingLevel: "HIGH",
  videoRatio: "1280:720",
  videoDuration: "5",
};

export const DEFAULT_AD_STUDIO_FORM: AdStudioFormState = {
  lane: "capturer",
  audience: "public indoor capturers",
  city: "Atlanta",
  cta: "Apply to capture public indoor spaces",
  budgetCapUsd: "250",
  aspectRatio: "9:16",
  allowedClaims: "Illustrative scenes allowed",
  blockedClaims: "No fabricated proof\nNo fake earnings\nNo fake captured sites",
  firstFrameUrl: "",
  reviewHeadline: "Capture public indoor spaces near you",
  reviewPrimaryText:
    "Illustrative concept ad for Blueprint's public-indoor capture network. Real proof claims stay evidence-gated.",
  metaAccountId: "",
  metaPageId: "",
  metaVideoId: "",
  metaProvider: "graph_api",
  metaMediaPath: "",
  metaMediaType: "video",
  metaCallToAction: "learn_more",
  metaDestinationUrl: "https://tryblueprint.io/capture",
  metaCampaignName: "Blueprint Capturer Draft",
};

export function parseLineList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function metricValue(record: CampaignRecord, key: string) {
  return Number(record.event_counts?.[key] || 0);
}

export function formatEventTime(value: string | null | undefined) {
  if (!value) return "No events yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function buildCampaignKitPayload(form: CampaignKitFormState) {
  return {
    ...form,
    proofPoints: parseLineList(form.proofPoints),
    differentiators: parseLineList(form.differentiators),
  };
}

export function buildCampaignDraftPayload(form: CampaignKitFormState, kit: CampaignKit | null) {
  return {
    name: `${form.skuName} ${form.assetGoal}`.trim(),
    subject: kit?.emailDraft.subjectOptions[0] || `${form.skuName} follow-up`,
    body: kit?.emailDraft.body || "",
    channel: "sendgrid",
    recipientEmails: parseLineList(form.recipientEmails),
  };
}

export function buildAdStudioRunPayload(form: AdStudioFormState) {
  return {
    lane: form.lane,
    audience: form.audience,
    city: form.city,
    cta: form.cta,
    budgetCapUsd: Number(form.budgetCapUsd || 0),
    allowedClaims: parseLineList(form.allowedClaims),
    blockedClaims: parseLineList(form.blockedClaims),
    aspectRatio: form.aspectRatio,
  };
}

export function buildDefaultAdStudioReviewDraft(
  run: AdStudioRunRecord,
  form: AdStudioFormState,
): AdStudioReviewDraft {
  return {
    headline: run.review.headline || run.promptPack?.headlineOptions?.[0] || form.reviewHeadline,
    primaryText: run.review.primaryText || run.promptPack?.primaryTextOptions?.[0] || form.reviewPrimaryText,
  };
}

export function buildAdStudioReviewPayload(
  reviewDraft: AdStudioReviewDraft,
  form: AdStudioFormState,
) {
  return {
    headline: reviewDraft.headline,
    primaryText: reviewDraft.primaryText,
    allowedClaims: parseLineList(form.allowedClaims),
    blockedClaims: parseLineList(form.blockedClaims),
    evidenceLinks: [],
  };
}

export function buildDefaultAdStudioMetaDraft(form: AdStudioFormState): AdStudioMetaDraft {
  return {
    accountId: form.metaAccountId,
    pageId: form.metaPageId,
    videoId: form.metaVideoId,
    provider: form.metaProvider,
    mediaPath: form.metaMediaPath,
    mediaType: form.metaMediaType,
    callToAction: form.metaCallToAction,
    destinationUrl: form.metaDestinationUrl,
    campaignName: form.metaCampaignName,
  };
}

export function buildAdStudioMetaDraftPayload(metaDraft: AdStudioMetaDraft) {
  return {
    accountId: metaDraft.accountId,
    provider: metaDraft.provider,
    pageId: metaDraft.pageId,
    videoId: metaDraft.videoId,
    mediaPath: metaDraft.mediaPath,
    mediaType: metaDraft.mediaType,
    callToAction: metaDraft.callToAction,
    destinationUrl: metaDraft.destinationUrl,
    campaignName: metaDraft.campaignName,
  };
}

export function buildDisabledImageProviderStatus(): ProviderStatus {
  return {
    configured: false,
    available: false,
    model: "disabled_by_policy",
    executionState: "not_configured",
    note:
      "Server-side paid image generation is disabled. Route image-heavy work to webapp-codex and use Codex desktop OAuth image generation on gpt-image-2 there.",
    lastError: null,
  };
}

export function isRunwayTaskPending(task: RunwayTask | null) {
  return Boolean(task && ["PENDING", "THROTTLED", "RUNNING"].includes(task.status));
}
