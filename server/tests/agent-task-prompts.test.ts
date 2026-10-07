// @vitest-environment node
import { describe, expect, it } from "vitest";

import { taskDefinitions } from "../agents/tasks";
import type { AgentTaskKind } from "../agents/types";

const sampleInputs: Record<AgentTaskKind, unknown> = {
  adp_run_operator: { pipeline_task_id: "task-admitted-1" },
  waitlist_triage: {
    submission: {
      id: "waitlist-1",
      email: "capturer@example.com",
      market: "Durham, NC",
      device: "iPhone",
    },
    market_context: {
      sameMarketCount: 1,
      sameMarketDeviceCount: 1,
      sameMarketPendingCount: 0,
      sameRoleCount: 1,
      recentExamples: [],
    },
  },
  inbound_qualification: {
    requestId: "req-1",
    priority: "normal",
    buyerType: "robot_team",
    requestedLanes: ["hosted_review"],
    budgetBucket: "pilot",
    company: "Example Robotics",
    siteName: "Example Site",
    siteLocation: "Durham, NC",
    taskStatement: "Evaluate an exact-site hosted review.",
  },
  post_signup_scheduling: {
    blueprintId: "bp-1",
    companyName: "Example Robotics",
    address: "1 Main St",
  },
  support_triage: {
    id: "support-1",
    email: "buyer@example.com",
    message: "I need help with hosted review access.",
  },
  payout_exception_triage: {
    id: "payout-1",
    status: "failed",
    failure_reason: "stripe_error",
  },
  preview_diagnosis: {
    requestId: "preview-1",
    failure_reason: "provider_timeout",
  },
  operator_thread: {
    message: "Summarize the current agent runtime.",
    context: { issue: "BLU-1" },
  },
  external_harness_thread: {
    message: "Run the bounded check.",
    harness: "codex",
    context: { issue: "BLU-2" },
  },
  robot_capability_extraction: {
    robotTeamId: "team-1",
    teamName: "Example Robotics",
    currentCapability: { payloadCapacity: "two_to_ten" },
    sources: [{ url: "https://example.com/specs", title: "Specs", text: "Payload: 18 kg." }],
    allowedValues: { payloadCapacity: ["under_2kg", "two_to_ten", "ten_to_twentyfive"] },
  },
  outbound_outreach: {
    prospectId: "prospect-1",
    facilityName: "Example Distribution Center",
    facilityAddress: "100 Industrial Way, Columbus OH",
    observations: [
      { claim: "Runs a single day shift", source: "https://example.com/careers/warehouse" },
    ],
    hypothesisedTask: "Totes come off the line and get stacked onto pallets.",
    inferredGates: { sceneStability: "stable" },
    selfCaptureSeconds: 45,
  },
  capture_dispatch: {
    requestId: "req-1",
    taskStatement: "Totes come off the line and get stacked onto pallets.",
    captureMode: "self_capture",
    gateAnswers: { sceneStability: "stable", taskShape: "single" },
    siteContext: "Line-side packing bay, one station.",
  },
  site_video_evidence: {
    requestId: "req-1",
    taskVideoUrl: "https://example.com/clip.mp4",
    taskDescription: "Totes move from the conveyor to a pallet.",
    whatGoesWrong: "Shrink wrap snags about twice a shift.",
    operatorAnswers: { sceneStability: "stable", taskShape: "single" },
  },
  site_assessment: {
    message: "The operator needs repeatable rack movement; acceptance is not yet defined.",
    context: { request_id: "req-1" },
  },
  capture_video_privacy: { taskVideoUrl: "https://example.com/clip.mp4" },
  capture_coverage: {
    videoUrl: "https://example.com/clip.mp4",
    taskSummary: "Totes move from the conveyor to a pallet.",
    requestedViews: [{ id: "work-area", label: "The whole work area, from a few steps back" }],
  },
  site_task_brief_reading: {
    requestId: "req-1",
    taskStatement: "Totes come off the line and get stacked onto pallets, about six sizes.",
    whatGoesWrong: "Shrink wrap snags about twice a shift.",
    gates: [
      {
        id: "objectVariety",
        question: "How many distinct items does this job handle?",
        options: [{ value: "under_10", label: "Fewer than ten" }],
      },
    ],
  },
};

