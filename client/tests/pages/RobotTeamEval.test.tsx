import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RobotTeamEval from "@/pages/RobotTeamEval";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: vi.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    "X-CSRF-Token": "test-csrf-token",
  })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RobotTeamEval", () => {
  it("renders the simplified policy evaluation form", () => {
    render(<RobotTeamEval />);

    expect(
      screen.getByRole("heading", {
        name: /Compare policies on one site task\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Start with the essentials\./i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /1 Choose the site path/i })).toHaveValue("exact-site");
    expect(screen.getByRole("textbox", { name: /^Name$/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Work email/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Team or company/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /2 Add policies/i })).toHaveValue(
      "primary-policy",
    );
    expect(screen.getByRole("textbox", { name: /3 Tell us the robot/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /4 Choose episodes/i })).toHaveValue("100");
    expect(screen.getByRole("combobox", { name: /6 Protect hardware and site IP/i })).toHaveValue(
      "customer_hosted_sealed_eval_capsule",
    );
    expect(
      screen.getByRole("heading", {
        name: /Private robots without handing over either side's IP\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Customer-hosted sealed capsule/i)).toBeInTheDocument();
    expect(screen.getByText(/the full scoring harness, hidden failure labels/i)).toBeInTheDocument();
    expect(screen.getByText(/raw captures, full scenes, scoring harnesses/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Advanced details/i));
    expect(screen.getByRole("combobox", { name: /Validation mode/i })).toHaveValue(
      "comparative_policy_eval",
    );
    expect(screen.getByRole("combobox", { name: /Site IP protection/i })).toHaveValue(
      "sealed_eval_capsule",
    );
    for (const label of ["API", "Docker", "Checkpoint", "Trace", "Skill trace", "Teleop", "Sim plugin"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/Same task\. Same robot\. Same episode count\./i)).toBeInTheDocument();
  });

  it("persists an evaluation request with a normalized policy payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as typeof fetch);

    render(<RobotTeamEval />);

    fireEvent.change(screen.getByRole("textbox", { name: /^Name$/i }), {
      target: { value: "Jordan Lee" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Work email/i }), {
      target: { value: "jordan@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Team or company/i }), {
      target: { value: "Example Robotics" },
    });

    fireEvent.change(screen.getByRole("textbox", { name: /2 Add policies/i }), {
      target: { value: "warehouse-policy, baseline-policy, ignored-fourth" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /4 Choose episodes/i }), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /6 Protect hardware and site IP/i }), {
      target: { value: "physical_robot_evidence_bridge" },
    });
    fireEvent.click(screen.getByText(/Advanced details/i));
    fireEvent.change(screen.getByRole("textbox", { name: /^Observation schema$/i }), {
      target: { value: "gs://robot-team/schemas/top-observation.v1.json" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^Action schema$/i }), {
      target: { value: "gs://robot-team/schemas/top-action.v1.json" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Control frequency/i }), {
      target: { value: "20 Hz" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /3 Tell us the robot/i }), {
      target: { value: "mobile manipulator" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Task instruction/i }), {
      target: { value: "pick tote from shelf" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Success criteria/i }), {
      target: { value: "tote placed without safety event" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Site IP protection/i }), {
      target: { value: "redacted_anchor_packet" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Customer-hosted connector ref/i }), {
      target: { value: "gs://robot-team/blueprint/connector-contract.json" },
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

    fireEvent.click(screen.getByRole("button", { name: /Send request/i }));

    await waitFor(() => {
      expect(screen.getByText(/Request received\. Blueprint will confirm the real site/i)).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/contact");
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    const submission = body.robotTeamTestSubmission as Record<string, unknown>;

    expect(body).toMatchObject({
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "Example Robotics",
      projectType: "Policy Evaluation Run",
      requestSource: "robot-team-eval",
      benchmarkProtocolRequest: {
        schema_version: "blueprint_benchmark_protocol_request.v1",
        mode: "benchmark_grade",
        frozen_hidden_splits_required: true,
        fixed_rollouts_required: true,
        confidence_intervals_required: true,
        exact_checkpoint_digests_required: true,
      },
    });
    expect(submission.siteWorldId).toBeNull();
    expect(submission.sitePackageTarget).toBe("My exact site");
    expect(submission.schemaVersion).toBe("blueprint.robot_team_test_submission.v1");
    expect(submission.selectedModalities).toEqual(["policy_api_endpoint"]);
    expect(submission.policyLabels).toEqual([
      "warehouse-policy",
      "baseline-policy",
      "ignored-fourth",
    ]);
    expect(submission.episodeCount).toBe("500");
    expect(submission.validationMode).toBe("comparative_policy_eval");
    expect(submission.hardwareIntegrationMode).toBe("physical_robot_evidence_bridge");
    expect(submission.siteIpProtectionLevel).toBe("redacted_anchor_packet");
    expect(submission.customerHostedConnectorRef).toBe(
      "gs://robot-team/blueprint/connector-contract.json",
    );
    expect(submission.privateHardwareIntegration).toMatchObject({
      integrationMode: "physical_robot_evidence_bridge",
      siteIpProtectionLevel: "redacted_anchor_packet",
      blueprintIpControls: {
        rawCaptureBundleSharedWithCustomer: false,
        fullScoringHarnessSharedByDefault: false,
      },
      claimBoundary: {
        customerHostedConnectorDoesNotExportBlueprintRawSceneIp: true,
      },
    });
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

  it("surfaces a retryable error when request persistence is blocked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "Unable to persist the request.",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch,
    );

    render(<RobotTeamEval />);

    fireEvent.change(screen.getByRole("textbox", { name: /^Name$/i }), {
      target: { value: "Jordan Lee" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Work email/i }), {
      target: { value: "jordan@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Team or company/i }), {
      target: { value: "Example Robotics" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Send request/i }));

    expect(
      await screen.findByText(/Unable to persist the request/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Contact instead/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("source=robot-team-eval"),
    );
  });
});
