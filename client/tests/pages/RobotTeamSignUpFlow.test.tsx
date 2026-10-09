import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import BusinessSignUpFlow from "@/pages/RobotTeamSignUpFlow";
const mocks = vi.hoisted(() => ({ invitation: vi.fn(), google: vi.fn(), custom: vi.fn(), passwordSignIn: vi.fn(), verify: vi.fn(), workspace: vi.fn(), assign: vi.fn() }));
vi.mock("@/lib/accountInvitation", () => ({ invitationRequest: mocks.invitation }));
vi.mock("firebase/auth", () => ({ signInWithCustomToken: mocks.custom, signInWithEmailAndPassword: mocks.passwordSignIn, sendEmailVerification: mocks.verify }));
vi.mock("@/lib/firebase", () => ({ auth: {}, signInWithGoogle: mocks.google }));
vi.mock("@/lib/workspace", () => ({ workspaceRequest: mocks.workspace, WorkspaceRequestError: class extends Error {} }));
const user = { uid: "new-user", email: "team@example.com", displayName: "Team", emailVerified: false };
const invitation = { email: user.email, name: "Team", organization: "Robot Co", workspaceType: "robot_team", returnTo: "/contact/robot-team" };
function consent() { fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ })); }
async function openInvitation() { window.history.replaceState({}, "", "/signup/business?invitation=signed-invitation"); render(<BusinessSignUpFlow />); await screen.findByRole("heading", { name: "Create your account" }); }
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); window.history.replaceState({}, "", "/signup/business");
  vi.spyOn(window.location, "assign").mockImplementation(mocks.assign);
  mocks.invitation.mockImplementation(async (path: string) => path === "inspect" ? invitation : { customToken: "server-created-session" });
  mocks.custom.mockResolvedValue({ user }); mocks.google.mockResolvedValue({ ...user, emailVerified: true });
  mocks.workspace.mockResolvedValue({ ok: true }); mocks.verify.mockResolvedValue(undefined);
});
describe("invitation-only account creation", () => {
  it("offers public intake without credentials or Google signup", () => {
    render(<BusinessSignUpFlow />);
    expect(screen.getByRole("heading", { name: "Access by invitation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create a site account" })).toHaveAttribute("href", "/signup/business");
    expect(screen.getByRole("link", { name: "Register robot-team interest" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
    expect(mocks.invitation).not.toHaveBeenCalled();
  });
  it("keeps malformed/expired invitations out of the credential form", async () => {
    mocks.invitation.mockRejectedValue(new Error("Account creation requires a current Blueprint invitation."));
    window.history.replaceState({}, "", "/signup/business?invitation=invalid"); render(<BusinessSignUpFlow />);
    expect(await screen.findByRole("alert")).toHaveTextContent("current Blueprint invitation");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument(); expect(mocks.custom).not.toHaveBeenCalled();
  });
  it("locks identity and team type to the server invitation despite query overrides", async () => {
    window.history.replaceState({}, "", "/signup/business?invitation=signed-invitation&buyerType=site_operator&email=attacker@example.com");
    render(<BusinessSignUpFlow />); await screen.findByRole("heading", { name: "Create your account" });
    expect(screen.getByLabelText("Work email")).toHaveValue(user.email); expect(screen.getByLabelText("Work email")).toHaveAttribute("readonly");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
  it("requires consent before either authentication method", async () => {
    await openInvitation(); fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("accept the Terms");
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(mocks.invitation).toHaveBeenCalledTimes(1); expect(mocks.google).not.toHaveBeenCalled();
  });
  it("redeems a password invitation through the server and then verifies email", async () => {
    await openInvitation(); consent(); fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "strongpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/contact/robot-team"));
    expect(mocks.invitation).toHaveBeenCalledWith("redeem", "signed-invitation", { mode: "password", password: "strongpass123", acceptedTerms: true });
    expect(mocks.custom).toHaveBeenCalledWith({}, "server-created-session");
    expect(mocks.workspace).toHaveBeenCalledWith(user, "/setup", "POST", { name: "Team", organization: "Robot Co", workspaceType: "robot_team", acceptedTerms: true, optionalUpdates: false });
    expect(mocks.verify).toHaveBeenCalled();
  });
  it("prepares only the invited Google identity and rejects a different Google email", async () => {
    mocks.google.mockResolvedValue({ ...user, email: "other@example.com", emailVerified: true });
    await openInvitation(); consent(); fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("email address on your Blueprint invitation");
    expect(mocks.invitation).toHaveBeenCalledWith("redeem", "signed-invitation", { mode: "google", acceptedTerms: true });
    expect(mocks.workspace).not.toHaveBeenCalled();
  });
  it("uses existing credentials on an invited account rather than replacing them", async () => {
    mocks.invitation.mockImplementation(async path => { if (path === "inspect") return invitation; throw Object.assign(new Error("Sign in"), { code: "account_already_exists" }); });
    mocks.passwordSignIn.mockResolvedValue({ user });
    await openInvitation(); consent(); fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "existingpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith("/contact/robot-team"));
    expect(mocks.passwordSignIn).toHaveBeenCalledWith({}, user.email, "existingpass123");
    expect(mocks.custom).not.toHaveBeenCalled();
  });
  it("retains the created account across a workspace retry without replacing credentials", async () => {
    mocks.workspace.mockRejectedValueOnce(new Error("Try again"));
    await openInvitation(); consent(); fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "strongpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" })); await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalled());
    expect(mocks.custom).toHaveBeenCalledTimes(1); expect(mocks.invitation.mock.calls.filter(call => call[0] === "redeem")).toHaveLength(1);
  });
});
