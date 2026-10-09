import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BusinessSignUpFlow from "@/pages/BusinessSignUpFlow";
vi.mock("@/components/auth/AuthLayout", () => ({ AuthLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock("@/pages/RobotTeamSignUpFlow", () => ({ default: () => <div>Robot invitation flow</div> }));
vi.mock("@/pages/MarketingRedirect", () => ({ MarketingRedirect: ({to, preserveQuery}: any) => <a href={to} data-preserve-query={String(preserveQuery)}>Continue to your job</a> }));
beforeEach(() => window.history.replaceState({}, "", "/signup/business"));
describe("intake-first site signup", () => {
  it.each(["", "?buyerType=site_operator", "?persona=site-operator"])("starts with the site and job rather than credentials (%s)", query => {
    window.history.replaceState({}, "", `/signup/business${query}`);
    render(<BusinessSignUpFlow />);
    expect(screen.getByRole("link", { name: "Continue to your job" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Continue to your job" })).toHaveAttribute("data-preserve-query", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("preserves intake attribution without forwarding credentials or an arbitrary redirect", () => {
    window.history.replaceState({}, "", "/signup/business?source=faq&utm_campaign=beta&email=private@example.com&returnTo=https://other.test");
    render(<BusinessSignUpFlow />);
    expect(screen.getByRole("link", { name: "Continue to your job" })).toHaveAttribute("href", "/contact/site-operator?source=faq&utm_campaign=beta");
  });
  it("resumes a signed job claim without another intake", () => {
    window.history.replaceState({}, "", "/signup/business?returnTo=%2Fclaim%2Fsigned.job-token");
    render(<BusinessSignUpFlow />);
    expect(screen.getByRole("link", { name: "Continue to your job" })).toHaveAttribute("href", "/claim/signed.job-token");
  });
  it.each(["?buyerType=robot_team", "?persona=robot-team", "?invitation=token&buyerType=site_operator"])("keeps robot invitations authoritative (%s)", query => {
    window.history.replaceState({}, "", `/signup/business${query}`);
    render(<BusinessSignUpFlow />);
    expect(screen.getByText("Robot invitation flow")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
