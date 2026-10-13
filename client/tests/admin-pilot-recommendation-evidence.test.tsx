import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminRobotTeamAccess from "../src/pages/AdminRobotTeamAccess";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: unknown) => headers }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: async (_user: unknown, headers: unknown) => headers ?? {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const passing = { runId: "run_pass", resultId: "a".repeat(64), state: "completed", teamId: "team_acme_1a2b", teamName: "Acme Robotics",
  recommendedTeamId: "team_acme_1a2b", recommendedTeamName: "Acme Robotics", episodesRun: 20, episodesSucceeded: 19, successRate: 0.95,
  confidenceBand: null, evidenceScope: "development_only", evaluatedAtIso: "2026-10-02T00:00:00Z", passed: true, recommendable: true,
  refusals: [], teamRefusal: null };
const failing = { ...passing, runId: "run_fail", resultId: "b".repeat(64), teamId: "team_other", teamName: "Other Robotics",
  recommendedTeamId: "team_other", recommendedTeamName: "Other Robotics", episodesSucceeded: 10, successRate: 0.5, passed: false,
  recommendable: false, refusals: [{ code: "evaluation_below_pass_mark", error: "That evaluation did not meet this job's pass mark." }] };
const job = { requestId: "job_1", recommendation: null, decision: null, decisionSourceDigest: "c".repeat(64), customerConversation: [],
  customerClarification: null, coordination: null, assessment: null, teams: [], interests: [], briefRevision: "d".repeat(64),
  draft: { purpose: "Move cartons onto a pallet", successCondition: "", siteProvides: "", teamProvides: "", pilotCost: "", window: "",
    sitePreparation: "", humanWork: "", costBasis: "", capabilityBasis: "", providerCommitment: "", exclusions: "Production deployment needs approval.", uncertainties: "", alternative: "" },
  sources: { purpose: "siteTaskBriefs/job_1:summary", successCondition: null } };

describe("the admin recommendation form", () => {
  it("derives the team from a selected passing evaluation and submits the run, not a typed team", async () => {
    const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return { ok: true, json: async () => ({ ok: true, id: "rec_1", teamId: "team_acme_1a2b" }) };
      }
      if (url.endsWith("/jobs/job_1/evaluations")) return { ok: true, json: async () => ({ ok: true,
        passMark: { successRate: 0.9, source: "blueprint_default", minimumEpisodes: 10, cycleTimeSeconds: null },
        boundary: "Simulation estimate. It does not certify physical performance or safety; the physical pilot measures the real result.",
        consentWithdrawn: false, evaluations: [passing, failing] }) };
      if (url.endsWith("/recommendations/job_1")) return { ok: true, json: async () => job };
      return { ok: true, json: async () => ({ applications: [], count: 0 }) };
    }));
    render(<QueryClientProvider client={new QueryClient()}><AdminRobotTeamAccess /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText("Job reference"), { target: { value: "job_1" } });
    fireEvent.click(screen.getByRole("button", { name: /Load existing brief/ }));
    const pass = await screen.findByRole("radio", { name: /Acme Robotics · 19 of 20 development-simulation episodes succeeded.*passes the pass mark/ });
    const fail = screen.getByRole("radio", { name: /Other Robotics.*does not pass/ });
    expect(fail).toBeDisabled();
    expect(screen.getByText(/Pass mark: 90% of at least 10 episodes \(Blueprint's default; the job set none\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Admitted provider/)).toBeNull();
    const submit = screen.getByRole("button", { name: "Send reviewed proposal notice" });
    expect(submit).toBeDisabled();
    fireEvent.click(pass);
    expect(screen.getByText(/Recommended team: Acme Robotics \(from the selected evaluation/)).toBeInTheDocument();
    for (const [label, value] of [[/Site responsibilities/, "One escort"], [/Team responsibilities/, "Robot and operator"],
      [/Pilot cost, set by the robot team/, "$18,000"], [/Proposed timing/, "November"], [/Measurable success condition/, "Carton on pallet"],
      [/Quote source/, "Team quote"], [/Site preparation/, "Clear the station"], [/Human setup/, "Escort"], [/Provider interest/, "Interested"]] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    expect(screen.getByLabelText(/Capability basis/)).not.toBeRequired();
    fireEvent.click(submit);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].url).toBe("/api/admin/robot-teams/recommendations/job_1");
    expect(posts[0].body).toMatchObject({ evaluationRunId: "run_pass", resultId: "a".repeat(64), briefRevision: "d".repeat(64), pilotCost: "$18,000" });
    expect(posts[0].body).not.toHaveProperty("teamId");
    expect(await screen.findByText(/Proposal saved on the existing job for Acme Robotics/)).toBeInTheDocument();
  });
});
