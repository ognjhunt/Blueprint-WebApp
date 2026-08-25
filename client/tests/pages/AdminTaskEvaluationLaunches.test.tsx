import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminTaskEvaluationLaunches from "@/pages/AdminTaskEvaluationLaunches";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "operator-001" } }),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string> = {}) => headers,
}));

vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string> = {}) => headers,
}));

vi.mock("@/lib/taskEvaluationLaunchLabAccess", () => ({
  resolveTaskEvaluationLaunchLabToken: () => null,
  withTaskEvaluationLaunchLabHeader: (_token: null, headers: Record<string, string>) => headers,
}));

describe("AdminTaskEvaluationLaunches preparation workflow", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/admin/task-evaluation-launches/profiles") {
        return new Response(JSON.stringify({ profiles: [] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (url === "/api/admin/task-evaluation-launches/supervision") {
        return new Response(JSON.stringify({}), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (url === "/api/admin/task-evaluation-launches/preparations") {
        expect(init?.method).toBe("POST");
        const request = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
          status: "queued_for_no_spend_preparation",
          preparation_id: request.preparation_id,
          paid_execution_requested: false,
          preparation_is_not_execution: true,
        }), { status: 202, headers: { "content-type": "application/json" } });
      }
      if (url === "/api/admin/task-evaluation-launches/preparations/prep-scene-001") {
        return new Response(JSON.stringify({
          schema_version: "task_evaluation_launch_preparation_web_status.v1",
          state: "materialized",
          preparation_id: "prep-scene-001",
          paid_execution_requested: false,
          preparation_is_not_execution: true,
          pipeline: {
            worker_status: "native_arena_inputs_verified_awaiting_profile_authority",
            full_byte_service_account_readback_passed: true,
            blockers: [],
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === "/api/admin/task-evaluation-launches/activations") {
        expect(init?.method).toBe("POST");
        const request = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          schema_version: "task_evaluation_launch_activation_web_receipt.v1",
          status: "queued_for_authority_gated_activation",
          activation_id: request.activation_id,
          paid_execution_requested: false,
          activation_is_not_execution: true,
        }), { status: 202, headers: { "content-type": "application/json" } });
      }
      if (url === "/api/admin/task-evaluation-launches/activations/activate-scene-001") {
        return new Response(JSON.stringify({
          schema_version: "task_evaluation_launch_activation_web_status.v1",
          state: "prepared",
          activation_id: "activate-scene-001",
          paid_execution_requested: false,
          activation_is_not_execution: true,
          pipeline: {
            worker_status: "profile_authority_materialized_no_execution",
            profile_id: "scene-001-construction-r1",
            blockers: [],
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps preparation visibly separate from paid launch and synchronizes materialization", async () => {
    render(<AdminTaskEvaluationLaunches />);

    expect(screen.getByRole("heading", { name: "Prepare versioned inputs" })).toBeInTheDocument();
    expect(screen.getByText(/cannot publish a launch profile, allocate a GPU, spend money/i))
      .toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Preparation contract JSON"), {
      target: { value: JSON.stringify({ preparation_id: "prep-scene-001" }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate and prepare" }));

    await waitFor(() => expect(screen.getByText("materialized")).toBeInTheDocument());
    expect(screen.getByText("Full-byte service-account readback passed")).toBeInTheDocument();
    expect(screen.getByText(/verified input readiness, not execution or scientific success/i))
      .toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([target]) =>
      String(target) === "/api/admin/task-evaluation-launches/preparations/prep-scene-001"
    )).toBe(true);
  });

  it("does not submit malformed preparation JSON", async () => {
    render(<AdminTaskEvaluationLaunches />);
    fireEvent.change(screen.getByLabelText("Preparation contract JSON"), {
      target: { value: "{" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate and prepare" }));
    expect(await screen.findByText("Preparation JSON is invalid.")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([target]) =>
      String(target) === "/api/admin/task-evaluation-launches/preparations"
    )).toBe(false);
  });

  it("keeps activation visibly separate from paid execution and synchronizes publication", async () => {
    render(<AdminTaskEvaluationLaunches />);

    expect(screen.getByRole("heading", { name: "Activate verified inputs" })).toBeInTheDocument();
    expect(screen.getByText(/activation never submits a paid request or allocates a provider resource/i))
      .toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Activation contract JSON"), {
      target: { value: JSON.stringify({ activation_id: "activate-scene-001" }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate and activate" }));

    await waitFor(() => expect(screen.getByText("prepared")).toBeInTheDocument());
    expect(screen.getByText(/Published profile: scene-001-construction-r1/i)).toBeInTheDocument();
    expect(screen.getByText(/not a GPU allocation, simulator episode, or scientific result/i))
      .toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([target]) =>
      String(target) === "/api/admin/task-evaluation-launches/activations/activate-scene-001"
    )).toBe(true);
  });
});
