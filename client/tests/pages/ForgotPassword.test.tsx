import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ForgotPassword from "@/pages/ForgotPassword";
const sendReset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase", () => ({ auth: { name: "test-auth" }, sendPasswordResetEmail: sendReset }));
beforeEach(() => sendReset.mockReset().mockResolvedValue(undefined));

async function submit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  await screen.findByRole("heading", { name: "Check your email" });
}

describe("Minimal password reset", () => {
  it("calls Firebase reset and offers a return to sign in", async () => {
    render(<ForgotPassword />); await submit();
    expect(sendReset).toHaveBeenCalledWith({ name: "test-auth" }, "person@example.com");
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/sign-in");
  });
  it("keeps the same confirmation for unknown accounts or provider failures", async () => {
    sendReset.mockRejectedValueOnce(new Error("auth/user-not-found"));
    render(<ForgotPassword />); await submit();
    expect(screen.getByRole("status")).toHaveTextContent("If an account exists");
    expect(screen.queryByText(/auth\/user-not-found/)).not.toBeInTheDocument();
  });
});
