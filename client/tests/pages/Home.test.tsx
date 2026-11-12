import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Site-led homepage", () => {
  // The frame of 2026-11-12: one sentence, three steps, one button. The animated example of an invented result that
  // used to sit beside them is removed, not replaced (its tests went with it; its artwork's checks moved to
  // RobotScene.test.tsx).
  it("says what happens to a site's video in one sentence, shows three steps and offers one button", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Film a job once. We turn it into a job packet robot deployment companies can judge.");
    const starts = screen.getAllByRole("link", { name: "Start a job" });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByText("Free for sites")).toBeInTheDocument();
    expect(screen.getByText("A video, where the job is, and an email.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How it works ›" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" })).toHaveAttribute("href", "/partners");
    expect(screen.getByText("We take pick-up-and-put-down jobs best. Nothing here is a test at your site or a safety check.")).toBeInTheDocument();
    // No example, no invented result, no price.
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.textContent).not.toMatch(/did best|AI robot|Example|\$\s?\d|beta/i);
  });

  it("shows three steps from the video through the job packet to a shared summary, the video kept private", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list", { name: "How it works" })).getAllByRole("listitem");
    expect(steps.map(step => step.textContent)).toEqual([
      "Send a video of one job that repeats.",
      "We turn it into a job packet: what the job is, a first look at which robots could fit, and a simulation of your site.",
      "With your permission, we share a summary of it with robot deployment companies we approve. Your video stays private.",
    ]);
    expect(screen.getByRole("list", { name: "How it works" })).toHaveAttribute("id", "how-it-works");
  });
});
