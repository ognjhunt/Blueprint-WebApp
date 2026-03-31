export interface SlackDigest {
  channel: string;
  title: string;
  sections: Array<{
    heading: string;
    items: string[];
  }>;
}

export interface SlackWebhookTargets {
  default?: string;
  ops?: string;
  growth?: string;
  exec?: string;
  engineering?: string;
  manager?: string;
}

function pickWebhookUrl(targets: SlackWebhookTargets, channel: string): string | null {
  const normalized = channel.trim().toLowerCase();
  if (normalized.includes("manager")) {
    return targets.manager ?? targets.exec ?? targets.ops ?? targets.default ?? targets.growth ?? targets.engineering ?? null;
  }
  if (normalized.includes("exec")) {
    return targets.exec ?? targets.manager ?? targets.ops ?? targets.default ?? targets.growth ?? targets.engineering ?? null;
  }
  if (normalized.includes("eng")) {
    return targets.engineering ?? targets.ops ?? targets.default ?? targets.manager ?? targets.exec ?? targets.growth ?? null;
  }
  if (normalized.includes("growth") || normalized.includes("analytics")) {
    return targets.growth ?? targets.default ?? targets.ops ?? targets.exec ?? targets.engineering ?? targets.manager ?? null;
  }
  if (normalized.includes("ops") || normalized.includes("support")) {
    return targets.ops ?? targets.default ?? targets.manager ?? targets.exec ?? targets.growth ?? targets.engineering ?? null;
  }
  return targets.default ?? targets.manager ?? targets.exec ?? targets.ops ?? targets.growth ?? targets.engineering ?? null;
}

export async function postSlackDigest(
  targets: SlackWebhookTargets,
  digest: SlackDigest
): Promise<{
  ok: boolean;
  routedChannel: string;
  target: "ops" | "growth" | "exec" | "engineering" | "manager" | "default" | "none";
  statusCode?: number;
  responseBody?: string;
}> {
  const webhookUrl = pickWebhookUrl(targets, digest.channel);
  if (!webhookUrl) {
    return { ok: false, routedChannel: digest.channel, target: "none" };
  }

  const normalized = digest.channel.trim().toLowerCase();
  const target =
    normalized.includes("manager")
      ? "manager"
      : normalized.includes("exec")
        ? "exec"
        : normalized.includes("eng")
          ? "engineering"
          : normalized.includes("growth") || normalized.includes("analytics")
      ? "growth"
      : normalized.includes("ops") || normalized.includes("support")
        ? "ops"
        : "default";
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: digest.title },
    },
  ];

  for (const section of digest.sections) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${section.heading}*\n${section.items.map((i) => `• ${i}`).join("\n")}`,
      },
    });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${digest.title} (${digest.channel})`,
      blocks,
    }),
  });

  return {
    ok: response.ok,
    routedChannel: digest.channel,
    target,
    statusCode: response.status,
    responseBody: await response.text(),
  };
}

export function buildSlackToolHandler(targets: SlackWebhookTargets) {
  return {
    "slack-post-digest": async (params: SlackDigest) => {
      const result = await postSlackDigest(targets, params);
      return { success: result.ok, ...result };
    },
  };
}
