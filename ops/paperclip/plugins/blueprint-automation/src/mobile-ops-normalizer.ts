import type { OpsIssueRequest, OpsRoutingConfig } from "./ops-webhooks.js";

export type MobileOpsFirestoreSignal = {
  event?: string;
  collection: string;
  documentId: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown> | null;
  source?: string;
};

type NormalizeOptions = {
  now?: Date;
  uploadStalledAfterHours?: number;
  inactiveAfterApprovalDays?: number;
};

type MobileOpsEvent = {
  event: string;
  collection: string;
  documentId: string;
  entityLabel: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown> | null;
  source: string;
  reason: string;
  priority?: OpsIssueRequest["priority"];
};

const EXPLICIT_EVENTS = new Set([
  "capture.upload_failed",
  "capture.upload_stalled",
  "capture.raw_validation_failed",
  "capture.submitted",
  "capture.qa_needed",
  "capture.recapture_needed",
  "capturer.first_capture_uploaded",
  "capturer.first_capture_failed",
  "capturer.inactive_after_approval",
  "notification.device_sync_failed",
  "payout.action_required",
  "field_ops.assignment_needed",
]);

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function token(value: unknown) {
  return asString(value)?.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function hoursSince(value: unknown, now: Date) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 36e5);
}

function daysSince(value: unknown, now: Date) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 864e5);
}

function label(data: Record<string, unknown>, fallback: string) {
  return asString(data.capture_id)
    ?? asString(data.captureId)
    ?? asString(data.creator_id)
    ?? asString(data.creatorId)
    ?? asString(data.job_id)
    ?? asString(data.jobId)
    ?? asString(data.payout_id)
    ?? asString(data.payoutId)
    ?? fallback;
}

function startedAt(collection: string, data: Record<string, unknown>) {
  const lifecycle = asRecord(data.lifecycle);
  if (collection === "capture_submissions") {
    return lifecycle?.capture_started_at
      ?? lifecycle?.upload_started_at
      ?? data.upload_started_at
      ?? data.created_at
      ?? data.createdAt
      ?? data.submitted_at
      ?? data.submittedAt;
  }
  return data.updatedAt ?? data.updated_at ?? data.createdAt ?? data.created_at;
}

function isUploaded(data: Record<string, unknown>) {
  const operational = asRecord(data.operational_state);
  const lifecycle = asRecord(data.lifecycle);
  const uploadState = token(operational?.upload_state ?? data.upload_state ?? data.uploadState);
  const status = token(data.status);
  return ["uploaded", "submitted", "complete", "completed"].includes(uploadState ?? "")
    || ["submitted", "under_review", "processing", "qc", "approved", "paid"].includes(status ?? "")
    || Boolean(lifecycle?.capture_uploaded_at ?? data.submitted_at ?? data.submittedAt);
}

function isUploadFailed(data: Record<string, unknown>) {
  const operational = asRecord(data.operational_state);
  const uploadError = asRecord(data.upload_error);
  const uploadState = token(operational?.upload_state ?? data.upload_state ?? data.uploadState);
  const status = token(data.status);
  const errorCode = token(uploadError?.code ?? data.error_code ?? data.errorCode);
  return ["failed", "upload_failed", "error"].includes(uploadState ?? "")
    || ["upload_failed", "raw_validation_failed", "failed"].includes(status ?? "")
    || Boolean(errorCode?.includes("upload"))
    || Boolean(errorCode?.includes("raw_contract"));
}

function isUploadInFlight(data: Record<string, unknown>) {
  const operational = asRecord(data.operational_state);
  const uploadState = token(operational?.upload_state ?? data.upload_state ?? data.uploadState);
  const status = token(data.status);
  return ["uploading", "in_progress", "started", "pending"].includes(uploadState ?? "")
    || ["uploading", "capture_started", "in_progress"].includes(status ?? "");
}

function isQaNeeded(data: Record<string, unknown>) {
  const qaState = token(data.qa_state ?? asRecord(data.qa)?.state ?? asRecord(data.quality)?.state);
  const status = token(data.status);
  return ["qa_needed", "needs_qa", "review_required", "needs_review", "manual_review"].includes(qaState ?? "")
    || ["qa_needed", "review_required", "under_review"].includes(status ?? "");
}

function isRecaptureNeeded(data: Record<string, unknown>) {
  const qaState = token(data.qa_state ?? asRecord(data.qa)?.state ?? asRecord(data.quality)?.state);
  const status = token(data.status);
  return ["recapture_needed", "needs_recapture", "reshoot_required"].includes(qaState ?? "")
    || ["recapture_needed", "needs_recapture", "reshoot_required"].includes(status ?? "");
}

function eventFrom(signal: MobileOpsFirestoreSignal, event: string, reason: string, priority?: OpsIssueRequest["priority"]): MobileOpsEvent {
  return {
    event,
    collection: signal.collection,
    documentId: signal.documentId,
    entityLabel: label(signal.data, signal.documentId),
    data: signal.data,
    previousData: signal.previousData ?? null,
    source: signal.source ?? "firestore",
    reason,
    priority,
  };
}

