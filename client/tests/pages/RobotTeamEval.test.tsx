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
  vi.unstubAllGlobals();
  setLocationMock.mockReset();
});

describe("RobotTeamEval", () => {
  function representativeSiteSelect() {
    return screen.getByRole("combobox", { name: "Representative site" });
  }

  function canonicalTaskSelect() {
    return screen.getByRole("combobox", { name: "Canonical task" });
  }

  function scenarioFamilySelect() {
    return screen.getByRole("combobox", { name: "Scenario family" });
  }

  it("renders the six structured robot-team submission modalities", () => {
    render(<RobotTeamEval />);

    expect(screen.getByRole("heading", { name: /Robot-team test interface/i })).toBeInTheDocument();
    expect(screen.getByText(/Policy API endpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/Docker container/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Recorded action traces/i })).toBeInTheDocument();
    expect(screen.getByText(/High-level skill traces/i)).toBeInTheDocument();
    expect(screen.getByText(/Teleop demos/i)).toBeInTheDocument();
    expect(screen.getByText(/Sim controller plugin/i)).toBeInTheDocument();
    expect(screen.getByText(/Submitted interfaces are inputs/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Site package \+ robot profile \+ policy access = eval report\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /humanoid robot in a warehouse evaluation bay/i,
      }),
    ).toHaveAttribute(
      "src",
      "/editorial/2026-06-06/robot-team-eval-workflow.png",
    );
    expect(screen.getByText(/Robot teams keep source code and model weights private/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Site package$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Policy API$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Container \/ private cloud$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Action trace$/i)).toBeInTheDocument();
  });

  it("renders the real-site robot eval workflow and keeps sample report boundaries visible", () => {
    render(<RobotTeamEval />);

    expect(
      screen.getByRole("heading", { name: /Choose site, task, and scenario family/i }),
    ).toBeInTheDocument();
    expect(representativeSiteSelect()).toHaveValue("robot-eval-warehouse");
    expect(canonicalTaskSelect()).toHaveValue("warehouse-move-tote");
    expect(scenarioFamilySelect()).toHaveValue("warehouse-blocked-path");
    expect(screen.getAllByText(/policy_eval_report\.json/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/prediction_vs_actual_summary\.json/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unsafe proximity/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pilot/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tune/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hold/i).length).toBeGreaterThan(0);
  });

  it("updates the task and scenario controls when a representative site changes", () => {
    render(<RobotTeamEval />);

    fireEvent.change(representativeSiteSelect(), {
      target: { value: "robot-eval-hospital" },
    });

    expect(canonicalTaskSelect()).toHaveValue("hospital-room-delivery");
    expect(scenarioFamilySelect()).toHaveValue("hospital-dim-corridor");
    expect(screen.getAllByText(/Cherry Creek Hospital Supply Annex/i).length).toBeGreaterThan(0);

    fireEvent.change(canonicalTaskSelect(), {
      target: { value: "hospital-door-entry" },
    });

    expect(screen.getAllByText(/open_door_enter_room/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Door entry is completed/i)).toBeInTheDocument();
  });

  it("creates a hosted-session request with normalized robot-team submission policy", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          workspaceUrl: "/world-models/siteworld-f5fd54898cfb/workspace?sessionId=session-1",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<RobotTeamEval />);

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
    expect(submission.schemaVersion).toBe("blueprint.robot_team_test_submission.v1");
    expect(submission.selectedModalities).toEqual(["policy_api_endpoint"]);
    expect(submission.missingEvidenceStatuses).toEqual([]);
    expect(submission.pipelineDatasetSchemaRefs).toContain("robot_team_test_submission_modalities.v0.1");
    expect(body.notes).toEqual(expect.stringContaining("Representative eval workflow"));
  });

  it("surfaces the existing intake fallback when direct session creation is blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "Runtime path is request-gated.",
            blockers: ["Runtime path is request-gated."],
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(<RobotTeamEval />);

    fireEvent.click(screen.getByRole("button", { name: /Create hosted session/i }));

    expect(await screen.findByText(/Runtime path is request-gated/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Submit intake request/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact?"),
    );
  });
});
