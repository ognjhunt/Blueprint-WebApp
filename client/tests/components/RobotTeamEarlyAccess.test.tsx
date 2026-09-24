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

describe("robot-team verification from the task library", () => {
  it("resends the account verification link to the approved signed-in address", async () => {
    auth.send.mockClear();
    render(<RobotTeamEarlyAccess access={{ gated: true, status: "approved", signedIn: true,
      emailVerified: false, allowed: false, staff: false }} email="eng@robot.example" />);
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(auth.send).toHaveBeenCalledWith(auth.user, `${window.location.origin}/sites`));
    expect(screen.getByRole("status")).toHaveTextContent(/verification email sent/i);
  });
});
