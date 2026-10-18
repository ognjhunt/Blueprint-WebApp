// @vitest-environment jsdom
/**
 * The click that was missing.
 *
 * Tier 2 built the brief, the attestation, and the readiness ladder, and
 * shipped no way for an operator to confirm anything — so no site could reach
 * `qualified` through the new path, and the dead end was still a dead end. This
 * is the UI that closes it, so these tests pin the two things that make it an
 * attestation rather than a form: the operator's correction is what gets sent,
 * and "I am not sure" is a real answer that neither loops nor blocks.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

const authMocks = vi.hoisted(() => ({
  currentUser: null as unknown,
  listeners: [] as Array<(user: unknown) => void>,
  signInWithGoogle: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(async () => undefined),
  workspaceRequest: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/accountAuth", () => ({
  watchAuth: async (listener: (user: unknown) => void) => {
    authMocks.listeners.push(listener);
    listener(authMocks.currentUser);
    return () => undefined;
  },
  currentAuthUser: async () => authMocks.currentUser,
  signInWithGoogleAccount: authMocks.signInWithGoogle,
  createPasswordAccount: authMocks.createUserWithEmailAndPassword,
  signInPasswordAccount: authMocks.signInWithEmailAndPassword,
  sendAccountVerification: authMocks.sendEmailVerification,
}));
vi.mock("@/lib/workspace", () => ({
  WorkspaceRequestError: class extends Error {},
  workspaceRequest: authMocks.workspaceRequest,
}));

import { TaskBriefReview, type DraftedBrief } from "@/components/site/TaskBriefReview";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  authMocks.currentUser = null;
  authMocks.listeners.length = 0;
  for (const mock of [
    authMocks.signInWithGoogle, authMocks.createUserWithEmailAndPassword,
    authMocks.signInWithEmailAndPassword, authMocks.sendEmailVerification, authMocks.workspaceRequest,
  ]) mock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A brief with one confirmable answer and one open question. */
function brief(overrides: Partial<DraftedBrief> = {}): DraftedBrief {
  return {
    summary: "Cartons from a conveyor onto a pallet",
    captureMode: "self_capture",
    proposed: [
      {
        fieldId: "sceneStability",
        value: "stable",
        basis: "observation",
        reading: "The pallet station does not move between the clips.",
      },
      {
        fieldId: "objectVariety",
        value: "under_10",
        basis: "assumption",
        reading: "Guessing from the description; please confirm.",
      },
    ],
    unresolved: ["accessWindow"],
    successCriteria: { successDefinition: "Carton reaches the pallet without damage", successRate: 95, cycleTimeSeconds: 30, unknown: false },
    ...overrides,
  };
}

function lastConfirmBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/confirm"));
  return JSON.parse((call?.[1] as { body: string }).body);
}

describe("confirming a brief is an attestation", () => {
  it("shows what we understood, with where each answer came from", () => {
    render(<TaskBriefReview token="tok" brief={brief()} />);

    // The summary is the site's to correct: it is what the job is screened as.
    expect(screen.getByLabelText(/what is the job, in one sentence/i)).toHaveValue("Cartons from a conveyor onto a pallet");
    // The confirmable answer shows its basis.
    expect(screen.getByText(/from your footage/i)).toBeInTheDocument();
    // The assumption is not pre-filled as an answer -- it is an open question,
    // and so is the unresolved gate. Both show the open-question copy.
    expect(screen.getAllByText(/could not tell from what you sent/i).length).toBe(2);
  });

  it("sends the operator's name and their correction, not our reading", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, disposition: "qualified", stage: "capture_needed", nextAction: "Film it." }),
    });

    render(<TaskBriefReview token="tok" brief={brief()} />);

    // Correct the one confirmable answer.
    fireEvent.change(screen.getByLabelText(/between shifts/i), { target: { value: "reconfigured" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana Okafor" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());

    const body = lastConfirmBody();
    expect(body.confirmedBy).toBe("Dana Okafor");
    expect((body.answers as Record<string, string>).sceneStability).toBe("reconfigured");
  });

  it("treats 'I am not sure' on an open question as unknown, and still confirms", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, disposition: "needs_conversation", stage: "capture_needed", nextAction: "Film it." }),
    });

    render(<TaskBriefReview token="tok" brief={brief()} />);

    // The open question defaults to unset; choosing "not sure" records it as
    // unknown rather than looping or blocking.
    const openSelect = screen.getByLabelText(/distinct items/i);
    fireEvent.change(openSelect, { target: { value: "__unknown" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());

    const body = lastConfirmBody();
    expect(body.unknown).toContain("objectVariety");
    expect((body.answers as Record<string, string>).objectVariety).toBeUndefined();
  });

  it("refuses to confirm without a name, because an attestation needs one", async () => {
    render(<TaskBriefReview token="tok" brief={brief()} />);

    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/add your name/i);
    // Nothing was sent.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/confirm"))).toBe(false);
  });

  it("surfaces the next action the verdict returns, not a raw disposition", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        disposition: "qualified",
        stage: "capture_needed",
        nextAction: "We have enough to guide the recording. Film the work area now.",
        stillNeeded: ["deploymentTimeline"],
      }),
    });

    render(<TaskBriefReview token="tok" brief={brief()} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    await waitFor(() =>
      expect(screen.getByText(/enough to guide the recording/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/deploymentTimeline/)).toBeInTheDocument();
  });
});

