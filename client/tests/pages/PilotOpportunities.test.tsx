import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PilotOpportunities from "@/pages/app/PilotOpportunities";

const usePilotOpportunitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pilotOpportunities", () => ({
  usePilotOpportunities: usePilotOpportunitiesMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { email: "lead@robot.ai" },
    userData: { buyerType: "robot_team", name: "Robot Lead" },
  }),
}));

describe("PilotOpportunities", () => {
  it("renders a meaningful fail-closed empty state", () => {
    usePilotOpportunitiesMock.mockReturnValue({
      opportunities: [],
      proofBoundary: "Only gate-passed records are returned.",
      isLoading: false,
      error: null,
    });

    render(<PilotOpportunities />);
    expect(screen.getByRole("heading", { name: /Pilot opportunities/i })).toBeInTheDocument();
    expect(screen.getByText(/No permission-matched opportunities/i)).toBeInTheDocument();
    expect(screen.getByText(/Incomplete, private, rejected, and unmatched records remain hidden/i)).toBeInTheDocument();
  });

  it("keeps the deployment claim ceiling visible on projected opportunities", () => {
    usePilotOpportunitiesMock.mockReturnValue({
      opportunities: [
        {
          opportunity_id: "opportunity-1",
          access_level: "anonymized",
          visibility: "anonymized",
          site_name: null,
          site_location: null,
          site_type: "Fulfillment center",
          workflow: "Packed-tote transfer between automation islands.",
          anonymized_summary: "Packed-tote transfer between automation islands.",
          benchmark_profile: "Rigid totes, 97% success, 42 second target.",
          object_profile: null,
          operational_profile: null,
          integration_environment: null,
          rollout_readiness: null,
          data_use_permissions: {
            evaluateExistingPolicy: "granted",
            siteSpecificAdaptation: "not_granted",
            retainImprovements: "not_granted",
            generalModelTraining: "not_granted",
          },
          underlying_site_files: "hosted_not_downloadable",
          controlled_evaluation: "request_required",
          compute_responsibility: "The robot team funds incremental evaluation compute.",
          qualification_outcome: "evaluation_candidate",
          qualification_state: "qualified_ready",
          opportunity_state: "handoff_ready",
          deployment_readiness: "not_established",
          claim_ceiling: "Simulation evidence does not establish deployment readiness; robot-specific and physical evidence remain required.",
        },
      ],
      proofBoundary: "Private feed boundary.",
      isLoading: false,
      error: null,
    });

    render(<PilotOpportunities />);
    expect(screen.getByText(/Evaluation candidate/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulation evidence does not establish deployment readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/site-model files remain hosted inside Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/General model training/i)).toBeInTheDocument();
    expect(screen.getByText(/completion rate, expected cycle time/i)).toBeInTheDocument();
    expect(screen.queryByText(/North line/i)).not.toBeInTheDocument();
  });
});
