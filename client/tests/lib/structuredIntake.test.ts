import { describe, expect, it } from "vitest";
import { evaluateStructuredIntake } from "@/lib/structuredIntake";

describe("structured intake proof readiness", () => {
  it("marks a concrete robot-team exact-site request as proof-ready intake", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "robot_team",
      requestedLanes: ["deeper_evaluation"],
      budgetBucket: "$50K-$300K",
      roleTitle: "Autonomy lead",
      siteName: "Durham fulfillment center",
      siteLocation: "Durham, NC",
      taskStatement: "Review pallet putaway before field travel.",
      targetRobotTeam: "AMR fleet",
      targetSiteType: "Warehouse",
      proofPathPreference: "exact_site_required",
    });

    expect(decision.proofReadyOutcome).toBe("proof_ready_intake");
    expect(decision.proofPathOutcome).toBe("exact_site");
    expect(decision.proofReadinessScore).toBe(100);
    expect(decision.missingProofReadyFields).toEqual([]);
    expect(decision.filterTags).toContain("proof_ready_intake");
    expect(decision.filterTags).toContain("proof_path_exact_site");
  });

  it("keeps a robot-team request in clarification when robot stack context is missing", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "robot_team",
      requestedLanes: ["deeper_evaluation"],
      budgetBucket: "$50K-$300K",
      roleTitle: "Deployment engineer",
      siteName: "Durham fulfillment center",
      siteLocation: "Durham, NC",
      taskStatement: "Compare release behavior in a warehouse.",
      targetSiteType: "Warehouse",
      proofPathPreference: "adjacent_site_acceptable",
    });

    expect(decision.proofReadyOutcome).toBe("needs_clarification");
    expect(decision.proofPathOutcome).toBe("scoped_follow_up");
    expect(decision.proofReadinessScore).toBeLessThan(100);
    expect(decision.missingProofReadyFields).toContain("robot_or_stack");
  });

  it("keeps site-operator records out of robot-team proof-ready scoring", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      budgetBucket: "Undecided/Unsure",
      siteName: "Brightleaf Books",
      siteLocation: "Durham, NC",
      taskStatement: "Can this site be listed for robot review?",
      operatingConstraints: "Open weekdays with escorted access.",
    });

    expect(decision.proofReadyOutcome).toBe("operator_handoff");
    expect(decision.proofPathOutcome).toBe("operator_handoff");
    expect(decision.proofReadinessScore).toBe(0);
    expect(decision.missingProofReadyFields).toEqual([]);
  });

  it("measures a site-operator claim and access-boundary outcome", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      budgetBucket: "$50K-$300K",
      siteName: "Brightleaf Books",
      siteLocation: "Durham, NC",
      taskStatement: "Claim this facility for escorted robot-team review.",
      operatingConstraints: "Escorted weekday access, no capture before 9am.",
      privacySecurityConstraints: "No employee-only rooms and redact faces.",
    });

    expect(decision.siteOperatorClaimOutcome).toBe("site_claim_access_boundary_ready");
    expect(decision.accessBoundaryOutcome).toBe("access_boundary_defined");
    expect(decision.siteClaimReadinessScore).toBe(100);
    expect(decision.siteClaimCriteria).toEqual([
      "facility_name",
      "site_location",
      "operator_intent",
      "access_rules",
      "privacy_security_boundary",
    ]);
    expect(decision.missingSiteClaimFields).toEqual([]);
    expect(decision.filterTags).toContain("site_claim_access_boundary_ready");
    expect(decision.filterTags).toContain("access_boundary_defined");
  });
});
