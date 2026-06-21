import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("renders the simplified capture-backed policy evaluation story", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Test robot policies before field time\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Use captured real-site tasks to see what works/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Start$/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/robot-team"),
    );
    expect(screen.getByRole("link", { name: /See pricing/i })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByText(/Capture site/i)).toBeInTheDocument();
    expect(screen.getByText(/Run policies/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick winner/i)).toBeInTheDocument();
    expect(screen.getByText(/100 episodes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/500 episodes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1-3 policies/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /Same task\. Same robot\. Clear winner\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Generated clips help review results/i)).toBeInTheDocument();
    expect(screen.getByText(/do not approve deployment, safety, or guaranteed real-world success/i)).toBeInTheDocument();
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/WAM\/VLA/i)).not.toBeInTheDocument();
  });
});
