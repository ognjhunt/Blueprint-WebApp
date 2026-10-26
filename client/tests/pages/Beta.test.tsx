import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Beta from "@/pages/Beta";
import { REPLY_TIMELINE } from "@/data/betaTimelines";

describe("the beta page", () => {
  it("gives a reply expectation without inventing evaluation or pilot dates", () => {
    render(<Beta />);
    const timing = screen.getByRole("heading", { name: "How long does it take?" }).closest("section")!;
    expect(timing).toHaveTextContent(REPLY_TIMELINE);
    expect(timing).toHaveTextContent(/does not reserve equipment or guarantee a pilot date/);
    expect(screen.queryByText(/Evaluations start once an invited robot team/)).not.toBeInTheDocument();
  });

  // Owner decision, 2026-10-26: Blueprint runs the candidates and recommends deployment companies.
  it("says Blueprint runs the candidates, recommends from full scoring and holds jobs it cannot score yet", () => {
    render(<Beta />);
    const receive = screen.getByRole("heading", { name: "What do I receive?" }).closest("section")!;
    expect(receive).toHaveTextContent(/run the candidates ourselves in simulation: accessible policies, policy APIs and robot configurations/);
    expect(receive).toHaveTextContent(/its technology provider supplies it/);
    expect(receive).toHaveTextContent(/Quick screening runs are diagnostic; a recommendation comes only from the finalists' full scoring/);
    expect(receive).toHaveTextContent(/When an approach wins, you get our recommendation, the deployment companies that support it/);
    expect(receive).toHaveTextContent(/We do not turn a job away because of its type/);
    expect(receive).not.toHaveTextContent(/technology teams where their involvement is needed/);
  });

  it("keeps the free beta distinct from customer-approved physical delivery costs", () => {
    render(<Beta />);
    const costs = screen.getByRole("heading", { name: "What does it cost?" }).closest("section")!;
    expect(costs).toHaveTextContent(/free for sites and partners/);
    expect(costs).toHaveTextContent(/takes no cut of the pilot/);
    expect(costs).toHaveTextContent(/you approve those costs and agree the contract directly/);
    expect(screen.getByRole("link", { name: "Explore partner roles" })).toHaveAttribute("href", "/partners");
  });
});
