import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type {
  ExactSiteGtmPilotLedger,
  ExactSiteGtmTarget,
} from "./exactSiteHostedReviewGtmPilot";
import {
  resolveHistoricalRecipientEvidence,
  resolveRepoArtifactRecipientEvidence,
} from "./cityLaunchRecipientEvidence";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export type GtmEnrichmentProviderKey =
  | "manual_human_supplied"
  | "repo_artifact"
  | "historical_campaign"
  | "governed_public_contact"
  | "inbound_dossier"
  | "clay_export";

export type GtmRecipientEvidenceType =
  | "explicit_research"
  | "historical_campaign"
  | "human_supplied";

export type GtmRecipientCandidate = {
  email: string;
  name?: string;
  role?: string;
  evidenceSource: string;
  evidenceType: GtmRecipientEvidenceType;
  providerKey: GtmEnrichmentProviderKey | string;
  confidence: "high" | "medium" | "low";
  discoveredAt: string;
  sourceUrl?: string;
  notes?: string;
};

export type GtmProviderRunRecord = {
  providerKey: string;
  status: "skipped" | "searched" | "contact_found" | "blocked" | "error";
  searchedAt: string;
  candidateCount: number;
  notes?: string;
  error?: string;
};

export type GtmEnrichmentTargetContext = {
  target: ExactSiteGtmTarget;
  ledger: ExactSiteGtmPilotLedger;
  ledgerPath?: string;
};

export type GtmEnrichmentProviderResult = {
  run: GtmProviderRunRecord;
  candidates: GtmRecipientCandidate[];
  blockers?: string[];
};

export type GtmEnrichmentProvider = {
  key: GtmEnrichmentProviderKey;
  enrich(context: GtmEnrichmentTargetContext): Promise<GtmEnrichmentProviderResult>;
};

