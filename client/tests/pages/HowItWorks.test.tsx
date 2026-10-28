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
    expect(evaluation).toHaveTextContent(/its technology provider supplies it; you do not need to find or invite anyone/);
    expect(evaluation).toHaveTextContent(/Every candidate is scored against the same placement criteria/);
    expect(evaluation).not.toHaveTextContent(/screening runs|finalists|scored in full/i);
    expect(evaluation).toHaveTextContent(/estimate, not proof of real performance or safety/);
    const result = screen.getByRole("region", { name: "See what works on your job." });
    expect(result).toHaveTextContent(/No approved budget is needed to start/);
    expect(result).toHaveTextContent(/bounded simulation estimate of what works on your job.*“held”/);
    expect(result).toHaveTextContent(/works alongside a deployment company/);
    expect(result).toHaveTextContent(/agree the pilot price and terms directly with that company/);
    expect(result).not.toHaveTextContent(/delivery proposals|comparable|invite those companies|recommends the approach/i);
    expect(screen.getByRole("region", { name: "Test the approach at the real bench." })).toHaveTextContent(/deployment company supplies and integrates the system/);
    expect(screen.getByRole("link", { name: "Submit a job" })).toHaveAttribute("href", "/contact/site-operator");
    expect(screen.getByRole("link", { name: "Become a partner" })).toHaveAttribute("href", "/partners");
  });

  it("retains the four job-fit questions and broad robot eligibility", () => {
    render(<HowItWorks />);
    const jobFit = screen.getByRole("region", { name: "Jobs we can assess first." });
    expect(jobFit).toHaveAttribute("id", "job-fit");
    // No job is turned away for its type; one we cannot score yet is held (owner, 2026-10-26).
    expect(jobFit).toHaveTextContent(/do not turn a job away because of its type.*hold it while we prepare its evaluation/);
    const questions = within(jobFit).getAllByRole("listitem");
    expect(questions.map(question => question.querySelector(".ms-fit-name")?.textContent)).toEqual(["Fixed scene", "Bounded job", "Known objects", "Clear window"]);
    questions.forEach(question => expect(question).toHaveTextContent(/If not:/));
    const robotFit = screen.getByRole("heading", { name: "Choose the approach that fits the job." }).closest("aside")!;
    expect(robotFit).toHaveTextContent(/Fixed arms, humanoids, wheeled humanoids and mobile manipulators/);
    expect(robotFit).toHaveTextContent(/specific setup is compatible/);
    expect(screen.getByRole("region", { name: "One task, from phone video to a pilot." })).toHaveTextContent(/examples, not measured customer results/);
  });
});
