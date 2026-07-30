import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TestbedCompilationControl } from "@/components/blueprint/app/TestbedCompilationControl";

describe("TestbedCompilationControl", () => {
  it("submits robot identity and customer constraints without scientific conclusions", () => {
    const onCompile = vi.fn();
    render(<TestbedCompilationControl sceneId="scene-1" busy={false} onCompile={onCompile} />);

    fireEvent.change(screen.getByLabelText("Robot ID"), { target: { value: "fixture-arm" } });
    fireEvent.change(screen.getByLabelText("Embodiment version"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Circular footprint radius (m)"), { target: { value: "0.4" } });
    fireEvent.change(screen.getByLabelText("Primary sensor ID"), { target: { value: "rgb-v1" } });
    fireEvent.change(screen.getByLabelText("Controller ID"), { target: { value: "joint-position-v1" } });
    fireEvent.change(screen.getByLabelText("End effector ID"), { target: { value: "parallel-gripper-v1" } });
    fireEvent.change(screen.getByLabelText("Maximum reach (m)"), { target: { value: "1.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Compile testbed" }));

    expect(onCompile).toHaveBeenCalledTimes(1);
    const command = onCompile.mock.calls[0]?.[0];
    expect(command).toMatchObject({
      schema_version: "capture_testbed_compilation_command.v1",
      testbed_id: "testbed-scene-1",
      robot_binding: {
        robot_id: "fixture-arm",
        base_footprint: { shape: "circle", radius_m: 0.4 },
        reach_envelope: { minimum_m: 0, maximum_m: 1 },
      },
      false_safe_consequence: "moderate",
      acceptable_false_safe_risk: 0.05,
      minimum_coverage: 0.9,
      minimum_independent_methods: 1,
    });
    expect(command).not.toHaveProperty("simready_decision");
    expect(command).not.toHaveProperty("robot_placement_result");
    expect(command).not.toHaveProperty("selected_provider");
  });
});
