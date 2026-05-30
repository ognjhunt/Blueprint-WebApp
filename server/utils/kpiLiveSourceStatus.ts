export const KPI_LIVE_SOURCE_CONTRACT_VERSION = "2026-05-30.kpi-live-source-contract.v1";

export type KpiLiveSourceStatus = "Sourced" | "Source needed";

export type KpiLiveSourceKey =
  | "captures"
  | "proof_packages"
  | "hosted_starts"
  | "contacts"
  | "sends_replies_calls"
  | "buyer_support"
  | "ci_failures"
  | "revenue_payments";

export type KpiSourceKey =
  | "capture_submissions"
  | "creatorCaptures"
  | "operatingGraphEvents"
  | "hostedSessions"
  | "inboundRequests"
  | "contactRequests"
  | "action_ledger"
  | "humanReplyEvents"
  | "callEvents"
  | "githubWorkflowRuns"
  | "paperclipIssues"
  | "stripeEvents"
  | "checkoutSessions";

export type KpiSourceRecord = {
  id: string;
  updatedAtIso?: string | null;
  artifactPath?: string | null;
  fields?: Record<string, unknown>;
};

export type KpiSourceSnapshot = Partial<Record<KpiSourceKey, KpiSourceRecord[]>>;

export type KpiLiveSourceClaimRow = {
  key: KpiLiveSourceKey;
  label?: string;
  claimedValue?: unknown;
  claimText?: string | null;
  asOfIso?: string | null;
};

export type KpiLiveSourceSnapshot = {
  generatedAt?: string | null;
  rows?: KpiLiveSourceClaimRow[];
  sources?: KpiSourceSnapshot;
};

export type KpiSourceContract = {
  sourceKey: KpiSourceKey;
  ownerSystem: string;
  collectionOrArtifact: string;
  allowedFields: string[];
  requiredFields?: string[];
  requiredAnyFields?: string[];
  timestampFields?: string[];
  acceptedStages?: string[];
  acceptedStatuses?: string[];
  requiredFieldValues?: Record<string, string[]>;
  blockedWhenMissing: string;
};

export type KpiLiveSourceContract = {
  key: KpiLiveSourceKey;
  notionRow: string;
  ownerSystem: string;
  sourceContracts: KpiSourceContract[];
  freshnessHours: number;
  blockerBehavior: string;
};

export type KpiLiveSourceRowStatus = {
  key: KpiLiveSourceKey;
  label: string;
  status: KpiLiveSourceStatus;
  ownerSystem: string;
  sourceContracts: Array<{
    sourceKey: KpiSourceKey;
    collectionOrArtifact: string;
    allowedFields: string[];
    freshnessHours: number;
  }>;
  reportableValue: unknown | null;
  suppressedClaim: unknown | null;
  evidenceRefs: string[];
  sourceNeededReasons: string[];
  blockedLiveSources: string[];
  blockerBehavior: string;
};

export type KpiLiveSourceStatusReport = {
  version: string;
  generatedAt: string;
  summary: {
    sourcedRows: number;
    sourceNeededRows: number;
    totalRows: number;
  };
  rows: KpiLiveSourceRowStatus[];
  blockedLiveSources: string[];
  notionMirror: {
    allowedToWriteNotion: false;
    mirrorInstruction: string;
  };
};

type EvidenceEvaluation = {
  accepted: boolean;
  evidenceRefs: string[];
  reasons: string[];
  blockedLiveSources: string[];
};

