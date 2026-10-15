import { z } from "zod";

/**
 * A robot team's own arm, declared for a simulated evaluation
 * (`blueprint.robot_embodiment.v1`). The Pipeline binds the model by its
 * SHA-256, reads its joints and links, checks that it can reach the job from
 * the scene's robot station, and refuses by name anything it cannot evaluate,
 * before any GPU time is spent. This schema only checks the shape so a team
 * sees a typo at once; the Pipeline's validation is the authority.
 *
 * Fixed-base arms are evaluated today. A mobile manipulator or humanoid would
 * be evaluated with its base locked, which needs an owner decision first.
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
export const ROBOT_CONTROL_HZ = [15, 30, 60] as const;

const armJoint = z.object({ name, lower: finite, upper: finite, max_velocity: finite.positive() }).strict()
  .refine(joint => joint.lower < joint.upper, "A joint's lower limit must be below its upper limit.");
const camera = z.object({
  name,
  mount_link: name.nullable(),
  position_m: z.tuple([finite, finite, finite]),
  orientation_xyzw: z.tuple([finite, finite, finite, finite]),
  width: z.number().int().min(32).max(1280),
  height: z.number().int().min(32).max(1280),
  horizontal_fov_deg: finite.min(10).max(170),
}).strict();

export const robotEmbodimentSchema = z.object({
  schema_version: z.literal(ROBOT_EMBODIMENT_SCHEMA),
  embodiment_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  form: z.literal("fixed_base_arm"),
  model: z.object({ format: z.literal("usd"), url: httpsModel, sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/) }).strict(),
  arm_joints: z.array(armJoint).min(1).max(32),
  gripper: z.object({
    joints: z.array(z.object({ name, open: finite, closed: finite }).strict()
      .refine(joint => joint.open !== joint.closed, "Open and closed positions must differ.")).min(1).max(8),
    max_width_m: finite.positive().max(1),
    contact_links: z.array(name).min(1).max(8),
  }).strict().nullable().optional(),
  tool_link: name,
  reset_joint_positions: z.record(name, finite),
  actuator: z.object({ stiffness: finite.positive(), damping: finite.positive() }).strict(),
  cameras: z.array(camera).min(1).max(4),
  control_hz: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  action_chunk_rows: z.number().int().min(1).max(64),
  reach_m: finite.min(0.1).max(3),
}).strict().superRefine((value, ctx) => {
  const joints = [...value.arm_joints.map(joint => joint.name), ...(value.gripper?.joints ?? []).map(joint => joint.name)];
  if (new Set(joints).size !== joints.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["arm_joints"], message: "Joint names must be unique." });
  }
  const reset = Object.keys(value.reset_joint_positions).sort();
  if (reset.join() !== [...joints].sort().join()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reset_joint_positions"],
      message: "Give one reset position for every arm and gripper joint, and no others." });
  }
  const cameras = value.cameras.map(row => row.name);
  if (new Set(cameras).size !== cameras.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cameras"], message: "Camera names must be unique." });
  }
});

export type RobotEmbodiment = z.infer<typeof robotEmbodimentSchema>;

/** One action row: a target per arm joint in declared order, then the gripper's closure (0 open, 1 closed). */
export function actionWidth(embodiment: RobotEmbodiment): number {
  return embodiment.arm_joints.length + (embodiment.gripper ? 1 : 0);
}
