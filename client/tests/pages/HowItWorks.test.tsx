import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorks from "@/pages/HowItWorks";

describe("HowItWorks", () => {
  it("renders the simplified proof-led exact-site loop page", () => {
    render(<HowItWorks />);

    expect(
      screen.getByRole("heading", {
        name: /How a Task Evaluation Run works\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Capture the real indoor site\.$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Package the proof and the limits\.$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Evaluate policies against the site\.$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Decide the next test\.$/i }),
    ).toBeInTheDocument();
    // Policy Improvement Run is no longer a mainline pipeline step; it lives only
    // in the demoted "After the run (later)" follow-on note.
    expect(
      screen.queryByRole("heading", { name: /^Turn failures into the next policy loop\.$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Four steps from real site to a decision\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not every value is proof\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See pricing/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: /Request evaluation/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/robot-team?persona=robot-team"),
    );
    expect(
      screen.getByText(/Blueprint turns one real indoor capture into a versioned, rights-attached/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Proof stories/i)).not.toBeInTheDocument();
  });
});
