import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ForgotPassword from "@/pages/ForgotPassword";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: any) => ({...headers, "X-CSRF-Token":"test-csrf"}) }));
beforeEach(() => {request.mockReset().mockResolvedValue({ok:true}); vi.stubGlobal("fetch", request);});
async function submit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  await screen.findByRole("heading", { name: "Check your email" });
}
describe("branded password reset request", () => {
  it("uses the CSRF-protected branded email endpoint and offers sign-in", async () => {
    render(<ForgotPassword />); await submit();
    expect(request).toHaveBeenCalledWith("/api/password-reset", {method:"POST",credentials:"include",headers:{"Content-Type":"application/json","X-CSRF-Token":"test-csrf"},body:JSON.stringify({email:"person@example.com"})});
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/sign-in");
  });
  it("keeps the same confirmation for unknown accounts or provider failures", async () => {
    request.mockRejectedValueOnce(new Error("provider unavailable"));
    render(<ForgotPassword />); await submit();
    expect(screen.getByRole("status")).toHaveTextContent("If an account exists");
    expect(screen.queryByText(/provider unavailable/)).not.toBeInTheDocument();
  });
});
