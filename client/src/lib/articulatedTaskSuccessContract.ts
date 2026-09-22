/**
 * Client-side reader for the articulated open/close success contract.
 *
 * The results page shows a robot team exactly what decided completion. An
 * open/close task is decided by one joint's own coordinate, so the rows here
 * describe the opening interval, the hold, and what had to stay still, rather
 * than the rigid lane's destination and lift.
 */
import { z } from "zod";

import {
  canonicalDigest,
  confirmRigidTaskSuccessContractProposal,
  describeRigidTaskSuccessContract,
  rigidTaskSuccessContractSchema,
  type TaskSuccessCriterionRow,
} from "./rigidTaskSuccessContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1);
const mode = z.enum(["required", "ignored"]);
const interval = z.tuple([z.number().finite(), z.number().finite()]);

export const articulatedTaskSuccessContractSchema = z.object({
  schema_version: z.literal("articulated_task_success_contract.v1"),
  scope: z.object({ site_id: nonEmpty, task_id: nonEmpty }).strict(),
  provenance: z.object({
    author_source: z.enum([
      "compatibility_default", "site_robot_team", "task_owner", "agent_proposal",
    ]),
    author_id: nonEmpty,
    confirmation_status: z.enum(["proposal_only", "confirmed"]),
    confirmed_by_team_id: nonEmpty.nullable(),
    proposal_digest: digest.nullable(),
  }).strict(),
  criteria: z.object({
    target_joint: z.object({
      joint_id: nonEmpty,
      joint_ids: z.array(nonEmpty),
    }).strict(),
    opening: z.object({
      mode: z.literal("required"),
      success_interval: interval,
      joint_hard_limits: interval,
      reset_position: z.number().finite(),
    }).strict(),
    hold: z.object({
      mode,
      window_samples: z.number().int().positive(),
      maximum_settled_target_speed: z.number().finite().positive(),
    }).strict(),
    locked_joints: z.object({
      mode,
      joint_ids: z.array(nonEmpty),
      motion_tolerance: z.number().finite().positive(),
    }).strict(),
    reset: z.object({ tolerance: z.number().finite().positive() }).strict(),
    motion: z.object({ movement_epsilon: z.number().finite().positive() }).strict(),
    assembly_root: z.object({ mode }).strict(),
    safety: z.object({ mode: z.literal("required") }).strict(),
    temporal_invariants: z.object({
      schema_version: z.literal("articulated_task_event_ledger_expectation.v1"),
      rebound_below_threshold_allowed: z.boolean(),
      forbidden_collision_allowed: z.boolean(),
      joint_limit_violation_allowed: z.boolean(),
      assembly_root_excursion_allowed: z.boolean(),
    }).strict(),
  }).strict(),
  contract_digest: digest,
}).strict();

export type ArticulatedTaskSuccessContract = z.infer<
  typeof articulatedTaskSuccessContractSchema
>;

export const anyTaskSuccessContractSchema = z.union([
  rigidTaskSuccessContractSchema,
  articulatedTaskSuccessContractSchema,
]);

export type AnyTaskSuccessContract = z.infer<typeof anyTaskSuccessContractSchema>;

/**
 * The contract a publication carries, of either kind. It lives here, beside the
 * union, so the rigid module never imports this one back: that cycle left the
 * union holding an undefined member whenever the rigid module loaded first.
 */
