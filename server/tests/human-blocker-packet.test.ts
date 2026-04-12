// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  renderHumanBlockerPacketEmailSubject,
  renderHumanBlockerPacketHtml,
  renderHumanBlockerPacketSlack,
  renderHumanBlockerPacketText,
  type HumanBlockerPacket,
} from "../utils/human-blocker-packet";

const packet: HumanBlockerPacket = {
  title: "Production inbound write smoke returned 500 on tryblueprint.io",
  summary: "Production readiness is green, but the buyer inbound write path returned 500.",
  recommendedAnswer:
    "Check production env for field encryption and set FIELD_ENCRYPTION_MASTER_KEY or FIELD_ENCRYPTION_KMS_KEY_NAME if missing.",
  exactResponseNeeded:
    "Confirm the field-encryption env is set, or send back the production log for the failed request.",
  whyBlocked:
    "The production smoke write path failed, and this likely requires a human with production env or log access.",
  alternatives: [
    "Inspect production logs for the tagged request ID.",
    "Run the same write-path smoke against a preview deployment.",
  ],
  risk:
    "If we guess wrong on the env cause, we lose time and still need a log-based diagnosis.",
  executionOwner: "webapp-codex",
  immediateNextAction:
    "Rerun the tagged production live-write smoke after the reply arrives.",
  deadline: "Today if possible.",
  evidence: [
    "tryblueprint.io/health/ready returned 200.",
    "The tagged production inbound write returned 500.",
  ],
  nonScope: "No pricing, policy, or rights change.",
};

describe("human blocker packet renderers", () => {
  it("builds the standard email subject", () => {
    expect(renderHumanBlockerPacketEmailSubject(packet.title)).toBe(
      "[Blueprint Blocker] Production inbound write smoke returned 500 on tryblueprint.io",
    );
  });

  it("renders readable plain text", () => {
    const text = renderHumanBlockerPacketText(packet);
    expect(text).toContain("Summary");
    expect(text).toContain("What I Need From You");
    expect(text).toContain("- Owner: webapp-codex");
    expect(text).toContain("1. Inspect production logs for the tagged request ID.");
  });

  it("renders readable slack markdown", () => {
    const slack = renderHumanBlockerPacketSlack(packet);
    expect(slack).toContain("*Blocked:* Production inbound write smoke returned 500 on tryblueprint.io");
    expect(slack).toContain("*What I need from you:*");
    expect(slack).toContain("- *Owner:* webapp-codex");
  });

  it("renders structured html", () => {
    const html = renderHumanBlockerPacketHtml(packet);
    expect(html).toContain("<strong>Summary</strong>");
    expect(html).toContain("<strong>What I Need From You</strong>");
    expect(html).toContain("<ol");
    expect(html).toContain("<ul");
  });
});
