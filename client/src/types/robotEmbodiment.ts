import { z } from "zod";

/**
 * A robot team's own robot, of any form, declared for a simulated evaluation
 * (`blueprint.robot_embodiment.v1`). Two things decide how it is simulated:
 * its base (`fixed`, pinned at the scene's robot station, or `free`, standing
 * or driving on the scene's floor from a clear stance facing the task) and
 * its joints (each driven by `position`, or by `velocity` for wheels). A fixed
 * arm, two arms, a mobile manipulator and a wheeled or legged humanoid are all
 * described this way. The Pipeline binds the model by its SHA-256, reads its
 * joints and links, checks the anchor, the reach or the floor stance, and
 * refuses by name anything it cannot evaluate, before any GPU time is spent.
 * This schema only checks the shape so a team sees a typo at once; the
 * Pipeline's validation is the authority.
 */
const name = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, "Use the joint or link name from your model.");
const finite = z.number().finite();
const httpsModel = z.string().trim().url().max(1000).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}, "Use an HTTPS link to the USD file, without credentials or query parameters.");

export const ROBOT_EMBODIMENT_SCHEMA = "blueprint.robot_embodiment.v1";
export const ROBOT_EMBODIMENT_SCHEMA_V2 = "blueprint.robot_embodiment.v2";
export const ROBOT_CONTROL_HZ = [15, 30, 60, 120] as const;
/** What the team says its robot is; reported, never a gate. */
export const ROBOT_FORMS = ["fixed_base_arm", "bimanual_arm", "mobile_manipulator", "wheeled_humanoid", "humanoid",
  "legged_manipulator", "other"] as const;
const FIXED_FORMS: ReadonlyArray<string> = ["fixed_base_arm", "bimanual_arm"];

const gain = finite.positive();
const joint = z.discriminatedUnion("control", [
  z.object({ name, control: z.literal("position"), lower: finite, upper: finite, max_velocity: gain,
    stiffness: gain.optional(), damping: gain.optional() }).strict(),
  // A wheel: its row value is a velocity, bounded by max_velocity.
  z.object({ name, control: z.literal("velocity"), max_velocity: gain, damping: gain.optional() }).strict(),
]).refine(value => value.control !== "position" || value.lower < value.upper,
  "A joint's lower limit must be below its upper limit.");
const base = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fixed") }).strict(),
  z.object({
    mode: z.literal("free"),
    root_height_m: finite.min(0.05).max(2.5),
    fall_height_m: finite.positive(),
    footprint_half_extent_m: z.tuple([finite.min(0.05).max(1.5), finite.min(0.05).max(1.5)]),
    // Feet, wheels or casters: they bear the robot's weight on the floor.
    ground_contact_links: z.array(name).min(1).max(16),
  }).strict(),
]);
const camera = z.object({
  name,
  mount_link: name.nullable(),
  position_m: z.tuple([finite, finite, finite]),
  orientation_xyzw: z.tuple([finite, finite, finite, finite]),
  width: z.number().int().min(32).max(1280),
  height: z.number().int().min(32).max(1280),
  horizontal_fov_deg: finite.min(10).max(170),
}).strict();

const finger = z.object({ name, open: finite, closed: finite }).strict()
  .refine(joint => joint.open !== joint.closed, "Open and closed positions must differ.");
const tool = z.object({
  joints: z.array(finger).min(1).max(8),
  max_width_m: finite.positive().max(1),
  contact_links: z.array(name).min(1).max(8),
}).strict();
const pose = z.object({
  position_m: z.tuple([finite, finite, finite]),
  orientation_xyzw: z.tuple([finite, finite, finite, finite])
    .refine(q => Math.abs(q.reduce((sum, v) => sum + v * v, 0) - 1) <= 1e-4,
      "Use a normalized XYZW quaternion."),
}).strict();