export function findPublishedTaskSuccessContract(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const publication = value as Record<string, any>;
  const candidates = [
    publication.policy_canary_result?.task_success_contract,
    publication.task_success_contract,
    publication.result_delivery?.reproducibility?.task_success_contract,
  ];
  for (const candidate of candidates) {
    // Either admitted kind: an articulated result would otherwise render no
    // criteria panel at all, which reads as "no scoring authority published".
    const parsed = anyTaskSuccessContractSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export function isArticulatedTaskSuccessContract(
  contract: AnyTaskSuccessContract,
): contract is ArticulatedTaskSuccessContract {
  return contract.schema_version === "articulated_task_success_contract.v1";
}

/** Metres for a sliding joint, radians for a hinge; the contract does not restate the unit. */
function amount(value: number): string {
  return value.toFixed(3);
}

export function describeArticulatedTaskSuccessContract(
  contract: ArticulatedTaskSuccessContract,
): TaskSuccessCriterionRow[] {
  const criteria = contract.criteria;
  const [low, high] = criteria.opening.success_interval;
  const [lower, upper] = criteria.opening.joint_hard_limits;
  const ledger = criteria.temporal_invariants;
  const locked = criteria.locked_joints;
  return [
    {
      label: "Part opened",
      value: `${criteria.target_joint.joint_id} between ${amount(low)} and ${amount(high)}`,
      detail: `Measured on the joint's own coordinate, read from the simulator. Qualified travel limits are ${amount(lower)} to ${amount(upper)}; the closed start is ${amount(criteria.opening.reset_position)}. These limits are estimated from footage, not measured on the real cabinet.`,
    },
    {
      label: "Held open",
      value: criteria.hold.mode === "required"
        ? `${criteria.hold.window_samples} settled samples`
        : "Not required",
      detail: `The part must stay inside the opening interval with speed at or below ${criteria.hold.maximum_settled_target_speed} per second. A drawer that springs back does not count.`,
    },
    {
      label: "Assembly stayed put",
      value: criteria.assembly_root.mode === "required" ? "Required" : "Ignored",
      detail: "Dragging or tipping the cabinet instead of opening the part is a failure, not a pass.",
    },
    {
      label: "Other parts still",
      value: locked.mode === "required"
        ? `${locked.joint_ids.length} joint${locked.joint_ids.length === 1 ? "" : "s"} within ${locked.motion_tolerance}`
        : "Ignored",
      detail: locked.joint_ids.length
        ? `Locked: ${locked.joint_ids.join(", ")}.`
        : "No other joints are declared on this assembly.",
    },
    {
      label: "Reset and movement",
      value: `reset within ${criteria.reset.tolerance} · movement over ${criteria.motion.movement_epsilon}`,
      detail: "Every episode starts from the same closed state; motion below the epsilon is not counted as opening.",
    },
    {
      label: "Safety",
      value: "Required",
      detail: "A forbidden collision or a joint-limit violation fails the episode regardless of the final joint position.",
    },
    {
      label: "Whole-episode events",
      value: [
        ledger.rebound_below_threshold_allowed ? null : "no rebound below threshold",
        ledger.forbidden_collision_allowed ? null : "no forbidden collision",
        ledger.joint_limit_violation_allowed ? null : "no joint-limit violation",
        ledger.assembly_root_excursion_allowed ? null : "no assembly excursion",
      ].filter(Boolean).join(" · ") || "None recorded",
      detail: "Evaluated across the complete episode ledger, so a later recovery does not erase a prohibited earlier event.",
    },
  ];
}

/**
 * Confirm a proposal-only contract of either kind, keeping the envelope rules
 * and the canonical digest identical to the lane it came from.
 */
export async function confirmTaskSuccessContractProposal(
  proposal: AnyTaskSuccessContract,
  confirmedByTeamId: string,
): Promise<AnyTaskSuccessContract> {
  if (!isArticulatedTaskSuccessContract(proposal)) {
    return confirmRigidTaskSuccessContractProposal(proposal, confirmedByTeamId);
  }
  const parsed = articulatedTaskSuccessContractSchema.parse(proposal);
  if (parsed.provenance.confirmation_status !== "proposal_only") {
    throw new Error("task_success_contract_not_a_proposal");
  }
  const confirmed = structuredClone(parsed);
  confirmed.provenance.confirmation_status = "confirmed";
  confirmed.provenance.confirmed_by_team_id = confirmedByTeamId.trim();
  if (confirmed.provenance.author_source === "agent_proposal") {
    confirmed.provenance.proposal_digest = parsed.contract_digest;
  }
  confirmed.contract_digest = await canonicalDigest(
    confirmed as unknown as Record<string, unknown>,
    "contract_digest",
  );
  return articulatedTaskSuccessContractSchema.parse(confirmed);
}

/** Describe whichever contract kind the result actually carries. */
export function describeTaskSuccessContract(
  contract: AnyTaskSuccessContract,
): TaskSuccessCriterionRow[] {
  return isArticulatedTaskSuccessContract(contract)
    ? describeArticulatedTaskSuccessContract(contract)
    : describeRigidTaskSuccessContract(contract);
}
