import { logger } from "../logger";
import type {
  BudgetBucket,
  HelpWithOption,
  RequestPriority,
} from "../types/inbound-request";

interface SlackNotifyOptions {
  requestId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  roleTitle: string;
  budgetBucket: BudgetBucket;
  helpWith: HelpWithOption[];
  details?: string | null;
  priority: RequestPriority;
  sourcePageUrl: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
    action_id?: string;
  }>;
}

const HELP_WITH_LABELS: Record<HelpWithOption, string> = {
  "benchmark-packs": "Benchmark Packs",
  "scene-library": "Scene Library",
  "dataset-packs": "Dataset Packs",
  "custom-capture": "Custom Scene",
  "pilot-exchange-location-brief": "Pilot Exchange: Location Brief",
  "pilot-exchange-policy-submission": "Pilot Exchange: Policy Submission",
  "pilot-exchange-data-licensing": "Pilot Exchange: Data Licensing",
};

const PRIORITY_EMOJI: Record<RequestPriority, string> = {
  high: ":fire:",
  normal: ":large_blue_circle:",
  low: ":white_circle:",
};

/**
 * Send a Slack notification for a new inbound request
 */
export async function notifySlackInboundRequest(
  options: SlackNotifyOptions
): Promise<{ sent: boolean; error?: unknown }> {
  const webhookUrl = process.env.SLACK_INBOUND_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn(
      "SLACK_INBOUND_WEBHOOK_URL not configured; skipping Slack notification"
    );
    return { sent: false };
  }

  const {
    requestId,
    firstName,
    lastName,
    email,
    company,
    roleTitle,
    budgetBucket,
    helpWith,
    details,
    priority,
    sourcePageUrl,
  } = options;

  const helpWithLabels = helpWith
    .map((h) => HELP_WITH_LABELS[h] || h)
    .join(", ");

  const priorityEmoji = PRIORITY_EMOJI[priority];
  const adminUrl = `${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${requestId}`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${priorityEmoji} New Inbound Request from ${company}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Name:*\n${firstName} ${lastName}`,
        },
        {
          type: "mrkdwn",
          text: `*Company:*\n${company}`,
        },
        {
          type: "mrkdwn",
          text: `*Email:*\n<mailto:${email}|${email}>`,
        },
        {
          type: "mrkdwn",
          text: `*Role:*\n${roleTitle || "Not specified"}`,
        },
        {
          type: "mrkdwn",
          text: `*Budget:*\n${budgetBucket}`,
        },
        {
          type: "mrkdwn",
          text: `*Priority:*\n${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Interested in:*\n${helpWithLabels}`,
      },
    },
  ];

  // Add details section if provided
  if (details && details.trim()) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Additional Details:*\n${details.slice(0, 500)}${details.length > 500 ? "..." : ""}`,
      },
    });
  }

  // Add source page
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Source:* ${sourcePageUrl}`,
    },
  });

  // Add action buttons
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in Admin",
          emoji: true,
        },
        url: adminUrl,
        action_id: "view_admin",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Send Email",
          emoji: true,
        },
        url: `mailto:${email}?subject=Re: Your Blueprint Request`,
        action_id: "send_email",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Schedule Call",
          emoji: true,
        },
        url: "https://calendly.com/blueprintar/30min",
        action_id: "schedule_call",
      },
    ],
  });

  // Add context with request ID
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `_Request ID: ${requestId}_`,
    },
  });

  const payload = {
    blocks,
    text: `New inbound request from ${firstName} ${lastName} at ${company}`, // Fallback text
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText, requestId },
        "Failed to send Slack notification"
      );
      return { sent: false, error: errorText };
    }

    logger.info({ requestId }, "Slack notification sent successfully");
    return { sent: true };
  } catch (error) {
    logger.error({ error, requestId }, "Error sending Slack notification");
    return { sent: false, error };
  }
}

/**
 * Send a simple Slack message to a webhook
 */
export async function sendSlackMessage(
  message: string,
  webhookUrl?: string
): Promise<{ sent: boolean; error?: unknown }> {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;

  if (!url) {
    logger.warn("Slack webhook URL not configured; skipping message");
    return { sent: false };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "Failed to send Slack message"
      );
      return { sent: false, error: errorText };
    }

    return { sent: true };
  } catch (error) {
    logger.error({ error }, "Error sending Slack message");
    return { sent: false, error };
  }
}
