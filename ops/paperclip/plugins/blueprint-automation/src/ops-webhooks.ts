import type { PluginWebhookInput } from "@paperclipai/plugin-sdk";
import { normalizeMobileOpsSignal } from "./mobile-ops-normalizer.js";

type IssuePriority = "critical" | "high" | "medium" | "low";

export interface OpsRoutingConfig {
  opsLead?: string;
  intakeAgent: string;
  captureCodexAgent?: string;
  captureQaAgent: string;
  capturerSuccessAgent?: string;
  fieldOpsAgent?: string;
  financeSupportAgent: string;
}

export interface OpsIssueRequest {
  sourceType: string;
  sourceId: string;
  title: string;
  description: string;
  projectName: string;
  assignee: string;
  priority: IssuePriority;
  metadata: Record<string, unknown>;
}

export interface OpsWebhookResult {
  handled: boolean;
  workItem?: OpsIssueRequest;
  workItems?: OpsIssueRequest[];
}

function stringifyMetadata(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildDescription(summary: string, metadata: Record<string, unknown>) {
  return `${summary}\n\n## Source Payload\n\`\`\`json\n${stringifyMetadata(metadata)}\n\`\`\``;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Handle Firestore-triggered events for new signups, requests, and captures.
 */
export async function handleFirestoreWebhook(
  input: PluginWebhookInput,
  routing: OpsRoutingConfig,
): Promise<OpsWebhookResult> {
  const body = (input.parsedBody ?? {}) as {
    event?: string;
    documentId?: string;
    collection?: string;
    data?: Record<string, unknown>;
    previousData?: Record<string, unknown> | null;
    source?: string;
  };

  const event = asString(body.event);
  const documentId = asString(body.documentId);
  const collection = asString(body.collection) ?? "unknown";
  const data = body.data ?? {};

  if (!event || !documentId) {
    return { handled: false };
  }

  const mobileWorkItems = normalizeMobileOpsSignal(
    {
      event,
      documentId,
      collection,
      data,
      previousData: body.previousData ?? null,
      source: asString(body.source) ?? "ops-firestore-webhook",
    },
    routing,
  );
  if (mobileWorkItems.length > 0) {
    return {
      handled: true,
      workItems: mobileWorkItems,
    };
  }

  const eventHandlers: Record<string, Omit<OpsIssueRequest, "sourceId" | "metadata" | "description"> & { prefix: string }> = {
    "waitlist.created": {
      prefix: "Waitlist",
      title: "",
      sourceType: "ops-firestore",
      projectName: "blueprint-webapp",
      assignee: routing.intakeAgent,
      priority: "medium",
    },
    "request.created": {
      prefix: "Inbound Request",
      title: "",
      sourceType: "ops-firestore",
      projectName: "blueprint-webapp",
      assignee: routing.intakeAgent,
      priority: "high",
    },
    "capture.completed": {
      prefix: "Capture QA",
      title: "",
      sourceType: "ops-firestore",
      projectName: "blueprint-capture-pipeline",
      assignee: routing.captureQaAgent,
      priority: "high",
    },
  };

  const handler = eventHandlers[event];
  if (!handler) {
    return { handled: false };
  }

  const metadata = {
    event,
    collection,
    documentId,
    data,
  };

  return {
    handled: true,
    workItem: {
      sourceType: handler.sourceType,
      sourceId: `${collection}:${documentId}`,
      title: `${handler.prefix}: ${documentId}`,
      description: buildDescription(
        `Firestore event \`${event}\` arrived from collection \`${collection}\` and needs routing.`,
        metadata,
      ),
      projectName: handler.projectName,
      assignee: handler.assignee,
      priority: handler.priority,
      metadata,
    },
  };
}

/**
 * Handle Stripe webhook events forwarded to Paperclip.
 */
export async function handleStripeWebhook(
  input: PluginWebhookInput,
  routing: OpsRoutingConfig,
): Promise<OpsWebhookResult> {
  const body = (input.parsedBody ?? {}) as {
    type?: string;
    id?: string;
    data?: { object?: Record<string, unknown> };
  };

  const eventType = asString(body.type);
  const eventId = asString(body.id);
  const object = body.data?.object ?? {};

  if (!eventType || !eventId) {
    return { handled: false };
  }

  const priorities: Record<string, IssuePriority> = {
    "payout.failed": "critical",
    "charge.dispute.created": "high",
    "account.updated": "medium",
    "charge.refunded": "medium",
  };

  const priority = priorities[eventType];
  if (!priority) {
    return { handled: true };
  }

  const metadata = {
    eventType,
    eventId,
    object,
  };

  return {
    handled: true,
    workItem: {
      sourceType: "ops-stripe",
      sourceId: eventId,
      title: `Stripe: ${eventType} (${eventId})`,
      description: buildDescription(
        `Stripe event \`${eventType}\` requires finance/support review.`,
        metadata,
      ),
      projectName: "blueprint-webapp",
      assignee: routing.financeSupportAgent,
      priority,
      metadata,
    },
  };
}

/**
 * Handle support inbox webhook (email forward or form submission).
 */
export async function handleSupportWebhook(
  input: PluginWebhookInput,
  routing: OpsRoutingConfig,
): Promise<OpsWebhookResult> {
  const body = (input.parsedBody ?? {}) as {
    ticketId?: string;
    subject?: string;
    from?: string;
    body?: string;
    source?: string;
    receivedAt?: string;
  };

  const subject = asString(body.subject);
  const from = asString(body.from);
  const receivedAt = asString(body.receivedAt) ?? new Date().toISOString();
  const source = asString(body.source) ?? "support";
  const ticketId = asString(body.ticketId) ?? `${from ?? "unknown"}:${receivedAt}`;

  if (!subject || !from) {
    return { handled: false };
  }

  const metadata = {
    ticketId,
    subject,
    from,
    source,
    receivedAt,
    body: body.body ?? "",
  };

  return {
    handled: true,
    workItem: {
      sourceType: "ops-support",
      sourceId: ticketId,
      title: `Support: ${subject}`,
      description: buildDescription(
        `Support ticket received from \`${from}\` via \`${source}\`.`,
        metadata,
      ),
      projectName: "blueprint-webapp",
      assignee: routing.financeSupportAgent,
      priority: "medium",
      metadata,
    },
  };
}
