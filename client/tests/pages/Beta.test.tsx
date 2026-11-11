import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Beta from "@/pages/Beta";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { COMPANY } from "@/data/company";

// The Questions page (bare bones, 2026-11-11): the one details screen for the public pages, in short rows. It holds
// what /beta, "Jobs we support" and "About" said.
describe("the questions page", () => {
  it("answers cost, reply time and who sets the robot up without inventing dates", () => {
    render(<Beta />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Questions");
    const beta = screen.getByRole("region", { name: "The beta" });
    expect(beta).toHaveTextContent(REPLY_TIMELINE);
    expect(beta).toHaveAttribute("id", "scope");
    expect(beta).toHaveTextContent(/The beta is free for sites and partners\. Blueprint takes no cut of any work you agree\./);
    expect(beta).toHaveTextContent(/You agree the price and terms with them\./);
    expect(screen.getByRole("link", { name: "Refunds and cancellations" })).toHaveAttribute("href", "/refunds");
  });

  it("says what is tested, that it is a simulation, and what it is not", () => {
    render(<Beta />);
    const answer = screen.getByRole("region", { name: "Your answer" });
    expect(answer).toHaveTextContent(/What do you test\?\s*Robots driven by AI software that sees through cameras\. Not pre-programmed motion\./);
    expect(answer).toHaveTextContent(/about ten tries/);
    expect(answer).toHaveTextContent(/It does not certify performance or safety\./);
    expect(answer).toHaveTextContent(/other jobs we keep and hold/);
    expect(answer).not.toHaveTextContent(/proof|guarantee/i);
  });

  it("keeps the video private, says how to stop, and says who we are", () => {
    render(<Beta />);
    expect(screen.getByRole("region", { name: "Your video" })).toHaveTextContent(/Your video, address and contacts stay private\..*stop us using your video at any time/);
    const who = screen.getByRole("region", { name: "Who we are" });
    expect(who).toHaveAttribute("id", "who-we-are");
    expect(who).toHaveTextContent(COMPANY.legalName);
    expect(who).toHaveTextContent(COMPANY.mailingAddress);
    expect(screen.getAllByRole("link", { name: "Start a job" })).toHaveLength(1);
  });
});
