import type { ExactSiteGtmTarget } from "./exactSiteHostedReviewGtmPilot";

export type ExactSiteFirstTouchReview = {
  proposedSubject: string;
  proposedBody: string;
  draftAngle: string;
  cta: string;
  landingPage: string;
  objectionPlan: string;
  proofSource: string;
  blockedClaims: string[];
  reviewFlags: string[];
  reviewerPrompt: string;
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function sentence(value: unknown, fallback: string): string {
  const text = clean(value);
  return text || fallback;
}

function firstIntentSignal(target: ExactSiteGtmTarget): string {
  return sentence(target.intentSignals?.[0], target.evidence?.summary || "a public robot-team workflow signal")
    .replace(/[.!?]+$/g, "");
}

function possessiveName(value: string): string {
  return value.endsWith("s") ? `${value}'` : `${value}'s`;
}

function isPublicOrGeneralInbox(target: ExactSiteGtmTarget): boolean {
  const recipientRole = clean(target.recipient?.role).toLowerCase();
  const recipientEmail = clean(target.recipient?.email).toLowerCase();
  return recipientRole.includes("general")
    || recipientRole.includes("support")
    || recipientRole.includes("public inbox")
    || recipientRole.includes("community")
    || recipientEmail.startsWith("info@")
    || recipientEmail.startsWith("support@")
    || recipientEmail.startsWith("contact@")
    || recipientEmail.startsWith("community@")
    || recipientEmail.startsWith("feedback@");
}

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  const text = clean(value);
  if (text) params.set(key, text);
}

function demandSourcedLandingPage(target: ExactSiteGtmTarget): string {
  const requestedSiteType = clean(target.captureAsk?.requestedSiteType);
  const requestedCity = clean(target.captureAsk?.requestedCity || target.city);
  const workflow = clean(target.captureAsk?.buyerQuestion || target.workflowNeed);
  const message = [
    `GTM target: ${target.id}`,
    `Organization: ${target.organizationName}`,
    "Use this path only to ask which exact site or workflow should be captured first.",
    "Do not imply that a hosted review, package, or capture evidence already exists for this target.",
  ].join("\n");
  const params = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "capture-access",
    path: "request-capture",
    source: "gtm-first-touch",
    proofPathPreference: "exact_site_required",
  });

  appendParam(params, "query", workflow || requestedSiteType || target.workflowNeed);
  appendParam(params, "siteName", target.captureAsk?.requestedSiteType);
  appendParam(params, "location", requestedCity);
  appendParam(params, "siteLocation", requestedCity);
  appendParam(params, "city", requestedCity);
  appendParam(params, "targetSiteType", requestedSiteType);
  appendParam(params, "workflow", workflow);
  appendParam(params, "taskStatement", workflow || target.workflowNeed);
  appendParam(params, "targetRobotTeam", target.buyerSegment);
  appendParam(params, "message", message);

  return `/contact?${params.toString()}`;
}

function proofReadyLandingPage(target: ExactSiteGtmTarget): string {
  return clean(target.artifact?.hostedReviewPath) || "/product";
}

function landingPageForTarget(target: ExactSiteGtmTarget): string {
  return target.track === "proof_ready_outreach"
    ? proofReadyLandingPage(target)
    : demandSourcedLandingPage(target);
}

function proofSourceForTarget(target: ExactSiteGtmTarget): string {
  const artifactPath = clean(target.artifact?.path) || "missing artifact path";
  if (target.track === "proof_ready_outreach") {
    return [
      `Labeled hosted-review proof at ${artifactPath}.`,
      target.artifact?.hostedReviewPath ? `Hosted review handoff: ${target.artifact.hostedReviewPath}.` : null,
      target.artifact?.siteWorldId ? `Site-world id: ${target.artifact.siteWorldId}.` : null,
      "Use as representative proof shape only; do not claim recipient/customer-specific proof.",
    ].filter(Boolean).join(" ");
  }

  return [
    `Draft opportunity brief at ${artifactPath}.`,
    "No hosted review or site-world package exists for this target yet.",
    "Use only to ask which site/workflow should be captured first.",
  ].join(" ");
}

function blockedClaimsForTarget(target: ExactSiteGtmTarget): string[] {
  const claims = [
    "No live send, reply, hosted-review start, qualified call, customer traction, paid spend, sender durability, or dispatch authorization is approved by this packet.",
    "No pricing, legal, privacy, rights, permission, readiness, deployment, or guaranteed support commitment is approved by this packet.",
  ];

  if (target.track === "proof_ready_outreach") {
    claims.push("Do not present the sample review as the recipient's site, a customer result, or a deployment outcome.");
  } else {
    claims.push("Do not imply a hosted review, site-world package, package access, or capture evidence already exists for this target.");
  }

  if (target.recipient?.email) {
    claims.push("Recipient-backed evidence proves the address source only; it does not prove buyer intent or permission to make unsupported claims.");
  }

  return claims;
}

