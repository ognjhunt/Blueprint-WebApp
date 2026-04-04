import { createHash } from "node:crypto";

export type ContentAssetType =
  | "community_update"
  | "ship_broadcast"
  | "campaign_bundle"
  | "blog_post"
  | "newsletter"
  | "landing_page"
  | "social_draft";

export type ContentChannel =
  | "newsletter"
  | "blog"
  | "landing_page"
  | "linkedin"
  | "x"
  | "slack"
  | "notion";

export interface ContentBrief {
  wedge: string;
  audience: string;
  channels: ContentChannel[];
  sourceEvidence: string[];
  proofLinks: string[];
  allowedClaims: string[];
  blockedClaims: string[];
  callToAction: string | null;
  owner: string;
}

export interface ContentOutcomeReview {
  id: string;
  assetKey: string;
  issueId: string | null;
  assetType: ContentAssetType;
  channels: ContentChannel[];
  summary: string;
  whatWorked: string[];
  whatDidNot: string[];
  nextRecommendation: string | null;
  evidenceSource: string;
  confidence: number;
  recordedAt: string;
  recordedBy: string | null;
}

export interface ShipBroadcastIssueSpec {
  assetKey: string;
  sourceId: string;
  title: string;
  description: string;
  brief: ContentBrief;
  channels: ContentChannel[];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeChannel(value: string): ContentChannel | null {
  switch (value.trim().toLowerCase()) {
    case "newsletter":
      return "newsletter";
    case "blog":
      return "blog";
    case "landing_page":
    case "landing-page":
    case "landing page":
      return "landing_page";
    case "linkedin":
      return "linkedin";
    case "x":
    case "twitter":
      return "x";
    case "slack":
      return "slack";
    case "notion":
      return "notion";
    default:
      return null;
  }
}

function normalizeAssetType(value: unknown, fallback: ContentAssetType): ContentAssetType {
  const normalized = asString(value)?.toLowerCase();
  switch (normalized) {
    case "community_update":
    case "community-update":
      return "community_update";
    case "ship_broadcast":
    case "ship-broadcast":
      return "ship_broadcast";
    case "campaign_bundle":
    case "campaign-bundle":
      return "campaign_bundle";
    case "blog_post":
    case "blog-post":
      return "blog_post";
    case "newsletter":
      return "newsletter";
    case "landing_page":
    case "landing-page":
      return "landing_page";
    case "social_draft":
    case "social-draft":
      return "social_draft";
    default:
      return fallback;
  }
}

export function normalizeContentChannels(
  value: unknown,
  fallback: ContentChannel[],
): ContentChannel[] {
  const direct = normalizeStringArray(value)
    .map((entry) => normalizeChannel(entry))
    .filter((entry): entry is ContentChannel => Boolean(entry));
  const selected = direct.length > 0 ? direct : fallback;
  return [...new Set(selected)];
}

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeContentBrief(
  input: Record<string, unknown>,
  fallbackOwner: string,
): ContentBrief {
  return {
    wedge:
      asString(input.wedge)
      ?? "Exact-Site Hosted Review",
    audience:
      asString(input.audience)
      ?? "robot teams, capturers, partners, and interested operators",
    channels: normalizeContentChannels(input.channels, ["newsletter", "blog", "slack", "notion"]),
    sourceEvidence: normalizeStringArray(input.sourceEvidence),
    proofLinks: normalizeStringArray(input.proofLinks),
    allowedClaims:
      normalizeStringArray(input.allowedClaims).length > 0
        ? normalizeStringArray(input.allowedClaims)
        : [
          "Only describe shipped work, measured operational changes, and proof-backed product behavior.",
          "Keep the message anchored to one real site, one workflow question, and one concrete next step when relevant.",
        ],
    blockedClaims:
      normalizeStringArray(input.blockedClaims).length > 0
        ? normalizeStringArray(input.blockedClaims)
        : [
          "No invented traction, customer logos, or market leadership claims.",
          "No unsupported capability claims or qualification-first reframing.",
          "No pricing, contract, legal, privacy, or rights commitments without human approval.",
        ],
    callToAction: asString(input.callToAction),
    owner: asString(input.owner) ?? fallbackOwner,
  };
}

export function buildContentBriefMarkdown(brief: ContentBrief) {
  const lines = [
    "## Content Brief",
    `- Wedge: ${brief.wedge}`,
    `- Audience: ${brief.audience}`,
    `- Channels: ${brief.channels.join(", ") || "unspecified"}`,
    `- Owner: ${brief.owner}`,
    `- Call to action: ${brief.callToAction ?? "none"}`,
  ];

  if (brief.sourceEvidence.length > 0) {
    lines.push("", "### Source Evidence", ...brief.sourceEvidence.map((entry) => `- ${entry}`));
  }
  if (brief.proofLinks.length > 0) {
    lines.push("", "### Proof Links", ...brief.proofLinks.map((entry) => `- ${entry}`));
  }
  if (brief.allowedClaims.length > 0) {
    lines.push("", "### Allowed Claims", ...brief.allowedClaims.map((entry) => `- ${entry}`));
  }
  if (brief.blockedClaims.length > 0) {
    lines.push("", "### Blocked Claims", ...brief.blockedClaims.map((entry) => `- ${entry}`));
  }

  return lines.join("\n");
}

export function normalizeContentOutcomeReview(
  input: Record<string, unknown>,
  recordedAt: string,
): ContentOutcomeReview {
  const assetType = normalizeAssetType(input.assetType, "campaign_bundle");
  const summary = asString(input.summary) ?? "Outcome review captured.";
  const evidenceSource =
    asString(input.evidenceSource)
    ?? "manual_review";
  const recordedBy = asString(input.recordedBy);
  const assetKey =
    asString(input.assetKey)
    ?? stableDigest({
      summary,
      evidenceSource,
      recordedAt,
      issueId: asString(input.issueId),
    }).slice(0, 16);
  const confidenceRaw = Number(input.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(confidenceRaw, 1))
    : 0.5;

  return {
    id: stableDigest({
      assetKey,
      issueId: asString(input.issueId),
      summary,
      evidenceSource,
      recordedAt,
    }).slice(0, 16),
    assetKey,
    issueId: asString(input.issueId),
    assetType,
    channels: normalizeContentChannels(input.channels, ["newsletter"]),
    summary,
    whatWorked: normalizeStringArray(input.whatWorked),
    whatDidNot: normalizeStringArray(input.whatDidNot),
    nextRecommendation: asString(input.nextRecommendation),
    evidenceSource,
    confidence,
    recordedAt,
    recordedBy,
  };
}

export function formatContentOutcomeReviewIssueComment(review: ContentOutcomeReview) {
  const lines = [
    "Structured content outcome review recorded.",
    `- Asset key: ${review.assetKey}`,
    `- Asset type: ${review.assetType}`,
    `- Channels: ${review.channels.join(", ") || "unspecified"}`,
    `- Summary: ${review.summary}`,
    `- Evidence source: ${review.evidenceSource}`,
    `- Confidence: ${review.confidence.toFixed(2)}`,
  ];

  if (review.whatWorked.length > 0) {
    lines.push("", "What worked:", ...review.whatWorked.map((entry) => `- ${entry}`));
  }
  if (review.whatDidNot.length > 0) {
    lines.push("", "What did not:", ...review.whatDidNot.map((entry) => `- ${entry}`));
  }
  if (review.nextRecommendation) {
    lines.push("", `Next recommendation: ${review.nextRecommendation}`);
  }

  return lines.join("\n");
}

export function buildShipBroadcastIssueSpec(input: {
  repoKey: string;
  repoName: string;
  projectName: string;
  branch: string;
  afterSha: string;
  compareUrl?: string | null;
  headCommitMessage?: string | null;
  commitMessages: string[];
  changedFiles: string[];
  owner: string;
}) : ShipBroadcastIssueSpec {
  const shortSha = input.afterSha.slice(0, 7);
  const headline =
    asString(input.headCommitMessage)?.split("\n")[0]
    ?? input.commitMessages[0]
    ?? `Ship ${shortSha}`;

  const brief = normalizeContentBrief(
    {
      wedge: "Exact-Site Hosted Review",
      audience: "robot teams, capturers, partners, and interested operators",
      channels: ["newsletter", "blog", "slack", "notion"],
      sourceEvidence: [
        `Repo: ${input.repoName}`,
        `Project: ${input.projectName}`,
        `Branch: ${input.branch}`,
        `Head commit: ${headline}`,
      ],
      proofLinks: input.compareUrl ? [input.compareUrl] : [],
      allowedClaims: [
        "Describe only shipped work that is visible in the merged commit set or linked proof artifacts.",
        "Explain why the shipped change matters for buyers, capturers, operators, or hosted-review quality.",
      ],
      blockedClaims: [
        "No invented traction or adoption claims.",
        "No promises of deployment success or product capability beyond the merged evidence.",
        "No pricing, legal, rights, privacy, or contract claims without human approval.",
      ],
      callToAction: "Invite the reader to ask for an exact-site hosted review or reply with the next deployment question.",
      owner: input.owner,
    },
    input.owner,
  );

  const commitBullets = input.commitMessages.slice(0, 5).map((entry) => `- ${entry}`);
  const changedFileBullets = input.changedFiles.slice(0, 12).map((entry) => `- ${entry}`);
  const descriptionLines = [
    `GitHub push shipped new work on \`${input.branch}\` for \`${input.repoName}\`. Draft a truthful ship-broadcast package that turns the merged work into one concise public-facing update bundle.`,
    "",
    "## Ship Summary",
    `- Repo: ${input.repoName}`,
    `- Project: ${input.projectName}`,
    `- Branch: ${input.branch}`,
    `- After SHA: ${input.afterSha}`,
    ...(input.compareUrl ? [`- Compare URL: ${input.compareUrl}`] : []),
    "",
    buildContentBriefMarkdown(brief),
  ];

  if (commitBullets.length > 0) {
    descriptionLines.push("", "## Commit Headlines", ...commitBullets);
  }
  if (changedFileBullets.length > 0) {
    descriptionLines.push("", "## Changed Files", ...changedFileBullets);
  }

  return {
    assetKey: `ship-broadcast:${input.repoKey}:${input.afterSha}`,
    sourceId: `${input.repoKey}:ship:${input.afterSha}`,
    title: `Ship Broadcast: ${input.repoName} ${shortSha} - ${headline}`,
    description: descriptionLines.join("\n"),
    brief,
    channels: brief.channels,
  };
}
