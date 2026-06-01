import { describe, expect, it } from "vitest";

import { buildLaunchNowApprovalPacket, renderMarkdown } from "./generate-launch-now-approval-packet";

function budgetLine(line: string, target_usd: number, owner_system = "test owner", proof_level = "estimate") {
  return {
    line,
    target_usd,
    owner_system,
    proof_level,
  };
}

function sampleSummary() {
  return {
    budget_cap_usd: 500,
    target_total_usd: 500,
    paperclip_compression: {
      declared_agent_budget_after_usd: 173,
    },
    budget_ledger: [
      budgetLine("Paperclip agent/runtime envelope", 173, "Paperclip company config", "repo-local"),
      budgetLine("Codex OAuth / Pro subscription seat", 0, "Human OpenAI subscription billing"),
      budgetLine("OpenAI API costs (approval-only guardrail)", 0, "OpenAI organization billing", "live-verified"),
      budgetLine("DeepSeek direct model reserve", 80, "DeepSeek API account"),
      budgetLine("Render WebApp hosting", 25, "Render"),
      budgetLine("Paperclip VPS / tunnel", 30, "DigitalOcean / Cloudflare / Paperclip host"),
      budgetLine("Firebase / Firestore / storage", 25, "Firebase / Firestore / GCS"),
      budgetLine("Redis / cache", 10, "Redis / Upstash"),
      budgetLine("Email / human reply / Slack", 7, "SendGrid, Gmail, Slack"),
      budgetLine("Analytics", 0, "PostHog / GA4 / Firestore mirror"),
      budgetLine("Search / research APIs", 45, "Parallel Search MCP / configured search"),
      budgetLine("Recipient evidence enrichment", 35, "GTM evidence / enrichment providers"),
      budgetLine("Profiles, listings, and owned growth ops", 20, "Repo docs / Paperclip growth lanes"),
      budgetLine("Paid city/launch experiments", 50, "Meta/ads/provider accounts"),
    ],
  };
}

function sampleControlStatus() {
  return {
    state: "repo_local_controls_ready_live_action_blocked",
    validation_pass: true,
    can_allocate_repo_local: true,
    can_delegate_repo_local: true,
    can_mutate_live_spend: false,
    can_claim_live_budget_complete: false,
    can_claim_operational_launch_ready: false,
    live_proof_gaps: ["Render billing", "Ad account spend and paused-draft proof"],
  };
}

describe("generate launch-now approval packet", () => {
  it("builds a pending, bounded approval packet without opening live-action authority", () => {
    const packet = buildLaunchNowApprovalPacket({
      summary: sampleSummary(),
      controlStatus: sampleControlStatus(),
      now: new Date("2026-06-01T12:00:00.000Z"),
      expiresOn: "2026-07-01",
    });

    expect(packet.schema).toBe("blueprint/autonomous-budget-launch-now-approval-packet/v1");
    expect(packet.state).toBe("pending_human_signature");
    expect(packet.approval_effective).toBe(false);
    expect(packet.no_live_mutation_attempted).toBe(true);
    expect(packet.no_provider_calls_made).toBe(true);
    expect(packet.secrets_persisted).toBe(false);
    expect(packet.repo_local_paperclip_envelope_usd).toBe(173);
    expect(packet.requested_live_spend_ceiling_usd).toBe(327);
    expect(packet.combined_budget_ceiling_usd).toBe(500);
    expect(packet.codex_oauth_pro_excluded_from_budget).toBe(true);
    expect(packet.openai_api_target_usd).toBe(0);
    expect(packet.control_status.can_mutate_live_spend).toBe(false);
    expect(packet.control_status.can_claim_operational_launch_ready).toBe(false);
    expect(packet.approval_capture.human_approved).toBe(false);
  });

  it("approves only positive live launch/growth lines and keeps excluded lines non-spendable", () => {
    const packet = buildLaunchNowApprovalPacket({
      summary: sampleSummary(),
      controlStatus: sampleControlStatus(),
      now: new Date("2026-06-01T12:00:00.000Z"),
      expiresOn: "2026-07-01",
    });

    const approvalLines = packet.approval_items.map((item) => item.budget_line);

    expect(approvalLines).toEqual([
      "DeepSeek direct model reserve",
      "Render WebApp hosting",
      "Paperclip VPS / tunnel",
      "Firebase / Firestore / storage",
      "Redis / cache",
      "Email / human reply / Slack",
      "Search / research APIs",
      "Recipient evidence enrichment",
      "Profiles, listings, and owned growth ops",
      "Paid city/launch experiments",
    ]);
    expect(approvalLines).not.toContain("Paperclip agent/runtime envelope");
    expect(approvalLines).not.toContain("Codex OAuth / Pro subscription seat");
    expect(approvalLines).not.toContain("OpenAI API costs (approval-only guardrail)");
    expect(approvalLines).not.toContain("Analytics");
    expect(packet.non_spend_guardrails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ budget_line: "Codex OAuth / Pro subscription seat", max_usd: 0 }),
        expect.objectContaining({ budget_line: "OpenAI API costs (approval-only guardrail)", max_usd: 0 }),
        expect.objectContaining({ budget_line: "Analytics", max_usd: 0 }),
      ]),
    );
  });

  it("renders exact human approval text and activation blockers", () => {
    const packet = buildLaunchNowApprovalPacket({
      summary: sampleSummary(),
      controlStatus: sampleControlStatus(),
      now: new Date("2026-06-01T12:00:00.000Z"),
      expiresOn: "2026-07-01",
    });
    const markdown = renderMarkdown(packet);

    expect(packet.exact_human_approval_text).toContain("I, Nijel Hunt, approve");
    expect(packet.exact_human_approval_text).toContain("$327.00 in live launch/growth spend");
    expect(packet.exact_human_approval_text).toContain("$173.00 repo-local Paperclip envelope");
    expect(packet.exact_human_approval_text).toContain("OpenAI API spend remains $0.00");
    expect(markdown).toContain("This packet is a pending approval artifact.");
    expect(markdown).toContain("Do not use this pending packet to execute live sends");
  });

  it("fails closed if the $500 cap or OpenAI API $0 guardrail drifts", () => {
    const openAiSpendSummary = sampleSummary();
    openAiSpendSummary.budget_ledger = openAiSpendSummary.budget_ledger.map((line) =>
      line.line.includes("OpenAI API") ? { ...line, target_usd: 1 } : line,
    );

    expect(() =>
      buildLaunchNowApprovalPacket({
        summary: openAiSpendSummary,
        controlStatus: sampleControlStatus(),
        now: new Date("2026-06-01T12:00:00.000Z"),
        expiresOn: "2026-07-01",
      }),
    ).toThrow("OpenAI API spend must remain at a $0 target");
  });
});
