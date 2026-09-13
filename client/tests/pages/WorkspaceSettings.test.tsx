import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Settings from "@/pages/workspace/Settings";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { uid: "capturer", email: "capture@example.com" },
    userData: { role: "capturer", name: "Capture Owner" },
    logout: vi.fn(),
  }),
}));
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => {
    throw new Error("Capturer settings must not call a buyer workspace API");
  },
}));
vi.mock("@/components/auth/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
describe("generic account settings compatibility", () => {
  it("keeps capturer account details available without granting a customer role", () => {
    render(<Settings />);
    expect(
      screen.getByRole("heading", { name: "Account settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("capture@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open capture account" }),
    ).toHaveAttribute("href", "/capture-app/account");
  });
});
