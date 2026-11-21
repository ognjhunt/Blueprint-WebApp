import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingChecklist from "@/pages/OnboardingChecklist";

const setLocationMock = vi.hoisted(() => vi.fn());
const account = vi.hoisted(() => ({ userData: { buyerType: "site_operator" } as { buyerType?: string } | null }));
const approved = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({
  useLocation: () => ["/onboarding", setLocationMock],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "account-user" }, userData: account.userData }),
}));

vi.mock("@/lib/robotTeamAccess", () => ({
  BROWSE_JOBS_PATH: "/contact/robot-team",
  isApprovedDeploymentCompany: approved,
}));

// The setup checklist is retired (2026-11-20): /onboarding only forwards, and says nothing in intake terms.
describe("/onboarding forwards to where the account works", () => {
  beforeEach(() => {
    setLocationMock.mockReset();
    approved.mockReset().mockResolvedValue(false);
  });

  it("sends a site to its jobs without asking whether it is a company", async () => {
    account.userData = { buyerType: "site_operator" };
    render(<OnboardingChecklist />);
    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/app", { replace: true }));
    expect(approved).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText(/intake|proof|buyer|review queue|workspace|Finish setup/i)).not.toBeInTheDocument();
  });

  it("sends an approved deployment company to Find jobs", async () => {
    account.userData = { buyerType: "robot_team" };
    approved.mockResolvedValue(true);
    render(<OnboardingChecklist />);
    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/contact/robot-team", { replace: true }));
  });

  it("sends an account with no type, or a company not yet approved, to /app", async () => {
    account.userData = {};
    render(<OnboardingChecklist />);
    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/app", { replace: true }));
    expect(approved).toHaveBeenCalledTimes(1);
  });
});