export const KPI_LIVE_SOURCE_CONTRACTS: KpiLiveSourceContract[] = [
  {
    key: "captures",
    notionRow: "Captures",
    ownerSystem: "Firestore capture projections backed by BlueprintCapture run truth",
    freshnessHours: 24 * 7,
    blockerBehavior:
      "Keep the Notion KPI row as Source needed until a capture_submissions or creatorCaptures record carries fresh capture/upload provenance.",
    sourceContracts: [
      {
        sourceKey: "capture_submissions",
        ownerSystem: "Firestore",
        collectionOrArtifact: "capture_submissions",
        allowedFields: [
          "capture_id",
          "site_submission_id",
          "buyer_request_id",
          "capture_job_id",
          "lifecycle.capture_uploaded_at",
          "operational_state.upload_state",
          "submitted_at",
          "updated_at",
        ],
        requiredAnyFields: ["capture_id", "site_submission_id"],
        timestampFields: ["updated_at", "submitted_at", "lifecycle.capture_uploaded_at"],
        blockedWhenMissing: "Firestore capture_submissions export or repo-local snapshot",
      },
      {
        sourceKey: "creatorCaptures",
        ownerSystem: "Firestore",
        collectionOrArtifact: "creatorCaptures",
        allowedFields: [
          "id",
          "capture_job_id",
          "buyer_request_id",
          "site_submission_id",
          "captured_at",
          "status",
          "updated_at",
        ],
        requiredAnyFields: ["id", "captured_at"],
        timestampFields: ["updated_at", "captured_at"],
        blockedWhenMissing: "Firestore creatorCaptures snapshot",
      },
    ],
  },
  {
    key: "proof_packages",
    notionRow: "Proof packages",
    ownerSystem: "BlueprintCapturePipeline package output projected into WebApp",
    freshnessHours: 24 * 7,
    blockerBehavior:
      "Keep proof-package KPI values Source needed until package-ready evidence links back to capture or request ids.",
    sourceContracts: [
      {
        sourceKey: "operatingGraphEvents",
        ownerSystem: "Firestore",
        collectionOrArtifact: "operatingGraphEvents where entity_type=package_run",
        allowedFields: [
          "entity_type",
          "entity_id",
          "stage",
          "source_repo",
          "source_kind",
          "metadata.capture_id",
          "metadata.site_submission_id",
          "metadata.buyer_request_id",
          "metadata.package_id",
          "recorded_at_iso",
        ],
        requiredFields: ["entity_type", "entity_id", "stage"],
        requiredAnyFields: [
          "metadata.capture_id",
          "metadata.site_submission_id",
          "metadata.buyer_request_id",
          "metadata.package_id",
        ],
        timestampFields: ["recorded_at_iso"],
        acceptedStages: ["package_ready", "hosted_review_ready"],
        requiredFieldValues: {
          entity_type: ["package_run"],
        },
        blockedWhenMissing: "Pipeline/WebApp package_run operating graph projection",
      },
    ],
  },
  {
    key: "hosted_starts",
    notionRow: "Hosted starts",
    ownerSystem: "WebApp hosted-session runtime and Firestore hostedSessions",
    freshnessHours: 24 * 3,
    blockerBehavior:
      "Keep hosted-start values Source needed unless hostedSessions contains fresh runtime/session evidence. OperatingGraph text alone is proof drift.",
    sourceContracts: [
      {
        sourceKey: "hostedSessions",
        ownerSystem: "Firestore + Redis live-store mirror",
        collectionOrArtifact: "hostedSessions",
        allowedFields: [
          "sessionId",
          "status",
          "sessionMode",
          "site.siteWorldId",
          "site.capture_id",
          "createdBy.uid",
          "createdAt",
          "updatedAt",
          "runtimeHandle.runtime_base_url",
          "presentationRuntime.status",
          "presentationRuntime.uiBaseUrl",
          "latestEpisode.episodeId",
        ],
        requiredAnyFields: [
          "runtimeHandle.runtime_base_url",
          "presentationRuntime.uiBaseUrl",
          "latestEpisode.episodeId",
        ],
        timestampFields: ["updatedAt", "createdAt", "presentationRuntime.startedAt"],
        acceptedStatuses: ["ready", "running"],
        blockedWhenMissing: "Firestore hostedSessions runtime/session evidence",
      },
      {
        sourceKey: "operatingGraphEvents",
        ownerSystem: "Firestore",
        collectionOrArtifact: "operatingGraphEvents where stage=hosted_review_started",
        allowedFields: [
          "entity_type",
          "entity_id",
          "stage",
          "source_kind",
          "metadata.hosted_session_id",
          "metadata.session_id",
          "metadata.hostedReviewRunId",
          "metadata.package_id",
          "recorded_at_iso",
        ],
        requiredFields: ["entity_type", "entity_id", "stage"],
        timestampFields: ["recorded_at_iso"],
        acceptedStages: ["hosted_review_started"],
        requiredFieldValues: {
          entity_type: ["hosted_review_run"],
        },
        blockedWhenMissing: "Hosted-review operatingGraph event correlated to hostedSessions",
      },
    ],
  },
  {
    key: "contacts",
    notionRow: "Contacts",
    ownerSystem: "Firestore inbound/contact request records",
    freshnessHours: 24 * 7,
    blockerBehavior:
      "Keep contact KPIs Source needed when contact rows are absent or only exist as narrative target research.",
    sourceContracts: [
      {
        sourceKey: "inboundRequests",
        ownerSystem: "Firestore",
        collectionOrArtifact: "inboundRequests",
        allowedFields: [
          "requestId",
          "status",
          "qualification_state",
          "opportunity_state",
          "contact.email_normalized",
          "contact.company",
          "context.buyerChannelSource",
          "createdAt",
          "updatedAt",
        ],
        requiredAnyFields: ["requestId", "contact.email_normalized", "contact.company"],
        timestampFields: ["updatedAt", "createdAt"],
        blockedWhenMissing: "Firestore inboundRequests snapshot",
      },
      {
        sourceKey: "contactRequests",
        ownerSystem: "Firestore",
        collectionOrArtifact: "contactRequests",
        allowedFields: [
          "requestSource",
          "company",
          "email_normalized",
          "summary",
          "ops_automation.intent",
          "createdAt",
          "updatedAt",
        ],
        requiredAnyFields: ["email_normalized", "company", "requestSource"],
        timestampFields: ["updatedAt", "createdAt"],
        blockedWhenMissing: "Firestore contactRequests snapshot",
      },
    ],
  },
  {
    key: "sends_replies_calls",
    notionRow: "Sends / replies / calls",
    ownerSystem: "Action ledger, human reply events, and qualified call ledger",
    freshnessHours: 24 * 7,
    blockerBehavior:
      "Keep the grouped GTM KPI Source needed until sends, replies, and calls each have a fresh ledger-backed source.",
    sourceContracts: [
      {
        sourceKey: "action_ledger",
        ownerSystem: "Firestore",
        collectionOrArtifact: "action_ledger send records",
        allowedFields: [
          "idempotency_key",
          "lane",
          "action_type",
          "source_collection",
          "source_doc_id",
          "status",
          "provider_reference",
          "created_at",
          "updated_at",
        ],
        requiredFields: ["idempotency_key", "status"],
        timestampFields: ["updated_at", "created_at"],
        acceptedStatuses: ["sent", "executed", "completed"],
        blockedWhenMissing: "Firestore action_ledger send execution records",
      },
      {
        sourceKey: "humanReplyEvents",
        ownerSystem: "Firestore",
        collectionOrArtifact: "humanReplyEvents",
        allowedFields: [
          "blocker_id",
          "thread_id",
          "channel",
          "approved_email",
          "created_at",
          "received_at",
        ],
        requiredAnyFields: ["blocker_id", "thread_id"],
        timestampFields: ["received_at", "created_at"],
        blockedWhenMissing: "Firestore humanReplyEvents reply records",
      },
      {
        sourceKey: "callEvents",
        ownerSystem: "Repo-local or Firestore call ledger",
        collectionOrArtifact: "qualified call event artifact",
        allowedFields: [
          "call_id",
          "request_id",
          "status",
          "started_at",
          "completed_at",
          "artifact_path",
        ],
        requiredAnyFields: ["call_id", "request_id"],
        timestampFields: ["completed_at", "started_at"],
        acceptedStatuses: ["completed", "qualified", "held"],
        blockedWhenMissing: "Qualified call event ledger or repo-local call snapshot",
      },
    ],
  },
  {
    key: "buyer_support",
    notionRow: "Buyer support",
    ownerSystem: "Firestore contactRequests plus support-triage action ledger",
    freshnessHours: 24 * 7,
    blockerBehavior:
      "Keep buyer-support KPIs Source needed unless support triage rows come from contactRequests or action_ledger support records.",
    sourceContracts: [
      {
        sourceKey: "contactRequests",
        ownerSystem: "Firestore",
        collectionOrArtifact: "contactRequests where ops_automation.intent=support_triage",
        allowedFields: [
          "requestSource",
          "summary",
          "queue",
          "priority",
          "human_review_required",
          "automation_confidence",
          "ops_automation.intent",
          "ops_automation.status",
          "createdAt",
          "updatedAt",
        ],
        requiredAnyFields: ["ops_automation.intent", "queue", "summary"],
        timestampFields: ["updatedAt", "createdAt", "ops_automation.processed_at"],
        blockedWhenMissing: "Firestore contactRequests support-triage rows",
      },
      {
        sourceKey: "action_ledger",
        ownerSystem: "Firestore",
        collectionOrArtifact: "action_ledger support records",
        allowedFields: [
          "idempotency_key",
          "lane",
          "action_type",
          "source_collection",
          "source_doc_id",
          "status",
          "created_at",
          "updated_at",
        ],
        requiredFields: ["idempotency_key", "lane", "status"],
        timestampFields: ["updated_at", "created_at"],
        requiredFieldValues: {
          lane: ["support"],
        },
        blockedWhenMissing: "Firestore action_ledger support lane records",
      },
    ],
  },
  {
    key: "ci_failures",
    notionRow: "CI failures",
    ownerSystem: "GitHub workflow polling mirrored through Paperclip/plugin snapshots",
    freshnessHours: 24 * 3,
    blockerBehavior:
      "Keep CI failure KPIs Source needed unless a GitHub workflow run snapshot or Paperclip source mapping names the failing run.",
    sourceContracts: [
      {
        sourceKey: "githubWorkflowRuns",
        ownerSystem: "GitHub / Blueprint automation plugin",
        collectionOrArtifact: "GitHub workflow run snapshot",
        allowedFields: [
          "repo",
          "workflow",
          "run_id",
          "status",
          "conclusion",
          "html_url",
          "created_at",
          "updated_at",
        ],
        requiredAnyFields: ["run_id", "html_url"],
        timestampFields: ["updated_at", "created_at"],
        blockedWhenMissing: "GitHub workflow polling snapshot",
      },
      {
        sourceKey: "paperclipIssues",
        ownerSystem: "Paperclip",
        collectionOrArtifact: "Paperclip managed issue with sourceType=github-workflow",
        allowedFields: [
          "sourceType",
          "sourceId",
          "issueId",
          "status",
          "title",
          "updatedAt",
        ],
        requiredAnyFields: ["sourceId", "issueId"],
        timestampFields: ["updatedAt"],
        requiredFieldValues: {
          sourceType: ["github-workflow", "github-ci", "ci-workflow"],
        },
        blockedWhenMissing: "Paperclip managed CI issue/source mapping snapshot",
      },
    ],
  },
  {
    key: "revenue_payments",
    notionRow: "Revenue / payments",
    ownerSystem: "Stripe checkout/webhook truth, optionally mirrored into Firestore",
    freshnessHours: 24 * 7,
    blockerBehavior:
      "Keep revenue and payment values Source needed until Stripe evidence exists. Entitlements or request text alone are not payment truth.",
    sourceContracts: [
      {
        sourceKey: "stripeEvents",
        ownerSystem: "Stripe",
        collectionOrArtifact: "Stripe webhook/event snapshot",
        allowedFields: [
          "event_id",
          "type",
          "created",
          "amount_total",
          "currency",
          "payment_status",
          "checkout_session_id",
          "payment_intent",
        ],
        requiredAnyFields: ["event_id", "checkout_session_id", "payment_intent"],
        timestampFields: ["updated_at", "created"],
        acceptedStatuses: ["paid", "succeeded", "complete", "completed"],
        blockedWhenMissing: "Stripe checkout/webhook/payment event evidence",
      },
      {
        sourceKey: "checkoutSessions",
        ownerSystem: "Stripe",
        collectionOrArtifact: "Stripe checkout session snapshot",
        allowedFields: [
          "id",
          "payment_status",
          "status",
          "amount_total",
          "currency",
          "created",
          "updated_at",
        ],
        requiredAnyFields: ["id"],
        timestampFields: ["updated_at", "created"],
        acceptedStatuses: ["paid", "complete", "completed"],
        blockedWhenMissing: "Stripe checkout session evidence",
      },
    ],
  },
];

