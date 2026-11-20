// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { email: "eng@robot.example" },
  send: vi.fn(async () => undefined),
}));
vi.mock("@/lib/accountAuth", () => ({
  currentAuthUser: async () => auth.user,
  sendAccountVerification: auth.send,
}));

import { RobotTeamEarlyAccess } from "@/components/site/RobotTeamEarlyAccess";

describe("robot-team verification from the job library", () => {
  it("resends the account verification link to the approved signed-in address", async () => {
    auth.send.mockClear();
    render(<RobotTeamEarlyAccess access={{ gated: true, status: "approved", signedIn: true,
      emailVerified: false, allowed: false, staff: false }} email="eng@robot.example" />);
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(auth.send).toHaveBeenCalledWith(auth.user, `${window.location.origin}/contact/robot-team`));
    expect(screen.getByRole("status")).toHaveTextContent(/verification email sent/i);
  });

  it("points a company that has not applied to the one application form, on the page for deployment companies", () => {
    render(<RobotTeamEarlyAccess access={null} email={null} />);
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute("href", "/partners#partner-application");
    expect(screen.queryByRole("form", { name: "Early access application" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Your name/ })).toBeNull();
  });

  it("shows where approval will be sent while an application is pending", () => {
    render(<RobotTeamEarlyAccess access={{ gated: true, status: "applied", signedIn: true, emailVerified: true, allowed: false, staff: false }}
      email="eng@robot.example" />);
    expect(screen.getByText("We'll email eng@robot.example if your company is approved.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/task fits/i);
  });
});