function inferEvents(signal: MobileOpsFirestoreSignal, options: Required<NormalizeOptions>) {
  const events: MobileOpsEvent[] = [];
  const { collection, data } = signal;

  if (collection === "capture_submissions" || collection === "creatorCaptures") {
    if (isUploadFailed(data)) {
      const errorCode = token(asRecord(data.upload_error)?.code ?? data.error_code ?? data.errorCode);
      events.push(eventFrom(
        signal,
        errorCode?.includes("raw_contract") ? "capture.raw_validation_failed" : "capture.upload_failed",
        "Capture upload or raw validation failed before a truthful package-ready state could be reached.",
        "high",
      ));
    } else if (isRecaptureNeeded(data)) {
      events.push(eventFrom(signal, "capture.recapture_needed", "Capture QA indicates a recapture is needed.", "high"));
    } else if (isQaNeeded(data)) {
      events.push(eventFrom(signal, "capture.qa_needed", "Capture is waiting on QA review.", "high"));
    } else if (isUploaded(data)) {
      events.push(eventFrom(signal, "capture.submitted", "Capture was submitted and needs downstream operational tracking.", "medium"));
    } else if (
      isUploadInFlight(data)
      && (hoursSince(startedAt(collection, data), options.now) ?? 0) >= options.uploadStalledAfterHours
    ) {
      events.push(eventFrom(signal, "capture.upload_stalled", "Capture upload appears stalled beyond the configured threshold.", "high"));
    }
  }

  if (collection === "sessionEvents") {
    const kind = token(data.event ?? data.type ?? data.name);
    if (kind === "notification_device_sync_failed" || kind === "device_sync_failed") {
      events.push(eventFrom(signal, "notification.device_sync_failed", "Notification device sync failed for the mobile client.", "medium"));
    }
  }

  if (collection === "creatorProfiles") {
    const status = token(data.status ?? data.approval_status ?? data.approvalStatus);
    const inactiveDays = daysSince(data.last_capture_at ?? data.lastCaptureAt ?? data.last_submission_at ?? data.lastSubmissionAt, options.now);
    if (["approved", "active"].includes(status ?? "") && inactiveDays !== null && inactiveDays >= options.inactiveAfterApprovalDays) {
      events.push(eventFrom(signal, "capturer.inactive_after_approval", "Approved capturer has not produced recent capture activity.", "medium"));
    }
  }

  if (collection === "capture_jobs") {
    const status = token(data.status);
    const assignment = asRecord(asRecord(data.field_ops)?.capturer_assignment);
    const overdueReview = asRecord(asRecord(data.site_access)?.overdue_review);
    if (!["cancelled", "completed", "paid", "approved"].includes(status ?? "")
      && (!assignment || overdueReview?.active === true || ["scheduled", "capture_requested", "dispatch_review", "assignment_needed"].includes(status ?? ""))) {
      events.push(eventFrom(signal, "field_ops.assignment_needed", "Capture job needs assignment, scheduling, or site-access review.", "medium"));
    }
  }

  if (collection === "creatorPayouts") {
    const status = token(data.status);
    const reviewStatus = token(asRecord(data.finance_review)?.review_status);
    if (["action_required", "review_required", "pending_approval", "failed"].includes(status ?? "")
      || ["pending", "investigating", "needs_review", "action_required"].includes(reviewStatus ?? "")) {
      events.push(eventFrom(signal, "payout.action_required", "Creator payout requires finance or account action.", "high"));
    }
  }

  return events;
}

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function description(event: MobileOpsEvent, summary: string) {
  const metadata = {
    event: event.event,
    collection: event.collection,
    documentId: event.documentId,
    source: event.source,
    reason: event.reason,
    data: event.data,
    previousData: event.previousData ?? null,
  };
  return `${summary}\n\n## Truth Boundary\nDo not mark this complete from app-side optimism. Close it only when backend, Firestore, Paperclip, payout, or QA state shows the lifecycle step is actually resolved.\n\n## Source Payload\n\`\`\`json\n${stringify(metadata)}\n\`\`\``;
}

function issue(
  event: MobileOpsEvent,
  sourceType: string,
  suffix: string,
  title: string,
  summary: string,
  projectName: string,
  assignee: string | undefined,
  priority: OpsIssueRequest["priority"],
): OpsIssueRequest {
  return {
    sourceType,
    sourceId: `${event.collection}:${event.documentId}:${suffix}`,
    title,
    description: description(event, summary),
    projectName,
    assignee: assignee ?? "ops-lead",
    priority,
    metadata: {
      event: event.event,
      collection: event.collection,
      documentId: event.documentId,
      source: event.source,
      reason: event.reason,
      data: event.data,
      previousData: event.previousData ?? null,
    },
  };
}

