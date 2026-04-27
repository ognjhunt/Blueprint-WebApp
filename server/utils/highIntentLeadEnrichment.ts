import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest, RequestedLane } from "../types/inbound-request";
import { listCityLaunchActivations, type CityLaunchActivationRecord } from "./cityLaunchLedgers";
import { slugifyCityName } from "./cityLaunchProfiles";
import {
  createPaperclipIssueComment,
  resetPaperclipAgentSession,
  upsertPaperclipIssue,
  wakePaperclipAgent,
} from "./paperclip";

const DOSSIER_COLLECTION = "leadEnrichmentDossiers";
const PAPERCLIP_PROJECT_NAME = "blueprint-webapp";
const ORIGIN_KIND = "high_intent_lead_enrichment";

const HIGH_INTENT_ROBOT_LANES: RequestedLane[] = [
  "deeper_evaluation",
  "data_licensing",
  "managed_tuning",
];

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

type LeadClassification =
  | "robot_team_buyer"
  | "site_operator"
  | "capturer_supply"
  | "city_launch_interest"
  | "partner"
  | "low_signal";

type LeadTriggerKind =
  | "inbound_robot_team_high_intent"
  | "inbound_site_operator_specific"
  | "waitlist_active_city_signal"
  | "waitlist_city_demand_aggregate"
  | "not_eligible";

type LeadOwnerAgent =
  | "intake-agent"
  | "buyer-solutions-agent"
  | "robot-team-growth-agent"
  | "site-operator-partnership-agent"
  | "city-demand-agent";

type EvidenceLabel = "evidence" | "inference" | "open_question";

export type LeadEnrichmentEvidenceItem = {
  source:
    | "submitted_form"
    | "derived_domain"
    | "public_company_page"
    | "city_launch_activation"
    | "policy_guardrail";
  label: EvidenceLabel;
  summary: string;
  url?: string | null;
};

export type LeadEnrichmentDecision = {
  eligible: boolean;
  triggerKind: LeadTriggerKind;
  triggerReasons: string[];
  classification: LeadClassification;
  ownerAgent: LeadOwnerAgent;
  relatedAgents: LeadOwnerAgent[];
  confidence: number;
  noLiveSend: true;
  skipReason?: string | null;
};

export type LeadEnrichmentDossier = {
  schema_version: "2026-04-27.high-intent-lead-enrichment.v1";
  source_collection: "inboundRequests" | "waitlistSubmissions";
  source_doc_id: string;
  dossier_id: string;
  status: "draft_ready" | "aggregate_only";
  classification: LeadClassification;
  trigger_kind: LeadTriggerKind;
  trigger_reasons: string[];
  owner_agent: LeadOwnerAgent;
  related_agents: LeadOwnerAgent[];
  company: {
    name: string | null;
    domain: string | null;
    website: string | null;
    submitted_role: string | null;
  };
  submitted_context: Record<string, unknown>;
  public_research_plan: {
    mode: "company_domain_only";
    blocked_person_research: true;
    suggested_queries: string[];
  };
  evidence: LeadEnrichmentEvidenceItem[];
  draft_follow_up: {
    requires_human_approval: true;
    subject: string;
    body: string;
    allowed_claims: string[];
    blocked_claims: string[];
  } | null;
  next_actions: string[];
  guardrails: string[];
  created_at_iso: string;
  updated_at_iso: string;
};

export type LeadEnrichmentRunResult = {
  eligible: boolean;
  status: "draft_ready" | "aggregate_only" | "skipped" | "failed";
  dossierId: string | null;
  ownerAgent: LeadOwnerAgent | null;
  paperclipIssueId: string | null;
  paperclipIssueIdentifier: string | null;
  paperclipWakeStatus: string | null;
  error: string | null;
  reason: string | null;
};

type WaitlistLeadSignalInput = {
  submissionId: string;
  email: string;
  market: string;
  role: string;
  locationType: string;
  device: string;
  company: string;
  notes: string;
  source: string;
};

function isTruthyFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isFalsyFlag(value: string | undefined) {
  return ["0", "false", "no", "off"].includes(String(value || "").trim().toLowerCase());
}

