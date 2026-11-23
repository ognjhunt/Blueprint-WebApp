import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

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

// Launch copy (2026-11-20): the Runway header and footer carry the public pages' links, in the same words.
describe("Header", () => {
  beforeEach(() => {
    authStateMock.currentUser = null;
    authStateMock.userData = null;
    authStateMock.tokenClaims = null;
    authStateMock.logout = vi.fn();
  });

  it("has the public pages' two links and Sign in, and nothing from the old frame", () => {
    render(<Header />);

    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["How it works", "Find jobs"]);
    expect(nav.getByRole("link", { name: "Find jobs" })).toHaveAttribute("href", "/jobs");
    expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/#how-it-works");
    expect(within(screen.getByRole("navigation", { name: "Account" })).getByRole("link", { name: "Sign in" }))
      .toHaveAttribute("href", "/sign-in");
    expect(document.body.textContent).not.toMatch(/Sign up|Robot team|Site operator|Task Evaluation Run|pilot|Choose access path|Explore|Signed in as/);
  });

  it("shows the same links in the phone menu", () => {
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: /Toggle navigation/i }));
    expect(within(screen.getByRole("navigation", { name: "Menu" })).getAllByRole("link").map((link) => link.textContent))
      .toEqual(["How it works", "Find jobs", "Sign in"]);
  });

  it.each([
    { buyerType: "site_operator", finishedOnboarding: false },
    { buyerType: "site_operator", finishedOnboarding: true },
    { buyerType: "robot_team", finishedOnboarding: false },
    { buyerType: "robot_team", finishedOnboarding: true },
  ])("gives every signed-in account one link, Your account, to /app (%o)", (userData) => {
    authStateMock.currentUser = { uid: "account-uid" };
    authStateMock.userData = { ...userData, organizationName: "Brightleaf Ops" };

    render(<Header />);

    expect(within(screen.getByRole("navigation", { name: "Account" })).getByRole("link", { name: "Your account" }))
      .toHaveAttribute("href", "/app");
    expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Find jobs" }))
      .toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/onboarding|workspace|Brightleaf/i);
  });
});

describe("Footer", () => {
  it("has the public pages' footer links and no Refunds link", () => {
    render(<Footer />);

    const footer = within(screen.getByRole("navigation", { name: "Footer navigation" }));
    expect(footer.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Questions", "/beta"],
      ["About", "/beta#who-we-are"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ]);
    expect(footer.getByRole("button", { name: "Cookie settings" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Refunds|Evidence|Product/);
  });
});
