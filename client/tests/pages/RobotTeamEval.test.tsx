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
  it("renders the six structured robot-team submission modalities", () => {
    render(<RobotTeamEval />);

    expect(screen.getByRole("heading", { name: /Robot-team test interface/i })).toBeInTheDocument();
    expect(screen.getByText(/Policy API endpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/Docker container/i)).toBeInTheDocument();
    expect(screen.getByText(/Recorded action traces/i)).toBeInTheDocument();
    expect(screen.getByText(/High-level skill traces/i)).toBeInTheDocument();
    expect(screen.getByText(/Teleop demos/i)).toBeInTheDocument();
    expect(screen.getByText(/Sim controller plugin/i)).toBeInTheDocument();
    expect(screen.getByText(/Artifact refs first/i)).toBeInTheDocument();
    expect(screen.getByText(/does not prove deployment readiness/i)).toBeInTheDocument();
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
