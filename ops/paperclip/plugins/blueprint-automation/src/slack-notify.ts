export interface SlackDigest {
  channel: string;
  title: string;
  sections: Array<{
    heading: string;
    items: string[];
  }>;
}

export async function postSlackDigest(
  webhookUrl: string,
  digest: SlackDigest
): Promise<boolean> {
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
    body: JSON.stringify({ blocks }),
  });

  return response.ok;
}

export function buildSlackToolHandler(webhookUrl: string) {
  return {
    "slack-post-digest": async (params: SlackDigest) => {
      const ok = await postSlackDigest(webhookUrl, params);
      return { success: ok };
    },
  };
}