describe("agent task prompts", () => {
  it("replaces default capture outreach with the five rules and a review contract", () => {
    const prompt = taskDefinitions.outbound_outreach.build_prompt(sampleInputs.outbound_outreach as never);
    expect(prompt).toContain("CANONICAL FIRST-CONTACT RULES");
    expect(prompt).toContain("exactly one easy, non-confidential question");
    expect(prompt).toContain("TAILOR THE QUESTION TO VERIFIED SITE STATE");
    expect(prompt).toContain("Unknown interest: ask one easy question about the task/workflow");
    expect(prompt).toContain("Expressed interest: ask about the learning goal");
    expect(prompt).toContain("Pilot: ask about an unresolved uncertainty");
    expect(prompt).toContain("Existing deployment: ask about expansion learning without assuming expansion plans");
    expect(prompt).toContain("retain their exact claim/source in observations_used");
    expect(prompt).toContain('or ask "what prompted your interest" without evidence of expressed interest');
    expect(prompt).toContain("directions, not rigid templates");
    expect(prompt).toContain("never invent a relationship or imply community endorsement");
    expect(prompt).toContain("helping businesses explore where robots could fit into their operations");
    expect(prompt).toContain("Offer a useful concrete observation when one is supported");
    expect(prompt).toContain("Keep detailed evidence limits and unknowns internal");
    expect(prompt).toContain("not the default first-contact pitch");
    expect(prompt).toContain("Leave the decision about a deeper conversation with the recipient");
    expect(prompt).toContain("Always set requires_human_review=true");
    expect(prompt).toContain("outreach_contract");
    expect(prompt).toContain("Research the site, job, and team jointly");
    expect(prompt).toContain("Disclose Blueprint identity from the first contact");
    expect(prompt).toContain("confirmed deployment capacity separate");
    expect(prompt).toContain("Site permission is required before sharing");
    expect(prompt).toContain("configuration, support, and timing");
    expect(prompt).toContain("physical-outcome feedback require the parties' consent");
    expect(prompt).toContain("Never claim Atlas or pipeline capabilities without");
    expect(prompt).toContain("Web research and verified business contact routes lead discovery");
    expect(prompt).toContain("LinkedIn is optional role verification, never a required step");
    expect(prompt).toContain("using \"I'm building Blueprint\" framing");
    expect(prompt).not.toContain("Ask them to film");
    expect(prompt).not.toContain("a comparison of which robots can do the job");
  });

  it("keeps stable policy and return schema before dynamic JSON payloads", () => {
    for (const [kind, definition] of Object.entries(taskDefinitions) as Array<
      [AgentTaskKind, (typeof taskDefinitions)[AgentTaskKind]]
    >) {
      const prompt = definition.build_prompt(sampleInputs[kind] as never);
      const payloadIndex = prompt.lastIndexOf("Dynamic payload:");
      const returnShapeIndex = prompt.lastIndexOf("Return JSON");

      expect(payloadIndex, `${kind} should label the final dynamic payload`).toBeGreaterThan(0);
      expect(returnShapeIndex, `${kind} should define return shape before payload`).toBeGreaterThan(0);
      expect(returnShapeIndex, `${kind} should place return shape before payload`).toBeLessThan(payloadIndex);
      expect(prompt, `${kind} should carry no-change discipline before the dynamic payload`).toContain(
        "If the payload shows no material movement, report no_change or unchanged instead of inventing progress.",
      );
      expect(JSON.parse(prompt.slice(payloadIndex + "Dynamic payload:".length).trim())).toEqual(sampleInputs[kind]);
    }
  });

  it("serializes dynamic payload object keys deterministically for prompt-cache reuse", async () => {
    const { buildCacheFriendlyPrompt } = await import("../agents/tasks/prompt-cache");

    const first = buildCacheFriendlyPrompt({
      instructions: "Stable instructions.",
      returnShape: {
        z: "",
        a: "",
      },
      payload: {
        z: 1,
        nested: {
          b: 2,
          a: 1,
        },
        a: 0,
      },
    });
    const second = buildCacheFriendlyPrompt({
      instructions: "Stable instructions.",
      returnShape: {
        a: "",
        z: "",
      },
      payload: {
        a: 0,
        nested: {
          a: 1,
          b: 2,
        },
        z: 1,
      },
    });

    expect(first).toBe(second);
    expect(first).toContain('"a": 0');
    expect(first.indexOf('"a": 0')).toBeLessThan(first.indexOf('"nested"'));
    expect(first.indexOf('"a": 1')).toBeLessThan(first.indexOf('"b": 2'));
  });
});
