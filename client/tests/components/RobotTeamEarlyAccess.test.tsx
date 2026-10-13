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
    await waitFor(() => expect(auth.send).toHaveBeenCalledWith(auth.user, `${window.location.origin}/sites`));
    expect(screen.getByRole("status")).toHaveTextContent(/verification email sent/i);
  });

  it("carries the site a team asked about from a job record into the application", async () => {
    window.history.pushState({}, "", "/contact/robot-team?site=Owner-backed%20warehouse&source=site-detail-live-record");
    render(<RobotTeamEarlyAccess access={null} email={null} />);
    await waitFor(() => expect(screen.getByLabelText(/A site or customer you would want to test at/)).toHaveValue("Owner-backed warehouse"));
    window.history.pushState({}, "", "/");
  });
});