export type GtmEnrichmentWaterfallResult = {
  ledger: ExactSiteGtmPilotLedger;
  summary: {
    targetsConsidered: number;
    targetsUpdated: number;
    candidatesAdded: number;
    selectedRecipients: number;
    providerRuns: number;
    blockers: number;
  };
  targetResults: Array<{
    targetId: string;
    organizationName: string;
    status: string;
    candidatesAdded: number;
    selectedRecipient: string | null;
    blockers: string[];
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLikelyPlaceholderEmail(value: string) {
  const normalized = value.toLowerCase();
  return normalized.endsWith("@example.com")
    || normalized.endsWith("@example.org")
    || normalized.endsWith("@test.com")
    || normalized.includes("placeholder")
    || normalized.includes("fake");
}

function candidateKey(candidate: Pick<GtmRecipientCandidate, "email" | "providerKey" | "evidenceSource">) {
  return `${normalizeEmail(candidate.email)}::${candidate.providerKey}::${candidate.evidenceSource}`;
}

function validCandidate(candidate: GtmRecipientCandidate) {
  return isValidEmail(candidate.email) && !isLikelyPlaceholderEmail(candidate.email);
}

function mergeCandidates(
  existing: GtmRecipientCandidate[],
  next: GtmRecipientCandidate[],
) {
  const merged = new Map(existing.map((candidate) => [candidateKey(candidate), candidate]));
  for (const candidate of next) {
    if (!validCandidate(candidate)) continue;
    merged.set(candidateKey(candidate), candidate);
  }
  return [...merged.values()];
}

function rankCandidates(candidates: GtmRecipientCandidate[]) {
  const confidenceWeight = { high: 3, medium: 2, low: 1 };
  const evidenceWeight: Record<GtmRecipientEvidenceType, number> = {
    human_supplied: 4,
    historical_campaign: 3,
    explicit_research: 2,
  };
  return [...candidates].sort((left, right) => {
    const score =
      (confidenceWeight[right.confidence] - confidenceWeight[left.confidence])
      || (evidenceWeight[right.evidenceType] - evidenceWeight[left.evidenceType]);
    if (score !== 0) return score;
    return right.discoveredAt.localeCompare(left.discoveredAt);
  });
}

function targetNames(target: ExactSiteGtmTarget) {
  return [
    target.organizationName,
    target.buyerSegment,
    target.workflowNeed,
  ].filter(Boolean);
}

function providerRun(
  providerKey: GtmEnrichmentProviderKey,
  status: GtmProviderRunRecord["status"],
  candidateCount: number,
  notes?: string,
  error?: string,
): GtmProviderRunRecord {
  return {
    providerKey,
    status,
    searchedAt: nowIso(),
    candidateCount,
    notes,
    error,
  };
}

function contactAllowedHosts() {
  const configured = process.env.BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS
    || process.env.BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS
    || "";
  return configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(url: URL, allowedHosts: string[]) {
  const hostname = url.hostname.toLowerCase();
  return allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function extractEmails(input: string) {
  const matches = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((entry) => entry.trim().toLowerCase()))]
    .filter((entry) => isValidEmail(entry) && !isLikelyPlaceholderEmail(entry));
}

function sourceUrlsForTarget(target: ExactSiteGtmTarget) {
  return [...new Set([
    ...(target.evidence.sourceUrls ?? []),
    target.artifact.hostedReviewPath,
  ].filter((entry): entry is string => Boolean(entry)))];
}

export function createManualHumanSuppliedProvider(): GtmEnrichmentProvider {
  return {
    key: "manual_human_supplied",
    async enrich({ target }) {
      if (
        !target.recipient?.email
        || target.recipient.evidenceType !== "human_supplied"
        || !target.recipient.evidenceSource
      ) {
        return {
          run: providerRun("manual_human_supplied", "skipped", 0, "No human-supplied selected recipient on target."),
          candidates: [],
        };
      }
      const candidate: GtmRecipientCandidate = {
        email: normalizeEmail(target.recipient.email),
        name: target.recipient.name,
        role: target.recipient.role,
        evidenceSource: target.recipient.evidenceSource,
        evidenceType: "human_supplied",
        providerKey: "manual_human_supplied",
        confidence: "high",
        discoveredAt: nowIso(),
      };
      return {
        run: providerRun("manual_human_supplied", "contact_found", 1, "Existing human-supplied recipient mirrored into enrichment candidates."),
        candidates: [candidate],
      };
    },
  };
}

export function createRepoArtifactProvider(): GtmEnrichmentProvider {
  return {
    key: "repo_artifact",
    async enrich({ target }) {
      const matches = await resolveRepoArtifactRecipientEvidence({
        targets: targetNames(target),
      });
      const candidates = [...matches.values()].map((match): GtmRecipientCandidate => ({
        email: normalizeEmail(match.recipientEmail),
        evidenceSource: match.source,
        evidenceType: "explicit_research",
        providerKey: "repo_artifact",
        confidence: "medium",
        discoveredAt: nowIso(),
      }));
      return {
        run: providerRun(
          "repo_artifact",
          candidates.length > 0 ? "contact_found" : "searched",
          candidates.length,
          "Searched repo issue updates and generated playbook contact-list artifacts.",
        ),
        candidates,
      };
    },
  };
}

export function createHistoricalCampaignProvider(): GtmEnrichmentProvider {
  return {
    key: "historical_campaign",
    async enrich({ target }) {
      if (process.env.BLUEPRINT_GTM_HISTORICAL_CAMPAIGN_ENRICHMENT !== "1") {
        return {
          run: providerRun("historical_campaign", "skipped", 0, "Historical campaign enrichment is disabled. Set BLUEPRINT_GTM_HISTORICAL_CAMPAIGN_ENRICHMENT=1 to query live campaign ledgers."),
          candidates: [],
        };
      }
      const matches = await resolveHistoricalRecipientEvidence({
        targets: targetNames(target),
      });
      const candidates = [...matches.values()].map((match): GtmRecipientCandidate => ({
        email: normalizeEmail(match.recipientEmail),
        evidenceSource: match.source,
        evidenceType: match.source.includes("growth campaign delivery evidence")
          ? "historical_campaign"
          : "explicit_research",
        providerKey: "historical_campaign",
        confidence: match.source.includes("growth campaign delivery evidence") ? "high" : "medium",
        discoveredAt: nowIso(),
      }));
      return {
        run: providerRun(
          "historical_campaign",
          candidates.length > 0 ? "contact_found" : "searched",
          candidates.length,
          "Searched historical campaign delivery evidence and repo-backed recipient records.",
        ),
        candidates,
      };
    },
  };
}

export function createGovernedPublicContactProvider(): GtmEnrichmentProvider {
  return {
    key: "governed_public_contact",
    async enrich({ target }) {
      const allowedHosts = contactAllowedHosts();
      if (allowedHosts.length === 0) {
        return {
          run: providerRun("governed_public_contact", "blocked", 0, "No allowlisted GTM contact discovery hosts are configured."),
          candidates: [],
          blockers: ["Set BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS before governed public contact discovery."],
        };
      }

      const candidates: GtmRecipientCandidate[] = [];
      for (const urlValue of sourceUrlsForTarget(target)) {
        try {
          const url = new URL(urlValue);
          if (!hostAllowed(url, allowedHosts)) continue;
          if (!/contact|email|reach|get-in-touch|team|people|staff|leadership|about|company/i.test(url.pathname)) {
            continue;
          }
          const response = await fetch(url.href, {
            headers: { "User-Agent": "Blueprint GTM contact discovery" },
          });
          if (!response.ok) continue;
          const text = await response.text();
          for (const email of extractEmails(text)) {
            candidates.push({
              email,
              evidenceSource: `Recipient sourced from explicit public contact evidence at ${url.href}.`,
              evidenceType: "explicit_research",
              providerKey: "governed_public_contact",
              confidence: /contact|email|reach|get-in-touch/i.test(url.pathname) ? "high" : "medium",
              discoveredAt: nowIso(),
              sourceUrl: url.href,
            });
          }
        } catch {
          continue;
        }
      }
      return {
        run: providerRun(
          "governed_public_contact",
          candidates.length > 0 ? "contact_found" : "searched",
          candidates.length,
          "Fetched explicit email evidence from allowlisted target source URLs.",
        ),
        candidates,
      };
    },
  };
}

export function createInboundDossierProvider(): GtmEnrichmentProvider {
  return {
    key: "inbound_dossier",
    async enrich({ target }) {
      if (
        process.env.BLUEPRINT_GTM_INBOUND_DOSSIER_ENRICHMENT !== "1"
        || !db
        || process.env.NODE_ENV === "test"
        || process.env.VITEST
      ) {
        return {
          run: providerRun("inbound_dossier", "skipped", 0, "Inbound dossier enrichment is disabled or Firestore is unavailable. Set BLUEPRINT_GTM_INBOUND_DOSSIER_ENRICHMENT=1 to query live lead dossiers."),
          candidates: [],
        };
      }
      const targetKey = normalizeComparableText(target.organizationName);
      const snapshot = await db.collection("leadEnrichmentDossiers")
        .orderBy("updated_at_iso", "desc")
        .limit(100)
        .get();
      const candidates: GtmRecipientCandidate[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>;
        const company = data.company && typeof data.company === "object"
          ? data.company as Record<string, unknown>
          : {};
        const companyText = normalizeComparableText([
          asString(company.name),
          asString(company.domain),
          asString(company.website),
        ].join(" "));
        if (!companyText.includes(targetKey) && !targetKey.includes(companyText)) continue;
        const submitted = data.submitted_context && typeof data.submitted_context === "object"
          ? data.submitted_context as Record<string, unknown>
          : {};
        for (const email of extractEmails(JSON.stringify(submitted))) {
          candidates.push({
            email,
            evidenceSource: `Recipient sourced from submitted high-intent lead dossier ${doc.id}.`,
            evidenceType: "human_supplied",
            providerKey: "inbound_dossier",
            confidence: "high",
            discoveredAt: nowIso(),
          });
        }
      }
      return {
        run: providerRun(
          "inbound_dossier",
          candidates.length > 0 ? "contact_found" : "searched",
          candidates.length,
          "Searched high-intent lead enrichment dossiers for submitted contact evidence.",
        ),
        candidates,
      };
    },
  };
}

export function createClayExportProvider(exportPath?: string): GtmEnrichmentProvider {
  return {
    key: "clay_export",
    async enrich({ target }) {
      const configuredPath = exportPath || process.env.BLUEPRINT_GTM_CLAY_EXPORT_PATH || "";
      if (!configuredPath) {
        return {
          run: providerRun("clay_export", "skipped", 0, "No Clay export path configured."),
          candidates: [],
        };
      }
      const resolvedPath = path.resolve(REPO_ROOT, configuredPath);
      const raw = await fs.readFile(resolvedPath, "utf8").catch(() => "");
      if (!raw.trim()) {
        return {
          run: providerRun("clay_export", "blocked", 0, `Clay export not readable at ${resolvedPath}.`),
          candidates: [],
          blockers: [`Clay export not readable at ${resolvedPath}.`],
        };
      }
      const rows = JSON.parse(raw) as Array<Record<string, unknown>>;
      const targetKey = normalizeComparableText(target.organizationName);
      const candidates = rows
        .filter((row) => normalizeComparableText([
          row.organizationName,
          row.company,
          row.domain,
        ].map(asString).join(" ")).includes(targetKey))
        .flatMap((row): GtmRecipientCandidate[] => {
          const email = normalizeEmail(asString(row.email) || asString(row.recipientEmail));
          if (!email) return [];
          return [{
            email,
            name: asString(row.name) || undefined,
            role: asString(row.role) || asString(row.title) || undefined,
            evidenceSource: asString(row.evidenceSource) || `Recipient candidate imported from Clay export ${path.relative(REPO_ROOT, resolvedPath)}.`,
            evidenceType: "explicit_research",
            providerKey: "clay_export",
            confidence: asString(row.confidence) === "high" ? "high" : "medium",
            discoveredAt: nowIso(),
            sourceUrl: asString(row.sourceUrl) || undefined,
          }];
        });
      return {
        run: providerRun(
          "clay_export",
          candidates.length > 0 ? "contact_found" : "searched",
          candidates.length,
          "Read provider-normalized Clay export without treating Clay as system of record.",
        ),
        candidates,
      };
    },
  };
}

export function createDefaultGtmEnrichmentProviders(options: {
  clayExportPath?: string;
} = {}): GtmEnrichmentProvider[] {
  return [
    createManualHumanSuppliedProvider(),
    createRepoArtifactProvider(),
    createHistoricalCampaignProvider(),
    createInboundDossierProvider(),
    createGovernedPublicContactProvider(),
    createClayExportProvider(options.clayExportPath),
  ];
}

export async function runGtmEnrichmentWaterfall(input: {
  ledger: ExactSiteGtmPilotLedger;
  ledgerPath?: string;
  targetIds?: string[];
  providerKeys?: string[];
  selectRecipients?: boolean;
  providers?: GtmEnrichmentProvider[];
}): Promise<GtmEnrichmentWaterfallResult> {
  const providers = input.providers ?? createDefaultGtmEnrichmentProviders();
  const targetFilter = new Set(input.targetIds ?? []);
  const providerFilter = new Set(input.providerKeys ?? []);
  const targetResults: GtmEnrichmentWaterfallResult["targetResults"] = [];
  let targetsUpdated = 0;
  let candidatesAdded = 0;
  let selectedRecipients = 0;
  let providerRuns = 0;
  let blockers = 0;

  const targets = input.ledger.targets.map((target) => {
    if (targetFilter.size > 0 && !targetFilter.has(target.id)) {
      return target;
    }

    return target;
  });

  for (const target of targets) {
    if (targetFilter.size > 0 && !targetFilter.has(target.id)) continue;
    const existingCandidates = target.enrichment?.recipientCandidates ?? [];
    const existingRuns = target.enrichment?.providerRuns ?? [];
    const targetBlockers = [...(target.enrichment?.blockers ?? [])];
    let nextCandidates = existingCandidates;
    let nextRuns = existingRuns;

    for (const provider of providers) {
      if (providerFilter.size > 0 && !providerFilter.has(provider.key)) continue;
      try {
        const result = await provider.enrich({
          target,
          ledger: input.ledger,
          ledgerPath: input.ledgerPath,
        });
        providerRuns++;
        nextRuns = [...nextRuns, result.run];
        const before = nextCandidates.length;
        nextCandidates = mergeCandidates(nextCandidates, result.candidates);
        candidatesAdded += Math.max(0, nextCandidates.length - before);
        if (result.blockers) {
          targetBlockers.push(...result.blockers);
          blockers += result.blockers.length;
        }
      } catch (error) {
        providerRuns++;
        const message = error instanceof Error ? error.message : String(error);
        nextRuns = [...nextRuns, providerRun(provider.key, "error", 0, undefined, message)];
        targetBlockers.push(`${provider.key}: ${message}`);
        blockers++;
      }
    }

    const rankedCandidates = rankCandidates(nextCandidates);
    let selectedRecipient = target.recipient?.email || null;
    if (input.selectRecipients && !selectedRecipient && rankedCandidates.length > 0) {
      const candidate = rankedCandidates[0];
      target.recipient = {
        name: candidate.name,
        role: candidate.role,
        email: candidate.email,
        evidenceSource: candidate.evidenceSource,
        evidenceType: candidate.evidenceType,
      };
      target.outbound = {
        ...target.outbound,
        approvalState: target.outbound.approvalState === "approved"
          ? "approved"
          : "pending_first_send_approval",
      };
      selectedRecipient = candidate.email;
      selectedRecipients++;
    }

    target.enrichment = {
      status: selectedRecipient || rankedCandidates.length > 0
        ? "contact_found"
        : targetBlockers.length > 0
          ? "blocked"
          : "exhausted",
      providerRuns: nextRuns,
      recipientCandidates: rankedCandidates,
      selectedRecipientEvidence: selectedRecipient && target.recipient?.evidenceSource
        ? {
            providerKey: rankedCandidates.find((candidate) => candidate.email === selectedRecipient)?.providerKey
              || target.enrichment?.selectedRecipientEvidence?.providerKey
              || "unknown",
            selectedAt: nowIso(),
            evidenceSource: target.recipient.evidenceSource,
          }
        : target.enrichment?.selectedRecipientEvidence,
      blockers: [...new Set(targetBlockers)],
    };

    targetsUpdated++;
    targetResults.push({
      targetId: target.id,
      organizationName: target.organizationName,
      status: target.enrichment.status,
      candidatesAdded: Math.max(0, rankedCandidates.length - existingCandidates.length),
      selectedRecipient,
      blockers: target.enrichment.blockers ?? [],
    });
  }

  return {
    ledger: {
      ...input.ledger,
      targets,
    },
    summary: {
      targetsConsidered: targetFilter.size > 0 ? targetFilter.size : input.ledger.targets.length,
      targetsUpdated,
      candidatesAdded,
      selectedRecipients,
      providerRuns,
      blockers,
    },
    targetResults,
  };
}
