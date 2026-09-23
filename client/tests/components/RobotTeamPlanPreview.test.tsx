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

const accountMocks = vi.hoisted(() => ({
  currentUser: null as unknown,
  signInWithGoogle: vi.fn(),
  createAccount: vi.fn(),
  sendVerification: vi.fn(async () => undefined),
  connect: vi.fn(async () => undefined),
  setUp: vi.fn(async () => undefined),
}));
vi.mock("@/lib/accountAuth", () => ({
  currentAuthUser: async () => accountMocks.currentUser,
  signInWithGoogleAccount: accountMocks.signInWithGoogle,
  createPasswordAccount: accountMocks.createAccount,
  signInPasswordAccount: vi.fn(),
  sendAccountVerification: accountMocks.sendVerification,
}));
vi.mock("@/lib/robotTeamAccount", () => ({
  connectRobotTeam: accountMocks.connect,
  setUpRobotTeamWorkspace: accountMocks.setUp,
  robotTeamVerificationUrl: () => "https://tryblueprint.io/contact/robot-team?connect=1",
}));

import { RobotTeamPlanPreview } from "@/components/site/RobotTeamPlanPreview";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  accountMocks.currentUser = null;
  for (const mock of [accountMocks.signInWithGoogle, accountMocks.createAccount,
    accountMocks.sendVerification, accountMocks.connect, accountMocks.setUp]) mock.mockClear();
});

