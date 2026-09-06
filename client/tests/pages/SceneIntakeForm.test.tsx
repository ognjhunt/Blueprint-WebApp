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
  for (const label of [
    "Object to move",
    "Starting support surface",
    "Destination",
    "Observable success condition",
  ])
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: label },
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
