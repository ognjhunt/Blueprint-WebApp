import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/pages/Home";

describe("Home", () => {
  it("leads with what Blueprint is: real demand, made deployment-ready", () => {
    const { container } = render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Real jobs, made deployment-ready/i,
      }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(/Robot teams prove who can do them/i);
  });

  it("keeps the pitch to robot teams one level below the identity", () => {
    const { container } = render(<Home />);
    expect(
      screen.getByRole("heading", { name: /Don.t send engineers to scope a deployment/i }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(/your deployment team starts when the robot arrives/i);
  });

  it("draws the boundary on the page: Blueprint owns the site, the OEM owns the robot", () => {
    const { container } = render(<Home />);
    expect(container).toHaveTextContent(/Blueprint owns the site\. You own the robot/i);
    // The half Blueprint does not touch has to be as explicit as the half it does,
    // and the reason has to be the physical one rather than a disclaimer.
    expect(container).toHaveTextContent(/Stays with the robot company/i);
    expect(container).toHaveTextContent(/cannot be finished before the hardware is in the building/i);
    expect(container).toHaveTextContent(/Operator training, safety sign-off, and production integration/i);
  });

  it("commits to the measurable version of the promise", () => {
    const { container } = render(<Home />);
    expect(container).toHaveTextContent(/OEM engineering hours before the robot arrives/i);
    expect(container).toHaveTextContent(/~0/);
  });

  it("defines the unit of supply as a qualified deployable workcell", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /A qualified deployable workcell/i }),
    ).toBeInTheDocument();
    // The eight criteria are what stop "interested sites" being counted as supply.
    for (const criterion of [
      /A real operator, named and reachable/i,
      /Someone with authority and budget/i,
      /Agreement to deploy if the acceptance criteria are met/i,
    ]) {
      expect(screen.getByText(criterion)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/Fifty of these are worth more than five thousand interested sites/i),
    ).toBeInTheDocument();
  });

  it("keeps the robot team's proprietary work with the robot team", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /Do the work once\. Not once per vendor/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Proprietary policies and model weights/i)).toBeInTheDocument();
    expect(screen.getByText(/Final safety validation and commissioning/i)).toBeInTheDocument();
  });

  it("does not claim the cross-vendor record already exists", () => {
    const { container } = render(<Home />);
    expect(container).toHaveTextContent(/Blueprint learns what nobody else can see/i);
    // The honesty line is the guard: this is what the model builds, not an asset held today.
    expect(container).toHaveTextContent(
      /This record does not exist yet\. It is what the model builds/i,
    );
  });
});
