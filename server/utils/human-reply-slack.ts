function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseListEnv(value: string | undefined | null) {
  return String(value || "")
    .split(/[,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function inferConversationKind(channel: string, channelType?: string | null) {
  const normalizedType = normalizeString(channelType).toLowerCase();
  if (normalizedType === "im" || channel.startsWith("D")) {
    return "dm" as const;
  }
  return "channel" as const;
}

export type HumanReplySlackStatus = {
  configured: boolean;
  allow_dms: boolean;
  allowed_channels: string[];
  reason: string | null;
};

export function getHumanReplySlackStatus(): HumanReplySlackStatus {
  const signingSecret = normalizeString(process.env.SLACK_SIGNING_SECRET);
  const botToken = normalizeString(process.env.SLACK_BOT_TOKEN);
  const allowDms = /^(1|true|yes|on)$/i.test(
    normalizeString(process.env.BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS),
  );
  const allowedChannels = parseListEnv(process.env.BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS);

  if (!signingSecret || !botToken) {
    return {
      configured: false,
      allow_dms: allowDms,
      allowed_channels: allowedChannels,
      reason:
        "Slack human-reply watching requires both SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN.",
    };
  }

  if (!allowDms && allowedChannels.length === 0) {
    return {
      configured: false,
      allow_dms: allowDms,
      allowed_channels: allowedChannels,
      reason:
        "Slack human-reply watching is configured but no valid reply surface is enabled. Set BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1 and/or BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS.",
    };
  }

  return {
    configured: true,
    allow_dms: allowDms,
    allowed_channels: allowedChannels,
    reason: null,
  };
}

export function evaluateSlackHumanReplySurface(params: {
  channel: string;
  channelType?: string | null;
  threadTs?: string | null;
}) {
  const status = getHumanReplySlackStatus();
  if (!status.configured) {
    return {
      accepted: false,
      reason: status.reason || "Slack human-reply watching is not configured.",
    };
  }

  const channel = normalizeString(params.channel);
  const conversationKind = inferConversationKind(channel, params.channelType);
  const visibilityHint =
    conversationKind === "dm"
      ? "Slack DM visibility is configured."
      : status.allowed_channels.includes(channel) && normalizeString(params.threadTs)
        ? "Slack thread visibility is configured."
        : "Slack visibility is incomplete.";

  return {
    accepted: false,
    reason: `${visibilityHint} Slack remains a notification-only mirror for founder interrupts until inbound correlation, durable reply ingest, and resume handoff are implemented end to end. Email is the only durable resume path today.`,
  };
}