function shouldDispatchPaperclipHandoff() {
  const explicit = process.env.BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED;
  if (isFalsyFlag(explicit)) return false;
  if (isTruthyFlag(explicit)) return true;

  return Boolean(
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID?.trim()
      || process.env.PAPERCLIP_API_URL?.trim()
      || process.env.PAPERCLIP_API_KEY?.trim(),
  );
}

function stableDossierId(sourceCollection: string, sourceDocId: string) {
  const hash = crypto
    .createHash("sha256")
    .update(`${sourceCollection}:${sourceDocId}`)
    .digest("hex")
    .slice(0, 16);
  return `${sourceCollection}_${hash}`;
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim();
}

function containsAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function emailDomain(email: string | null | undefined) {
  const domain = normalize(email).toLowerCase().split("@")[1] || "";
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return null;
  }
  return domain;
}

function publicFetchTimeoutMs() {
  const parsed = Number(process.env.BLUEPRINT_LEAD_ENRICHMENT_PUBLIC_FETCH_TIMEOUT_MS || "2500");
  if (!Number.isFinite(parsed) || parsed <= 0) return 2500;
  return Math.min(parsed, 5000);
}

function publicCompanyFetchEnabled() {
  return !isFalsyFlag(process.env.BLUEPRINT_LEAD_ENRICHMENT_PUBLIC_FETCH_ENABLED);
}

function sanitizeSnippet(value: string | null | undefined, maxLength = 240) {
  return normalize(value)
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function extractHtmlTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return sanitizeSnippet(decodeHtmlEntities(match?.[1] || ""), 120);
}

function extractMetaDescription(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (!/\bname\s*=\s*["']description["']/i.test(tag) && !/\bproperty\s*=\s*["']og:description["']/i.test(tag)) {
      continue;
    }
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return sanitizeSnippet(decodeHtmlEntities(content), 220);
  }
  return "";
}

