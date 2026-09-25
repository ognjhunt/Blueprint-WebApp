import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import BusinessSignUpFlow from "@/pages/BusinessSignUpFlow";
const mocks = vi.hoisted(() => ({ create: vi.fn(), google: vi.fn(), request: vi.fn(), assign: vi.fn(), currentUser: null as any }));
vi.mock("@/lib/analytics", () => ({ analyticsEvents: { businessSignupStarted: vi.fn(), businessSignupSubmitted: vi.fn(), businessSignupCompleted: vi.fn(), businessSignupFailed: vi.fn() }, getSafeErrorType: () => "unknown" }));
vi.mock("firebase/auth", () => ({ getAuth: () => ({}), createUserWithEmailAndPassword: mocks.create }));
vi.mock("@/lib/firebase", () => ({ signInWithGoogle: mocks.google }));
vi.mock("@/lib/workspace", () => ({ workspaceRequest: mocks.request }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: mocks.currentUser }) }));
const user = { uid: "new-user", email: "team@example.com", displayName: "Test User" };
const unconfigured = { workspaceType: null, profile: { name: "", organization: "", email: user.email }, termsRequired: true, access: { operations: false, capture: false } };
function accountStep() {
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "strongpass123" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
}
function workspaceStep(role: "site_operator" | "robot_team" = "robot_team") {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Test User" } });
  fireEvent.change(screen.getByLabelText("Organization", { exact: true }), { target: { value: "Test Team" } });
  fireEvent.click(screen.getByLabelText(role === "robot_team" ? "Assess site tasks for my robots" : "Plan a robot pilot for my site"));
  fireEvent.click(screen.getByRole("checkbox"));
}
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); mocks.currentUser = null;
  window.history.pushState({}, "", "/signup/business");
  vi.spyOn(window.location, "assign").mockImplementation(mocks.assign);
  mocks.create.mockResolvedValue({ user }); mocks.google.mockResolvedValue(user);
  mocks.request.mockImplementation(async (_u, _path, method) => method === "POST" ? { ok: true } : unconfigured);
});
describe("minimal business signup", () => {
  it("has two account fields, two workspace fields, and one role choice without legacy intake", () => {
    render(<BusinessSignUpFlow />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    accountStep();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByText(/Requested lane|Proof path|Company size|Standardized benchmark|Commercialization boundary/)).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  for (const role of ["robot_team", "site_operator"] as const) {
    it(`creates only an account and ${role} workspace, without a sales intake or permissions grant`, async () => {
      render(<BusinessSignUpFlow />); accountStep(); workspaceStep(role);
      fireEvent.click(screen.getByRole("button", { name: "Create account", exact: true }));
      await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(role === "robot_team" ? "/contact/robot-team" : "/contact/site-operator"));
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.request).toHaveBeenCalledWith(user, "/setup", "POST", { name: "Test User", organization: "Test Team", workspaceType: role, acceptedTerms: true });
      expect(mocks.request.mock.calls.every(call => call[1] === "/setup")).toBe(true);
    });
  }
  it("requires legal acceptance before creating credentials", () => {
    render(<BusinessSignUpFlow />); accountStep(); workspaceStep(); fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account", exact: true }));
    expect(screen.getByRole("alert")).toHaveTextContent("Accept the Terms");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retries a failed workspace save without creating a second account or losing values", async () => {
    let fail = true;
    mocks.request.mockImplementation(async (_u, _path, method) => { if (method === "POST" && fail) throw Error("Unavailable"); return method === "POST" ? { ok: true } : unconfigured; });
    render(<BusinessSignUpFlow />); accountStep(); workspaceStep();
    fireEvent.click(screen.getByRole("button", { name: "Create account", exact: true }));
    await screen.findByText(/Your account is created, but workspace setup did not save/);
    expect(screen.getByLabelText("Organization", { exact: true })).toHaveValue("Test Team");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Open workspace", exact: true }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/contact/robot-team"));
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("prefills Google identity and requires workspace details and consent", async () => {
    render(<BusinessSignUpFlow />); fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(screen.getByLabelText("Your name")).toHaveValue("Test User"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(mocks.request.mock.calls.some(c => c[2] === "POST")).toBe(false);
    workspaceStep();fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/contact/robot-team"));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("routes an existing Google customer to their workspace without changing its type", async () => {
    mocks.request.mockResolvedValue({ ...unconfigured, workspaceType: "site_operator" });
    render(<BusinessSignUpFlow />);fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/app"));
    expect(mocks.request.mock.calls.some(c => c[2] === "POST")).toBe(false);
  });
  it("honors site query links and keeps typed values when going back", () => {
    window.history.pushState({}, "", "/signup/business?buyerType=site_operator&intent=pilot-opportunity");
    render(<BusinessSignUpFlow />);accountStep();
    expect(screen.getByLabelText("Plan a robot pilot for my site")).toBeChecked();
    fireEvent.change(screen.getByLabelText("Organization", { exact: true }), { target: { value: "Saved Team" } });
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByLabelText("Work email")).toHaveValue(user.email);
    fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(screen.getByLabelText("Organization", { exact: true })).toHaveValue("Saved Team");
  });
  it("resumes an authenticated unfinished account without asking for another password", async () => {
    mocks.currentUser = user;
    render(<BusinessSignUpFlow />);
    await waitFor(() => expect(screen.getByLabelText("Your name")).toHaveValue("Test User"));
    expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
    workspaceStep();
    await waitFor(() => expect(screen.getByRole("button", { name: "Open workspace" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/contact/robot-team"));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not overwrite a workspace after an ambiguous save succeeded", async () => {
    let writes = 0;
    mocks.request.mockImplementation(async (_u, _path, method) => {
      if (method === "POST") { writes++; throw Error("Response lost"); }
      return writes ? { ...unconfigured, workspaceType: "robot_team" } : unconfigured;
    });
    render(<BusinessSignUpFlow />); accountStep(); workspaceStep();
    fireEvent.click(screen.getByRole("button", { name: "Create account", exact: true }));
    await screen.findByText(/Your account is created, but workspace setup did not save/);
    fireEvent.click(screen.getByRole("button", { name: "Open workspace", exact: true }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/app"));
    expect(writes).toBe(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

});