const confirmed = (extra: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, disposition: "qualified", stage: "capture_needed", nextAction: "Film it.", ...extra }),
});

describe("bounded progressive review", () => {
  it("saves a factual correction without requiring a goal or an account", async () => {
    fetchMock.mockResolvedValueOnce(confirmed());
    render(<TaskBriefReview token="tok" brief={brief({ successCriteria: null, confirmedBy: "Dana",
      operatorAnswers: { sceneStability: "stable" } })} optionalAccount
      account={{ claimed: false, email: "dana@acme.example", claimToken: "claim-tok" }} />);
    expect(screen.queryByLabelText(/choose a password/i)).toBeNull();
    expect(screen.getByLabelText(/also save this job to my account/i)).not.toBeChecked();
    fireEvent.change(screen.getByLabelText(/between shifts/i), { target: { value: "minor_drift" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    await screen.findByText(/that is confirmed/i);
    expect(lastConfirmBody()).toMatchObject({ confirmedBy: "Dana", answers: { sceneStability: "minor_drift" } });
    expect(lastConfirmBody()).not.toHaveProperty("successCriteria");
    expect(authMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(authMocks.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(authMocks.workspaceRequest).not.toHaveBeenCalled();
  });
  it("confirms assessment without hypothetical pilot intent or publication", async () => {
    fetchMock.mockResolvedValueOnce(confirmed());
    render(<TaskBriefReview token="tok" brief={brief()} />);
    expect(screen.queryByLabelText(/would you consider/i)).toBeNull();
    expect(screen.queryByLabelText(/job type/i)).toBeNull();
    expect(screen.queryByLabelText(/idle and clear/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    await screen.findByText(/that is confirmed/i);
    expect(lastConfirmBody().pilotIntent).toBeUndefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("task-listings"))).toBe(false);
  });
  it("retains recorded choices and permits corrections without repeating questions", () => {
    const { rerender } = render(<TaskBriefReview token="tok" brief={brief({ operatorAnswers: { sceneStability: "stable" }, operatorUnknown: ["objectVariety"] })} />);
    expect(screen.queryByText(/could not tell from what you sent/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/between shifts/i), { target: { value: "reconfigured" } });
    fireEvent.change(screen.getByLabelText(/successful cycle/i), { target: { value: "Customer's edited goal" } });
    rerender(<TaskBriefReview token="tok" brief={brief({ summary: "Updated evidence", operatorAnswers: { sceneStability: "stable" }, successCriteria: { successDefinition: "Server's newer suggestion", successRate: 99, cycleTimeSeconds: 15, unknown: false } })} />);
    expect(screen.getByLabelText(/between shifts/i)).toHaveValue("reconfigured");
    expect(screen.getByLabelText(/successful cycle/i)).toHaveValue("Customer's edited goal");
  });
  it("loads the operator's recorded pilot preferences for optional correction", () => {
    render(<TaskBriefReview token="tok" brief={brief({ pilotIntent: { pilotConsideration: "evaluation_only", deploymentPath: "pilot_only" } })} />);
    expect(screen.getByLabelText(/would you consider a physical pilot here/i)).toHaveValue("evaluation_only");
    expect(screen.getByLabelText(/if a pilot meets the agreed targets/i)).toHaveValue("pilot_only");
  });
});

describe("the same step saves the site to an account", () => {
  const account = { claimed: false, email: "dana@acme.example", claimToken: "claim-tok" };
  const unverified = { email: "dana@acme.example", emailVerified: false, reload: vi.fn(), getIdToken: vi.fn() };

  it("creates the account first, then sends one verification click that finishes the claim", async () => {
    authMocks.createUserWithEmailAndPassword.mockResolvedValueOnce(unverified);
    fetchMock.mockResolvedValueOnce(confirmed());
    render(<TaskBriefReview token="tok" brief={brief()} account={account} />);
    fireEvent.change(screen.getByLabelText(/choose a password/i), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByLabelText(/accept the/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm and save$/i }));

    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument());
    expect(authMocks.createUserWithEmailAndPassword).toHaveBeenCalledWith("dana@acme.example", "hunter22");
    // Workspace and terms are set up now, so the verification click is the last step.
    expect(authMocks.workspaceRequest).toHaveBeenCalledWith(unverified, "/setup", "POST", expect.objectContaining({ workspaceType: "site_operator", acceptedTerms: true }));
    expect(authMocks.sendEmailVerification).toHaveBeenCalledWith(unverified, expect.stringMatching(/\/claim\/claim-tok\?auto=1$/));
  });

  it("claims in place when Google has already verified the email", async () => {
    authMocks.signInWithGoogle.mockResolvedValueOnce({ email: "dana@acme.example", emailVerified: true });
    fetchMock.mockResolvedValueOnce(confirmed());
    render(<TaskBriefReview token="tok" brief={brief()} account={account} />);
    fireEvent.click(screen.getByLabelText(/accept the/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /save with google/i }));

    await waitFor(() => expect(screen.getByText(/saved to your account/i)).toBeInTheDocument());
    expect(authMocks.workspaceRequest).toHaveBeenCalledWith(expect.anything(), "/claim", "POST", { token: "claim-tok", acceptedTerms: true });
    expect(authMocks.sendEmailVerification).not.toHaveBeenCalled();
  });

  it("confirms nothing when the account is for a different email", async () => {
    authMocks.signInWithGoogle.mockResolvedValueOnce({ email: "someone@else.example", emailVerified: true });
    render(<TaskBriefReview token="tok" brief={brief()} account={account} />);
    fireEvent.click(screen.getByLabelText(/accept the/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /save with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/dana@acme.example/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks nothing more of a site already in an account", () => {
    render(<TaskBriefReview token="tok" brief={brief()} account={{ claimed: true, email: "dana@acme.example", claimToken: null }} />);
    expect(screen.queryByText(/save this site to your account/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm it/i })).toBeInTheDocument();
  });
});

/**
 * Audit N3: a site can start with footage and no description, so its brief's
 * summary is a placeholder. The job is screened and prepared from that
 * sentence, so the review asks for it, and a site can correct a summary we read
 * wrong before confirming.
 */
describe("the job in the site's own sentence", () => {
  const confirmed = { ok: true, status: 200, json: async () => ({ ok: true, disposition: "qualified", stage: "capture_needed", nextAction: "Done." }) };

  it("requires one sentence when the brief has no description, and sends it", async () => {
    fetchMock.mockResolvedValueOnce(confirmed);
    render(<TaskBriefReview token="tok" brief={brief({ summary: "Your site task" })} />);

    const summary = screen.getByLabelText(/what is the job, in one sentence/i) as HTMLInputElement;
    expect(summary.value).toBe("");
    expect(summary).toBeRequired();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/one sentence/i);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/confirm"))).toBe(false);

    fireEvent.change(summary, { target: { value: "Pick up each carton and place it at the end of the table" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());
    expect(lastConfirmBody().summary).toBe("Pick up each carton and place it at the end of the table");
  });

  it("starts from the drafted summary and sends it only when the site changes it", async () => {
    fetchMock.mockResolvedValue(confirmed);
    const { unmount } = render(<TaskBriefReview token="tok" brief={brief()} />);
    expect(screen.getByLabelText(/what is the job, in one sentence/i)).toHaveValue("Cartons from a conveyor onto a pallet");
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());
    expect(lastConfirmBody()).not.toHaveProperty("summary");
    unmount();

    fetchMock.mockClear();
    render(<TaskBriefReview token="tok" brief={brief()} />);
    fireEvent.change(screen.getByLabelText(/what is the job, in one sentence/i), { target: { value: "Pick each carton off the conveyor and set it on the table" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());
    expect(lastConfirmBody().summary).toBe("Pick each carton off the conveyor and set it on the table");
  });

  it("shows the server's field error when the sentence is still missing", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ code: "task_brief_summary_required",
      error: "Describe the job in one sentence, for example “Pick up each carton and place it at the end of the table.”" }) });
    render(<TaskBriefReview token="tok" brief={brief()} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Describe the job in one sentence/);
  });
});
