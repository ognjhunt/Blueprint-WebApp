import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

// The frame of 2026-11-12: what goes into a job packet and where it goes, one line each; which jobs fit (the old
// "Jobs we support" page) in one line; one button; the limits in one line.
describe("How it works", () => {
  it("shows the video, the job packet, deployment companies and the early trial, and one button", () => {
    const { container } = render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How it works");
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent(/Your video\s*One job that repeats, filmed on any phone\./);
    expect(steps[1]).toHaveTextContent(/Your job packet\s*Your sentence for the job, a first look on paper, a simulation of your site, and what counts as done\./);
    expect(steps[2]).toHaveTextContent(/Deployment companies\s*We share your job, with its video, with deployment companies we approve\. We approve each company by hand\. They answer, and you choose which to meet\./);
    expect(steps[3]).toHaveTextContent(/Early trial\s*Sometimes we also try openly available robot software in the simulation\. It is a trial, not a prediction of any company's robot\./);
    expect(screen.getAllByRole("link", { name: "Start a job" })).toHaveLength(1);
    expect(screen.getByText("Free for sites.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Questions ›" })).toHaveAttribute("href", "/beta");
    expect(screen.getByText(/Best for one job that repeats, with known objects, where something is picked up and put down/)).toBeInTheDocument();
    // A job whose kind we cannot simulate yet is still sent; only its simulation waits (teamJobAccess: no simulation required).
    expect(screen.getByText(/Other jobs still go to companies; their simulation waits until we can build one\./)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/keep and hold/);
    // The fine line is gone (owner, 2026-11-12: "why do we have this??? ... is this just outdated?").
    expect(screen.queryByText(/We take pick-up-and-put-down jobs best/)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.textContent).not.toMatch(/did best|AI robot|top AI|paper check/i);
  });
});