function reviewFlagsForTarget(target: ExactSiteGtmTarget): string[] {
  const flags: string[] = [];
  if (target.track === "demand_sourced_capture") {
    flags.push("capture ask only; no hosted-review claim");
  }
  if (target.artifact.status === "draft") {
    flags.push("artifact is a draft opportunity brief");
  }
  if (isPublicOrGeneralInbox(target)) {
    flags.push("public/general inbox; expect routing friction");
  } else if (target.recipient?.email) {
    flags.push("recipient-backed address; still first-send approval gated");
  }
  return flags;
}

function proofReadyDraft(target: ExactSiteGtmTarget, landingPage: string): Pick<ExactSiteFirstTouchReview, "proposedSubject" | "proposedBody" | "draftAngle" | "cta" | "objectionPlan"> {
  const siteLabel = clean(target.artifact?.hostedReviewPath) || clean(target.artifact?.siteWorldId) || "a labeled hosted-review sample";
  const proposedSubject = `Labeled exact-site review for ${target.buyerSegment}`;
  const proposedBody = [
    "Hi,",
    "",
    "I am building Blueprint, a capture-backed way for robot teams to inspect real sites before committing people, simulation time, or deployment planning.",
    "",
    `For ${target.organizationName}, I saw this signal: ${firstIntentSignal(target)}.`,
    `The closest current artifact is ${siteLabel}. It is representative proof shape, not ${possessiveName(target.organizationName)} site, not a customer result, and not deployment proof.`,
    "",
    `Would it be useful to inspect it and tell me what exact site or workflow would make the review relevant for your ${target.buyerSegment.toLowerCase()}?`,
    "",
    landingPage,
    "",
    "Nijel",
  ].join("\n");

  return {
    proposedSubject,
    proposedBody,
    draftAngle:
      "Invite the recipient to inspect a labeled exact-site hosted review, then ask what site or workflow would make the review more relevant.",
    cta: "Inspect the review, then name the more relevant site or workflow.",
    objectionPlan:
      "If they say the sample is not their site, ask for the exact workflow to capture next and keep the sample labeled as representative proof shape.",
  };
}

function demandSourcedDraft(target: ExactSiteGtmTarget, landingPage: string): Pick<ExactSiteFirstTouchReview, "proposedSubject" | "proposedBody" | "draftAngle" | "cta" | "objectionPlan"> {
  const requestedSiteType = clean(target.captureAsk?.requestedSiteType) || "site";
  const requestedCity = clean(target.captureAsk?.requestedCity || target.city);
  const sitePhrase = requestedCity ? `${requestedSiteType} in ${requestedCity}` : requestedSiteType;
  const proposedSubject = `What exact ${target.buyerSegment} site should Blueprint capture next?`;
  const proposedBody = [
    "Hi,",
    "",
    "I am building Blueprint, a capture-backed way for robot teams to turn real sites into Task Evaluation Runs, Policy Improvement Runs, and hosted review sessions.",
    "",
    `For ${target.organizationName}, I do not want to guess the wrong environment. If Blueprint captured one ${sitePhrase} for your team first, what exact site or workflow should we start with?`,
    "",
    `The request path is prefilled here: ${landingPage}`,
    "",
    "Do not imply a hosted review exists yet; this row is only asking which exact site or workflow should be captured first.",
    "",
    "This is a capture ask only. No hosted review, site-world package, package access, or capture evidence exists for this target yet, and I will not claim availability before the site is captured and reviewed.",
    "",
    "Nijel",
  ].join("\n");

  return {
    proposedSubject,
    proposedBody,
    draftAngle:
      "Ask which site or workflow Blueprint should capture first; do not imply that a hosted review already exists for this row.",
    cta: "Name the site or workflow worth capturing first.",
    objectionPlan:
      "If they ask for a hosted review first, offer only labeled sample proof or state that a new capture is needed before a buyer-specific review exists.",
  };
}

export function buildExactSiteFirstTouchReview(target: ExactSiteGtmTarget): ExactSiteFirstTouchReview {
  const landingPage = landingPageForTarget(target);
  const draft = target.track === "proof_ready_outreach"
    ? proofReadyDraft(target, landingPage)
    : demandSourcedDraft(target, landingPage);

  return {
    ...draft,
    landingPage,
    proofSource: proofSourceForTarget(target),
    blockedClaims: blockedClaimsForTarget(target),
    reviewFlags: reviewFlagsForTarget(target),
    reviewerPrompt:
      "Approve, edit, or reject this exact first-touch copy. Approval here does not authorize live dispatch.",
  };
}
