import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("explains the job-to-pilot process, buyer choice and delivery responsibility", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Start with the work. Get a clear next step.");
    const process = screen.getByRole("heading", { name: "Describe the job" }).closest("ol")!;
    expect(within(process).getAllByRole("listitem")).toHaveLength(6);
    expect(process).toHaveTextContent(/no approved budget is needed to start/);
    expect(process).toHaveTextContent(/you choose the partner and agree the pilot price and terms directly/);
    const evaluation = screen.getByRole("region", { name: "The right amount of evaluation." });
    expect(evaluation).toHaveTextContent(/does not automatically need a new simulation/);
    expect(evaluation).toHaveTextContent(/do not establish physical performance or safety/);
    const responsibilities = screen.getByRole("region", { name: "Know who is responsible." });
    expect(responsibilities).toHaveTextContent(/Your deployment partner.*Supply and integrate the system/);
    expect(screen.getByRole("link", { name: "Submit a job" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Become a partner" })).toHaveAttribute("href", "/partners");
  });

  it("retains the four job-fit questions and broad robot eligibility", () => {
    render(<HowItWorks />);
    const jobFit = screen.getByRole("region", { name: "Jobs we can assess first." });
    expect(jobFit).toHaveAttribute("id", "job-fit");
    const questions = within(jobFit).getAllByRole("listitem");
    expect(questions.map(question => question.querySelector(".ms-fit-name")?.textContent)).toEqual(["Fixed scene", "Bounded job", "Known objects", "Clear window"]);
    questions.forEach(question => expect(question).toHaveTextContent(/If not:/));
    const robotFit = screen.getByRole("heading", { name: "Choose the approach that fits the job." }).closest("aside")!;
    expect(robotFit).toHaveTextContent(/Fixed arms, humanoids, wheeled humanoids and mobile manipulators/);
    expect(robotFit).toHaveTextContent(/specific setup is compatible/);
    expect(screen.getByRole("region", { name: "Place cases from a tote into a tray." })).toHaveTextContent(/not a measured customer result/);
  });
});
