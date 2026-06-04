import { describe, expect, it } from "vitest";
import { evaluateStructuredIntake } from "@/lib/structuredIntake";

describe("structured intake proof readiness", () => {
  it("uses real-site robot eval fit fields to score concrete robot-team requests", () => {
    const decision = evaluateStructuredIntake({
      buyerType: "robot_team",
      requestedLanes: ["deeper_evaluation"],
      budgetBucket: "$50K-$300K",
      roleTitle: "Deployment engineer",
      siteName: "Harborview Grocery Distribution Annex",
      siteLocation: "1847 W Fulton St, Chicago, IL",
      taskStatement: "Move totes from shelf staging to conveyor induction.",
      targetSiteType: "Grocery distribution",
      proofPathPreference: "exact_site_required",
      realSiteRobotEvalFit: {
        siteCardInput: {
          siteType: "Grocery distribution",
          knownGeometryAssets: "CAD for dock and shelf aisles exists.",
          visualConditions: "Mixed LED lighting and reflective tote labels.",
          dynamicConditions: "Forklifts cross the main aisle twice per minute.",
          safetyConstraints: "No-go zone around dock edge and human handoff lane.",
          robotRelevantMetadata: "36 inch aisle choke point near staging.",
        },
        taskCardInput: {
          task: "Move blue totes from shelf staging to conveyor induction.",
          startState: "Robot starts at charging alcove with empty hands.",
          successDefinition: "Tote arrives at induction lane without human touch.",
          failureDefinition: "Dropped tote, blocked route, or human intervention.",
          requiredMetrics:
            "97% success, under 45 seconds per tote, fewer than one intervention per shift.",
        },
        scenarioCardInput: {
          normalScenario: "Clear aisle tote transfer.",
          variation: "Cart partially blocks the main aisle.",
          edgeCase: "Human steps into the handoff zone.",
          knownRisk: "Reflective tape causes false positive obstacle detection.",
        },
        evalCardInput: {
          robotOrPolicyTested: "Unitree G1 policy API endpoint.",
          preferredReviewPath: "Hosted review first, then simulator traces.",
          resultsValidationExpectations:
            "Compare policy trace, human demo, action logs, and short pilot result.",
          predictedVsActualHistory: "One prior pilot missed cycle time by 20%.",
        },
      },
    });

    expect(decision.proofReadyOutcome).toBe("proof_ready_intake");
    expect(decision.proofPathOutcome).toBe("exact_site");
    expect(decision.proofReadinessScore).toBe(100);
    expect(decision.proofReadyCriteria).toEqual(
      expect.arrayContaining([
        "metric_thresholds",
        "safety_constraints",
        "evidence_validation_needs",
      ]),
    );
    expect(decision.missingProofReadyFields).toEqual([]);
    expect(decision.filterTags).toContain("has_metric_thresholds");
    expect(decision.filterTags).toContain("has_safety_constraints");
    expect(decision.filterTags).toContain("has_evidence_validation_needs");
  });

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
      realSiteRobotEvalFit: {
        siteCardInput: {
          safetyConstraints: "Forklift lane exclusion zones.",
        },
        taskCardInput: {
          requiredMetrics: "95% success and under 60 seconds per putaway.",
        },
        evalCardInput: {
          resultsValidationExpectations: "Simulator traces and action logs.",
        },
      },
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
      realSiteRobotEvalFit: {
        siteCardInput: {
          safetyConstraints: "Forklift lane exclusion zones.",
        },
        taskCardInput: {
          requiredMetrics: "95% success and under 60 seconds per putaway.",
        },
        evalCardInput: {
          resultsValidationExpectations: "Simulator traces and action logs.",
        },
      },
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
      realSiteRobotEvalFit: {
        siteCardInput: {
          safetyConstraints: "Forklift lane exclusion zones.",
        },
        taskCardInput: {
          requiredMetrics: "95% success and under 60 seconds per putaway.",
        },
        evalCardInput: {
          resultsValidationExpectations: "Simulator traces and action logs.",
        },
      },
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
      derivedScenePermission: "Keep private until owner review.",
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
      "commercialization_boundary",
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
      privacySecurityConstraints: "No employee-only rooms and redact faces.",
    });

    expect(decision.siteOperatorClaimOutcome).toBe("site_claim_needs_access_boundary");
    expect(decision.accessBoundaryOutcome).toBe("needs_commercialization_boundary");
    expect(decision.requiresHumanReview).toBe(true);
    expect(decision.calendarDisposition).toBe("required_before_next_step");
    expect(decision.recommendedPath).toBe("intake_then_required_scoping_call");
    expect(decision.nextAction).toMatch(/commercialization/i);
    expect(decision.calendarSummary).toMatch(/required before access, rights, privacy, or commercialization movement/i);
  });
});
