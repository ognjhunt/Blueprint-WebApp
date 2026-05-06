// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("human reply slack surface policy", () => {
  it("accepts configured Slack DMs as resumable reply surfaces", async () => {
    vi.stubEnv("SLACK_SIGNING_SECRET", "signing-secret");
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-token");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS", "1");

    const { evaluateSlackHumanReplySurface } = await import("../utils/human-reply-slack");

    expect(
      evaluateSlackHumanReplySurface({
        channel: "D123",
        channelType: "im",
        threadTs: null,
      }),
    ).toMatchObject({
      accepted: true,
      reason: "dm_allowed",
    });
  });

  it("accepts only allowlisted channel thread replies", async () => {
    vi.stubEnv("SLACK_SIGNING_SECRET", "signing-secret");
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-token");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS", "C123,C456");

    const { evaluateSlackHumanReplySurface } = await import("../utils/human-reply-slack");

    expect(
      evaluateSlackHumanReplySurface({
        channel: "C123",
        channelType: "channel",
        threadTs: "1712960000.000100",
      }),
    ).toMatchObject({
      accepted: true,
      reason: "channel_thread_allowed",
    });

    expect(
      evaluateSlackHumanReplySurface({
        channel: "C123",
        channelType: "channel",
        threadTs: null,
      }),
    ).toMatchObject({
      accepted: false,
      reason: "root_channel_not_supported",
    });
  });
});
