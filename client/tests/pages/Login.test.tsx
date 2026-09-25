import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "@/pages/Login";

const signIn = vi.hoisted(() => vi.fn());
const signInWithGoogle = vi.hoisted(() => vi.fn());
const prepareGoogleSignIn = vi.hoisted(() => vi.fn());
const completeGoogleRedirect = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signIn, signInWithGoogle, completeGoogleRedirect, prepareGoogleSignIn }) }));
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
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
  it("retains the essential account and recovery links", async () => {
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup/business");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
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
  it("rejects an external sign-in return path", async () => {
    window.history.replaceState({}, "", "/sign-in?next=https%3A%2F%2Foutside.example");
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(sessionStorage.getItem("redirectAfterAuth")).toBeNull();
  });
  it("offers a copyable result link when a browser blocks the popup", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fapp%2Fresults%2Fcapture-run-123");
    const blocked = Object.assign(new Error("Google sign-in was blocked here."), { code: "auth/popup-blocked" });
    signInWithGoogle.mockRejectedValueOnce(blocked);
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("button", { name: "Copy result link" })).toBeInTheDocument();
    expect(screen.getByLabelText("Result link to open in Safari")).toHaveValue(`${window.location.origin}/app/results/capture-run-123`);
  });
  it("shows an accessible generic error after credential rejection and retains input", async () => {
    signIn.mockRejectedValueOnce(new Error("auth/user-not-found"));
    render(<Login />); fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByLabelText("Email")).toHaveValue("person@example.com");
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
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
});
