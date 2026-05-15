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
    expect(decision.missingStructuredFields).toEqual(["robot_or_stack"]);
    expect(decision.missingStructuredFieldLabels).toEqual(["Robot or stack"]);
    expect(decision.calendarDisposition).toBe("not_needed_yet");
    expect(decision.routingSummary).toMatch(/intake-agent/i);
  });

  it("routes adjacent-site robot-team proof requests without requiring exact-site fields", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "robot_team",
      requestedLanes: ["deeper_evaluation"],
      budgetBucket: "$50K-$300K",
      roleTitle: "Deployment engineer",
      taskStatement: "Compare pallet putaway policies before field travel.",
      targetRobotTeam: "AMR fleet",
      targetSiteType: "Warehouse pallet putaway",
      proofPathPreference: "adjacent_site_acceptable",
    });

    expect(decision.proofReadyOutcome).toBe("proof_ready_intake");
    expect(decision.proofPathOutcome).toBe("adjacent_site");
    expect(decision.missingStructuredFields).toEqual([]);
    expect(decision.missingStructuredFieldLabels).toEqual([]);
    expect(decision.ownerLane).toBe("buyer-solutions-agent");
    expect(decision.recommendedPath).toBe("proof_ready_buyer_solutions_handoff");
    expect(decision.calendarDisposition).toBe("eligible_optional");
    expect(decision.proofPathSummary).toMatch(/adjacent-site proof path/i);
    expect(decision.calendarSummary).toMatch(/secondary/i);
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

  it("keeps site-operator access claims in boundary clarification before human review", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      budgetBucket: "Undecided/Unsure",
      siteName: "Brightleaf Books",
      siteLocation: "Durham, NC",
      taskStatement: "Claim this facility for escorted robot-team review.",
      operatingConstraints: "Escorted weekday access, no capture before 9am.",
    });

    expect(decision.siteOperatorClaimOutcome).toBe("site_claim_needs_access_boundary");
    expect(decision.accessBoundaryOutcome).toBe("needs_privacy_security_boundary");
    expect(decision.requiresHumanReview).toBe(false);
    expect(decision.calendarDisposition).toBe("eligible_optional");
    expect(decision.recommendedPath).toBe("operator_access_boundary_review");
    expect(decision.nextAction).toMatch(/privacy\/security/i);
    expect(decision.calendarSummary).toMatch(/secondary/i);
  });
});
