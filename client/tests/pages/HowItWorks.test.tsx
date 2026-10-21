import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HowItWorks from "@/pages/HowItWorks";

describe("How it works", () => {
  it("retains the visual warehouse walkthrough with video, simulation, buyer choice and delivery responsibility", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Start with your task.");
    const contents = screen.getByRole("navigation", { name: "Warehouse walkthrough contents" });
    expect(within(contents).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getAllByRole("img")).toHaveLength(7);
    const capture = screen.getByRole("region", { name: "Show us the task as it happens." });
    expect(capture).toHaveTextContent(/analyzes the video and drafts the job description/);
    expect(capture).toHaveTextContent(/video is required/);
    const evaluation = screen.getByRole("region", { name: "Compare suitable robots and policies in simulation." });
    expect(evaluation).toHaveTextContent(/using APIs or other supported access/);
    expect(evaluation).toHaveTextContent(/estimate, not proof of real performance or safety/);
    const recommendation = screen.getByRole("region", { name: "Compare delivery proposals and choose your partner." });
    expect(recommendation).toHaveTextContent(/No approved budget is needed to start/);
    expect(recommendation).toHaveTextContent(/You choose the partner and agree the pilot price and terms directly/);
    expect(screen.getByRole("region", { name: "Test the approach at the real bench." })).toHaveTextContent(/partner supplies and integrates the system/);
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
    expect(screen.getByRole("region", { name: "One task, from phone video to a pilot." })).toHaveTextContent(/examples, not measured customer results/);
  });
});
