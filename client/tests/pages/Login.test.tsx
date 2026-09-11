import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "@/pages/Login";

const signIn = vi.hoisted(() => vi.fn());
const signInWithGoogle = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signIn, signInWithGoogle }) }));
beforeEach(() => { signIn.mockReset().mockResolvedValue(undefined); signInWithGoogle.mockReset().mockResolvedValue(undefined); });

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
}

describe("Minimal sign in", () => {
  it("validates empty fields without calling authentication", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
  it("retains the essential account and recovery links", () => {
    render(<Login />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup/business");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Capture app access" })).toHaveAttribute("href", "/capture-app");
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
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
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
