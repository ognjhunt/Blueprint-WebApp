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

  it("renders the Google sign-in CTA on the ivory account surface", () => {
    const { container } = render(<Login />);

    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sign in to Blueprint/i })).toBeInTheDocument();
    // The account screens share the public site's ivory surface rather than
    // the dark instrument chrome the product app uses.
    expect(container.querySelector(".minimal-site")).not.toBeNull();
  });

  it("keeps capturer help as a secondary utility path", () => {
    render(<Login />);

    expect(screen.getByText(/New to Blueprint\?/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Capturer: Access the capture app/i })).toHaveAttribute(
      "href",
      "/capture-app",
    );
    expect(screen.getByRole("link", { name: /Robot team: Create evaluation account/i })).toHaveAttribute(
      "href",
      "/signup/business?buyerType=robot_team&source=login",
    );
    expect(screen.getByRole("link", { name: /Site operator: Start site review/i })).toHaveAttribute(
      "href",
      "/signup/business?buyerType=site_operator&source=login",
    );
    expect(screen.getByRole("link", { name: /Robot team: Scope before signup/i })).toHaveAttribute(
      "href",
      "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=login",
    );
  });
});