async function fetchPublicCompanyEvidence(domain: string | null): Promise<LeadEnrichmentEvidenceItem[]> {
  if (!domain || !publicCompanyFetchEnabled() || typeof fetch !== "function") {
    return [];
  }

  const url = `https://${domain}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), publicFetchTimeoutMs());
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "BlueprintLeadEnrichment/1.0 (+https://tryblueprint.io)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return [{
        source: "public_company_page",
        label: "open_question",
        summary: `Could not fetch a public company homepage snapshot from ${domain}; HTTP ${response.status}.`,
        url,
      }];
    }

    const html = (await response.text()).slice(0, 250_000);
    const title = extractHtmlTitle(html);
    const description = extractMetaDescription(html);
    const parts = [
      title ? `title: ${title}` : "",
      description ? `description: ${description}` : "",
    ].filter(Boolean);

    return [{
      source: "public_company_page",
      label: parts.length ? "evidence" : "open_question",
      summary: parts.length
        ? `Public company homepage snapshot for ${domain}: ${parts.join("; ")}`
        : `Fetched ${domain}, but no title or description metadata was found.`,
      url: response.url || url,
    }];
  } catch (error) {
    return [{
      source: "public_company_page",
      label: "open_question",
      summary: `Public company homepage snapshot for ${domain} was unavailable: ${error instanceof Error ? error.message : String(error)}.`,
      url,
    }];
  } finally {
    clearTimeout(timeout);
  }
}

function siteOperatorHasSpecificSignal(request: InboundRequest) {
  const siteName = normalize(request.request.siteName);
  const siteLocation = normalize(request.request.siteLocation);
  if (!siteName || !siteLocation) {
    return false;
  }

  const explicitFields = [
    request.request.captureRights,
    request.request.derivedScenePermission,
    request.request.datasetLicensingPermission,
    request.request.humanGateTopics,
    request.request.operatingConstraints,
    request.request.privacySecurityConstraints,
    request.request.details,
    request.request.workflowContext,
  ]
    .map((value) => normalize(value))
    .join(" ");

  return containsAny(explicitFields, [
    "right",
    "permission",
    "access",
    "operator",
    "owner",
    "commercial",
    "license",
    "privacy",
    "security",
    "consent",
  ]);
}

function robotTeamHasHighIntent(request: InboundRequest) {
  return request.request.buyerType === "robot_team" && (
    request.request.proofPathPreference === "exact_site_required"
      || request.growth_wedge === "exact_site_hosted_review"
      || request.ops_automation?.queue === "exact_site_hosted_review_queue"
      || request.request.requestedLanes.some((lane) => HIGH_INTENT_ROBOT_LANES.includes(lane))
  );
}

function ownerForInbound(request: InboundRequest): LeadOwnerAgent {
  if (request.request.buyerType === "site_operator") {
    return "site-operator-partnership-agent";
  }
  if (
    request.request.proofPathPreference === "exact_site_required"
    || request.request.requestedLanes.includes("deeper_evaluation")
    || request.request.requestedLanes.includes("managed_tuning")
  ) {
    return "buyer-solutions-agent";
  }
  return "robot-team-growth-agent";
}

function relatedAgentsForInbound(request: InboundRequest, ownerAgent: LeadOwnerAgent): LeadOwnerAgent[] {
  const related = new Set<LeadOwnerAgent>(["intake-agent", ownerAgent]);
  if (request.request.buyerType === "robot_team") related.add("robot-team-growth-agent");
  if (request.request.buyerType === "site_operator") related.add("site-operator-partnership-agent");
  if (request.context?.demandCity) related.add("city-demand-agent");
  return [...related].filter((agent) => agent !== ownerAgent);
}

export function evaluateInboundLeadEnrichment(request: InboundRequest): LeadEnrichmentDecision {
  const triggerReasons: string[] = [];

  if (robotTeamHasHighIntent(request)) {
    if (request.request.proofPathPreference === "exact_site_required") {
      triggerReasons.push("robot team requested exact-site proof");
    }
    for (const lane of request.request.requestedLanes) {
      if (HIGH_INTENT_ROBOT_LANES.includes(lane)) {
        triggerReasons.push(`robot team requested ${lane}`);
      }
    }
    if (request.growth_wedge === "exact_site_hosted_review") {
      triggerReasons.push("request is in the Exact-Site Hosted Review wedge");
    }
    const ownerAgent = ownerForInbound(request);
    return {
      eligible: true,
      triggerKind: "inbound_robot_team_high_intent",
      triggerReasons: [...new Set(triggerReasons)],
      classification: "robot_team_buyer",
      ownerAgent,
      relatedAgents: relatedAgentsForInbound(request, ownerAgent),
      confidence: 0.88,
      noLiveSend: true,
      skipReason: null,
    };
  }

  if (request.request.buyerType === "site_operator" && siteOperatorHasSpecificSignal(request)) {
    const ownerAgent = ownerForInbound(request);
    return {
      eligible: true,
      triggerKind: "inbound_site_operator_specific",
      triggerReasons: ["site operator provided a specific site plus access, rights, privacy, or commercialization context"],
      classification: "site_operator",
      ownerAgent,
      relatedAgents: relatedAgentsForInbound(request, ownerAgent),
      confidence: 0.82,
      noLiveSend: true,
      skipReason: null,
    };
  }

  return {
    eligible: false,
    triggerKind: "not_eligible",
    triggerReasons: [],
    classification: "low_signal",
    ownerAgent: "intake-agent",
    relatedAgents: [],
    confidence: 0.2,
    noLiveSend: true,
    skipReason: "request did not match the high-intent robot-team or specific site-operator trigger rules",
  };
}

function buildCompanyResearchQueries(company: string | null, domain: string | null, context: string[]) {
  const seed = domain || company;
  if (!seed) return [];
  const suffix = context.filter(Boolean).join(" ");
  return [
    `${seed} robotics autonomy simulation site-specific data`,
    `${seed} warehouse robot evaluation digital twin`,
    suffix ? `${seed} ${suffix}` : `${seed} Blueprint exact-site hosted review fit`,
  ].slice(0, 3);
}

function buildInboundEvidence(request: InboundRequest, companyDomain: string | null): LeadEnrichmentEvidenceItem[] {
  const evidence: LeadEnrichmentEvidenceItem[] = [
    {
      source: "submitted_form",
      label: "evidence",
      summary: `${request.contact.company} submitted a ${request.request.buyerType} request for: ${request.request.taskStatement}`,
    },
  ];

  if (request.request.siteName || request.request.siteLocation) {
    evidence.push({
      source: "submitted_form",
      label: "evidence",
      summary: `Submitted site context: ${[request.request.siteName, request.request.siteLocation].filter(Boolean).join(" / ")}`,
    });
  }

  if (request.request.proofPathPreference) {
    evidence.push({
      source: "submitted_form",
      label: "evidence",
      summary: `Submitted proof-path preference: ${request.request.proofPathPreference}`,
    });
  }

  if (companyDomain) {
    evidence.push({
      source: "derived_domain",
      label: "inference",
      summary: `Company domain derived from submitter email: ${companyDomain}. This is enrichment context, not proof of buyer authority.`,
      url: `https://${companyDomain}`,
    });
  } else {
    evidence.push({
      source: "derived_domain",
      label: "open_question",
      summary: "No company domain was safely derived because the submitter used a public or malformed email domain.",
    });
  }

  evidence.push({
    source: "policy_guardrail",
    label: "evidence",
    summary: "This loop researches company/domain context only; person-level social profiling and guessed contacts are blocked.",
  });

  return evidence;
}

