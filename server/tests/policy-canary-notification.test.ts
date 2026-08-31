// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  policyCanaryNotificationRecipientAllowed,
  policyCanaryNotificationRecipientOptions,
} from "../utils/internalPolicyCanaryContract";
import { buildPolicyCanaryTerminalEmail } from "../utils/policyCanaryNotification";

describe("policy canary notification", () => {
  it("renders complete terminal email copy without artifact links or attachments", () => {
    const resultUrl = "https://tryblueprint.io/app/results/result-839873";
    const copy = buildPolicyCanaryTerminalEmail({
      resultUrl,
      record: {
        state: "results_ready",
        scene: { id: "839873", version: "v1" },
        task: { id: "simple-relocation", label: "simple relocation" },
        robot: { preset_id: "franka_panda_robotiq_2f85_v1", display_name: "Franka Panda + Robotiq 2F-85" },
        policy_candidates: [
          { candidate_id: "pi05_droid", display_name: "PI 0.5 DROID" },
          { candidate_id: "groot_n17_droid", display_name: "GR00T N1.7 DROID" },
        ],
        episode_plan: { episodes_per_policy: 10 },
        policy_run_result_projection: {
          candidate_results: [
            { display_name: "PI 0.5 DROID", success_count: 6, interpretable_episode_count: 8, action_delivery_rate: 1 },
            { display_name: "GR00T N1.7 DROID", success_count: 4, interpretable_episode_count: 7, action_delivery_rate: 0.9 },
          ],
        },
      },
    });

    expect(copy.emailSubject).toBe(
      "Blueprint policy canary results are ready — Scene 839873",
    );
    expect(copy.emailText).toContain("Task: simple-relocation · simple relocation");
    expect(copy.emailText).toContain("Robot preset: Franka Panda + Robotiq 2F-85");
    expect(copy.emailText).toContain("Policies: PI 0.5 DROID vs GR00T N1.7 DROID");
    expect(copy.emailText).toContain("Run size: 10 episodes per policy");
    expect(copy.emailText).toContain("Terminal status: completed_unqualified");
    expect(copy.emailText).toContain("Controls pending — results are unqualified.");
    expect(copy.emailText).toContain("PI 0.5 DROID: 6/8 interpretable successes; 100% action delivery.");
    expect(copy.emailText).toContain("GR00T N1.7 DROID: 4/7 interpretable successes; 90% action delivery.");
    expect(copy.emailText).toContain(`Open the authenticated result: ${resultUrl}`);
    expect(copy.emailText).not.toContain("signature=");
    expect(copy.emailText).not.toContain("artifact");
  });

  it("allows only the account address or a server-configured admin recipient", () => {
    const adminOptions = policyCanaryNotificationRecipientOptions({
      authenticatedEmail: "admin@tryblueprint.io",
      isAdmin: true,
      isOps: false,
      configuredAllowlist: "ops@tryblueprint.io",
      approvedInternalEmail: "founder@example.com",
    });
    expect(adminOptions).toEqual([
      "admin@tryblueprint.io",
      "founder@example.com",
      "ops@tryblueprint.io",
    ]);
    expect(policyCanaryNotificationRecipientAllowed({
      requestedEmail: "founder@example.com",
      authenticatedEmail: "admin@tryblueprint.io",
      isAdmin: true,
      isOps: false,
      approvedInternalEmail: "founder@example.com",
    })).toBe(true);
    expect(policyCanaryNotificationRecipientAllowed({
      requestedEmail: "founder@example.com",
      authenticatedEmail: "member@tryblueprint.io",
      isAdmin: false,
      isOps: false,
      approvedInternalEmail: "founder@example.com",
    })).toBe(false);
    expect(policyCanaryNotificationRecipientAllowed({
      requestedEmail: "arbitrary@outside.example",
      authenticatedEmail: "admin@tryblueprint.io",
      isAdmin: true,
      isOps: true,
      configuredAllowlist: "ops@tryblueprint.io",
      approvedInternalEmail: "founder@example.com",
    })).toBe(false);
  });
});
