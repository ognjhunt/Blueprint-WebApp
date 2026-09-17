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
  fireEvent.change(screen.getByLabelText(/work email/i), {
    target: { value: "eng@alpha.example" },
  });
  fireEvent.change(screen.getByLabelText(/team or company/i), {
    target: { value: "Alpha Robotics" },
  });
  if (reference !== null) {
    fireEvent.change(screen.getByLabelText(/where is it/i), { target: { value: reference } });
  }
  fireEvent.click(screen.getByRole("button", { name: /see what we would run/i }));
}

describe("RobotTeamPlanPreview", () => {
  it("asks about the robot, and asks none of the four gates", () => {
    render(<RobotTeamPlanPreview />);

    // Understanding the robot is the point of onboarding. The gates are
    // deployment questions and belong to a later conversation.
    expect(screen.getByLabelText(/what is it/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what does it do/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.queryByText(/where is the hardware today/i)).toBeNull();
    expect(screen.queryByText(/who commits the deployment engineering/i)).toBeNull();
    expect(screen.queryByText(/would you deploy/i)).toBeNull();
  });

  it("sends the robot details so the first plan is ranked, not generic", async () => {
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    jsonOnce(200, { selected: [], totalCostUsd: 0 });

    render(<RobotTeamPlanPreview />);
    fireEvent.change(screen.getByLabelText(/what does it do/i), {
      target: { value: "palletizing" },
    });
    fillAndSubmit();

    await screen.findByText(/you are in/i);
    const [, registerInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(registerInit.body))).toMatchObject({
      contactEmail: "eng@alpha.example",
      taskFamily: "palletizing",
    });
  });

  it("does not dead-end when the library has nothing yet", async () => {
    // The state the first version stopped on: "No evaluation candidates
    // available today", full stop, at the moment someone had just signed up.
    // An empty library is our gap, not theirs, and the answer has to name what
    // happens next.
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    jsonOnce(200, { selected: [], totalCostUsd: 0 });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/you are in/i);
    expect(screen.getByText(/gap in our library/i)).toBeInTheDocument();
    expect(screen.getByText(/come back to you when a site lands/i)).toBeInTheDocument();
  });

  it("registers a team that has no checkpoint yet", async () => {
    // Having nothing to run is a real state, not a failure. Turning them away
    // for it would be a gate wearing a different hat.
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x" });

    render(<RobotTeamPlanPreview />);
    fireEvent.click(screen.getByLabelText(/i have a checkpoint/i));
    fillAndSubmit(null as unknown as string);

    await screen.findByText(/you are in/i);
    expect(screen.getByText(/nothing to rank yet/i)).toBeInTheDocument();
    // Only the registration call: there is no checkpoint to plan against.
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
      totalCostUsd: 250,
    });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/1 site we would run this against/i);
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

  it("does not put a bearer token in a person's face", async () => {
    // A key is an agent affordance. Handing one to a human as the headline,
    // under "this is the only time we can show it", makes losing it their
    // fault for something they never asked for.
    jsonOnce(201, {
      teamId: "team_alpha_ab12cd",
      agentKey: "bpk_only_chance",
      checkpoint: { checkpointId: "ckpt_1" },
    });
    jsonOnce(200, { selected: [], totalCostUsd: 0 });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/you are in/i);
    expect(screen.queryByText("bpk_only_chance")).toBeNull();

    // Available to the teams that want it, behind the disclosure where agent
    // things live.
    fireEvent.click(screen.getByRole("button", { name: /reveal key/i }));
    expect(screen.getByText("bpk_only_chance")).toBeInTheDocument();
  });

  it("never claims to have sent an email, because nothing sends one", async () => {
    // Registration writes a record. It does not notify anyone, and saying it
    // did would be the easiest lie on the page to tell.
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    jsonOnce(200, { selected: [], totalCostUsd: 0 });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/you are in/i);
    expect(document.body.textContent).not.toMatch(/we have emailed|check your inbox|sent you an email/i);
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

  it("does not blame the robot for our own outage", async () => {
    // An empty list and a failed catalogue look identical on screen and are
    // opposite things to say. "We have no site for your robot" is a claim about
    // their machine; this was our request failing.
    jsonOnce(201, {
      teamId: "t",
      agentKey: "bpk_x",
      checkpoint: { checkpointId: "ckpt_1" },
    });
    jsonOnce(503, { error: "Site catalogue is unavailable" });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();

    await screen.findByText(/could not load the site list/i);
    expect(screen.getByText(/fault on our side/i)).toBeInTheDocument();
    expect(screen.queryByText(/gap in our library/i)).toBeNull();
    expect(screen.queryByText(/we would run this against/i)).toBeNull();
  });
});
