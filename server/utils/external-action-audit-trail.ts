type UnknownRecord = Record<string, unknown>;

export type ExternalActionKind = "outbound" | "lifecycle" | "escalation";
export type ExternalActionApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "blocked"
  | "rejected"
  | "unknown";
export type ExternalActionResult =
  | "approved"
  | "skipped"
  | "dry_run"
  | "sent"
  | "replied"
  | "failed"
  | "blocked"
  | "pending"
  | "rejected"
  | "executing"
  | "queued"
  | "unknown";

export interface ExternalActionSourceObject {
  collection: string;
  id: string;
  key: string;
  path?: string | null;
}

export interface ExternalActionAuditTrailItem {
  id: string;
  actionKind: ExternalActionKind;
  actor: string;
  sourceObject: ExternalActionSourceObject;
  approvalState: ExternalActionApprovalState;
  result: ExternalActionResult;
  providerPath: string;
  title: string;
  notes: string | null;
  evidencePaths: string[];
  createdAtIso: string | null;
  updatedAtIso: string | null;
  liveTelemetry: false;
}

export interface ExternalActionAuditTrailSource {
  actionLedgerDocs?: UnknownRecord[];
  gtmLedgers?: Array<{
    path?: string;
    ledger?: UnknownRecord;
  }>;
  gtmSendExecutorManifests?: UnknownRecord[];
  humanBlockerDispatches?: UnknownRecord[];
  humanReplyEvents?: UnknownRecord[];
  humanBlockerThreads?: UnknownRecord[];
  voiceSupportQueueDocs?: UnknownRecord[];
}

export interface ExternalActionAuditTrailProjection {
  items: ExternalActionAuditTrailItem[];
  summary: {
    total: number;
    byActionKind: Record<ExternalActionKind, number>;
    byApprovalState: Partial<Record<ExternalActionApprovalState, number>>;
    byResult: Partial<Record<ExternalActionResult, number>>;
    byProviderPath: Record<string, number>;
  };
}

