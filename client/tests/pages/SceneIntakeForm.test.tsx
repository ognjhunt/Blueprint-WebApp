import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneIntakeForm } from "@/components/blueprint/app/SceneIntakeForm";
import type { User } from "firebase/auth";

const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/captureUploads", async (original) => ({
  ...(await original<typeof import("@/lib/captureUploads")>()),
  apiRequest: state.api,
}));
const user = { uid: "owner" } as User;
const options = {
  provider_terms: {
    vast: {
      digest: `sha256:${"e".repeat(64)}`,
      label: "Vast retained terms",
      url: "https://vast.ai/terms",
    },
  },
  policy_pairs: [],
};
beforeEach(() => {
  sessionStorage.clear();
  state.api.mockReset();
  state.api.mockImplementation(async (_user, path, init) =>
    init?.method === "POST"
      ? { id: "accepted" }
      : path.endsWith("/options")
        ? options
        : path.endsWith("/sources")
          ? {
              sources: [
                {
                  id: "native-cap-one",
                  label: "App workcell",
                  kind: "gaussian_splat",
                  capture_authority_profile: "provided_scene_splat",
                  pipeline_handoff: { status: "forwarded" },
                  status: "uploaded_verification_pending",
                  validation_status: "passed",
                  selectable: true,
                },
              ],
            }
          : { intakes: [] },
  );
});
afterEach(cleanup);
function fill() {
  fireEvent.change(screen.getByLabelText("Source"), {
    target: { value: "native-cap-one" },
  });
  fireEvent.change(screen.getByLabelText("Object to move"), {
    target: { value: "block" },
  });
  fireEvent.change(screen.getByLabelText("Starting support surface"), {
    target: { value: "table" },
  });
  fireEvent.change(screen.getByLabelText("Placement relation"), {
    target: { value: "inside" },
  });
  fireEvent.change(screen.getByLabelText("Destination surface or container"), {
    target: { value: "tray" },
  });
  fireEvent.change(screen.getByLabelText("Target X (m)"), {
    target: { value: "0.4" },
  });
  fireEvent.change(screen.getByLabelText("Target Y (m)"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Target Z (m)"), {
    target: { value: "0.1" },
  });
  fireEvent.change(screen.getByLabelText("Candidate 1 ID"), {
    target: { value: "one" },
  });
  fireEvent.change(screen.getByLabelText("Candidate 2 ID"), {
    target: { value: "two" },
  });
  screen.getAllByLabelText("Frozen artifact SHA-256").forEach((field, i) =>
    fireEvent.change(field, {
      target: { value: `sha256:${(i ? "b" : "a").repeat(64)}` },
    }),
  );
  fireEvent.click(screen.getByLabelText(/I confirm this task/));
}
describe("scene task intake UI", () => {
  it("submits app source and explicit bounded consent without client actor authority", async () => {
    render(<SceneIntakeForm currentUser={user} sessions={[]} />);
    await screen.findByRole("option", { name: /App workcell/ });
    fill();
    expect(
      Array.from(
        screen
          .getByRole("button", { name: "Confirm task and submit run" })
          .closest("form")!.elements,
      )
        .filter(
          (element) =>
            "checkValidity" in element &&
            !(element as HTMLInputElement).checkValidity(),
        )
        .map((element) => element.outerHTML),
    ).toEqual([]);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm task and submit run" }),
    );
    await waitFor(() =>
      expect(
        state.api.mock.calls.some((call) => call[2]?.method === "POST"),
      ).toBe(true),
    );
    const input = JSON.parse(
      state.api.mock.calls.find((call) => call[2]?.method === "POST")![2].body,
    );
    expect(input).toMatchObject({
      source_session_id: "native-cap-one",
      execution: {
        max_total_spend_usd: 35,
        max_paid_attempts: 8,
        max_retries: 0,
        claim_scope: "development_only",
      },
      consent: {
        task_confirmed: true,
        spend_authorized: true,
        provider_training_authorized: false,
      },
    });
    expect(input).not.toHaveProperty("owner");
    expect(input.consent).not.toHaveProperty("accepted_by");
    // The structured destination pose and success criteria the factory requires
    // are forwarded, not a description-only task.
    expect(input.task.subject).toEqual({
      description: "block",
      authority: "owner_confirmed",
    });
    expect(input.task.destination).toEqual({
      relation: "inside",
      visible_label: "tray",
      position_world_m: [0.4, 0, 0.1],
      orientation_xyzw: [0, 0, 0, 1],
    });
    expect(input.task.success).toEqual({
      control_frequency_hz: 15,
      maximum_episode_seconds: 24,
      minimum_lift_m: 0.05,
      pregrasp_clearance_m: 0.1,
      minimum_planar_displacement_m: 0.1,
      maximum_final_planar_target_error_m: 0.05,
      maximum_retries: 0,
      maximum_regrasps: 0,
    });
    // The shipped defaults satisfy the factory's integer-steps rule.
    expect(
      Number.isInteger(
        input.task.success.control_frequency_hz *
          input.task.success.maximum_episode_seconds,
      ),
    ).toBe(true);
  });
  it("blocks submission when control rate times episode seconds is not a whole number of steps", async () => {
    render(<SceneIntakeForm currentUser={user} sessions={[]} />);
    await screen.findByRole("option", { name: /App workcell/ });
    fill();
    fireEvent.change(screen.getByLabelText("Maximum episode seconds"), {
      target: { value: "24.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm task and submit run" }),
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /whole number of simulation steps/i,
    );
    expect(
      state.api.mock.calls.some((call) => call[2]?.method === "POST"),
    ).toBe(false);
  });
  it("isolates retries by tenant and restores the same owner's exact request after remount", async () => {
    state.api.mockImplementation(async (_user, path, init) => {
      if (init?.method === "POST") throw new Error("connection lost");
      return path.endsWith("/options")
        ? options
        : path.endsWith("/sources")
          ? {
              sources: [
                {
                  id: "native-cap-one",
                  label: "App workcell",
                  kind: "gaussian_splat",
                  capture_authority_profile: "provided_scene_splat",
                  pipeline_handoff: { status: "forwarded" },
                  status: "uploaded_verification_pending",
                  validation_status: "passed",
                  selectable: true,
                },
              ],
            }
          : { intakes: [] };
    });
    const first = render(<SceneIntakeForm currentUser={user} sessions={[]} />);
    await screen.findByRole("option", { name: /App workcell/ });
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm task and submit run" }),
    );
    await screen.findByRole("button", { name: "Retry same submission" });
    const retained = sessionStorage.getItem(sessionStorage.key(0)!);
    expect(retained).toBeTruthy();
    first.unmount();
    const otherTenant = render(
      <SceneIntakeForm
        currentUser={{ ...user, tenantId: "other-tenant" } as User}
        sessions={[]}
      />,
    );
    await screen.findByRole("option", { name: /App workcell/ });
    expect(
      screen.queryByRole("button", { name: "Retry same submission" }),
    ).toBeNull();
    expect(
      (screen.getByLabelText("Object to move") as HTMLInputElement).value,
    ).toBe("");
    otherTenant.unmount();
    render(<SceneIntakeForm currentUser={user} sessions={[]} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry same submission" }),
    );
    await waitFor(() =>
      expect(
        state.api.mock.calls.filter((call) => call[2]?.method === "POST"),
      ).toHaveLength(2),
    );
    expect(
      state.api.mock.calls
        .filter((call) => call[2]?.method === "POST")
        .map((call) => call[2].body),
    ).toEqual([retained, retained]);
  });
});

