import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RobotTeamIntake from "@/pages/RobotTeamIntake";
import { robotGateFields, robotSpecFields } from "@/data/robotTeamQualification";

function choose(question: string, value: string) {
  fireEvent.change(screen.getByLabelText(question), { target: { value } });
}

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function answerGatesClear() {
  for (const field of robotGateFields) {
    const clear = field.options.find((option) => option.verdict === "clear");
    if (clear) choose(field.question, clear.value);
  }
}

describe("RobotTeamIntake", () => {
  it("says outright that it is not screening the robot", () => {
    // The distinction the whole page rests on: a site can fail to suit a robot;
    // a robot team is screened on whether it would actually deploy.
    render(<RobotTeamIntake />);
    expect(
      screen.getByRole("heading", { name: /We are not screening your robot/i }),
    ).toBeInTheDocument();
  });

  it("gates on deployment readiness rather than capability", () => {
    render(<RobotTeamIntake />);
    for (const field of robotGateFields) {
      expect(screen.getByLabelText(field.question)).toBeInTheDocument();
    }
    // Capability questions exist, but not before the gates.
    for (const field of robotSpecFields) {
      expect(screen.queryByLabelText(field.question)).toBeNull();
    }
  });

  it("asks no account questions", () => {
    const { container } = render(<RobotTeamIntake />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it("reveals the capability envelope once the gates pass", () => {
    render(<RobotTeamIntake />);
    answerGatesClear();
    for (const field of robotSpecFields) {
      expect(screen.getByLabelText(field.question)).toBeInTheDocument();
    }
  });

  it("frames a block as timing rather than as a judgement of the system", () => {
    render(<RobotTeamIntake />);
    answerGatesClear();

    const hardware = robotGateFields.find((field) => field.id === "hardwareMaturity")!;
    const blocking = hardware.options.find((option) => option.verdict === "blocking")!;
    choose(hardware.question, blocking.value);

    expect(screen.getAllByText(/Not yet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not about your system/i)).toBeInTheDocument();
    // The envelope stays hidden — no point asking capability of a team with no
    // hardware to describe.
    for (const field of robotSpecFields) {
      expect(screen.queryByLabelText(field.question)).toBeNull();
    }
  });

  it("tells a qualified team that opportunities arrive scoped, not as a newsletter", () => {
    render(<RobotTeamIntake />);
    answerGatesClear();
    expect(screen.getAllByText(/Clears the screen/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/match your envelope against captured site tasks/i)).toBeInTheDocument();
  });

  it("promises no data crosses between the two sides on submission", () => {
    render(<RobotTeamIntake />);
    answerGatesClear();
    expect(
      screen.getByText(/Nothing is shared with a site, and no site data is shared with you/i),
    ).toBeInTheDocument();
  });

  it("keeps submission disabled until the system is actually described", () => {
    render(<RobotTeamIntake />);
    answerGatesClear();

    const submit = screen.getByRole("button", { name: /Send the envelope/i });
    expect(submit).toBeDisabled();

    fill("Your name", "Alex Chen");
    fill("Work email", "alex@example.com");
    fill("Company", "Example Robotics");
    expect(submit).toBeDisabled();

    fill(/What does your system do/i, "Bin picking for mixed SKUs at up to 8 kg.");
    expect(submit).toBeEnabled();
  });
});
