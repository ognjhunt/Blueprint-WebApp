import { describe, expect, it } from "vitest";

import type { InboundRequest } from "../types/inbound-request";
import {
  pilotOpportunityPassedGates,
  projectPilotOpportunityForRobotTeam,
} from "../utils/pilot-opportunity-projection";

function qualifiedRecord(
  visibility: "private" | "anonymized" | "approved_robot_teams" = "anonymized",
): InboundRequest {
  return {
    requestId: "opportunity-1",
    qualification_state: "qualified_ready",
    opportunity_state: "handoff_ready",
    request: {
      buyerType: "site_operator",
      siteName: "North fulfillment line",
      siteLocation: "1847 W Fulton St, Chicago, IL",
      targetSiteType: "Fulfillment center",
      taskStatement: "Move packed totes from inspection to outbound staging.",
      pilotOpportunity: {
        requested: true,
        visibility,
        approvedRobotTeamEmails: ["deployment@robotco.ai"],
        anonymizedSummary: "Two-shift packed-tote transfer between existing automation islands.",
        benchmarkProfile: "8-18 kg rigid totes, 97% success, 42 second throughput target.",
        objectProfile: "Rigid packed totes, 8-18 kg.",
        operationalProfile: "42 second cycle, two shifts, 2% exception rate.",
        integrationEnvironment: "WMS task API and facility Wi-Fi.",
        rolloutReadiness: "Named owner and six similar lines.",
        dataUsePermissions: {
          evaluateExistingPolicy: "granted",
          siteSpecificAdaptation: "negotiable",
          retainImprovements: "not_granted",
          generalModelTraining: "not_granted",
        },
      },
    },
    structured_intake: {
      site_operator_claim_outcome: "site_claim_access_boundary_ready",
      access_boundary_outcome: "access_boundary_defined",
      pilot_opportunity_outcome: "evaluation_candidate",
      missing_pilot_opportunity_fields: [],
    },
    ops: { rights_status: "verified", capture_status: "approved" },
  } as InboundRequest;
}

describe("pilot opportunity projection", () => {
  it("redacts identity and full dossier fields from anonymized opportunities", () => {
    const record = qualifiedRecord("anonymized");
    expect(pilotOpportunityPassedGates(record)).toBe(true);
    expect(projectPilotOpportunityForRobotTeam(record, "any@robot.ai")).toEqual(
      expect.objectContaining({
        access_level: "anonymized",
        site_name: null,
        site_location: null,
        object_profile: null,
        benchmark_profile: "8-18 kg rigid totes, 97% success, 42 second throughput target.",
        underlying_site_files: "hosted_not_downloadable",
        deployment_readiness: "not_established",
        qualification_outcome: "evaluation_candidate",
      }),
    );
  });

  it("shows the full standardized dossier only to exact approved emails", () => {
    const record = qualifiedRecord("approved_robot_teams");
    expect(projectPilotOpportunityForRobotTeam(record, "other@robotco.ai")).toBeNull();
    expect(projectPilotOpportunityForRobotTeam(record, "Deployment@RobotCo.ai")).toEqual(
      expect.objectContaining({
        access_level: "shortlisted_confidential",
        site_name: "North fulfillment line",
        object_profile: "Rigid packed totes, 8-18 kg.",
        underlying_site_files: "hosted_not_downloadable",
        data_use_permissions: expect.objectContaining({
          generalModelTraining: "not_granted",
        }),
      }),
    );
  });

  it("never projects private, incomplete, or non-candidate records", () => {
    expect(projectPilotOpportunityForRobotTeam(qualifiedRecord("private"), "deployment@robotco.ai")).toBeNull();

    const missingEvidence = qualifiedRecord();
    missingEvidence.structured_intake!.pilot_opportunity_outcome = "missing_evidence";
    expect(projectPilotOpportunityForRobotTeam(missingEvidence, "deployment@robotco.ai")).toBeNull();

    const simulationOnly = qualifiedRecord();
    simulationOnly.ops!.capture_status = "under_review";
    expect(projectPilotOpportunityForRobotTeam(simulationOnly, "deployment@robotco.ai")).toBeNull();
  });
});