it("submits a registered public task and both required providers without an upload", async () => {
  const fixedTask = {
    task_id: "task-public-scene-one", strategy: "pick_and_place",
    subject: { description: "small dark object", source_instance_id: "12" },
    support: { description: "wooden tabletop", source_instance_id: "13" },
    destination: { kind: "green_region", relation: "on", visible_label: "green spot", radius_m: .07,
      position_world_m: [.4, .2, .75], orientation_xyzw: [0, 0, 0, 1] },
    success: { control_frequency_hz: 15, maximum_episode_seconds: 24, minimum_lift_m: .05,
      pregrasp_clearance_m: .1, minimum_planar_displacement_m: .1, maximum_final_planar_target_error_m: .03,
      maximum_retries: 0, maximum_regrasps: 0 },
  };
  state.api.mockImplementation(async (_user, path, init) => init?.method === "POST" ? { id: "accepted" }
    : path.endsWith("/options") ? { ...options, provider_terms: { ...options.provider_terms, openai: options.provider_terms.vast },
        policy_pairs: [[{ id: "pi05_droid", artifact_digest: `sha256:${"a".repeat(64)}` },
                       { id: "groot_n17_droid", artifact_digest: `sha256:${"b".repeat(64)}` }]] }
    : path.endsWith("/sources") ? { sources: [{ id: "public-scene-one", label: "InteriorGS fixture", kind: "public_scene",
        selectable: true, validation_status: "publisher_bytes_pending_controller_verification",
        task_proposal: fixedTask, required_providers: ["vast", "openai"] }] } : { intakes: [] });
  render(<SceneIntakeForm currentUser={user} sessions={[]} />);
  await screen.findByRole("option", { name: /InteriorGS fixture/ });
  fireEvent.change(screen.getByLabelText("Source"), { target: { value: "public-scene-one" } });
  expect(screen.getByLabelText("Object to move")).toHaveValue("small dark object");
  expect(screen.getByLabelText("Target X (m)")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Total spending ceiling (USD)"), { target: { value: "50" } });
  fireEvent.click(screen.getByLabelText(/I confirm this task/));
  fireEvent.click(screen.getByRole("button", { name: "Confirm task and submit run" }));
  await waitFor(() => expect(state.api.mock.calls.some((call) => call[2]?.method === "POST")).toBe(true));
  const submitted = JSON.parse(state.api.mock.calls.find((call) => call[2]?.method === "POST")![2].body);
  expect(submitted.task).toEqual(fixedTask);
  expect(submitted.execution.allowed_providers).toEqual(["vast", "openai"]);
  expect(submitted.execution.max_total_spend_usd).toBe(50);
  expect(submitted).not.toHaveProperty("owner");
});
