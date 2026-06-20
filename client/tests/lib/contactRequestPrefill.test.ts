import { describe, expect, it } from "vitest";
import {
  buildAgentInboundRequestDraft,
  buildContactRequestUrl,
  parseContactRequestPrefill,
} from "@/lib/contactRequestPrefill";

describe("contactRequestPrefill", () => {
  it("parses agent-friendly location, workflow, source, buyer type, and path aliases", () => {
    const prefill = parseContactRequestPrefill(
      "source=site-worlds&buyerType=robot_team&path=hosted-review&location=123%20Unknown%20St&workflow=warehouse%20tote&message=Need%20a%20review&episodeCount=500&validationMode=comparative_policy_eval&requestedOutputs=Policy%20Evaluation%20Run&siteType=warehouse&requiredMetrics=97%25%20success&robotOrPolicy=Unitree%20G1%20policy&validationExpectations=sim%20trace",
    );

    expect(prefill).toMatchObject({
      source: "site-worlds",
      buyerType: "robot_team",
      requestPath: "hosted-review",
      commercialRequestPath: "hosted_evaluation",
      siteLocation: "123 Unknown St",
      workflow: "warehouse tote",
      taskStatement: "warehouse tote",
      message: "Need a review",
      requestedOutputs: "Policy Evaluation Run",
      episodeCount: "500",
      validationMode: "comparative_policy_eval",
      primaryNeed: "123 Unknown St",
      realSiteRobotEvalFit: {
        siteCardInput: {
          siteType: "warehouse",
        },
        taskCardInput: {
          requiredMetrics: "97% success",
        },
        evalCardInput: {
          robotOrPolicyTested: "Unitree G1 policy",
          resultsValidationExpectations: "sim trace",
        },
      },
    });
  });

  it("builds a contact URL with both human-readable and current form prefill keys", () => {
    const href = buildContactRequestUrl({
      source: "site-worlds",
      buyerType: "robot_team",
      requestPath: "hosted-review",
      location: "123 Unknown St",
      workflow: "warehouse tote",
      siteName: "Unknown warehouse",
      targetRobotTeam: "robot-team agent",
      realSiteRobotEvalFit: {
        siteCardInput: {
          siteType: "warehouse",
          safetyConstraints: "No-go zone around dock edge.",
        },
        taskCardInput: {
          startState: "Robot starts near staging.",
          successDefinition: "Tote reaches conveyor.",
          requiredMetrics: "97% success under 45 seconds.",
        },
        scenarioCardInput: {
          normalScenario: "Clear aisle transfer.",
          edgeCase: "Human steps into handoff zone.",
        },
        evalCardInput: {
          robotOrPolicyTested: "robot-team agent",
          preferredReviewPath: "Hosted review first.",
          resultsValidationExpectations: "Simulator traces and action logs.",
        },
      },
      episodeCount: "100",
      validationMode: "virtual_preflight",
      message: "Scope hosted review without granting access.",
    });
    const url = new URL(href, "https://tryblueprint.local");

    expect(url.pathname).toBe("/contact/robot-team");
    expect(url.searchParams.get("source")).toBe("site-worlds");
    expect(url.searchParams.get("buyerType")).toBe("robot_team");
    expect(url.searchParams.get("interest")).toBe("policy-evaluation-run");
    expect(url.searchParams.get("path")).toBe("policy-evaluation-run");
    expect(url.searchParams.get("location")).toBe("123 Unknown St");
    expect(url.searchParams.get("siteLocation")).toBe("123 Unknown St");
    expect(url.searchParams.get("workflow")).toBe("warehouse tote");
    expect(url.searchParams.get("taskStatement")).toBe("warehouse tote");
    expect(url.searchParams.get("targetRobotTeam")).toBe("robot-team agent");
    expect(url.searchParams.get("siteType")).toBe("warehouse");
    expect(url.searchParams.get("safetyConstraints")).toBe("No-go zone around dock edge.");
    expect(url.searchParams.get("startState")).toBe("Robot starts near staging.");
    expect(url.searchParams.get("successDefinition")).toBe("Tote reaches conveyor.");
    expect(url.searchParams.get("requiredMetrics")).toBe("97% success under 45 seconds.");
    expect(url.searchParams.get("normalScenario")).toBe("Clear aisle transfer.");
    expect(url.searchParams.get("edgeCase")).toBe("Human steps into handoff zone.");
    expect(url.searchParams.get("robotOrPolicy")).toBe("robot-team agent");
    expect(url.searchParams.get("preferredReviewPath")).toBe("Hosted review first.");
    expect(url.searchParams.get("validationExpectations")).toBe("Simulator traces and action logs.");
    expect(url.searchParams.get("requestedOutputs")).toBe("Policy Evaluation Run");
    expect(url.searchParams.get("episodeCount")).toBe("100");
    expect(url.searchParams.get("validationMode")).toBe("virtual_preflight");
    expect(url.searchParams.get("proofPathPreference")).toBe("exact_site_required");
    expect(url.searchParams.has("entitlementId")).toBe(false);
    expect(url.searchParams.has("access")).toBe(false);
  });

  it("maps rebuilt Policy Evaluation Run query labels to hosted evaluation state", () => {
    const prefill = parseContactRequestPrefill(
      "persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&validationMode=real_rollout_validated",
      "/contact/robot-team",
    );

    expect(prefill).toMatchObject({
      buyerType: "robot_team",
      requestPath: "hosted-review",
      commercialRequestPath: "hosted_evaluation",
      requestedOutputs: "Policy Evaluation Run",
      episodeCount: "500",
      validationMode: "real_rollout_validated",
    });

    const genericContactPrefill = parseContactRequestPrefill(
      "persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=100&validationMode=virtual_preflight",
      "/contact",
    );

    expect(genericContactPrefill).toMatchObject({
      requestPath: "hosted-review",
      commercialRequestPath: "hosted_evaluation",
      requestedOutputs: "Policy Evaluation Run",
      episodeCount: "100",
      validationMode: "virtual_preflight",
    });
  });

  it("maps legacy world-model params to the Policy Improvement Run lane", () => {
    const legacyPrefill = parseContactRequestPrefill(
      "persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&requestedOutputs=Policy%20Improvement%20Run",
    );

    expect(legacyPrefill).toMatchObject({
      buyerType: "robot_team",
      requestPath: "data-package",
      commercialRequestPath: "world_model",
      requestedOutputs: "Policy Improvement Run",
    });

    const href = buildContactRequestUrl({
      buyerType: "robot_team",
      requestPath: "world-model",
      requestedOutputs: "Policy Improvement Run",
    });
    const url = new URL(href, "https://tryblueprint.local");

    expect(url.pathname).toBe("/contact/robot-team");
    expect(url.searchParams.get("interest")).toBe("policy-improvement-run");
    expect(url.searchParams.get("path")).toBe("policy-improvement-run");

    const draft = buildAgentInboundRequestDraft({
      buyerType: "robot_team",
      requestPath: "world-model",
      siteName: "Warehouse annex",
      workflow: "tote transfer",
    });

    expect(draft).toMatchObject({
      buyerType: "robot_team",
      commercialRequestPath: "world_model",
      requestedLanes: ["data_licensing"],
      taskStatement: "tote transfer",
    });
  });

  it("maps policy-improvement aliases to the compatibility data lane", () => {
    const prefill = parseContactRequestPrefill(
      "persona=robot-team&buyerType=robot_team&interest=policy-improvement-run&path=policy-lift",
    );

    expect(prefill).toMatchObject({
      buyerType: "robot_team",
      requestPath: "data-package",
      commercialRequestPath: "world_model",
    });

    const href = buildContactRequestUrl({
      buyerType: "robot_team",
      requestPath: "data-package",
      requestedOutputs: "Policy Improvement Run",
    });
    const url = new URL(href, "https://tryblueprint.local");

    expect(url.searchParams.get("interest")).toBe("policy-improvement-run");
    expect(url.searchParams.get("path")).toBe("policy-improvement-run");
    expect(url.searchParams.get("requestedOutputs")).toBe("Policy Improvement Run");
  });

  it("creates an agent inbound-request draft without access, payment, provider, or hosted grants", () => {
    const draft = buildAgentInboundRequestDraft({
      source: "site-worlds",
      requestPath: "new-capture",
      location: "RDU warehouse aisle",
      workflow: "warehouse tote transfer",
      siteClass: "warehouse aisle",
      sourcePageUrl: "https://tryblueprint.io/contact?source=site-worlds",
      realSiteRobotEvalFit: {
        siteCardInput: {
          siteType: "warehouse aisle",
          dynamicConditions: "Forklifts and carts cross the route.",
          safetyConstraints: "Forklift lane exclusion.",
        },
        taskCardInput: {
          requiredMetrics: "95% success and fewer than one intervention per shift.",
        },
        evalCardInput: {
          robotOrPolicyTested: "Humanoid policy container",
          resultsValidationExpectations: "Action logs and human demo.",
        },
      },
    });

    expect(draft).toMatchObject({
      buyerType: "robot_team",
      commercialRequestPath: "capture_access",
      requestedLanes: ["deeper_evaluation"],
      siteLocation: "RDU warehouse aisle",
      taskStatement: "warehouse tote transfer",
      targetSiteType: "warehouse aisle",
      proofPathPreference: "exact_site_required",
      workflowContext: "warehouse tote transfer",
      realSiteRobotEvalFit: {
        siteCardInput: {
          siteType: "warehouse aisle",
          dynamicConditions: "Forklifts and carts cross the route.",
          safetyConstraints: "Forklift lane exclusion.",
        },
        taskCardInput: {
          requiredMetrics: "95% success and fewer than one intervention per shift.",
        },
        evalCardInput: {
          robotOrPolicyTested: "Humanoid policy container",
          resultsValidationExpectations: "Action logs and human demo.",
        },
      },
      context: {
        sourcePageUrl: "https://tryblueprint.io/contact?source=site-worlds",
        buyerChannelSourceRaw: "site-worlds",
      },
    });
    expect(draft).not.toHaveProperty("entitlementId");
    expect(draft).not.toHaveProperty("paymentStatus");
    expect(draft).not.toHaveProperty("hostedSessionId");
    expect(draft).not.toHaveProperty("providerRunId");
  });
});
