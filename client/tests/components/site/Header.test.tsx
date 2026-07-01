import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/site/Header";

const authStateMock = vi.hoisted(() => ({
  currentUser: null as null | { uid: string },
  userData: null as null | Record<string, any>,
  tokenClaims: null as null | Record<string, any>,
  logout: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authStateMock,
}));

describe("Header", () => {
  beforeEach(() => {
    authStateMock.currentUser = null;
    authStateMock.userData = null;
    authStateMock.tokenClaims = null;
    authStateMock.logout = vi.fn();
  });

  it("keeps the buyer-facing nav focused", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /^For Robot Teams$/i })).toHaveAttribute(
      "href",
      "/for-robot-teams",
    );
    expect(screen.getByRole("link", { name: /^For Site Operators$/i })).toHaveAttribute(
      "href",
      "/for-site-operators",
    );
    expect(screen.getByRole("link", { name: /^How it works$/i })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: /^Pricing$/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.queryByRole("link", { name: /^Evaluate$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Sites$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Proof$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Robot teams$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Product$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Readiness$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Site packages$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Capture$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^For capturers$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Sample Listing$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Deliverables$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^About$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Policy Evaluation Set$/i })).not.toBeInTheDocument();
  });

  it("uses a reduced proof-first action rail in the header", () => {
    render(<Header />);

    const requestLink = screen.getAllByRole("link", { name: /^Request evaluation$/i })[0];
    expect(requestLink).toHaveAttribute(
      "href",
      "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=header",
    );
    expect(screen.queryByRole("link", { name: /See policy evaluation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Book call$/i })).not.toBeInTheDocument();
  });

  it("exposes sign-in and persona-specific signup paths", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );

    fireEvent.click(screen.getByRole("button", { name: /Toggle navigation/i }));

    expect(screen.getByRole("link", { name: /^Sign up: Robot team$/i })).toHaveAttribute(
      "href",
      "/signup/business?buyerType=robot_team&source=header-signup",
    );
    expect(screen.getByRole("link", { name: /^Sign up: Site operator$/i })).toHaveAttribute(
      "href",
      "/signup/business?buyerType=site_operator&source=header-signup",
    );
  });

  it("switches the signed-in header toward the account persona workspace", () => {
    authStateMock.currentUser = { uid: "site-operator-uid" };
    authStateMock.userData = {
      buyerType: "site_operator",
      finishedOnboarding: false,
      organizationName: "Brightleaf Ops",
    };

    render(<Header />);

    expect(screen.getAllByRole("link", { name: /Finish site onboarding/i })[0]).toHaveAttribute(
      "href",
      "/onboarding",
    );
    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
  });
});