export const robotEmbodimentSchema = z.object({
  schema_version: z.enum([ROBOT_EMBODIMENT_SCHEMA, ROBOT_EMBODIMENT_SCHEMA_V2]),
  embodiment_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  form: z.enum(ROBOT_FORMS),
  model: z.object({ format: z.literal("usd"), url: httpsModel, sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/) }).strict(),
  base,
  joints: z.array(joint).min(1).max(64),
  gripper: tool.nullable().optional(),
  grippers: z.array(tool.extend({ name, tool_link: name }).strict()).min(1).max(2).optional(),
  arms: z.array(z.object({
    name, joint_names: z.array(name).min(1).max(64), base_link: name,
    tool_link: name, gripper_name: name, tool_from_tcp: pose,
  }).strict()).min(1).max(2).optional(),
  tool_link: name,
  reset_joint_positions: z.record(name, finite),
  actuator: z.object({ stiffness: finite.positive(), damping: finite.positive() }).strict(),
  cameras: z.array(camera).min(1).max(4),
  control_hz: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]),
  action_chunk_rows: z.number().int().min(1).max(64),
  // A fixed base reaches the task from the station; a free base goes to it.
  reach_m: finite.min(0.1).max(3).optional(),
}).strict().superRefine((value, ctx) => {
  const v2 = value.schema_version === ROBOT_EMBODIMENT_SCHEMA_V2;
  const issue = (path: string[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if ((v2 && ("gripper" in value || !value.grippers))
    || (!v2 && (!("gripper" in value) || "grippers" in value || "arms" in value))) {
    issue(["schema_version"], "Version 1 uses gripper; version 2 uses independently named grippers and optional arms.");
  }
  const tools = v2 ? value.grippers ?? [] : value.gripper ? [value.gripper] : [];
  const gripper = tools.flatMap(tool => tool.joints.map(joint => joint.name));
  const joints = [...value.joints.map(joint => joint.name), ...gripper];
  if (new Set(joints).size !== joints.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["joints"], message: "Joint names must be unique." });
  }
  const positioned = [...value.joints.filter(joint => joint.control === "position").map(joint => joint.name), ...gripper];
  const reset = Object.keys(value.reset_joint_positions).sort();
  if (reset.join() !== [...positioned].sort().join()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reset_joint_positions"],
      message: "Give one reset position for every position-driven and gripper joint (wheels start at rest), and no others." });
  }
  if ((value.base.mode === "fixed") !== (value.reach_m !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reach_m"],
      message: "Give reach_m for a fixed base only." });
  }
  if (value.base.mode === "free" && !(value.base.fall_height_m < value.base.root_height_m)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["base", "fall_height_m"],
      message: "The fall height must be below the standing root height." });
  }
  if (FIXED_FORMS.includes(value.form) && value.base.mode !== "fixed") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["base"], message: "A fixed arm has a fixed base." });
  }
  const cameras = value.cameras.map(row => row.name);
  if (new Set(cameras).size !== cameras.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cameras"], message: "Camera names must be unique." });
  }
  if (v2 && value.grippers) {
    const names = value.grippers.map(tool => tool.name);
    const links = value.grippers.map(tool => tool.tool_link);
    if (new Set(names).size !== names.length || new Set(links).size !== links.length
      || !links.includes(value.tool_link)) {
      issue(["grippers"], "Give each gripper a unique name and tool link; tool_link selects one declared tool.");
    }
    const arms = value.arms ?? [];
    const armNames = arms.map(arm => arm.name);
    const armJoints = arms.flatMap(arm => arm.joint_names);
    const armTools = arms.map(arm => arm.gripper_name);
    if (new Set(armNames).size !== armNames.length || new Set(armJoints).size !== armJoints.length
      || new Set(armTools).size !== armTools.length
      || (value.arms !== undefined && (value.base.mode !== "fixed"
        || armJoints.length !== value.joints.length || armTools.length !== value.grippers.length))) {
      issue(["arms"], "Arms must have independent names, joint groups and grippers.");
    }
    for (const arm of arms) {
      if (arm.base_link === arm.tool_link
        || !arm.joint_names.every(name => value.joints.some(joint => joint.name === name && joint.control === "position"))
        || !value.grippers.some(tool => tool.name === arm.gripper_name && tool.tool_link === arm.tool_link)) {
        issue(["arms"], "Bind every arm to declared position joints and its matching gripper/tool link.");
      }
    }
  }
});

export type RobotEmbodiment = z.infer<typeof robotEmbodimentSchema>;

/** One action row: a value per declared joint (a position, or a wheel's velocity), then the gripper's closure. */
export function actionWidth(embodiment: RobotEmbodiment): number {
  return embodiment.joints.length + (embodiment.schema_version === ROBOT_EMBODIMENT_SCHEMA_V2
    ? embodiment.grippers?.length ?? 0 : embodiment.gripper ? 1 : 0);
}