function buildDraftFollowUp(input: {
  firstName: string;
  company: string | null;
  classification: LeadClassification;
  siteName: string | null;
  taskStatement: string | null;
  proofPathPreference?: string | null;
}) {
  const salutation = input.firstName || "there";
  const companyLine = input.company ? ` for ${input.company}` : "";
  const siteLine = input.siteName ? ` around ${input.siteName}` : "";
  const taskLine = input.taskStatement ? `, especially ${input.taskStatement}` : "";

  if (input.classification === "site_operator") {
    return {
      requires_human_approval: true as const,
      subject: `Blueprint follow-up${siteLine || companyLine}`,
      body: [
        `Hi ${salutation},`,
        "",
        `Thanks for sharing the site context${siteLine}${taskLine}. Before we suggest a capture or hosted-review path, we should confirm the access, rights, and privacy boundaries for the exact areas you want covered.`,
        "",
        "Could you reply with the specific areas that are in scope, any areas that should be avoided, and whether Blueprint can use the resulting site package for buyer-facing hosted review?",
        "",
        "We will keep the next step bounded to the evidence you provided.",
      ].join("\n"),
      allowed_claims: [
        "Blueprint received the submitted site/operator context.",
        "Blueprint needs access, rights, privacy, and in-scope area confirmation before any downstream package claim.",
      ],
      blocked_claims: [
        "Do not claim site permission is already granted.",
        "Do not quote price, promise delivery timing, or make commercialization commitments.",
      ],
    };
  }

  if (input.classification === "capturer_supply") {
    return {
      requires_human_approval: true as const,
      subject: `Blueprint city capture follow-up${companyLine}`,
      body: [
        `Hi ${salutation},`,
        "",
        `Thanks for sharing the capture context${siteLine}. Before we route this into an active city launch, we should confirm the device, area, and lawful capture posture for the site types you can cover.`,
        "",
        "Could you reply with the exact city/area, capture device, and any access limits or site types you should avoid?",
        "",
        "We will keep the next step grounded to submitted evidence and active launch needs.",
      ].join("\n"),
      allowed_claims: [
        "Blueprint received the submitted capture interest.",
        "Blueprint needs device, area, and lawful capture posture confirmation before approving supply work.",
      ],
      blocked_claims: [
        "Do not approve the capturer or promise paid work.",
        "Do not claim the city is publicly launched unless launch state is source-backed.",
      ],
    };
  }

  return {
    requires_human_approval: true as const,
    subject: `Blueprint exact-site review follow-up${companyLine}`,
    body: [
      `Hi ${salutation},`,
      "",
      `Thanks for sharing the workflow context${taskLine}. The useful next step is to pin the exact site/workflow you want reviewed and confirm what evidence your team needs before a hosted review would be credible.`,
      "",
      "Could you reply with the target site type or exact site, the workflow lane you care about, and whether exact-site proof is required or an adjacent site is acceptable?",
      "",
      "We will keep the review grounded to submitted or source-backed evidence only.",
    ].join("\n"),
    allowed_claims: [
      "Blueprint received the submitted robot-team request.",
      "Blueprint can prepare a follow-up around exact-site proof needs once the site/workflow is clear.",
    ],
    blocked_claims: [
      "Do not claim Blueprint has already validated the buyer or site.",
      "Do not imply a hosted review, package, price, or delivery date is approved.",
    ],
  };
}