function route(event: MobileOpsEvent, routing: OpsRoutingConfig): OpsIssueRequest[] {
  switch (event.event) {
    case "capture.upload_failed":
    case "capture.upload_stalled":
    case "capture.raw_validation_failed":
      return [issue(event, "mobile-capture-lifecycle", "technical", `Mobile capture technical review: ${event.entityLabel}`, "Investigate the failed or stalled mobile capture path and leave the creator-visible state truthful.", "blueprint-capture", routing.captureCodexAgent, event.priority ?? "high")];
    case "capture.submitted":
    case "capture.qa_needed":
      return [issue(event, "mobile-capture-qa", "qa", `Mobile capture QA: ${event.entityLabel}`, "Review the submitted capture and coordinate pipeline handoff only from real capture provenance.", "blueprint-capture", routing.captureQaAgent, event.priority ?? "high")];
    case "capture.recapture_needed":
      return [
        issue(event, "mobile-capture-qa", "recapture-qa", `Mobile capture recapture QA: ${event.entityLabel}`, "Confirm why recapture is required and keep QA state aligned with source evidence.", "blueprint-capture", routing.captureQaAgent, event.priority ?? "high"),
        issue(event, "mobile-capturer-lifecycle", "recapture-support", `Capturer recapture support: ${event.entityLabel}`, "Coordinate creator-facing recovery for the recapture request without promising payout or buyer readiness.", "blueprint-capture", routing.capturerSuccessAgent, event.priority ?? "high"),
      ];
    case "capturer.first_capture_uploaded":
      return [issue(event, "mobile-capturer-lifecycle", "first-upload", `First capture uploaded: ${event.entityLabel}`, "Support the first-capture moment and verify the creator sees truthful review state.", "blueprint-capture", routing.capturerSuccessAgent, event.priority ?? "medium")];
    case "capturer.first_capture_failed":
      return [issue(event, "mobile-capturer-lifecycle", "first-failed", `First capture failed: ${event.entityLabel}`, "Help the creator recover from a failed first capture and coordinate technical investigation if needed.", "blueprint-capture", routing.capturerSuccessAgent, event.priority ?? "high")];
    case "capturer.inactive_after_approval":
      return [issue(event, "mobile-capturer-lifecycle", "inactive-approved", `Approved capturer inactive: ${event.entityLabel}`, "Follow up on an approved capturer who has not produced recent capture activity.", "blueprint-capture", routing.capturerSuccessAgent, event.priority ?? "medium")];
    case "notification.device_sync_failed":
      return [issue(event, "mobile-capture-lifecycle", "notification-device", `Notification device sync failed: ${event.entityLabel}`, "Investigate notification device sync so nearby jobs, recapture requests, and payout notices can reach the creator.", "blueprint-capture", routing.captureCodexAgent, event.priority ?? "medium")];
    case "payout.action_required":
      return [issue(event, "mobile-payout-lifecycle", "action-required", `Payout action required: ${event.entityLabel}`, "Resolve the payout or account action before the app can truthfully show payout progress.", "blueprint-webapp", routing.financeSupportAgent, event.priority ?? "high")];
    case "field_ops.assignment_needed":
      return [issue(event, "mobile-field-ops-lifecycle", "assignment", `Capture job field ops needed: ${event.entityLabel}`, "Assign, schedule, or clear site-access blockers for the capture job.", "blueprint-capture", routing.fieldOpsAgent, event.priority ?? "medium")];
    default:
      return [];
  }
}

export function normalizeMobileOpsSignal(
  signal: MobileOpsFirestoreSignal,
  routing: OpsRoutingConfig,
  options: NormalizeOptions = {},
): OpsIssueRequest[] {
  const normalized: MobileOpsFirestoreSignal = {
    collection: asString(signal.collection) ?? "unknown",
    documentId: asString(signal.documentId) ?? asString(signal.data?.id) ?? "unknown",
    data: asRecord(signal.data) ?? {},
    previousData: asRecord(signal.previousData) ?? null,
    source: asString(signal.source) ?? "firestore",
    event: asString(signal.event),
  };
  const effectiveOptions = {
    now: options.now ?? new Date(),
    uploadStalledAfterHours: options.uploadStalledAfterHours ?? 2,
    inactiveAfterApprovalDays: options.inactiveAfterApprovalDays ?? 7,
  };
  const explicit = normalized.event && EXPLICIT_EVENTS.has(normalized.event)
    ? [eventFrom(normalized, normalized.event, `Explicit mobile ops event ${normalized.event} arrived.`)]
    : [];
  const events = explicit.length > 0 ? explicit : inferEvents(normalized, effectiveOptions);
  const seen = new Set<string>();
  const requests: OpsIssueRequest[] = [];
  for (const event of events) {
    for (const request of route(event, routing)) {
      const key = `${request.sourceType}:${request.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      requests.push(request);
    }
  }
  return requests;
}
