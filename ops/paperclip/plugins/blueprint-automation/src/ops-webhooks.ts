import type { PluginContext, PluginWebhookInput } from "@paperclipai/plugin-sdk";

export interface OpsWebhookResult {
  handled: boolean;
  agentAssignment?: string;
  issueTitle?: string;
}

/**
 * Handle Firestore-triggered events for new signups, requests, and captures.
 */
export async function handleFirestoreWebhook(
  input: PluginWebhookInput,
  ctx: PluginContext
): Promise<OpsWebhookResult> {
  const body = (input.parsedBody ?? {}) as {
    event: string;
    documentId: string;
    collection: string;
    data: Record<string, unknown>;
  };

  if (!body.event || !body.documentId) {
    return { handled: false };
  }

  const eventHandlers: Record<string, { agent: string; prefix: string }> = {
    "waitlist.created": { agent: "intake-agent", prefix: "Waitlist" },
    "request.created": { agent: "intake-agent", prefix: "Inbound Request" },
    "capture.completed": { agent: "capture-qa-agent", prefix: "Capture QA" },
  };

  const handler = eventHandlers[body.event];
  if (!handler) {
    return { handled: false };
  }

  const title = `${handler.prefix}: ${body.documentId}`;
  const fingerprint = `firestore:${body.collection}:${body.documentId}`;

  const existingMapping = await ctx.entities.list({
    entityType: "source-mapping",
    scopeKind: "company",
    scopeId: "",
    externalId: fingerprint,
    limit: 1,
    offset: 0,
  });

  if (existingMapping.length > 0) {
    return { handled: true, issueTitle: title };
  }

  await ctx.activity.log({
    companyId: "",
    message: `ops.firestore.${body.event}`,
    entityType: "webhook",
    entityId: fingerprint,
    metadata: {
      event: body.event,
      collection: body.collection,
      documentId: body.documentId,
      assignee: handler.agent,
    },
  });

  return { handled: true, agentAssignment: handler.agent, issueTitle: title };
}

/**
 * Handle Stripe webhook events forwarded to Paperclip.
 */
export async function handleStripeWebhook(
  input: PluginWebhookInput,
  ctx: PluginContext
): Promise<OpsWebhookResult> {
  const body = (input.parsedBody ?? {}) as {
    type: string;
    id: string;
    data?: { object?: Record<string, unknown> };
  };

  if (!body.type || !body.id) {
    return { handled: false };
  }

  const relevantEvents = [
    "payout.failed",
    "charge.dispute.created",
    "account.updated",
    "charge.refunded",
  ];

  if (!relevantEvents.includes(body.type)) {
    return { handled: true };
  }

  const fingerprint = `stripe:${body.type}:${body.id}`;
  const title = `Stripe: ${body.type} (${body.id})`;

  const existingMapping = await ctx.entities.list({
    entityType: "source-mapping",
    scopeKind: "company",
    scopeId: "",
    externalId: fingerprint,
    limit: 1,
    offset: 0,
  });

  if (existingMapping.length > 0) {
    return { handled: true, issueTitle: title };
  }

  await ctx.activity.log({
    companyId: "",
    message: `ops.stripe.${body.type}`,
    entityType: "webhook",
    entityId: fingerprint,
    metadata: {
      event: body.type,
      stripeEventId: body.id,
      assignee: "finance-support-agent",
    },
  });

  return {
    handled: true,
    agentAssignment: "finance-support-agent",
    issueTitle: title,
  };
}

/**
 * Handle support inbox webhook (email forward or form submission).
 */
export async function handleSupportWebhook(
  input: PluginWebhookInput,
  ctx: PluginContext
): Promise<OpsWebhookResult> {
  const body = (input.parsedBody ?? {}) as {
    subject: string;
    from: string;
    body: string;
    source: string;
    receivedAt: string;
  };

  if (!body.subject || !body.from) {
    return { handled: false };
  }

  const title = `Support: ${body.subject}`;
  const fingerprint = `support:${body.from}:${body.receivedAt ?? Date.now()}`;

  await ctx.activity.log({
    companyId: "",
    message: "ops.support.ticket_created",
    entityType: "webhook",
    entityId: fingerprint,
    metadata: {
      from: body.from,
      subject: body.subject,
      source: body.source,
      assignee: "finance-support-agent",
    },
  });

  return {
    handled: true,
    agentAssignment: "finance-support-agent",
    issueTitle: title,
  };
}