async function buildInboundDossier(request: InboundRequest, decision: LeadEnrichmentDecision): Promise<LeadEnrichmentDossier> {
  const domain = emailDomain(request.contact.email);
  const dossierId = stableDossierId("inboundRequests", request.requestId);
  const nowIso = new Date().toISOString();
  const contextTerms = [
    request.request.targetSiteType || "",
    request.request.siteLocation || "",
    request.request.taskStatement || "",
  ];

  return {
    schema_version: "2026-04-27.high-intent-lead-enrichment.v1",
    source_collection: "inboundRequests",
    source_doc_id: request.requestId,
    dossier_id: dossierId,
    status: "draft_ready",
    classification: decision.classification,
    trigger_kind: decision.triggerKind,
    trigger_reasons: decision.triggerReasons,
    owner_agent: decision.ownerAgent,
    related_agents: decision.relatedAgents,
    company: {
      name: request.contact.company || null,
      domain,
      website: domain ? `https://${domain}` : null,
      submitted_role: request.contact.roleTitle || null,
    },
    submitted_context: {
      buyer_type: request.request.buyerType,
      requested_lanes: request.request.requestedLanes,
      proof_path_preference: request.request.proofPathPreference || null,
      site_name: request.request.siteName || null,
      site_location: request.request.siteLocation || null,
      task_statement: request.request.taskStatement || null,
      target_site_type: request.request.targetSiteType || null,
      demand_city: request.context?.demandCity || null,
      source_page_url: request.context?.sourcePageUrl || null,
    },
    public_research_plan: {
      mode: "company_domain_only",
      blocked_person_research: true,
      suggested_queries: buildCompanyResearchQueries(request.contact.company || null, domain, contextTerms),
    },
    evidence: [
      ...buildInboundEvidence(request, domain),
      ...(await fetchPublicCompanyEvidence(domain)),
    ],
    draft_follow_up: buildDraftFollowUp({
      firstName: request.contact.firstName,
      company: request.contact.company,
      classification: decision.classification,
      siteName: request.request.siteName,
      taskStatement: request.request.taskStatement,
      proofPathPreference: request.request.proofPathPreference,
    }),
    next_actions: [
      "Review the dossier and draft before any external send.",
      "Verify company/domain context with public sources before relying on it in buyer prep.",
      "Route exact-site proof, rights, privacy, pricing, or commercial questions to the owner agent/human lane.",
    ],
    guardrails: LEAD_ENRICHMENT_GUARDRAILS,
    created_at_iso: nowIso,
    updated_at_iso: nowIso,
  };
}

const LEAD_ENRICHMENT_GUARDRAILS = [
  "No invented contacts or guessed email addresses.",
  "No person-level social profiling unless the submitter explicitly provided the profile or context.",
  "No automated live outreach to third parties who did not submit the form.",
  "No public/company claims unless backed by submitted or public source evidence.",
  "Research outputs are evidence context, not source-of-truth approval, readiness, pricing, rights, or delivery state.",
  "All drafted external messages require human approval in phase 1.",
];

function buildPaperclipDescription(dossier: LeadEnrichmentDossier) {
  return [
    `# High-intent lead enrichment: ${dossier.company.name || dossier.source_doc_id}`,
    "",
    "A high-intent website input matched the draft-first enrichment rules.",
    "",
    "Source:",
    `- collection: ${dossier.source_collection}`,
    `- document: ${dossier.source_doc_id}`,
    `- dossier: ${DOSSIER_COLLECTION}/${dossier.dossier_id}`,
    "",
    "Classification:",
    `- class: ${dossier.classification}`,
    `- trigger: ${dossier.trigger_kind}`,
    `- owner: ${dossier.owner_agent}`,
    `- related agents: ${dossier.related_agents.join(", ") || "none"}`,
    "",
    "Evidence:",
    ...dossier.evidence.map((item) => `- [${item.label}] ${item.summary}${item.url ? ` (${item.url})` : ""}`),
    "",
    "Draft status:",
    "- A personalized follow-up draft exists in the dossier.",
    "- Live send is blocked until human approval.",
    "",
    "Next actions:",
    ...dossier.next_actions.map((action) => `- ${action}`),
    "",
    "Guardrails:",
    ...dossier.guardrails.map((guardrail) => `- ${guardrail}`),
  ].join("\n");
}

