import { describe, expect, it } from "vitest";
import {
  resolveSlackWebhookUrl,
  slackChannelsShareDestination,
} from "./slack-notify.js";

describe("slack routing helpers", () => {
  it("routes analytics and manager channels to the same webhook when manager falls back to growth", () => {
    const targets = {
      growth: "https://hooks.slack.test/growth",
      default: "https://hooks.slack.test/growth",
    };

    expect(resolveSlackWebhookUrl(targets, "#analytics")).toBe("https://hooks.slack.test/growth");
    expect(resolveSlackWebhookUrl(targets, "#paperclip-manager")).toBe("https://hooks.slack.test/growth");
    expect(slackChannelsShareDestination(targets, "#analytics", "#paperclip-manager")).toBe(true);
  });

  it("keeps engineering and manager channels distinct when separate webhooks exist", () => {
    const targets = {
      engineering: "https://hooks.slack.test/eng",
      manager: "https://hooks.slack.test/manager",
      default: "https://hooks.slack.test/default",
    };

    expect(slackChannelsShareDestination(targets, "#paperclip-eng", "#paperclip-manager")).toBe(false);
  });
});
