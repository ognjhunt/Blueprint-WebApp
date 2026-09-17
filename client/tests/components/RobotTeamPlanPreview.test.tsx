// @vitest-environment jsdom
/**
 * A person getting the same thing their agent gets.
 *
 * The asymmetry this closes was never a decision anybody made. An agent could
 * register, hand over a checkpoint and read back every site we hold — ranked,
 * priced, with a reason per row — in three calls and a few seconds. A person
 * arriving at the same page got four qualifying questions, nine spec answers,
 * two prose fields, "Send application", and a wait. The bot had strictly better
 * access than the customer because the API was built first and the page was
 * never revisited.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RobotTeamPlanPreview } from "@/components/site/RobotTeamPlanPreview";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonOnce(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

function fillAndSubmit(reference = "https://policies.example/v3") {
  fireEvent.change(screen.getByLabelText(/team name/i), {
    target: { value: "Alpha Robotics" },
  });
  fireEvent.change(screen.getByLabelText(/where is it/i), { target: { value: reference } });
  fireEvent.click(screen.getByRole("button", { name: /see my plan/i }));
}

describe("RobotTeamPlanPreview", () => {
  it("asks for a checkpoint and nothing else", () => {
    render(<RobotTeamPlanPreview />);

    // The four gates are deployment questions and belong to a later
    // conversation; the seven spec answers a single run establishes better.
    // None of them is needed to rank sites.
    expect(screen.queryByText(/where is the hardware today/i)).toBeNull();
    expect(screen.queryByText(/who commits the deployment engineering/i)).toBeNull();
    expect(screen.queryByText(/would you deploy/i)).toBeNull();
    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/where is it/i)).toBeInTheDocument();
  });

  it("registers with the checkpoint inline and shows the ranked plan", async () => {
    jsonOnce(201, {
      teamId: "team_alpha_ab12cd",
      agentKey: "bpk_secret",
      checkpoint: { checkpointId: "ckpt_1" },
    });
    jsonOnce(200, {
      selected: [
        {
          sceneId: "s1",
          siteLabel: "Grocery back room",
          costUsd: 250,
          rationale: "Resolves 4 hard constraints nobody has established for this robot.",
        },
      ],
      summary: "Starting 1 run for $250 of a $2500 budget.",
      totalCostUsd: 250,
    });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/1 site worth running against/i);
    expect(screen.getByText("Grocery back room")).toBeInTheDocument();
    // The reason, not just the ranking -- a team should be able to disagree.
    expect(screen.getByText(/resolves 4 hard constraints/i)).toBeInTheDocument();

    // One registration carrying the checkpoint, so a plan is two round trips.
    const [registerUrl, registerInit] = fetchMock.mock.calls[0];
    expect(registerUrl).toBe("/api/agent-team/register");
    expect(JSON.parse(String(registerInit.body))).toMatchObject({
      teamName: "Alpha Robotics",
      checkpoint: { runtime: "policy_endpoint", reference: "https://policies.example/v3" },
    });

    // And the plan is fetched with the key that was just issued.
    const [planUrl, planInit] = fetchMock.mock.calls[1];
    expect(planUrl).toBe("/api/agent-team/plan");
    expect(planInit.headers.Authorization).toBe("Bearer bpk_secret");
  });

  it("shows the key once, because we cannot show it again", async () => {
    jsonOnce(201, {
      teamId: "team_alpha_ab12cd",
      agentKey: "bpk_only_chance",
      checkpoint: { checkpointId: "ckpt_1" },
    });
    jsonOnce(200, { selected: [], summary: "No evaluation candidates available today." });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/only time we can show it/i);
    expect(screen.getByText("bpk_only_chance")).toBeInTheDocument();
  });

  it("says plainly when there is nothing worth running", async () => {
    // Honest rather than encouraging: an empty library is our problem, and
    // dressing it up as a near-miss would be fake supply.
    jsonOnce(201, {
      teamId: "t",
      agentKey: "bpk_x",
      checkpoint: { checkpointId: "ckpt_1" },
    });
    jsonOnce(200, { selected: [], summary: "No evaluation candidates available today." });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/nothing worth running yet/i);
  });

  it("surfaces the reason a checkpoint was refused", async () => {
    jsonOnce(400, {
      teamId: "t",
      agentKey: "bpk_x",
      checkpoint: { refusal: "reference_missing", detail: "A checkpoint needs something we can run." },
    });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit("   ");

    // Client-side: a blank reference never reaches the network.
    await screen.findByRole("alert");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not claim a plan when the catalogue fails", async () => {
    jsonOnce(201, {
      teamId: "t",
      agentKey: "bpk_x",
      checkpoint: { checkpointId: "ckpt_1" },
    });
    jsonOnce(503, { error: "Site catalogue is unavailable" });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/catalogue/i);
    expect(screen.queryByText(/worth running against/i)).toBeNull();
  });
});
