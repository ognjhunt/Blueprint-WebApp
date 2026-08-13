import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InteractiveEvaluationPreview } from "@/components/site/InteractiveEvaluationPreview";

describe("InteractiveEvaluationPreview", () => {
  it("switches the visible terminal outcome when the candidate changes", () => {
    render(<InteractiveEvaluationPreview />);

    expect(
      screen.getByRole("heading", {
        name: /Change the task\. Swap the candidate\. See what changed\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Parcel placed")).toBeInTheDocument();
    expect(screen.getByText("Task completed")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Candidate B Fast approach/i }),
    );

    expect(screen.getByText("Placement overshoot")).toBeInTheDocument();
    expect(screen.getByText("Task incomplete")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /parcel placement overshot an empty tan tote/i,
      }),
    ).toHaveAttribute(
      "src",
      "/generated/task-evaluation-preview-2026-08-13/packing-cell-candidate-b.jpg",
    );
  });

  it("keeps fixed-arm tasks primary while exposing humanoid warehouse tasks", () => {
    render(<InteractiveEvaluationPreview />);

    expect(screen.getByText("3 fixed-arm · 2 humanoid")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Parcel to tote/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Part to nest/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Block to fixture/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tote to conveyor/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tote relay/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tote to conveyor/i }));
    expect(screen.getByText("Parcel transferred")).toBeInTheDocument();
    expect(screen.getByText("Clear top grasp")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Candidate B Fast approach/i }),
    );
    expect(screen.getByText("Occlusion stop")).toBeInTheDocument();
    expect(screen.getByText("Parcel overlap")).toBeInTheDocument();
    expect(screen.getByText("Stopped safely")).toBeInTheDocument();
  });

  it("states the preview's evidence boundary next to the generated frames", () => {
    render(<InteractiveEvaluationPreview />);

    expect(screen.getByText("Simulation only")).toBeInTheDocument();
    expect(
      screen.getByText(
        /They are not captured site media, completed policy runs, policy-ranking evidence, physical outcomes, or deployment approval/i,
      ),
    ).toBeInTheDocument();
  });
});