async function dispatchPaperclipHandoff(dossier: LeadEnrichmentDossier) {
  if (!shouldDispatchPaperclipHandoff() || dossier.status !== "draft_ready") {
    return {
      issueId: null,
      issueIdentifier: null,
      wakeStatus: null,
    };
  }

  const issue = await upsertPaperclipIssue({
    projectName: PAPERCLIP_PROJECT_NAME,
    assigneeKey: dossier.owner_agent,
    title: `Review high-intent lead: ${dossier.company.name || dossier.source_doc_id}`,
    description: buildPaperclipDescription(dossier),
    priority: dossier.classification === "robot_team_buyer" ? "high" : "medium",
    status: "todo",
    originKind: ORIGIN_KIND,
    originId: dossier.dossier_id,
  });

  await createPaperclipIssueComment(
    issue.issue.id,
    [
      `Lead enrichment dossier is ready: ${DOSSIER_COLLECTION}/${dossier.dossier_id}.`,
      "Do not send the draft externally until a human approves it.",
    ].join("\n"),
  ).catch(() => undefined);

  let wakeStatus: string | null = null;
  if (issue.assigneeAgentId) {
    await resetPaperclipAgentSession(issue.assigneeAgentId, issue.issue.id, issue.companyId).catch(() => undefined);
    const wake = await wakePaperclipAgent({
      agentId: issue.assigneeAgentId,
      companyId: issue.companyId,
      reason: "high_intent_lead_enrichment_ready",
      idempotencyKey: `lead-enrichment:${dossier.dossier_id}:${dossier.updated_at_iso}`,
      payload: {
        dossierId: dossier.dossier_id,
        sourceCollection: dossier.source_collection,
        sourceDocId: dossier.source_doc_id,
        classification: dossier.classification,
        noLiveSend: true,
      },
    }).catch((error) => ({
      status: "wakeup_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    wakeStatus = wake?.status || null;
  }

  return {
    issueId: issue.issue.id,
    issueIdentifier: issue.issue.identifier || null,
    wakeStatus,
  };
}

async function persistDossier(dossier: LeadEnrichmentDossier) {
  if (!db) {
    throw new Error("Database not available");
  }
  await db.collection(DOSSIER_COLLECTION).doc(dossier.dossier_id).set(
    {
      ...dossier,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function runHighIntentLeadEnrichmentForRequest(
  request: InboundRequest,
): Promise<LeadEnrichmentRunResult> {
  const decision = evaluateInboundLeadEnrichment(request);
  if (!decision.eligible) {
    return {
      eligible: false,
      status: "skipped",
      dossierId: null,
      ownerAgent: null,
      paperclipIssueId: null,
      paperclipIssueIdentifier: null,
      paperclipWakeStatus: null,
      error: null,
      reason: decision.skipReason || "not eligible",
    };
  }

  if (!db) {
    return {
      eligible: true,
      status: "failed",
      dossierId: null,
      ownerAgent: decision.ownerAgent,
      paperclipIssueId: null,
      paperclipIssueIdentifier: null,
      paperclipWakeStatus: null,
      error: "Database not available",
      reason: "database_unavailable",
    };
  }

  try {
    const dossier = await buildInboundDossier(request, decision);
    await persistDossier(dossier);
    const handoff = await dispatchPaperclipHandoff(dossier).catch((error) => ({
      issueId: null,
      issueIdentifier: null,
      wakeStatus: null,
      error: error instanceof Error ? error.message : String(error),
    }));

    await db.collection("inboundRequests").doc(request.requestId).set(
      {
        lead_enrichment: {
          status: "draft_ready",
          dossier_ref: `${DOSSIER_COLLECTION}/${dossier.dossier_id}`,
          classification: dossier.classification,
          trigger_kind: dossier.trigger_kind,
          owner_agent: dossier.owner_agent,
          related_agents: dossier.related_agents,
          no_live_send: true,
          draft_requires_human_approval: true,
          paperclip_issue_id: handoff.issueId,
          paperclip_issue_identifier: handoff.issueIdentifier,
          paperclip_wake_status: handoff.wakeStatus,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    return {
      eligible: true,
      status: "draft_ready",
      dossierId: dossier.dossier_id,
      ownerAgent: dossier.owner_agent,
      paperclipIssueId: handoff.issueId,
      paperclipIssueIdentifier: handoff.issueIdentifier,
      paperclipWakeStatus: handoff.wakeStatus,
      error: "error" in handoff && typeof handoff.error === "string" ? handoff.error : null,
      reason: null,
    };
  } catch (error) {
    return {
      eligible: true,
      status: "failed",
      dossierId: null,
      ownerAgent: decision.ownerAgent,
      paperclipIssueId: null,
      paperclipIssueIdentifier: null,
      paperclipWakeStatus: null,
      error: error instanceof Error ? error.message : String(error),
      reason: "execution_failed",
    };
  }
}

function classifyWaitlistLead(input: WaitlistLeadSignalInput): LeadClassification {
  const role = input.role.toLowerCase();
  const joined = `${input.role} ${input.notes} ${input.company}`.toLowerCase();
  if (role.includes("capturer")) return "capturer_supply";
  if (containsAny(joined, ["operator", "owner", "facility", "site"])) return "site_operator";
  if (containsAny(joined, ["robot", "autonomy", "simulation"])) return "robot_team_buyer";
  if (containsAny(joined, ["partner", "channel", "community"])) return "partner";
  return "city_launch_interest";
}

function isStrongCapturerSupplySignal(input: WaitlistLeadSignalInput) {
  const joined = `${input.device} ${input.notes} ${input.locationType}`.toLowerCase();
  return containsAny(joined, ["lidar", "iphone 15 pro", "iphone 16 pro", "matterport", "commercial", "warehouse", "facility"])
    || normalize(input.notes).length >= 80;
}

function matchActivation(input: WaitlistLeadSignalInput, activations: CityLaunchActivationRecord[]) {
  const marketSlug = slugifyCityName(input.market);
  return activations.find((activation) => {
    const cityName = activation.city.toLowerCase().split(",")[0].trim();
    return activation.citySlug === marketSlug || input.market.toLowerCase().includes(cityName);
  }) || null;
}

function isActiveOrNearActivation(activation: CityLaunchActivationRecord | null) {
  if (!activation) return false;
  return activation.status !== "planning" || activation.founderApproved === true;
}

async function buildWaitlistDossier(
  input: WaitlistLeadSignalInput,
  activation: CityLaunchActivationRecord,
): Promise<LeadEnrichmentDossier> {
  const classification = classifyWaitlistLead(input);
  const dossierId = stableDossierId("waitlistSubmissions", input.submissionId);
  const nowIso = new Date().toISOString();
  const domain = emailDomain(input.email);
  const ownerAgent: LeadOwnerAgent =
    classification === "capturer_supply" ? "intake-agent" : "city-demand-agent";

  return {
    schema_version: "2026-04-27.high-intent-lead-enrichment.v1",
    source_collection: "waitlistSubmissions",
    source_doc_id: input.submissionId,
    dossier_id: dossierId,
    status: "draft_ready",
    classification,
    trigger_kind: "waitlist_active_city_signal",
    trigger_reasons: [
      `${input.market} matches city-launch activation ${activation.city} in status ${activation.status}`,
      ...(classification === "capturer_supply" && isStrongCapturerSupplySignal(input)
        ? ["capturer supplied a strong device/location/note signal"]
        : []),
    ],
    owner_agent: ownerAgent,
    related_agents: ownerAgent === "intake-agent" ? ["city-demand-agent"] : ["intake-agent"],
    company: {
      name: input.company || null,
      domain,
      website: domain ? `https://${domain}` : null,
      submitted_role: input.role || null,
    },
    submitted_context: {
      market: input.market,
      role: input.role || null,
      location_type: input.locationType || null,
      device: input.device || null,
      source: input.source || null,
      city_activation_status: activation.status,
      city_activation_root_issue_id: activation.rootIssueId,
    },
    public_research_plan: {
      mode: "company_domain_only",
      blocked_person_research: true,
      suggested_queries: buildCompanyResearchQueries(input.company || null, domain, [
        input.market,
        input.locationType,
        input.role,
      ]),
    },
    evidence: [
      {
        source: "submitted_form",
        label: "evidence",
        summary: `Waitlist submission for ${input.market || "unknown market"} with role ${input.role || "unknown"}.`,
      },
      {
        source: "city_launch_activation",
        label: "evidence",
        summary: `${activation.city} is ${activation.status}; the signal can be routed beyond passive city-demand aggregation.`,
      },
      {
        source: "policy_guardrail",
        label: "evidence",
        summary: "No live outreach is allowed from this dossier. Drafting and routing only.",
      },
      ...(await fetchPublicCompanyEvidence(domain)),
    ],
    draft_follow_up: classification === "capturer_supply"
      ? buildDraftFollowUp({
          firstName: "",
          company: input.company || null,
          classification,
          siteName: input.locationType || null,
          taskStatement: "capture supply for an active city launch",
        })
      : null,
    next_actions: [
      "Use this as a routing artifact, not as proof that the city is publicly launched.",
      "If the signal is buyer/operator-like, fold it into city-demand planning before any outreach.",
      "If the signal is capturer supply, intake should verify device, city, and lawful capture posture before approval.",
    ],
    guardrails: LEAD_ENRICHMENT_GUARDRAILS,
    created_at_iso: nowIso,
    updated_at_iso: nowIso,
  };
}

export async function runWaitlistLeadSignalRouting(
  input: WaitlistLeadSignalInput,
): Promise<LeadEnrichmentRunResult> {
  if (!db) {
    return {
      eligible: false,
      status: "skipped",
      dossierId: null,
      ownerAgent: null,
      paperclipIssueId: null,
      paperclipIssueIdentifier: null,
      paperclipWakeStatus: null,
      error: null,
      reason: "database_unavailable",
    };
  }

  const activations = await listCityLaunchActivations();
  const activation = matchActivation(input, activations);
  const activeOrNear = isActiveOrNearActivation(activation);
  const classification = classifyWaitlistLead(input);
  const isCapturer = classification === "capturer_supply";
  const strongCapturer = isStrongCapturerSupplySignal(input);

  if (!activation || !activeOrNear || (isCapturer && !strongCapturer && activation.status === "planning")) {
    await db.collection("waitlistSubmissions").doc(input.submissionId).set(
      {
        city_demand_signal: {
          status: "aggregated_only",
          reason: activation
            ? "city is not active or near activation"
            : "submitted market does not match a tracked city-launch activation",
          classification,
          market: input.market || null,
          no_live_send: true,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
    return {
      eligible: false,
      status: "aggregate_only",
      dossierId: null,
      ownerAgent: "city-demand-agent",
      paperclipIssueId: null,
      paperclipIssueIdentifier: null,
      paperclipWakeStatus: null,
      error: null,
      reason: "city_signal_aggregated_only",
    };
  }

  const dossier = await buildWaitlistDossier(input, activation);
  await persistDossier(dossier);
  const handoff = await dispatchPaperclipHandoff(dossier).catch((error) => ({
    issueId: null,
    issueIdentifier: null,
    wakeStatus: null,
    error: error instanceof Error ? error.message : String(error),
  }));

  await db.collection("waitlistSubmissions").doc(input.submissionId).set(
    {
      lead_enrichment: {
        status: "draft_ready",
        dossier_ref: `${DOSSIER_COLLECTION}/${dossier.dossier_id}`,
        classification: dossier.classification,
        trigger_kind: dossier.trigger_kind,
        owner_agent: dossier.owner_agent,
        related_agents: dossier.related_agents,
        no_live_send: true,
        draft_requires_human_approval: Boolean(dossier.draft_follow_up),
        paperclip_issue_id: handoff.issueId,
        paperclip_issue_identifier: handoff.issueIdentifier,
        paperclip_wake_status: handoff.wakeStatus,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  return {
    eligible: true,
    status: "draft_ready",
    dossierId: dossier.dossier_id,
    ownerAgent: dossier.owner_agent,
    paperclipIssueId: handoff.issueId,
    paperclipIssueIdentifier: handoff.issueIdentifier,
    paperclipWakeStatus: handoff.wakeStatus,
    error: "error" in handoff && typeof handoff.error === "string" ? handoff.error : null,
    reason: null,
  };
}