export interface ExternalActionAuditTrailFilter {
  actionKind?: ExternalActionKind | ExternalActionKind[];
  actor?: string | string[];
  sourceObject?: string | string[];
  approvalState?: ExternalActionApprovalState | ExternalActionApprovalState[];
  result?: ExternalActionResult | ExternalActionResult[];
  providerPath?: string | string[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compactStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(asString)
        .filter(Boolean),
    ),
  );
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function sourceObject(collection: string, id: string, path?: string | null): ExternalActionSourceObject {
  const cleanCollection = collection || "externalActions";
  const cleanId = id || "unknown";
  return {
    collection: cleanCollection,
    id: cleanId,
    key: `${cleanCollection}/${cleanId}`,
    path: path || null,
  };
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (isRecord(value) && typeof value.toDate === "function") {
    const date = value.toDate() as unknown;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (
    isRecord(value)
    && typeof value.seconds === "number"
    && Number.isFinite(value.seconds)
  ) {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

function actionKindForLedger(doc: UnknownRecord): ExternalActionKind {
  const lane = normalizeKey(asString(doc.lane));
  const sourceCollection = normalizeKey(asString(doc.source_collection));
  const payload = asRecord(doc.action_payload);
  if (
    lane.includes("lifecycle")
    || sourceCollection === "marketplaceentitlements"
    || asString(payload.lifecycleStage)
    || asString(payload.lifecycleCadenceId)
    || asString(payload.lifecycleStepKey)
  ) {
    return "lifecycle";
  }
  return "outbound";
}

function approvalStateForLedger(doc: UnknownRecord): ExternalActionApprovalState {
  const status = normalizeKey(asString(doc.status));
  if (status === "pending_approval") return "pending";
  if (status === "operator_approved") return "approved";
  if (status === "rejected" || status === "operator_rejected") return "rejected";
  if (status === "auto_approved") return "not_required";
  if (asString(doc.approved_by)) return "approved";
  if (asString(doc.auto_approve_reason)) return "not_required";
  if (status === "failed") return "unknown";
  if (status === "sent") return "not_required";
  return "unknown";
}

function resultForLedger(doc: UnknownRecord): ExternalActionResult {
  const status = normalizeKey(asString(doc.status));
  if (status === "operator_approved" || status === "auto_approved") return "approved";
  if (status === "pending_approval") return "blocked";
  if (status === "operator_rejected" || status === "rejected") return "rejected";
  if (status === "executing") return "executing";
  if (status === "sent") return "sent";
  if (status === "failed") return "failed";
  return status ? "unknown" : "unknown";
}

function projectActionLedgerDocs(docs: UnknownRecord[] = []): ExternalActionAuditTrailItem[] {
  return docs.map((doc, index) => {
    const id = asString(doc.id) || asString(doc.ledgerDocId) || `ledger-${index + 1}`;
    const payload = asRecord(doc.action_payload);
    const draft = asRecord(doc.draft_output);
    const sourceCollection = asString(doc.source_collection) || "action_ledger";
    const sourceDocId = asString(doc.source_doc_id) || id;
    const actionType = asString(doc.action_type) || asString(payload.type) || "unknown";
    const actor =
      asString(doc.approved_by)
      || asString(doc.rejected_by)
      || asString(payload.actor)
      || asString(draft.ownerAgent)
      || asString(draft.owner_agent)
      || asString(doc.lane)
      || "unknown";
    const title =
      asString(payload.subject)
      || asString(draft.recommendation)
      || `${asString(doc.lane) || "action"} ${actionType}`.trim();
    const notes =
      asString(doc.last_execution_error)
      || asString(doc.approval_reason)
      || asString(doc.rejected_reason)
      || null;

    return {
      id: `action_ledger:${id}`,
      actionKind: actionKindForLedger(doc),
      actor,
      sourceObject: sourceObject(sourceCollection, sourceDocId),
      approvalState: approvalStateForLedger(doc),
      result: resultForLedger(doc),
      providerPath: `action_ledger/${actionType}`,
      title,
      notes,
      evidencePaths: compactStrings([doc.send_ledger_path, payload.evidencePath, payload.evidence_path]),
      createdAtIso: toIso(doc.created_at),
      updatedAtIso: toIso(doc.updated_at || doc.last_execution_at || doc.sent_at),
      liveTelemetry: false,
    };
  });
}

function approvalStateForGtmTarget(outbound: UnknownRecord): ExternalActionApprovalState {
  const state = normalizeKey(asString(outbound.approvalState));
  if (state === "pending_first_send_approval") return "pending";
  if (state === "not_required") return "not_required";
  if (state === "approved") return "approved";
  if (state === "blocked") return "blocked";
  return "unknown";
}

function hasOpenBlocker(target: UnknownRecord): boolean {
  return asArray(target.blockers).some((entry) => {
    const blocker = asRecord(entry);
    return ["open", "blocked", "waiting_on_human", "waiting_on_provider"].includes(
      normalizeKey(asString(blocker.status)),
    );
  });
}

function resultForGtmTarget(target: UnknownRecord): ExternalActionResult {
  const outbound = asRecord(target.outbound);
  const status = normalizeKey(asString(outbound.status));
  const approval = approvalStateForGtmTarget(outbound);
  if (approval === "blocked" || hasOpenBlocker(target)) return "blocked";
  if (["sent", "hosted_review_started", "closed"].includes(status)) return "sent";
  if (status === "replied") return "replied";
  if (approval === "approved" || status === "human_approved") return "approved";
  if (approval === "pending" || status === "not_ready" || status === "draft_ready") return "skipped";
  return "unknown";
}

function projectGtmLedgers(entries: ExternalActionAuditTrailSource["gtmLedgers"] = []): ExternalActionAuditTrailItem[] {
  const items: ExternalActionAuditTrailItem[] = [];
  for (const entry of entries) {
    const path = asString(entry.path);
    const ledger = asRecord(entry.ledger);
    for (const target of asArray(ledger.targets).map(asRecord)) {
      const outbound = asRecord(target.outbound);
      const sales = asRecord(target.sales);
      const id = asString(target.id);
      if (!id) continue;
      const actor =
        asString(outbound.approvedBy)
        || asString(sales.nextActionOwner)
        || "outbound-sales-agent";
      items.push({
        id: `gtm_target:${id}`,
        actionKind: "outbound",
        actor,
        sourceObject: sourceObject("gtmTargets", id, path || null),
        approvalState: approvalStateForGtmTarget(outbound),
        result: resultForGtmTarget(target),
        providerPath: "gtm/ledger-target",
        title: asString(target.organizationName) || id,
        notes:
          asString(sales.nextAction)
          || asArray(target.blockers).map((blocker) => asString(asRecord(blocker).summary)).filter(Boolean).join("; ")
          || null,
        evidencePaths: compactStrings([
          path,
          asRecord(target.artifact).path,
          outbound.messagePath,
          outbound.sendLedgerPath,
          outbound.sendReceipt,
          outbound.replyThreadPath,
        ]),
        createdAtIso: toIso(outbound.approvedAt || outbound.sentAt),
        updatedAtIso: toIso(outbound.replyAt || outbound.sentAt || outbound.approvedAt),
        liveTelemetry: false,
      });
    }
  }
  return items;
}

function manifestSourceKey(manifest: UnknownRecord) {
  const path = asString(manifest.path);
  if (path) return path;
  return asString(manifest.generatedAt) || asString(manifest.ledgerPath) || "gtm-send-executor";
}

function pushManifestAggregate(params: {
  items: ExternalActionAuditTrailItem[];
  manifest: UnknownRecord;
  suffix: string;
  count: number;
  result: ExternalActionResult;
  approvalState: ExternalActionApprovalState;
  title: string;
  notes?: string | null;
}) {
  if (params.count <= 0) return;
  const sourceKey = manifestSourceKey(params.manifest);
  const providerPath = params.manifest.dryRun === true
    ? "gtm/send-executor/dry-run"
    : "gtm/send-executor";
  params.items.push({
    id: `gtm_send_executor:${sourceKey}:${params.suffix}`,
    actionKind: "outbound",
    actor: "gtm-send-executor",
    sourceObject: sourceObject("gtmSendExecutorManifest", sourceKey, asString(params.manifest.path) || null),
    approvalState: params.approvalState,
    result: params.result,
    providerPath,
    title: params.title,
    notes: params.notes || compactStrings(asArray(params.manifest.errors)).join("; ") || null,
    evidencePaths: compactStrings([params.manifest.path, params.manifest.ledgerPath]),
    createdAtIso: toIso(params.manifest.generatedAt),
    updatedAtIso: toIso(params.manifest.generatedAt),
    liveTelemetry: false,
  });
}

function projectGtmSendExecutorManifests(manifests: UnknownRecord[] = []): ExternalActionAuditTrailItem[] {
  const items: ExternalActionAuditTrailItem[] = [];
  for (const manifest of manifests) {
    const summary = asRecord(manifest.summary);
    pushManifestAggregate({
      items,
      manifest,
      suffix: "dry_run",
      count: asNumber(summary.dryRun),
      result: "dry_run",
      approvalState: "approved",
      title: "GTM send executor dry-run receipts",
    });
    pushManifestAggregate({
      items,
      manifest,
      suffix: "skipped_approval",
      count: asNumber(summary.skippedApproval),
      result: "skipped",
      approvalState: "pending",
      title: "GTM send executor skipped unapproved rows",
    });
    pushManifestAggregate({
      items,
      manifest,
      suffix: "skipped_no_recipient",
      count: asNumber(summary.skippedNoRecipient),
      result: "skipped",
      approvalState: "blocked",
      title: "GTM send executor skipped rows missing recipient evidence",
    });
    pushManifestAggregate({
      items,
      manifest,
      suffix: "skipped_no_message",
      count: asNumber(summary.skippedNoMessage),
      result: "skipped",
      approvalState: "blocked",
      title: "GTM send executor skipped rows missing message evidence",
    });
    pushManifestAggregate({
      items,
      manifest,
      suffix: "skipped_already_sent",
      count: asNumber(summary.skippedAlreadySent),
      result: "skipped",
      approvalState: "approved",
      title: "GTM send executor skipped rows already sent",
    });
    pushManifestAggregate({
      items,
      manifest,
      suffix: "failed",
      count: asNumber(summary.failed),
      result: "failed",
      approvalState: "unknown",
      title: "GTM send executor failed local proof run",
    });
  }
  return items;
}

function projectHumanBlockerDispatches(docs: UnknownRecord[] = []): ExternalActionAuditTrailItem[] {
  return docs.map((doc, index) => {
    const id = asString(doc.id) || asString(doc.dispatch_id) || `dispatch-${index + 1}`;
    const repoContext = asRecord(doc.repo_context);
    const sourceId =
      asString(repoContext.ops_work_item_id)
      || asString(doc.ops_work_item_id)
      || asString(repoContext.issue_id)
      || asString(doc.paperclip_issue_id)
      || id;
    const deliveryStatus = normalizeKey(asString(doc.delivery_status));
    const deliveryMode = normalizeKey(asString(doc.delivery_mode));
    const emailSent = doc.email_sent === true;
    const slackSent = doc.slack_sent === true;
    const approvalState: ExternalActionApprovalState =
      deliveryMode === "review_required" && !emailSent && !slackSent
        ? "pending"
        : asString(doc.reviewed_by)
          ? "approved"
          : "not_required";
    const result: ExternalActionResult =
      deliveryStatus === "failed"
        ? "failed"
        : deliveryStatus === "awaiting_review"
          ? "blocked"
          : deliveryStatus === "sent"
            ? "sent"
            : "pending";
    const providerPath = emailSent && slackSent
      ? "human_blocker/email+slack"
      : slackSent
        ? "human_blocker/slack"
        : emailSent
          ? "human_blocker/email"
          : "human_blocker/review";

    return {
      id: `human_blocker_dispatch:${id}`,
      actionKind: "escalation",
      actor:
        asString(asRecord(doc.actor).email)
        || asString(doc.sender_owner)
        || asString(doc.execution_owner)
        || "unknown",
      sourceObject: sourceObject("opsWorkItems", sourceId),
      approvalState,
      result,
      providerPath,
      title: asString(doc.title) || asString(doc.blocker_id) || id,
      notes: asString(doc.email_subject) || asString(doc.blocker_kind) || null,
      evidencePaths: compactStrings([doc.report_paths, repoContext.source_ref]),
      createdAtIso: toIso(doc.created_at),
      updatedAtIso: toIso(doc.updated_at),
      liveTelemetry: false,
    };
  });
}

function projectHumanReplyEvents(docs: UnknownRecord[] = []): ExternalActionAuditTrailItem[] {
  return docs.map((doc, index) => {
    const id = asString(doc.id) || asString(doc.external_message_id) || `reply-${index + 1}`;
    const channel = asString(doc.channel) || "unknown";
    const classification = normalizeKey(asString(doc.classification));
    const resolution = normalizeKey(asString(doc.resolution));
    const result: ExternalActionResult =
      classification === "approval" && resolution === "resolved_input"
        ? "approved"
        : resolution === "ambiguous_input"
          ? "blocked"
          : resolution === "resolved_input"
            ? "sent"
            : "pending";

    return {
      id: `human_reply:${id}`,
      actionKind: "escalation",
      actor: asString(doc.sender) || "unknown",
      sourceObject: sourceObject("humanBlockerThreads", asString(doc.blocker_id) || id),
      approvalState: result === "approved" ? "approved" : "pending",
      result,
      providerPath: `human_reply/${channel}`,
      title: asString(doc.subject) || asString(doc.blocker_id) || id,
      notes: compactStrings([doc.reason, doc.body_excerpt]).join(" ") || null,
      evidencePaths: [],
      createdAtIso: toIso(doc.received_at || doc.created_at),
      updatedAtIso: toIso(doc.received_at || doc.created_at),
      liveTelemetry: false,
    };
  });
}

function projectHumanBlockerThreads(docs: UnknownRecord[] = []): ExternalActionAuditTrailItem[] {
  return docs.map((doc, index) => {
    const id = asString(doc.id) || asString(doc.blocker_id) || `thread-${index + 1}`;
    const status = normalizeKey(asString(doc.status));
    const result: ExternalActionResult =
      status === "resolved" || status === "closed"
        ? "sent"
        : status === "ambiguous" || status === "blocked"
          ? "blocked"
          : "pending";
    return {
      id: `human_blocker_thread:${id}`,
      actionKind: "escalation",
      actor: asString(doc.sender_owner) || asString(doc.routing_owner) || "unknown",
      sourceObject: sourceObject("humanBlockerThreads", asString(doc.blocker_id) || id),
      approvalState: normalizeKey(asString(doc.review_status)) === "approved" ? "approved" : "pending",
      result,
      providerPath: `human_blocker_thread/${asString(doc.channel) || "unknown"}`,
      title: asString(doc.title) || id,
      notes: asString(doc.blocked_reason) || asString(doc.summary) || null,
      evidencePaths: compactStrings([asRecord(doc.record_of_truth).report_paths]),
      createdAtIso: toIso(doc.created_at),
      updatedAtIso: toIso(doc.updated_at),
      liveTelemetry: false,
    };
  });
}

function projectVoiceSupportQueueDocs(docs: UnknownRecord[] = []): ExternalActionAuditTrailItem[] {
  return docs.map((doc, index) => {
    const id = asString(doc.id) || asString(doc.conversation_id) || `voice-${index + 1}`;
    const status = normalizeKey(asString(doc.status));
    const handoffRequired = doc.handoff_required === true;
    const result: ExternalActionResult =
      handoffRequired || status === "new" || status === "pending"
        ? "blocked"
        : status === "failed"
          ? "failed"
          : "queued";
    return {
      id: `voice_support_queue:${id}`,
      actionKind: "escalation",
      actor: "voice_concierge",
      sourceObject: sourceObject("voice_support_queue", asString(doc.conversation_id) || id),
      approvalState: handoffRequired ? "pending" : "not_required",
      result,
      providerPath: "voice/support-queue",
      title: asString(doc.category) || "voice escalation",
      notes: compactStrings([doc.last_user_message, doc.last_response_text]).join(" ") || null,
      evidencePaths: [],
      createdAtIso: toIso(doc.created_at),
      updatedAtIso: toIso(doc.updated_at),
      liveTelemetry: false,
    };
  });
}

function sortedItems(items: ExternalActionAuditTrailItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.updatedAtIso || left.createdAtIso || "";
    const rightTime = right.updatedAtIso || right.createdAtIso || "";
    if (leftTime !== rightTime) {
      return rightTime.localeCompare(leftTime);
    }
    return left.id.localeCompare(right.id);
  });
}

function countBy<T extends string>(
  items: ExternalActionAuditTrailItem[],
  read: (item: ExternalActionAuditTrailItem) => T,
): Record<T, number> {
  return items.reduce((counts, item) => {
    const key = read(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

export function projectExternalActionAuditTrail(
  source: ExternalActionAuditTrailSource,
): ExternalActionAuditTrailProjection {
  const items = sortedItems([
    ...projectActionLedgerDocs(source.actionLedgerDocs),
    ...projectGtmLedgers(source.gtmLedgers),
    ...projectGtmSendExecutorManifests(source.gtmSendExecutorManifests),
    ...projectHumanBlockerDispatches(source.humanBlockerDispatches),
    ...projectHumanReplyEvents(source.humanReplyEvents),
    ...projectHumanBlockerThreads(source.humanBlockerThreads),
    ...projectVoiceSupportQueueDocs(source.voiceSupportQueueDocs),
  ]);

  return {
    items,
    summary: {
      total: items.length,
      byActionKind: {
        outbound: items.filter((item) => item.actionKind === "outbound").length,
        lifecycle: items.filter((item) => item.actionKind === "lifecycle").length,
        escalation: items.filter((item) => item.actionKind === "escalation").length,
      },
      byApprovalState: countBy(items, (item) => item.approvalState),
      byResult: countBy(items, (item) => item.result),
      byProviderPath: countBy(items, (item) => item.providerPath),
    },
  };
}

function matchesStringFilter(value: string, filter?: string | string[]) {
  if (filter === undefined) return true;
  const accepted = Array.isArray(filter) ? filter : [filter];
  const normalizedValue = normalizeKey(value);
  return accepted.map(normalizeKey).includes(normalizedValue);
}

export function filterExternalActionAuditTrail(
  items: ExternalActionAuditTrailItem[],
  filter: ExternalActionAuditTrailFilter,
): ExternalActionAuditTrailItem[] {
  return items.filter((item) =>
    matchesStringFilter(item.actionKind, filter.actionKind)
    && matchesStringFilter(item.actor, filter.actor)
    && matchesStringFilter(item.sourceObject.key, filter.sourceObject)
    && matchesStringFilter(item.approvalState, filter.approvalState)
    && matchesStringFilter(item.result, filter.result)
    && matchesStringFilter(item.providerPath, filter.providerPath),
  );
}
