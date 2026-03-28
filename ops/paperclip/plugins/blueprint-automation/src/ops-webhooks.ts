import type { PluginSetupContext, PluginWebhookInput } from "@paperclipai/plugin-sdk";

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
  ctx: PluginSetupContext
): Promise<OpsWebhookResult> {
  const body = input.body as {
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

  const existingMapping = await ctx.pluginEntities.find(
    "source-mapping",
    fingerprint
  );

  if (existingMapping) {
    return { handled: true, issueTitle: title };
  }

  const issue = await ctx.issues.create({
    title,
    description: `Firestore event: ${body.event}\nDocument: ${body.collection}/${body.documentId}\n\nData: ${JSON.stringify(body.data, null, 2)}`,
    priority: body.event === "request.created" ? "high" : "medium",
    assignee: handler.agent,
  });

  await ctx.pluginEntities.upsert("source-mapping", fingerprint, {
    issueId: issue.id,
    sourceType: "firestore",
    sourceId: `${body.collection}:${body.documentId}`,
    event: body.event,
    createdAt: new Date().toISOString(),
  });

  return { handled: true, agentAssignment: handler.agent, issueTitle: title };
}

/**
 * Handle Stripe webhook events forwarded to Paperclip.
 */
export async function handleStripeWebhook(
  input: PluginWebhookInput,
  ctx: PluginSetupContext
): Promise<OpsWebhookResult> {
  const body = input.body as {
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

  const priority = body.type === "charge.dispute.created" ? "high" : "medium";
  const title = `Stripe: ${body.type} (${body.id})`;
  const fingerprint = `stripe:${body.type}:${body.id}`;

  const existingMapping = await ctx.pluginEntities.find(
    "source-mapping",
    fingerprint
  );

  if (existingMapping) {
    return { handled: true, issueTitle: title };
  }

  const issue = await ctx.issues.create({
    title,
    description: `Stripe event: ${body.type}\nEvent ID: ${body.id}\n\nData: ${JSON.stringify(body.data?.object ?? {}, null, 2)}`,
    priority,
    assignee: "finance-support-agent",
  });

  await ctx.pluginEntities.upsert("source-mapping", fingerprint, {
    issueId: issue.id,
    sourceType: "stripe",
    sourceId: body.id,
    event: body.type,
    createdAt: new Date().toISOString(),
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
  ctx: PluginSetupContext
): Promise<OpsWebhookResult> {
  const body = input.body as {
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

  const issue = await ctx.issues.create({
    title,
    description: `From: ${body.from}\nSource: ${body.source}\nReceived: ${body.receivedAt}\n\n${body.body}`,
    priority: "medium",
    assignee: "finance-support-agent",
  });

  await ctx.pluginEntities.upsert("source-mapping", fingerprint, {
    issueId: issue.id,
    sourceType: "support",
    sourceId: body.from,
    event: "ticket.created",
    createdAt: new Date().toISOString(),
  });

  return {
    handled: true,
    agentAssignment: "finance-support-agent",
    issueTitle: title,
  };
}
