import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Login from "@/pages/Login";

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

describe("Login", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
    });
  });

  it("shows validation errors when submitting an empty form", () => {
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
  });

  it("renders the Google sign-in CTA", () => {
    render(<Login />);

    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();
    expect(screen.getByText(/Secure Access Portal/i)).toBeInTheDocument();
  });

  it("keeps capturer help as a secondary utility path", () => {
    render(<Login />);

    expect(screen.getByText(/New to Blueprint\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Capturer: Access the capture app/i })).toHaveAttribute(
      "href",
      "/capture-app",
    );
    expect(screen.getByRole("link", { name: /Buyer: Scope your project/i })).toHaveAttribute(
      "href",
      "/book-exact-site-review",
    );
    expect(screen.getByRole("link", { name: /Buyer: Request access/i })).toHaveAttribute(
      "href",
      "/signup/business",
    );
  });
});
