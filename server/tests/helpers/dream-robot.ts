import { robotEmbodimentSchema } from "../../../client/src/types/robotEmbodiment";

const pose = { position_m: [0, 0, 0], orientation_xyzw: [0, 0, 0, 1] };
export function dreamRobotFixture() {
  return robotEmbodimentSchema.parse({
    schema_version: "blueprint.robot_embodiment.v2", embodiment_id: "development-dual-arm", form: "bimanual_arm",
    model: { format: "usd", url: "https://models.example/robot.usda", sha256: `sha256:${"9".repeat(64)}` },
    base: { mode: "fixed" }, reach_m: 1,
    joints: ["left", "right"].map(arm => ({ name: `${arm}_joint`, control: "position", lower: -3, upper: 3, max_velocity: 2 })),
    grippers: ["left", "right"].map(arm => ({ name: `${arm}_gripper`, tool_link: `${arm}_tool`,
      joints: [{ name: `${arm}_finger`, open: 0.04, closed: 0 }], max_width_m: 0.08, contact_links: [`${arm}_finger_link`] })),
    arms: ["left", "right"].map(arm => ({ name: arm, joint_names: [`${arm}_joint`], base_link: `${arm}_base`,
      tool_link: `${arm}_tool`, gripper_name: `${arm}_gripper`, tool_from_tcp: pose })),
    tool_link: "left_tool", reset_joint_positions: { left_joint: 0, right_joint: 0, left_finger: 0.04, right_finger: 0.04 },
    actuator: { stiffness: 400, damping: 40 }, control_hz: 60, action_chunk_rows: 30,
    cameras: ["overview", "left_wrist", "right_wrist"].map(name => ({ name,
      mount_link: name === "overview" ? null : name === "left_wrist" ? "left_tool" : "right_tool", ...pose,
      width: 320, height: 240, horizontal_fov_deg: 90 })),
  });
}
