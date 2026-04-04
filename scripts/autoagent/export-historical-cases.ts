import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "../../server/utils/field-encryption";
import type { InboundRequest } from "../../server/types/inbound-request";
import type { PreviewDiagnosisInput } from "../../server/agents/tasks/preview-diagnosis";
import type { SupportTriageInput } from "../../server/agents/tasks/support-triage";
import type { WaitlistTriageTaskInput } from "../../server/agents/tasks/waitlist-triage";

export type ExportLane = "waitlist_triage" | "support_triage" | "preview_diagnosis";
export type DatasetSplit = "dev" | "holdout" | "shadow";

type ExportCliOptions = {
  lanes: ExportLane[];
  outputRoot: string;
  maxPerLane: number;
  overwrite: boolean;
  since?: string | null;
};

type RiskTier = "low" | "medium" | "high";

type ExportedCase = {
  caseId: string;
  lane: ExportLane;
  split: DatasetSplit;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  labels: Record<string, unknown>;
  source: Record<string, unknown>;
};

type ExportSummary = {
  lane: ExportLane;
  scanned: number;
  exported: number;
  skipped: number;
  skipReasons: Record<string, number>;
};

type WaitlistDoc = Record<string, unknown>;
type SupportDoc = Record<string, unknown>;
type PreviewSourceDoc = Record<string, unknown>;

const DEFAULT_OUTPUT_ROOT = path.resolve(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/tasks",
);

const DATASET_SPLIT_THRESHOLDS = {
  dev: 0.7,
  holdout: 0.9,
};

function parseArgs(argv: string[]): ExportCliOptions {
  const options: ExportCliOptions = {
    lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
    outputRoot: DEFAULT_OUTPUT_ROOT,
    maxPerLane: 250,
    overwrite: false,
    since: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--lanes":
        if (!next) throw new Error("--lanes requires a comma-separated value");
        options.lanes = next
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            if (
              entry === "waitlist_triage"
              || entry === "support_triage"
              || entry === "preview_diagnosis"
            ) {
              return entry;
            }
            throw new Error(`Unsupported lane: ${entry}`);
          });
        index += 1;
        break;
      case "--output-root":
        if (!next) throw new Error("--output-root requires a path");
        options.outputRoot = path.resolve(next);
        index += 1;
        break;
      case "--max-per-lane":
        if (!next) throw new Error("--max-per-lane requires a number");
        options.maxPerLane = Math.max(1, Number.parseInt(next, 10) || options.maxPerLane);
        index += 1;
        break;
      case "--overwrite":
        options.overwrite = true;
        break;
      case "--since":
        if (!next) throw new Error("--since requires an ISO date or timestamp");
        options.since = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null) {
    const withToDate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof withToDate.toDate === "function") {
      return withToDate.toDate().toISOString();
    }
    if (typeof withToDate.seconds === "number") {
      return new Date(withToDate.seconds * 1000).toISOString();
    }
  }
  return null;
}

function sanitizeForJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return value;
  }
  const asIso = toIsoString(value);
  if (asIso) {
    return asIso;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeForJson(entry))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeForJson(entry);
      if (sanitized !== undefined) {
        next[key] = sanitized;
      }
    }
    return next;
  }
  return String(value);
}

function hashToUnitInterval(value: string) {
  const digest = crypto.createHash("sha1").update(value).digest("hex");
  const prefix = digest.slice(0, 8);
  return Number.parseInt(prefix, 16) / 0xffffffff;
}

export function pickDatasetSplit(caseId: string): DatasetSplit {
  const bucket = hashToUnitInterval(caseId);
  if (bucket < DATASET_SPLIT_THRESHOLDS.dev) {
    return "dev";
  }
  if (bucket < DATASET_SPLIT_THRESHOLDS.holdout) {
    return "holdout";
  }
  return "shadow";
}

function ensureDirForLane(outputRoot: string, lane: ExportLane) {
  const laneDir = path.join(outputRoot, laneToDir(lane));
  return {
    laneDir,
    casesDir: path.join(laneDir, "cases"),
  };
}