/** Paying needs a verified account: connect one through Google, which is verified. */
async function connectAccount() {
  accountMocks.signInWithGoogle.mockResolvedValueOnce({ email: "eng@alpha.example", emailVerified: true });
  fireEvent.click(screen.getByLabelText(/accept the/i));
  fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
  await waitFor(() => expect(screen.queryByText(/create your account to run these/i)).toBeNull());
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/agent-team/plan").length).toBeGreaterThanOrEqual(2));
}

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
  fireEvent.change(screen.getByLabelText(/where is the hardware today/i), {
    target: { value: "pilots" },
  });
  fireEvent.change(screen.getByLabelText(/would you deploy in the austin metro/i), {
    target: { value: "right_opportunity" },
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
    // The two deployment facts matching treats as hard and no run can measure
    // are asked here, in two taps. The rest of the old interview is not.
    expect(screen.getByLabelText(/where is the hardware today/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/would you deploy in the austin metro/i)).toBeInTheDocument();
    expect(screen.queryByText(/who commits the deployment engineering/i)).toBeNull();
    expect(screen.queryByText(/when would you want to be running/i)).toBeNull();
    expect(screen.queryByText(/what would prove the system works/i)).toBeNull();
  });

  it("sends the robot's facts structured, so matching stops guessing", async () => {
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    jsonOnce(200, { selected: [], totalCostUsd: 0 });

    render(<RobotTeamPlanPreview />);
    fireEvent.change(screen.getByLabelText(/what is it/i), { target: { value: "Mobile manipulator" } });
    fireEvent.change(screen.getByLabelText(/where is the hardware today/i), { target: { value: "pilots" } });
    fireEvent.change(screen.getByLabelText(/would you deploy in the austin metro/i), {
      target: { value: "right_opportunity" },
    });
    fireEvent.change(screen.getByLabelText(/website or spec sheet/i), {
      target: { value: "https://alpha.example/specs" },
    });
    fillAndSubmit();

    await screen.findByText(/you are in/i);
    const [, registerInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(registerInit.body))).toMatchObject({
      embodiment: "Mobile manipulator",
      hardwareMaturity: "pilots",
      deploymentGeography: "right_opportunity",
      website: "https://alpha.example/specs",
    });
  });

  it("does not register until both non-observable physical facts are answered", async () => {
    render(<RobotTeamPlanPreview />);
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "eng@alpha.example" },
    });
    fireEvent.change(screen.getByLabelText(/team or company/i), {
      target: { value: "Alpha Robotics" },
    });
    fireEvent.change(screen.getByLabelText(/where is it/i), {
      target: { value: "https://policies.example/v3" },
    });

    fireEvent.submit(screen.getByRole("form", { name: /tell us about your robot/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/where the hardware is today/i);
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(document.body.textContent).not.toContain("bpk_only_chance");

    // An agent's key comes from the account that owns the team, not from here.
    expect(screen.getByRole("link", { name: /settings → agent access/i })).toHaveAttribute(
      "href",
      "/settings?tab=agent",
    );
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

describe("funding and queueing the plan", () => {
  const STASH_KEY = "bp-plan-queue";
  const row = (sceneId: string) => ({
    sceneId,
    siteLabel: "Warehouse",
    costUsd: 25,
    rationale: "Payload band unknown for this checkpoint.",
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/contact/robot-team");
  });

  it.each(["", "?funded=1"])("never restores or buys another task's saved plan (%s)", async (query) => {
    const saved = JSON.stringify({ agentKey: "bpk_saved", checkpointId: "ckpt_saved",
      sceneId: "old-task", totalCostUsd: 25, planToken: "old-plan", idempotencyKey: "old-key",
      receipt: { status: "queued", started: [{ runId: "old-run", ...row("old-task") }], refused: [], reservedUsd: 25 } });
    window.sessionStorage.setItem(STASH_KEY, saved);
    window.history.replaceState({}, "", `/contact/robot-team${query}`);
    render(<RobotTeamPlanPreview sceneId="new-task" />);
    expect(screen.getByRole("form", { name: "Tell us about your robot" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(STASH_KEY)).toBe(saved);
  });

  it("funds only the actual shortfall without enabling autonomous spend", async () => {
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    const planned = {
      selected: [row("s1"), row("s2"), row("s3")],
      totalCostUsd: 75,
      planToken: "signed-plan",
      availableBalanceUsd: 55,
      fundingNeededUsd: 20,
    };
    jsonOnce(200, { ...planned, planToken: null, accountBound: false });
    // Connecting the account re-plans; the payable plan comes back signed.
    jsonOnce(200, { ...planned, accountBound: true });
    jsonOnce(201, { ok: true, checkoutUrl: "https://checkout.stripe.test/s1" });
    const onCheckout = vi.fn();

    render(<RobotTeamPlanPreview onCheckout={onCheckout} />);
    fillAndSubmit();
    await screen.findByText(/3 sites we would run this against/i);
    await connectAccount();

    // The old ending: "we will be in touch to start them". A queue with a person in it.
    expect(document.body.textContent).not.toMatch(/be in touch/i);
    fireEvent.click(screen.getByRole("button", { name: /add \$50 and queue these runs/i }));

    await waitFor(() => expect(onCheckout).toHaveBeenCalledWith("https://checkout.stripe.test/s1"));
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/agent-team/policy");
    const [fundingUrl, fundingInit] = fetchMock.mock.calls[3];
    expect(fundingUrl).toBe("/api/agent-team/funding");
    expect(JSON.parse(String(fundingInit.body))).toEqual({ amountUsd: 50 });
    expect(screen.getByText(/amount above the \$20 shortfall remains in your balance/i)).toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem(STASH_KEY)!)).toMatchObject({
      agentKey: "bpk_x",
      checkpointId: "ckpt_1",
      totalCostUsd: 75,
      planToken: "signed-plan",
    });
  });

  it("uses existing balance to confirm the signed one-time plan directly", async () => {
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    const planned = {
      selected: [row("s1"), row("s2")],
      totalCostUsd: 50,
      planToken: "signed-direct",
      availableBalanceUsd: 80,
      fundingNeededUsd: 0,
    };
    jsonOnce(200, { ...planned, planToken: null, accountBound: false });
    jsonOnce(200, { ...planned, accountBound: true });
    jsonOnce(202, { started: [], refused: [], reservedUsd: 50 });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();
    await screen.findByText(/2 sites we would run this against/i);
    await connectAccount();
    fireEvent.click(screen.getByRole("button", { name: /queue these runs from your balance/i }));

    await screen.findByText(/queued 0 runs/i);
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/agent-team/funding");
    expect(JSON.parse(String(fetchMock.mock.calls[3][1].body))).toMatchObject({
      checkpointId: "ckpt_1",
      confirm: true,
      spendMode: "one_time",
      planToken: "signed-direct",
    });
  });

  it("confirms the runs once the payment has landed and says what was queued", async () => {
    window.sessionStorage.setItem(
      STASH_KEY,
      JSON.stringify({
        agentKey: "bpk_x",
        checkpointId: "ckpt_1",
        totalCostUsd: 50,
        planToken: "signed-plan",
        idempotencyKey: "idem-0001",
        email: "eng@alpha.example",
      }),
    );
    window.history.replaceState({}, "", "/contact/robot-team?funded=1");
    jsonOnce(200, { balance: { availableUsd: 50 } });
    jsonOnce(202, {
      started: [
        { runId: "run_a", sceneId: "s1", siteLabel: "Warehouse", costUsd: 25 },
        { runId: "run_b", sceneId: "s2", siteLabel: "Warehouse", costUsd: 25 },
      ],
      refused: [],
      reservedUsd: 50,
    });

    render(<RobotTeamPlanPreview />);

    await screen.findByText(/queued 2 runs/i);
    const [meUrl, meInit] = fetchMock.mock.calls[0];
    expect(meUrl).toBe("/api/agent-team/me");
    expect(meInit.headers.Authorization).toBe("Bearer bpk_x");
    const [runsUrl, runsInit] = fetchMock.mock.calls[1];
    expect(runsUrl).toBe("/api/agent-team/runs");
    expect(JSON.parse(String(runsInit.body))).toEqual({
      checkpointId: "ckpt_1",
      confirm: true,
      spendMode: "one_time",
      planToken: "signed-plan",
      idempotencyKey: "idem-0001",
    });
    expect(screen.getByText(/\$50 is reserved/i)).toBeInTheDocument();
    // Nothing emails a result today, so nothing here may say it will.
    expect(document.body.textContent).not.toMatch(/we will email|check your inbox/i);
    expect(window.sessionStorage.getItem(STASH_KEY)).not.toBeNull();
  });

  it("names the runs that were refused rather than swallowing them", async () => {
    window.sessionStorage.setItem(
      STASH_KEY,
      JSON.stringify({ agentKey: "bpk_x", checkpointId: "ckpt_1", totalCostUsd: 50, planToken: "signed-plan", idempotencyKey: "idem-2" }),
    );
    window.history.replaceState({}, "", "/contact/robot-team?funded=1");
    jsonOnce(200, { balance: { availableUsd: 50 } });
    jsonOnce(202, {
      started: [{ runId: "run_a", sceneId: "s1", siteLabel: "Warehouse", costUsd: 25 }],
      refused: [{ sceneId: "s2", siteLabel: "Site", costUsd: 25, refusal: "site_no_longer_runnable", detail: "This site is no longer available to evaluate. Nothing was charged for it." }],
      reservedUsd: 25,
    });

    render(<RobotTeamPlanPreview />);

    await screen.findByText(/queued 1 run\b/i);
    expect(screen.getByText(/no longer available to evaluate/i)).toBeInTheDocument();
  });

  it("shows result receipts inside the UI using the retained session key", async () => {
    window.sessionStorage.setItem(
      STASH_KEY,
      JSON.stringify({ agentKey: "bpk_x", checkpointId: "ckpt_1", totalCostUsd: 50, planToken: "signed-plan", idempotencyKey: "idem-results" }),
    );
    window.history.replaceState({}, "", "/contact/robot-team?funded=1");
    jsonOnce(200, { balance: { availableUsd: 50 } });
    jsonOnce(202, { started: [{ runId: "run_a", sceneId: "s1", siteLabel: "Warehouse", costUsd: 25 }], refused: [], reservedUsd: 25 });
    jsonOnce(200, {
      runs: [{ runId: "run_a", sceneId: "s1", state: "completed", resultStatus: "reported", result: { observed: { episodesRun: 50, episodesSucceeded: 41 } } }],
    });

    render(<RobotTeamPlanPreview />);
    await screen.findByText(/queued 1 run/i);
    fireEvent.click(screen.getByRole("button", { name: /check results/i }));

    await screen.findByText(/41 of 50 episodes/i);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/agent-team/results");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer bpk_x");
  });

  it("requires explicit re-review when the signed plan expires", async () => {
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    const planned = {
      selected: [row("s1")], totalCostUsd: 25, planToken: "expired-plan",
      availableBalanceUsd: 25, fundingNeededUsd: 0,
    };
    jsonOnce(200, { ...planned, planToken: null, accountBound: false });
    jsonOnce(200, { ...planned, accountBound: true });
    jsonOnce(409, { code: "eval_plan_invalid", error: "expired" });

    render(<RobotTeamPlanPreview />);
    fillAndSubmit();
    await screen.findByText(/1 site we would run this against/i);
    await connectAccount();
    fireEvent.click(screen.getByRole("button", { name: /queue these runs from your balance/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/review a fresh plan before spending/i);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("recovers an expired Stripe-return plan with the same account and explicit review", async () => {
    window.sessionStorage.setItem("bp-plan-queue", JSON.stringify({ agentKey: "bpk_saved", checkpointId: "ckpt_saved", totalCostUsd: 25, planToken: "expired", idempotencyKey: "saved-key", email: "team@example.test", sceneId: "s1" }));
    window.history.replaceState({}, "", "/contact/robot-team?funded=1");
    jsonOnce(200, { balance: { availableUsd: 50 } });
    jsonOnce(409, { code: "eval_plan_invalid" });
    render(<RobotTeamPlanPreview />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/review a fresh plan/i);
    expect(screen.queryByRole("form", { name: "Tell us about your robot" })).not.toBeInTheDocument();
    jsonOnce(200, { selected: [row("s1")], teamId: "saved-team", totalCostUsd: 25, planToken: "renewed", availableBalanceUsd: 50, fundingNeededUsd: 0 });
    jsonOnce(200, { accountBound: true, balance: { availableUsd: 50 } });
    fireEvent.click(screen.getByRole("button", { name: "Review updated plan" }));
    await screen.findByRole("button", { name: /queue these runs from your balance/i });
    // The team already paid once, so its account is on file and nothing is asked again.
    expect(screen.queryByText(/create your account to run these/i)).toBeNull();
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/agent-team/me", "/api/agent-team/runs", "/api/agent-team/plan", "/api/agent-team/me"]);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body))).toEqual({ checkpointId: "ckpt_saved", sceneId: "s1" });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer bpk_saved");
  });

});

describe("paying needs a verified account", () => {
  const row = (sceneId: string) => ({
    sceneId, siteLabel: "Warehouse", costUsd: 99, rationale: "Payload band unknown for this checkpoint.",
  });
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  function planWithRows() {
    jsonOnce(201, { teamId: "t", agentKey: "bpk_x", checkpoint: { checkpointId: "ckpt_1" } });
    const planned = { selected: [row("s1")], totalCostUsd: 99, availableBalanceUsd: 0, fundingNeededUsd: 99 };
    // Unbound: priced but unsigned. After connecting, the re-plan is signed.
    jsonOnce(200, { ...planned, planToken: null, accountBound: false });
    jsonOnce(200, { ...planned, planToken: "signed", accountBound: true });
  }

  it("shows the plan free, and holds the pay button until an account owns the team", async () => {
    planWithRows();
    render(<RobotTeamPlanPreview />);
    fillAndSubmit();
    await screen.findByText(/1 site we would run this against/i);

    expect(screen.getByText(/create your account to run these/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add \$99 and queue these runs/i })).toBeDisabled();

    await connectAccount();
    expect(accountMocks.connect).toHaveBeenCalledWith(
      expect.objectContaining({ email: "eng@alpha.example" }),
      "bpk_x",
      expect.objectContaining({ teamName: "Alpha Robotics" }),
    );
    // Connecting re-plans with the same key, which is what makes it payable.
    await waitFor(() => expect(screen.getByRole("button", { name: /add \$99 and queue these runs/i })).toBeEnabled());
    expect(fetchMock.mock.calls[2][0]).toBe("/api/agent-team/plan");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer bpk_x");
  });

  it("sends one verification click for a password account and keeps the plan for the return trip", async () => {
    planWithRows();
    const user = { email: "eng@alpha.example", emailVerified: false, reload: vi.fn(), getIdToken: vi.fn() };
    accountMocks.createAccount.mockResolvedValueOnce(user);
    render(<RobotTeamPlanPreview />);
    fillAndSubmit();
    await screen.findByText(/1 site we would run this against/i);

    fireEvent.change(screen.getByLabelText(/choose a password/i), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByLabelText(/accept the/i));
    fireEvent.click(screen.getByRole("button", { name: /create account and continue/i }));

    await screen.findByText(/check your inbox/i);
    expect(accountMocks.setUp).toHaveBeenCalledWith(user, { teamName: "Alpha Robotics", acceptedTerms: true });
    expect(accountMocks.sendVerification).toHaveBeenCalledWith(user, expect.stringContaining("connect=1"));
    expect(accountMocks.connect).not.toHaveBeenCalled();
    // Kept across tabs: mail clients open the verification link in a new one.
    const stash = JSON.parse(window.localStorage.getItem("bp-plan-account")!);
    expect(stash.plan.agentKey).toBe("bpk_x");
    expect(typeof stash.savedAtMs).toBe("number");
    expect(screen.getByRole("button", { name: /add \$99 and queue these runs/i })).toBeDisabled();
  });

  it("finishes the connection in the new tab the verification link opens", async () => {
    // Another tab saved the plan before the email was sent.
    const saved = {
      plan: {
        teamId: "team-1", agentKey: "bpk_x", checkpointId: "ckpt-1", rows: [{ sceneId: "s1", siteLabel: "Site one", costUsd: 99, rationale: "r" }],
        totalCostUsd: 99, planToken: null, availableBalanceUsd: 0, fundingNeededUsd: 99, email: "eng@alpha.example",
        teamName: "Alpha Robotics", accountBound: false, taskFamilyLabel: "Pick and place", planUnavailable: false,
      },
      savedAtMs: Date.now(),
    };
    window.localStorage.setItem("bp-plan-account", JSON.stringify(saved));
    window.history.replaceState({}, "", "/contact/robot-team?connect=1");
    const user = { email: "eng@alpha.example", emailVerified: true, reload: vi.fn(), getIdToken: vi.fn() };
    accountMocks.currentUser = user;
    render(<RobotTeamPlanPreview />);
    await screen.findByText(/1 site we would run this against/i);
    await vi.waitFor(() => expect(accountMocks.connect).toHaveBeenCalledWith(user, "bpk_x", expect.anything()));
    await vi.waitFor(() => expect(window.localStorage.getItem("bp-plan-account")).toBeNull());
    window.history.replaceState({}, "", "/");
  });

  it("drops a saved plan older than a day instead of reusing its key", async () => {
    window.localStorage.setItem("bp-plan-account", JSON.stringify({ plan: { agentKey: "bpk_old" }, savedAtMs: Date.now() - 25 * 60 * 60 * 1000 }));
    window.history.replaceState({}, "", "/contact/robot-team?connect=1");
    render(<RobotTeamPlanPreview />);
    expect(screen.queryByText(/we would run this against/i)).toBeNull();
    expect(window.localStorage.getItem("bp-plan-account")).toBeNull();
    window.history.replaceState({}, "", "/");
  });
});