function contractForKey(key: KpiLiveSourceKey) {
  const contract = KPI_LIVE_SOURCE_CONTRACTS.find((item) => item.key === key);
  if (!contract) {
    throw new Error(`Unknown KPI live-source key: ${key}`);
  }
  return contract;
}

function sourceRecords(snapshot: KpiLiveSourceSnapshot, sourceKey: KpiSourceKey) {
  return snapshot.sources?.[sourceKey] || [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readPathFromObject(value: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = value;
  for (const part of parts) {
    const record = asObject(current);
    if (!record || !(part in record)) {
      return undefined;
    }
    current = record[part];
  }
  return current;
}

function readField(record: KpiSourceRecord, path: string): unknown {
  if (path === "id") {
    return record.id;
  }
  if (path === "artifact_path") {
    return record.artifactPath;
  }
  const direct = readPathFromObject(record, path);
  if (direct !== undefined) {
    return direct;
  }
  return readPathFromObject(record.fields || {}, path);
}

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceIso(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function recordTimestamp(record: KpiSourceRecord, source: KpiSourceContract) {
  const candidates = [
    record.updatedAtIso,
    ...(source.timestampFields || []).map((field) => readField(record, field)),
  ];
  for (const candidate of candidates) {
    const iso = coerceIso(candidate);
    if (iso) {
      return iso;
    }
  }
  return null;
}

function ageHours(timestampIso: string, generatedAt: string) {
  const ageMs = Date.parse(generatedAt) - Date.parse(timestampIso);
  return Number.isFinite(ageMs) ? ageMs / 3_600_000 : Number.POSITIVE_INFINITY;
}

function evidenceRef(sourceKey: KpiSourceKey, record: KpiSourceRecord) {
  return record.artifactPath || `${sourceKey}/${record.id || "unknown"}`;
}

function fieldExists(record: KpiSourceRecord, path: string) {
  const value = readField(record, path);
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function statusMatches(record: KpiSourceRecord, source: KpiSourceContract) {
  if (!source.acceptedStatuses?.length) {
    return true;
  }
  const status = coerceString(
    readField(record, "status")
      || readField(record, "payment_status")
      || readField(record, "conclusion"),
  ).toLowerCase();
  return source.acceptedStatuses.includes(status);
}

function requiredFieldValuesMatch(record: KpiSourceRecord, source: KpiSourceContract) {
  const required = source.requiredFieldValues || {};
  for (const [field, allowedValues] of Object.entries(required)) {
    const actual = coerceString(readField(record, field)).toLowerCase();
    const normalizedAllowed = allowedValues.map((value) => value.toLowerCase());
    if (!actual || !normalizedAllowed.includes(actual)) {
      return false;
    }
  }
  return true;
}

function stageMatches(record: KpiSourceRecord, source: KpiSourceContract) {
  if (!source.acceptedStages?.length) {
    return true;
  }
  const stage = coerceString(readField(record, "stage")).toLowerCase();
  return source.acceptedStages.includes(stage);
}

function recordHasRequiredFields(record: KpiSourceRecord, source: KpiSourceContract) {
  const missingAll = (source.requiredFields || []).filter((field) => !fieldExists(record, field));
  if (missingAll.length > 0) {
    return { ok: false, missing: missingAll };
  }
  const requiredAny = source.requiredAnyFields || [];
  if (requiredAny.length > 0 && !requiredAny.some((field) => fieldExists(record, field))) {
    return { ok: false, missing: requiredAny };
  }
  return { ok: true, missing: [] };
}

function validateGenericRecord(
  record: KpiSourceRecord,
  source: KpiSourceContract,
  generatedAt: string,
  freshnessHours: number,
) {
  const timestamp = recordTimestamp(record, source);
  if (!timestamp) {
    return { ok: false, reason: "missing_freshness_timestamp" };
  }
  if (ageHours(timestamp, generatedAt) > freshnessHours) {
    return { ok: false, reason: "stale_source" };
  }
  const required = recordHasRequiredFields(record, source);
  if (!required.ok) {
    return {
      ok: false,
      reason: `missing_required_fields:${required.missing.join(",")}`,
    };
  }
  if (!stageMatches(record, source)) {
    return { ok: false, reason: "unsupported_stage" };
  }
  if (!statusMatches(record, source)) {
    return { ok: false, reason: "unsupported_status" };
  }
  if (!requiredFieldValuesMatch(record, source)) {
    return { ok: false, reason: "unsupported_field_value" };
  }
  return { ok: true, reason: "accepted" };
}

function evaluateAnyFreshSource(
  snapshot: KpiLiveSourceSnapshot,
  contract: KpiLiveSourceContract,
  generatedAt: string,
): EvidenceEvaluation {
  const reasons: string[] = [];
  const blockedLiveSources: string[] = [];
  const evidenceRefs: string[] = [];

  for (const source of contract.sourceContracts) {
    const records = sourceRecords(snapshot, source.sourceKey);
    if (records.length === 0) {
      reasons.push(`missing_source:${source.sourceKey}`);
      blockedLiveSources.push(`${contract.key}: ${source.blockedWhenMissing}`);
      continue;
    }

    const validRefs = records
      .filter((record) => {
        const validation = validateGenericRecord(record, source, generatedAt, contract.freshnessHours);
        if (!validation.ok) {
          reasons.push(`${source.sourceKey}:${validation.reason}`);
          return false;
        }
        return true;
      })
      .map((record) => evidenceRef(source.sourceKey, record));

    evidenceRefs.push(...validRefs);
  }

  return {
    accepted: evidenceRefs.length > 0,
    evidenceRefs,
    reasons: Array.from(new Set(reasons)),
    blockedLiveSources: Array.from(new Set(blockedLiveSources)),
  };
}

function sessionHasRuntimeEvidence(record: KpiSourceRecord) {
  const status = coerceString(readField(record, "status")).toLowerCase();
  if (status !== "ready" && status !== "running") {
    return false;
  }
  const presentationStatus = coerceString(readField(record, "presentationRuntime.status")).toLowerCase();
  return Boolean(
    fieldExists(record, "runtimeHandle.runtime_base_url")
      || fieldExists(record, "presentationRuntime.uiBaseUrl")
      || presentationStatus === "live"
      || fieldExists(record, "latestEpisode.episodeId"),
  );
}

function sessionIdentity(record: KpiSourceRecord) {
  return coerceString(readField(record, "sessionId")) || record.id;
}

function eventHostedSessionIdentity(record: KpiSourceRecord) {
  return (
    coerceString(readField(record, "metadata.hosted_session_id"))
    || coerceString(readField(record, "metadata.session_id"))
    || coerceString(readField(record, "metadata.hostedSessionId"))
  );
}

function evaluateHostedStarts(
  snapshot: KpiLiveSourceSnapshot,
  contract: KpiLiveSourceContract,
  generatedAt: string,
): EvidenceEvaluation {
  const [hostedSource, eventSource] = contract.sourceContracts;
  const hostedRecords = sourceRecords(snapshot, "hostedSessions");
  const eventRecords = sourceRecords(snapshot, "operatingGraphEvents").filter((record) =>
    coerceString(readField(record, "stage")).toLowerCase() === "hosted_review_started",
  );
  const reasons: string[] = [];
  const blockedLiveSources = new Set<string>();

  const validSessions = hostedRecords.filter((record) => {
    const validation = validateGenericRecord(record, hostedSource, generatedAt, contract.freshnessHours);
    if (!validation.ok) {
      reasons.push(`hostedSessions:${validation.reason}`);
      return false;
    }
    if (!sessionHasRuntimeEvidence(record)) {
      reasons.push("hostedSessions:missing_runtime_session_evidence");
      return false;
    }
    return true;
  });

  if (validSessions.length === 0) {
    blockedLiveSources.add(`${contract.key}: ${hostedSource.blockedWhenMissing}`);
  }

  const validSessionIds = new Set(validSessions.map(sessionIdentity).filter(Boolean));
  const eventRefs = eventRecords
    .filter((record) => {
      const validation = validateGenericRecord(record, eventSource, generatedAt, contract.freshnessHours);
      if (!validation.ok) {
        reasons.push(`operatingGraphEvents:${validation.reason}`);
        return false;
      }
      const eventSessionId = eventHostedSessionIdentity(record);
      if (!eventSessionId || !validSessionIds.has(eventSessionId)) {
        reasons.push("hosted_session_proof_drift");
        blockedLiveSources.add(`${contract.key}: ${eventSource.blockedWhenMissing}`);
        return false;
      }
      return true;
    })
    .map((record) => evidenceRef("operatingGraphEvents", record));

  const sessionRefs = validSessions.map((record) => evidenceRef("hostedSessions", record));
  const accepted = sessionRefs.length > 0 && (eventRecords.length === 0 || eventRefs.length > 0);

  if (hostedRecords.length === 0) {
    reasons.push("missing_source:hostedSessions");
  }
  if (eventRecords.length > 0 && eventRefs.length === 0) {
    reasons.push("hosted_session_proof_drift");
  }

  return {
    accepted,
    evidenceRefs: accepted ? [...sessionRefs, ...eventRefs] : [],
    reasons: Array.from(new Set(reasons)),
    blockedLiveSources: Array.from(blockedLiveSources),
  };
}

function evaluateSendsRepliesCalls(
  snapshot: KpiLiveSourceSnapshot,
  contract: KpiLiveSourceContract,
  generatedAt: string,
): EvidenceEvaluation {
  const evidenceRefs: string[] = [];
  const reasons: string[] = [];
  const blockedLiveSources: string[] = [];

  for (const source of contract.sourceContracts) {
    const records = sourceRecords(snapshot, source.sourceKey);
    const valid = records.filter((record) =>
      validateGenericRecord(record, source, generatedAt, contract.freshnessHours).ok,
    );
    if (valid.length === 0) {
      reasons.push(records.length === 0 ? `missing_source:${source.sourceKey}` : `source_not_accepted:${source.sourceKey}`);
      blockedLiveSources.push(`${contract.key}: ${source.blockedWhenMissing}`);
    } else {
      evidenceRefs.push(...valid.map((record) => evidenceRef(source.sourceKey, record)));
    }
  }

  return {
    accepted: blockedLiveSources.length === 0,
    evidenceRefs: blockedLiveSources.length === 0 ? evidenceRefs : [],
    reasons: Array.from(new Set(reasons)),
    blockedLiveSources: Array.from(new Set(blockedLiveSources)),
  };
}

function evaluateRevenuePayments(
  snapshot: KpiLiveSourceSnapshot,
  contract: KpiLiveSourceContract,
  generatedAt: string,
): EvidenceEvaluation {
  const evaluation = evaluateAnyFreshSource(snapshot, contract, generatedAt);
  if (!evaluation.accepted) {
    return {
      ...evaluation,
      reasons: Array.from(new Set([...evaluation.reasons, "stripe_payment_source_missing"])),
    };
  }
  return evaluation;
}

function evaluateEvidence(
  snapshot: KpiLiveSourceSnapshot,
  contract: KpiLiveSourceContract,
  generatedAt: string,
): EvidenceEvaluation {
  if (contract.key === "hosted_starts") {
    return evaluateHostedStarts(snapshot, contract, generatedAt);
  }
  if (contract.key === "sends_replies_calls") {
    return evaluateSendsRepliesCalls(snapshot, contract, generatedAt);
  }
  if (contract.key === "revenue_payments") {
    return evaluateRevenuePayments(snapshot, contract, generatedAt);
  }
  return evaluateAnyFreshSource(snapshot, contract, generatedAt);
}

function rowStatusFromEvaluation(
  row: KpiLiveSourceClaimRow,
  contract: KpiLiveSourceContract,
  evaluation: EvidenceEvaluation,
): KpiLiveSourceRowStatus {
  const hasClaim = row.claimedValue !== undefined && row.claimedValue !== null && row.claimedValue !== "";
  const sourceNeededReasons = evaluation.accepted ? [] : [...evaluation.reasons];
  if (!evaluation.accepted && hasClaim) {
    sourceNeededReasons.push("unsupported_metric_claim");
  }

  return {
    key: contract.key,
    label: row.label || contract.notionRow,
    status: evaluation.accepted ? "Sourced" : "Source needed",
    ownerSystem: contract.ownerSystem,
    sourceContracts: contract.sourceContracts.map((source) => ({
      sourceKey: source.sourceKey,
      collectionOrArtifact: source.collectionOrArtifact,
      allowedFields: source.allowedFields,
      freshnessHours: contract.freshnessHours,
    })),
    reportableValue: evaluation.accepted ? row.claimedValue ?? evaluation.evidenceRefs.length : null,
    suppressedClaim: evaluation.accepted ? null : row.claimedValue ?? row.claimText ?? null,
    evidenceRefs: evaluation.evidenceRefs,
    sourceNeededReasons: Array.from(new Set(sourceNeededReasons)),
    blockedLiveSources: evaluation.accepted ? [] : evaluation.blockedLiveSources,
    blockerBehavior: contract.blockerBehavior,
  };
}

function defaultRows(): KpiLiveSourceClaimRow[] {
  return KPI_LIVE_SOURCE_CONTRACTS.map((contract) => ({
    key: contract.key,
    label: contract.notionRow,
  }));
}

export function buildKpiLiveSourceStatusReport(
  snapshot: KpiLiveSourceSnapshot,
): KpiLiveSourceStatusReport {
  const generatedAt = coerceIso(snapshot.generatedAt) || new Date().toISOString();
  const rows = snapshot.rows?.length ? snapshot.rows : defaultRows();
  const statusRows = rows.map((row) => {
    const contract = contractForKey(row.key);
    const evaluation = evaluateEvidence(snapshot, contract, generatedAt);
    return rowStatusFromEvaluation(row, contract, evaluation);
  });
  const blockedLiveSources = Array.from(
    new Set(statusRows.flatMap((row) => row.blockedLiveSources)),
  ).sort();

  return {
    version: KPI_LIVE_SOURCE_CONTRACT_VERSION,
    generatedAt,
    summary: {
      sourcedRows: statusRows.filter((row) => row.status === "Sourced").length,
      sourceNeededRows: statusRows.filter((row) => row.status === "Source needed").length,
      totalRows: statusRows.length,
    },
    rows: statusRows,
    blockedLiveSources,
    notionMirror: {
      allowedToWriteNotion: false,
      mirrorInstruction:
        "This repo-local artifact is safe for Notion Manager to mirror later. This generator must not write Notion.",
    },
  };
}

function escapeMarkdown(value: unknown) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ")
    .trim();
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function renderKpiLiveSourceStatusMarkdown(report: KpiLiveSourceStatusReport) {
  const lines = [
    "# Autonomous KPI Live Source Status",
    "",
    `Generated: ${report.generatedAt}`,
    `Contract: ${report.version}`,
    "",
    "This artifact is repo-local and Notion-mirror-ready. It does not write Notion, Firestore, Stripe, providers, sends, or Paperclip.",
    "",
    `Summary: ${report.summary.sourcedRows} sourced, ${report.summary.sourceNeededRows} source needed, ${report.summary.totalRows} total.`,
    "",
    "| KPI row | Status | Reportable value | Evidence | Source-needed reason | Blocked live source |",
    "|---|---|---:|---|---|---|",
  ];

  for (const row of report.rows) {
    lines.push(`| ${[
      escapeMarkdown(row.label),
      row.status,
      escapeMarkdown(formatValue(row.reportableValue)),
      escapeMarkdown(row.evidenceRefs.join(", ") || "none"),
      escapeMarkdown(row.sourceNeededReasons.join(", ") || "none"),
      escapeMarkdown(row.blockedLiveSources.join(", ") || "none"),
    ].join(" | ")} |`);
  }

  lines.push("", "## Source Contracts", "");
  for (const row of report.rows) {
    lines.push(`### ${row.label}`);
    lines.push(`- Owner system: ${row.ownerSystem}`);
    lines.push(`- Freshness: ${row.sourceContracts[0]?.freshnessHours ?? "unknown"} hours`);
    lines.push(`- Blocker behavior: ${row.blockerBehavior}`);
    for (const source of row.sourceContracts) {
      lines.push(`- Source: ${source.collectionOrArtifact} (${source.sourceKey})`);
      lines.push(`  - Allowed fields: ${source.allowedFields.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Blocked Live Sources", "");
  if (report.blockedLiveSources.length === 0) {
    lines.push("- none");
  } else {
    for (const source of report.blockedLiveSources) {
      lines.push(`- ${source}`);
    }
  }

  lines.push("", "## Notion Mirror Rule", "");
  lines.push(`- allowed_to_write_notion: ${report.notionMirror.allowedToWriteNotion}`);
  lines.push(`- instruction: ${report.notionMirror.mirrorInstruction}`);

  return `${lines.join("\n")}\n`;
}