function laneToDir(lane: ExportLane) {
  switch (lane) {
    case "waitlist_triage":
      return "waitlist-triage";
    case "support_triage":
      return "support-triage";
    case "preview_diagnosis":
      return "preview-diagnosis";
  }
}

async function resetCasesDir(outputRoot: string, lane: ExportLane) {
  const { casesDir } = ensureDirForLane(outputRoot, lane);
  await fs.rm(casesDir, { recursive: true, force: true });
}

async function writeExportedCase(outputRoot: string, exportedCase: ExportedCase) {
  const { casesDir } = ensureDirForLane(outputRoot, exportedCase.lane);
  const caseDir = path.join(casesDir, exportedCase.split, exportedCase.caseId);
  await fs.mkdir(caseDir, { recursive: true });
  await fs.writeFile(
    path.join(caseDir, "input.json"),
    `${JSON.stringify(sanitizeForJson(exportedCase.input), null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(caseDir, "expected.json"),
    `${JSON.stringify(sanitizeForJson(exportedCase.expected), null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(caseDir, "labels.json"),
    `${JSON.stringify(sanitizeForJson(exportedCase.labels), null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(caseDir, "source.json"),
    `${JSON.stringify(sanitizeForJson(exportedCase.source), null, 2)}\n`,
    "utf8",
  );
}

function shouldIncludeBySince(value: unknown, since: string | null | undefined) {
  if (!since) return true;
  const threshold = Date.parse(since);
  if (!Number.isFinite(threshold)) {
    return true;
  }
  const candidate = toIsoString(value);
  if (!candidate) return false;
  return Date.parse(candidate) >= threshold;
}

function summarizeSkip(summary: ExportSummary, reason: string) {
  summary.skipped += 1;
  summary.skipReasons[reason] = (summary.skipReasons[reason] || 0) + 1;
}

function buildCaseId(lane: ExportLane, sourceId: string) {
  return `${lane}-${sourceId}`;
}

function isResolvedStatus(value: unknown) {
  return value === "completed" || value === "blocked";
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function getRiskTierForWaitlist(expected: Record<string, unknown>): RiskTier {
  return expected.requires_human_review === true ? "medium" : "low";
}

function getRiskTierForSupport(expected: Record<string, unknown>): RiskTier {
  if (expected.requires_human_review === true) return "high";
  if (expected.category === "technical_issue" || expected.category === "mapping_reschedule") {
    return "medium";
  }
  return "low";
}

function getRiskTierForPreview(expected: Record<string, unknown>): RiskTier {
  if (
    expected.disposition === "blocked_release_risk"
    || expected.disposition === "provider_escalation"
  ) {
    return "high";
  }
  return "medium";
}

export function extractWaitlistCase(docId: string, data: WaitlistDoc): ExportedCase | null {
  const opsAutomation =
    data.ops_automation && typeof data.ops_automation === "object"
      ? (data.ops_automation as Record<string, unknown>)
      : {};

  if (!isResolvedStatus(opsAutomation.status)) {
    return null;
  }

  const recommendation = asNullableString(opsAutomation.recommendation);
  const recommendedQueue = asNullableString(data.queue) || asNullableString(opsAutomation.recommended_path);
  if (!recommendation || !recommendedQueue) {
    return null;
  }

  const input: WaitlistTriageTaskInput = {
    submission: {
      id: docId,
      email: asString(data.email),
      email_domain: asString(data.email_domain),
      location_type: asString(data.location_type),
      market: asString(data.market),
      role: asString(data.role),
      device: asString(data.device),
      phone_present: Boolean(data.phone),
      source: asString(data.source),
      status: asString(data.status),
      queue: asString(data.queue),
      filter_tags: asStringArray(data.filter_tags),
      company: asString(data.company),
      city: asString(data.city),
      state: asString(data.state),
      offWaitlistUrl: asString(data.offWaitlistUrl),
    },
    market_context:
      opsAutomation.market_context && typeof opsAutomation.market_context === "object"
        ? (opsAutomation.market_context as WaitlistTriageTaskInput["market_context"])
        : {
          sameMarketCount: 0,
          sameMarketDeviceCount: 0,
          sameMarketPendingCount: 0,
          sameRoleCount: 0,
          recentExamples: [],
        },
  };

  const expected = {
    automation_status: asString(opsAutomation.status),
    block_reason_code: asNullableString(opsAutomation.block_reason_code),
    retryable: asBoolean(opsAutomation.retryable),
    recommendation,
    confidence: asNumber(data.automation_confidence, asNumber(opsAutomation.confidence)),
    market_fit_score: asNumber(opsAutomation.market_fit_score),
    device_fit_score: asNumber(opsAutomation.device_fit_score),
    invite_readiness_score: asNumber(opsAutomation.invite_readiness_score),
    recommended_queue: recommendedQueue,
    next_action: asString(opsAutomation.next_action),
    rationale: asString(opsAutomation.rationale),
    market_summary: asString(opsAutomation.market_summary),
    requires_human_review: asBoolean(
      data.human_review_required,
      asBoolean(opsAutomation.requires_human_review),
    ),
    draft_email:
      opsAutomation.draft_email && typeof opsAutomation.draft_email === "object"
        ? opsAutomation.draft_email
        : null,
  };

  return {
    caseId: buildCaseId("waitlist_triage", docId),
    lane: "waitlist_triage",
    split: pickDatasetSplit(buildCaseId("waitlist_triage", docId)),
    input: input as unknown as Record<string, unknown>,
    expected,
    labels: {
      risk_tier: getRiskTierForWaitlist(expected),
      requires_human_review: expected.requires_human_review,
      unsafe_auto_clear_penalty: expected.requires_human_review ? 6 : 5,
      wrong_queue_penalty: 2,
      email_quality_weight: 0.25,
    },
    source: {
      collection: "waitlistSubmissions",
      doc_id: docId,
      created_at: toIsoString(data.created_at),
      updated_at: toIsoString(data.updated_at),
      top_level_status: data.status ?? null,
      top_level_queue: data.queue ?? null,
      ops_automation_status: opsAutomation.status ?? null,
    },
  };
}

export function extractSupportCase(docId: string, data: SupportDoc): ExportedCase | null {
  const opsAutomation =
    data.ops_automation && typeof data.ops_automation === "object"
      ? (data.ops_automation as Record<string, unknown>)
      : {};

  if (!isResolvedStatus(opsAutomation.status)) {
    return null;
  }

  const category = asNullableString(opsAutomation.recommended_path);
  const queue = asNullableString(data.queue) || asNullableString(opsAutomation.queue);
  if (!category || !queue) {
    return null;
  }

  const input: SupportTriageInput = {
    id: docId,
    requestSource: asString(data.requestSource),
    requesterName: asString(data.name),
    email: asString(data.email),
    company: asString(data.company),
    city: asString(data.city),
    state: asString(data.state),
    companyWebsite: asString(data.companyWebsite),
    message: asString(data.message),
    summary: asString(data.summary),
  };

  const expected = {
    automation_status: asString(opsAutomation.status),
    block_reason_code: asNullableString(opsAutomation.block_reason_code),
    retryable: asBoolean(opsAutomation.retryable),
    category,
    queue,
    priority: asString(data.priority) || "normal",
    confidence: asNumber(data.automation_confidence, asNumber(opsAutomation.confidence)),
    requires_human_review: asBoolean(
      data.human_review_required,
      asBoolean(opsAutomation.requires_human_review),
    ),
    next_action: asString(opsAutomation.next_action),
    rationale: asString(opsAutomation.rationale),
    internal_summary: asString(opsAutomation.internal_summary),
    suggested_response:
      opsAutomation.suggested_response && typeof opsAutomation.suggested_response === "object"
        ? opsAutomation.suggested_response
        : null,
  };

  return {
    caseId: buildCaseId("support_triage", docId),
    lane: "support_triage",
    split: pickDatasetSplit(buildCaseId("support_triage", docId)),
    input: input as unknown as Record<string, unknown>,
    expected,
    labels: {
      risk_tier: getRiskTierForSupport(expected),
      requires_human_review: expected.requires_human_review,
      unsafe_auto_clear_penalty: expected.requires_human_review ? 8 : 5,
      wrong_queue_penalty: 3,
      response_quality_weight: 0.5,
    },
    source: {
      collection: "contactRequests",
      doc_id: docId,
      created_at: toIsoString(data.createdAt),
      updated_at: toIsoString(data.updatedAt),
      top_level_queue: data.queue ?? null,
      top_level_priority: data.priority ?? null,
      ops_automation_status: opsAutomation.status ?? null,
    },
  };
}

function buildPreviewInput(requestId: string, decrypted: InboundRequest): PreviewDiagnosisInput {
  const deploymentReadiness =
    decrypted.deployment_readiness && typeof decrypted.deployment_readiness === "object"
      ? decrypted.deployment_readiness
      : {};
  const providerRun =
    deploymentReadiness.provider_run && typeof deploymentReadiness.provider_run === "object"
      ? deploymentReadiness.provider_run
      : {};
  const artifacts =
    decrypted.pipeline?.artifacts && typeof decrypted.pipeline.artifacts === "object"
      ? decrypted.pipeline.artifacts
      : {};

  return {
    requestId,
    siteWorldId:
      typeof decrypted.pipeline?.scene_id === "string"
        ? decrypted.pipeline.scene_id
        : null,
    preview_status:
      typeof deploymentReadiness.preview_status === "string"
        ? deploymentReadiness.preview_status
        : null,
    provider_name:
      typeof providerRun.provider_name === "string" ? providerRun.provider_name : null,
    provider_model:
      typeof providerRun.provider_model === "string" ? providerRun.provider_model : null,
    provider_run_id:
      typeof providerRun.provider_run_id === "string" ? providerRun.provider_run_id : null,
    failure_reason:
      typeof providerRun.failure_reason === "string" ? providerRun.failure_reason : null,
    preview_manifest_uri:
      typeof providerRun.preview_manifest_uri === "string"
        ? providerRun.preview_manifest_uri
        : null,
    worldlabs_operation_manifest_uri:
      typeof artifacts.worldlabs_operation_manifest_uri === "string"
        ? artifacts.worldlabs_operation_manifest_uri
        : null,
    worldlabs_world_manifest_uri:
      typeof artifacts.worldlabs_world_manifest_uri === "string"
        ? artifacts.worldlabs_world_manifest_uri
        : null,
  };
}

export async function extractPreviewCase(
  docId: string,
  rawData: PreviewSourceDoc,
): Promise<ExportedCase | null> {
  let decrypted: InboundRequest;
  if (
    rawData.contact
    && typeof rawData.contact === "object"
    && rawData.request
    && typeof rawData.request === "object"
  ) {
    decrypted = (await decryptInboundRequestForAdmin(rawData as any)) as InboundRequest;
  } else {
    decrypted = {
      requestId: asString((rawData as Record<string, unknown>).requestId) || docId,
      status: "submitted",
      qualification_state: "submitted",
      opportunity_state: "not_applicable",
      priority: "normal",
      owner: {},
      contact: {
        firstName: "",
        lastName: "",
        email: asString((rawData as Record<string, unknown>).email),
        roleTitle: "",
        company: "",
      },
      request: {
        budgetBucket: "Undecided/Unsure",
        requestedLanes: ["qualification"],
        helpWith: [],
        buyerType: "site_operator",
        siteName: asString((rawData as Record<string, unknown>).siteName) || "Legacy smoke request",
        siteLocation: asString((rawData as Record<string, unknown>).siteLocation) || "Unknown",
        taskStatement: "Legacy smoke request",
      },
      context: {
        sourcePageUrl: asString((rawData as Record<string, unknown>).source) || "legacy-smoke",
        utm: {},
      },
      enrichment: {},
      events: {},
      ops_automation:
        rawData.ops_automation && typeof rawData.ops_automation === "object"
          ? (rawData.ops_automation as InboundRequest["ops_automation"])
          : undefined,
      deployment_readiness:
        rawData.deployment_readiness && typeof rawData.deployment_readiness === "object"
          ? (rawData.deployment_readiness as InboundRequest["deployment_readiness"])
          : undefined,
      pipeline:
        rawData.pipeline && typeof rawData.pipeline === "object"
          ? (rawData.pipeline as InboundRequest["pipeline"])
          : undefined,
      createdAt: rawData.createdAt as InboundRequest["createdAt"],
    } as InboundRequest;
  }
  const opsAutomation =
    decrypted.ops_automation && typeof decrypted.ops_automation === "object"
      ? (decrypted.ops_automation as Record<string, unknown>)
      : {};

  if (!isResolvedStatus(opsAutomation.status)) {
    return null;
  }

  const disposition = asNullableString(opsAutomation.recommended_path);
  const queue = asNullableString(opsAutomation.queue);
  if (!disposition || !queue) {
    return null;
  }

  const expected = {
    automation_status: asString(opsAutomation.status),
    block_reason_code: asNullableString(opsAutomation.block_reason_code),
    retryable: asBoolean(opsAutomation.retryable),
    queue,
    confidence: asNumber(
      decrypted.automation_confidence,
      asNumber(opsAutomation.confidence),
    ),
    requires_human_review: asBoolean(
      decrypted.human_review_required,
      asBoolean(opsAutomation.requires_human_review),
    ),
    retry_recommended: asBoolean(opsAutomation.retry_recommended),
    disposition,
    next_action: asString(opsAutomation.next_action),
    rationale: asString(opsAutomation.rationale),
    internal_summary: asString(opsAutomation.internal_summary),
  };

  return {
    caseId: buildCaseId("preview_diagnosis", docId),
    lane: "preview_diagnosis",
    split: pickDatasetSplit(buildCaseId("preview_diagnosis", docId)),
    input: buildPreviewInput(docId, decrypted) as unknown as Record<string, unknown>,
    expected,
    labels: {
      risk_tier: getRiskTierForPreview(expected),
      requires_human_review: expected.requires_human_review,
      unsafe_auto_clear_penalty: 10,
      wrong_retry_penalty: 6,
      wrong_escalation_penalty: 5,
    },
    source: {
      collection: "inboundRequests",
      doc_id: docId,
      created_at: toIsoString((rawData as Record<string, unknown>).createdAt),
      updated_at: toIsoString((rawData as Record<string, unknown>).updatedAt),
      ops_automation_status: opsAutomation.status ?? null,
      preview_status:
        decrypted.deployment_readiness && typeof decrypted.deployment_readiness === "object"
          ? (decrypted.deployment_readiness as Record<string, unknown>).preview_status ?? null
          : null,
    },
  };
}

async function writeSummary(outputRoot: string, summaries: ExportSummary[]) {
  const payload = {
    exported_at: new Date().toISOString(),
    summaries,
  };
  await fs.writeFile(
    path.join(outputRoot, "export-summary.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

async function exportWaitlistCases(options: ExportCliOptions): Promise<ExportSummary> {
  const summary: ExportSummary = {
    lane: "waitlist_triage",
    scanned: 0,
    exported: 0,
    skipped: 0,
    skipReasons: {},
  };

  const snapshot = await db!.collection("waitlistSubmissions").get();
  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as WaitlistDoc }))
    .filter(({ data }) => shouldIncludeBySince(data.updated_at ?? data.created_at, options.since))
    .sort((a, b) => {
      const aTime = Date.parse(toIsoString(a.data.updated_at ?? a.data.created_at) || "1970-01-01T00:00:00.000Z");
      const bTime = Date.parse(toIsoString(b.data.updated_at ?? b.data.created_at) || "1970-01-01T00:00:00.000Z");
      return bTime - aTime;
    });

  for (const { id, data } of candidates) {
    summary.scanned += 1;
    if (summary.exported >= options.maxPerLane) break;
    const exportedCase = extractWaitlistCase(id, data);
    if (!exportedCase) {
      summarizeSkip(summary, "missing_resolved_waitlist_fields");
      continue;
    }
    await writeExportedCase(options.outputRoot, exportedCase);
    summary.exported += 1;
  }

  return summary;
}

async function exportSupportCases(options: ExportCliOptions): Promise<ExportSummary> {
  const summary: ExportSummary = {
    lane: "support_triage",
    scanned: 0,
    exported: 0,
    skipped: 0,
    skipReasons: {},
  };

  const snapshot = await db!.collection("contactRequests").get();
  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as SupportDoc }))
    .filter(({ data }) => shouldIncludeBySince(data.updatedAt ?? data.createdAt, options.since))
    .sort((a, b) => {
      const aTime = Date.parse(toIsoString(a.data.updatedAt ?? a.data.createdAt) || "1970-01-01T00:00:00.000Z");
      const bTime = Date.parse(toIsoString(b.data.updatedAt ?? b.data.createdAt) || "1970-01-01T00:00:00.000Z");
      return bTime - aTime;
    });

  for (const { id, data } of candidates) {
    summary.scanned += 1;
    if (summary.exported >= options.maxPerLane) break;
    const exportedCase = extractSupportCase(id, data);
    if (!exportedCase) {
      summarizeSkip(summary, "missing_resolved_support_fields");
      continue;
    }
    await writeExportedCase(options.outputRoot, exportedCase);
    summary.exported += 1;
  }

  return summary;
}

async function exportPreviewCases(options: ExportCliOptions): Promise<ExportSummary> {
  const summary: ExportSummary = {
    lane: "preview_diagnosis",
    scanned: 0,
    exported: 0,
    skipped: 0,
    skipReasons: {},
  };

  const snapshot = await db!.collection("inboundRequests").get();
  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as PreviewSourceDoc }))
    .filter(({ data }) => shouldIncludeBySince(data.updatedAt ?? data.createdAt, options.since))
    .sort((a, b) => {
      const aTime = Date.parse(toIsoString(a.data.updatedAt ?? a.data.createdAt) || "1970-01-01T00:00:00.000Z");
      const bTime = Date.parse(toIsoString(b.data.updatedAt ?? b.data.createdAt) || "1970-01-01T00:00:00.000Z");
      return bTime - aTime;
    });

  for (const { id, data } of candidates) {
    summary.scanned += 1;
    if (summary.exported >= options.maxPerLane) break;
    try {
      const exportedCase = await extractPreviewCase(id, data);
      if (!exportedCase) {
        summarizeSkip(summary, "missing_resolved_preview_fields");
        continue;
      }
      await writeExportedCase(options.outputRoot, exportedCase);
      summary.exported += 1;
    } catch (error) {
      summarizeSkip(summary, "preview_decrypt_or_extract_failed");
      console.warn(
        `[autoagent-export] failed to export preview case ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return summary;
}

export async function runExport(options: ExportCliOptions) {
  if (!db) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS before exporting historical cases.",
    );
  }

  await fs.mkdir(options.outputRoot, { recursive: true });

  if (options.overwrite) {
    for (const lane of options.lanes) {
      await resetCasesDir(options.outputRoot, lane);
    }
  }

  const summaries: ExportSummary[] = [];
  for (const lane of options.lanes) {
    switch (lane) {
      case "waitlist_triage":
        summaries.push(await exportWaitlistCases(options));
        break;
      case "support_triage":
        summaries.push(await exportSupportCases(options));
        break;
      case "preview_diagnosis":
        summaries.push(await exportPreviewCases(options));
        break;
    }
  }

  await writeSummary(options.outputRoot, summaries);
  return summaries;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const summaries = await runExport(options);
  for (const summary of summaries) {
    console.log(
      `[autoagent-export] ${summary.lane}: scanned=${summary.scanned} exported=${summary.exported} skipped=${summary.skipped}`,
    );
    for (const [reason, count] of Object.entries(summary.skipReasons)) {
      console.log(`  - ${reason}: ${count}`);
    }
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-export] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
