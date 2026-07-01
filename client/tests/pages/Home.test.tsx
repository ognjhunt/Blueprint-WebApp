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
    expect(screen.getByText(/Compare your policy against earlier checkpoints/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Request evaluation$/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/contact/robot-team"),
    );
    expect(screen.getByText(/Capture the site/i)).toBeInTheDocument();
    expect(screen.getByText(/Run the comparison/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Decide the next test/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500 episodes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/policies submitted by other teams and vendors/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /One captured envelope\. A clear policy ranking\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/First-person POV clips/i)).toBeInTheDocument();
    expect(screen.getByText(/policy-ranking result outside the measured evaluation scope/i)).toBeInTheDocument();
    expect(screen.queryByText(/Site Data Package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/WAM\/VLA/i)).not.toBeInTheDocument();
  });
});
