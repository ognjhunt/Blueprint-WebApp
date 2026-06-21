import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RobotTeamEval from "@/pages/RobotTeamEval";

const setLocationMock = vi.fn();
const { authMock } = vi.hoisted(() => ({
  authMock: {
    currentUser: {
      getIdToken: vi.fn(async () => "token-1"),
    },
  },
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/for-robot-teams", setLocationMock],
  };
});

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: vi.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "test-csrf-token",
  })),
}));

vi.mock("@/lib/firebase", () => ({
  auth: authMock,
}));

afterEach(() => {
  vi.restoreAllMocks();
  setLocationMock.mockReset();
});

describe("RobotTeamEval", () => {
  it("renders the simplified policy evaluation form", () => {
    render(<RobotTeamEval />);

    expect(
      screen.getByRole("heading", {
        name: /Evaluate robot policies before field time\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Evaluation setup/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Site package/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Policy \/ checkpoint labels/i })).toHaveValue(
      "primary-policy",
    );
    expect(screen.getByRole("combobox", { name: /Episode count/i })).toHaveValue("100");
    expect(screen.getByRole("combobox", { name: /Validation mode/i })).toHaveValue(
      "comparative_policy_eval",
    );
    expect(screen.getAllByText(/Policy API endpoint/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Docker container/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Model checkpoint/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/do not prove safety validation/i)).toBeInTheDocument();
  });

  it("creates a hosted-session request with normalized policy evaluation payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          workspaceUrl: "/world-models/siteworld-f5fd54898cfb/workspace?sessionId=session-1",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as typeof fetch);

    render(<RobotTeamEval />);

    fireEvent.change(screen.getByRole("textbox", { name: /Policy \/ checkpoint labels/i }), {
      target: { value: "warehouse-policy, baseline-policy, ignored-fourth" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Episode count/i }), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Observation schema ref/i }), {
      target: { value: "gs://robot-team/schemas/top-observation.v1.json" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Action schema ref/i }), {
      target: { value: "gs://robot-team/schemas/top-action.v1.json" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Control frequency/i }), {
      target: { value: "20 Hz" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Robot embodiment/i }), {
      target: { value: "mobile manipulator" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Task instruction/i }), {
      target: { value: "pick tote from shelf" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Success criteria/i }), {
      target: { value: "tote placed without safety event" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Endpoint URL"), {
      target: { value: "https://robot-team.example/policy" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Auth handling / redacted secret ref"), {
      target: { value: "Bearer token in redacted secret ref robot-policy-prod" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Observation schema URI or JSON ref"), {
      target: { value: "gs://robot-team/schemas/observation.v1.json" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Action schema URI or JSON ref"), {
      target: { value: "gs://robot-team/schemas/action.v1.json" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Rate-limit / runtime constraints"), {
      target: { value: "200 ms p95, 10 rps" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Callback / log URI"), {
      target: { value: "gs://robot-team/blueprint/callbacks/" },
    });
    fireEvent.change(screen.getByLabelText("Policy API endpoint Owner contact"), {
      target: { value: "robot-owner@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create hosted session/i }));

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith(
        "/world-models/siteworld-f5fd54898cfb/workspace?sessionId=session-1",
      );
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    const policy = body.policy as Record<string, unknown>;
    const submission = policy.robotTeamTestSubmission as Record<string, unknown>;

    expect(body.sessionMode).toBe("runtime_only");
    expect(body.requestedOutputs).toEqual([
      "policy_ranking",
      "failure_taxonomy",
      "ood_uncertainty_flags",
      "validation_targets",
    ]);
    expect(policy.proofBoundary).toEqual(expect.stringContaining("Virtual WAM/VLA outputs"));
    expect(submission.schemaVersion).toBe("blueprint.robot_team_test_submission.v1");
    expect(submission.selectedModalities).toEqual(["policy_api_endpoint"]);
    expect(submission.policyLabels).toEqual([
      "warehouse-policy",
      "baseline-policy",
      "ignored-fourth",
    ]);
    expect(submission.episodeCount).toBe("500");
    expect(submission.validationMode).toBe("comparative_policy_eval");
    expect(submission.observationSchemaRef).toBe(
      "gs://robot-team/schemas/top-observation.v1.json",
    );
    expect(submission.actionSchemaRef).toBe(
      "gs://robot-team/schemas/top-action.v1.json",
    );
    expect(submission.controlFrequency).toBe("20 Hz");
    expect(submission.robotEmbodiment).toBe("mobile manipulator");
    expect(submission.taskInstruction).toBe("pick tote from shelf");
    expect(submission.successCriteria).toBe("tote placed without safety event");
  });

  it("surfaces the intake fallback when direct session creation is blocked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "The site-world registration does not include a reachable runtime handle.",
            blockers: [
              "The site-world registration does not include a reachable runtime handle.",
            ],
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch,
    );

    render(<RobotTeamEval />);

    fireEvent.click(screen.getByRole("button", { name: /Create hosted session/i }));

    expect(
      await screen.findByText(/Hosted session access is request-gated/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/confirm runtime access, rights, pricing/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Submit intake request/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("source=robot-team-eval"),
    );
  });
});
