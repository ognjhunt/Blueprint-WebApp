import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("explains task-first comparison and the physical pilot for different manipulation embodiments", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Start with the task.Find the right fit.");
    expect(screen.getByRole("heading", { name: "Compare the candidates." })).toBeInTheDocument();
    expect(screen.getByText(/Two compatible candidates/)).toBeInTheDocument();
    expect(screen.getByText(/All robotics teams can apply/)).toBeInTheDocument();
    expect(screen.getByText(/clear reason to pause/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discuss your site" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Apply as a robot team" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.queryByText(/quadruped|inspection/i)).not.toBeInTheDocument();
  });
});
