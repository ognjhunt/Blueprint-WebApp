import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "@/pages/Login";

const signIn = vi.hoisted(() => vi.fn());
const signInWithGoogle = vi.hoisted(() => vi.fn());
const prepareGoogleSignIn = vi.hoisted(() => vi.fn());
const completeGoogleRedirect = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signIn, signInWithGoogle, completeGoogleRedirect, prepareGoogleSignIn }) }));
const customSignIn = vi.hoisted(() => vi.fn());
vi.mock("firebase/auth", () => ({ signInWithCustomToken: customSignIn }));
vi.mock("@/lib/firebase", () => ({ auth: { fixture: true } }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "x-csrf-token": "t" }) }));
beforeEach(() => {
  signIn.mockReset().mockResolvedValue(undefined);
  signInWithGoogle.mockReset().mockResolvedValue(undefined);
  prepareGoogleSignIn.mockReset().mockResolvedValue(undefined);
  completeGoogleRedirect.mockReset().mockResolvedValue(undefined);
  sessionStorage.clear();
  window.history.replaceState({}, "", "/sign-in");
});

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
}

describe("Minimal sign in", () => {
  it("validates empty fields without calling authentication", async () => {
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(screen.getByText("Enter your email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
  it("retains the essential account and recovery links", async () => {
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(screen.getByRole("link", { name: "Start a job" })).toHaveAttribute("href", "/contact/site-operator?source=sign-in");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByText(/Lost your job link\? Email/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hello@tryblueprint.io" })).toHaveAttribute("href", "mailto:hello@tryblueprint.io");
    expect(screen.queryByRole("link", { name: "Capture app access" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Secure Access Portal|Scope before signup/)).not.toBeInTheDocument();
  });
  it("signs in with the entered credentials and retains password visibility control", async () => {
    render(<Login />); fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("person@example.com", "test-password"));
  });
  it("keeps Google authentication connected", async () => {
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
  });
  it("waits for Firebase before allowing a popup click", async () => {
    let finish!: () => void;
    prepareGoogleSignIn.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Login />);
    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    expect(googleButton).toBeDisabled();
    fireEvent.click(googleButton);
    expect(signInWithGoogle).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    await waitFor(() => expect(googleButton).toBeEnabled());
    fireEvent.click(googleButton);
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(googleButton).toBeEnabled());
  });
  it("keeps the emailed result path for sign-in", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fapp%2Fresults%2Fcapture-run-123");
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(sessionStorage.getItem("redirectAfterAuth")).toBe("/app/results/capture-run-123");
  });
  it("keeps the emailed company job path for sign-in", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fjobs%2Fcapture-run-123");
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(sessionStorage.getItem("redirectAfterAuth")).toBe("/jobs/capture-run-123");
  });
  it.each(["/contact/robot-team", "/contact/robot-team#job-job-1"])("returns to %s after sign-in", async (path) => {
    window.history.replaceState({}, "", `/sign-in?next=${encodeURIComponent(path)}`);
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(sessionStorage.getItem("redirectAfterAuth")).toBe(path);
  });
  it("rejects a company job path with a trailing newline", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fjobs%2Fcapture-run-123%0A");
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(sessionStorage.getItem("redirectAfterAuth")).toBeNull();
  });
  it("rejects an external sign-in return path", async () => {
    window.history.replaceState({}, "", "/sign-in?next=https%3A%2F%2Foutside.example");
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(sessionStorage.getItem("redirectAfterAuth")).toBeNull();
  });
  it("offers a company the application instead of a site's start link", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fjobs%2Fjob-1");
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(screen.getByRole("link", { name: "Apply to see jobs" })).toHaveAttribute("href", "/jobs#partner-application");
    expect(screen.queryByRole("link", { name: "Start a job" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Lost your job link/)).not.toBeInTheDocument();
  });
  it("offers a copyable link when a browser blocks the popup", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fapp%2Fresults%2Fcapture-run-123");
    const blocked = Object.assign(new Error("Google sign-in was blocked here."), { code: "auth/popup-blocked" });
    signInWithGoogle.mockRejectedValueOnce(blocked);
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByText("Copy this link and open it in Safari or Chrome, then sign in there.")).toBeInTheDocument();
    expect(screen.getByLabelText("Link to open in Safari or Chrome")).toHaveValue(`${window.location.origin}/app/results/capture-run-123`);
  });
  it("offers the company job link when a browser blocks the popup", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fjobs%2Fjob-1");
    signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error("Google sign-in was blocked here."), { code: "auth/popup-blocked" }));
    render(<Login />);
    const google = screen.getByRole("button", { name: "Continue with Google" });
    await waitFor(() => expect(google).toBeEnabled());
    fireEvent.click(google);
    expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByLabelText("Link to open in Safari or Chrome")).toHaveValue(`${window.location.origin}/jobs/job-1`);
  });
  it("shows the account layer's words after credential rejection and retains input", async () => {
    signIn.mockRejectedValueOnce(new Error("That email and password do not match an account."));
    render(<Login />); fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match an account.");
    expect(screen.getByLabelText("Email")).toHaveValue("person@example.com");
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });
  it.each(["auth/user-not-found", "Firebase: Error (auth/internal-error)."])("never shows a raw sign-in error (%s)", async (raw) => {
    signIn.mockRejectedValueOnce(new Error(raw));
    render(<Login />); fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not sign you in. Please try again.");
  });
  it("disables both authentication actions while a request is pending", async () => {
    let finish!: () => void;
    signIn.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Login />); fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled());
  });

  it("emails a deployment company a sign-in link, with the same answer for any address", async () => {
    const message = "If that address belongs to an approved deployment company, we have emailed it a sign-in link. It works once, for 15 minutes.";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, message }), { status: 202 }));
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(screen.getByText("Enter your email.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "team@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/robot-team-access/sign-in-link", expect.objectContaining({ method: "POST",
      body: JSON.stringify({ email: "team@example.com" }) }));
    expect(signIn).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
  it("spends an emailed sign-in link, takes it out of the address bar and signs the account in", async () => {
    const assign = vi.spyOn(window.location, "replace").mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ customToken: "custom", returnTo: "/jobs/job-1" }), { status: 200 }));
    customSignIn.mockResolvedValue({ user: { uid: "u1" } });
    window.history.replaceState({}, "", "/sign-in?link=signed-link");
    render(<Login />);
    expect(window.location.search).toBe("");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/jobs/job-1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/robot-team-access/sign-in-link/redeem", expect.objectContaining({ body: JSON.stringify({ link: "signed-link" }) }));
    expect(customSignIn).toHaveBeenCalledWith({ fixture: true }, "custom");
    fetchMock.mockRestore(); assign.mockRestore();
  });
  it("after a link sign-in, goes to the job the company was opening in this tab and clears it", async () => {
    const assign = vi.spyOn(window.location, "replace").mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ customToken: "custom", returnTo: "/jobs/job-1" }), { status: 200 }));
    customSignIn.mockResolvedValue({ user: { uid: "u1" } });
    sessionStorage.setItem("redirectAfterAuth", "/jobs/job-2");
    window.history.replaceState({}, "", "/sign-in?link=signed-link");
    render(<Login />);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/jobs/job-2"));
    expect(sessionStorage.getItem("redirectAfterAuth")).toBeNull();
    fetchMock.mockRestore(); assign.mockRestore();
  });
  it("says a spent or expired link no longer works", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "This sign-in link no longer works. Ask for a new one on this page." }), { status: 403 }));
    customSignIn.mockReset();
    window.history.replaceState({}, "", "/sign-in?link=spent");
    render(<Login />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This sign-in link no longer works. Ask for a new one on this page.");
    expect(customSignIn).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
