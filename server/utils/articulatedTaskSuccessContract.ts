/**
 * The frozen success definition for an articulated open/close task.
 *
 * Twin of the rigid contract: same envelope, same provenance rules, same
 * canonical digest, same frozen safety predicate. Only the criteria differ,
 * because opening a drawer has no destination, no lift and no placement
 * tolerance. What it has is one target joint, an interval on that joint's own
 * coordinate, and the requirement that the part stay open while the assembly
 * stays put.
 *
 * Boundaries that can carry either contract use the union below rather than
 * assuming the rigid lane.
 */
import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import {
  confirmRigidTaskSuccessContract,
  confirmedRigidTaskSuccessContractSchema,
  rigidTaskSuccessContractSchema,
  type RigidTaskSuccessContract,
} from "./rigidTaskSuccessContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1).max(240);
const mode = z.enum(["required", "ignored"]);
const interval = z.tuple([z.number().finite(), z.number().finite()]);

const scopeSchema = z.object({ site_id: nonEmpty, task_id: nonEmpty }).strict();
const provenanceSchema = z.object({
  author_source: z.enum(["compatibility_default", "site_robot_team", "task_owner", "agent_proposal"]),
  author_id: nonEmpty,
  confirmation_status: z.enum(["proposal_only", "confirmed"]),
  confirmed_by_team_id: nonEmpty.nullable(),
  proposal_digest: digest.nullable(),
}).strict();

export const articulatedTaskSuccessCriteriaSchema = z.object({
  target_joint: z.object({
    joint_id: nonEmpty,
    joint_ids: z.array(nonEmpty).min(1).max(64),
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
    joint_ids: z.array(nonEmpty).max(64),
    motion_tolerance: z.number().finite().positive(),
  }).strict(),
  reset: z.object({ tolerance: z.number().finite().positive() }).strict(),
  motion: z.object({ movement_epsilon: z.number().finite().positive() }).strict(),
  assembly_root: z.object({ mode }).strict(),
  safety: z.object({ mode: z.literal("required") }).strict(),
  temporal_invariants: z.object({
    schema_version: z.literal("articulated_task_event_ledger_expectation.v1"),
    rebound_below_threshold_allowed: z.literal(false),
    forbidden_collision_allowed: z.literal(false),
    joint_limit_violation_allowed: z.literal(false),
    assembly_root_excursion_allowed: z.boolean(),
  }).strict(),
}).strict().superRefine((criteria, context) => {
  const [low, high] = criteria.opening.success_interval;
  const [lower, upper] = criteria.opening.joint_hard_limits;
  if (low >= high || lower >= upper || low < lower - 1e-9 || high > upper + 1e-9) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["opening", "success_interval"],
      message: "opening interval must be a real span inside the qualified joint limits",
    });
  }
  // A success interval containing the closed reset would score an untouched
  // drawer as opened.
  if (low <= criteria.opening.reset_position && criteria.opening.reset_position <= high) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["opening", "success_interval"],
      message: "opening interval cannot contain the closed reset position",
    });
  }
  if (!criteria.target_joint.joint_ids.includes(criteria.target_joint.joint_id)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["target_joint", "joint_id"],
      message: "the target joint must appear in its own joint list",
    });
  }
});

export const articulatedTaskSuccessContractSchema = z.object({
  schema_version: z.literal("articulated_task_success_contract.v1"),
  scope: scopeSchema,
  provenance: provenanceSchema,
  criteria: articulatedTaskSuccessCriteriaSchema,
  contract_digest: digest,
}).strict().superRefine((contract, context) => {
  const provenance = contract.provenance;
  if (provenance.confirmation_status === "proposal_only") {
    if (provenance.confirmed_by_team_id !== null || provenance.proposal_digest !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance"],
        message: "proposal-only contract cannot claim confirmation",
      });
    }
  } else if (provenance.author_source === "compatibility_default") {
    if (provenance.confirmed_by_team_id !== null || provenance.proposal_digest !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance"],
        message: "compatibility default cannot claim team confirmation",
      });
    }
  } else {
    if (!provenance.confirmed_by_team_id) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provenance", "confirmed_by_team_id"],
      message: "confirmed authored contract requires a team identity",
    });
    if (provenance.author_source === "agent_proposal" && !provenance.proposal_digest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance", "proposal_digest"],
        message: "confirmed agent proposal must bind its proposal digest",
      });
    }
  }
  if (canonicalArtifactDigest(
    contract as unknown as Record<string, unknown>,
    "contract_digest",
  ) !== contract.contract_digest) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["contract_digest"],
    message: "task success contract digest mismatch",
  });
});

export const confirmedArticulatedTaskSuccessContractSchema =
  articulatedTaskSuccessContractSchema.refine(
    (contract) => contract.provenance.confirmation_status === "confirmed",
    { path: ["provenance", "confirmation_status"], message: "task success contract is not confirmed" },
  );

/** Either admitted contract, discriminated by its own schema_version. */
export const taskSuccessContractSchema = z.union([
  rigidTaskSuccessContractSchema,
  articulatedTaskSuccessContractSchema,
]);

export const confirmedTaskSuccessContractSchema = z.union([
  confirmedRigidTaskSuccessContractSchema,
  confirmedArticulatedTaskSuccessContractSchema,
]);

export type ArticulatedTaskSuccessContract = z.infer<typeof articulatedTaskSuccessContractSchema>;
export type TaskSuccessContract = RigidTaskSuccessContract | ArticulatedTaskSuccessContract;

export function isArticulatedTaskSuccessContract(
  contract: { schema_version?: unknown } | null | undefined,
): boolean {
  return contract?.schema_version === "articulated_task_success_contract.v1";
}

export function confirmArticulatedTaskSuccessContract(
  proposal: ArticulatedTaskSuccessContract,
  confirmedByTeamId: string,
) {
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
  confirmed.contract_digest = canonicalArtifactDigest(
    confirmed as unknown as Record<string, unknown>,
    "contract_digest",
  );
  return confirmedArticulatedTaskSuccessContractSchema.parse(confirmed);
}

/**
 * Scope and digest agreement between a published contract and the confirmed
 * one a team selected. Kind-agnostic: it only reads the envelope, so a
 * selection that swaps the contract kind can never match.
 */
export function taskSuccessContractMatchesSelection(params: {
  published: TaskSuccessContract;
  selected: TaskSuccessContract;
  expectedSiteId: string;
  expectedTaskId: string;
  expectedTeamId: string;
}) {
  const { published, selected } = params;
  if (published.schema_version !== selected.schema_version) return false;
  if (
    published.scope.site_id !== params.expectedSiteId
    || published.scope.task_id !== params.expectedTaskId
    || selected.scope.site_id !== params.expectedSiteId
    || selected.scope.task_id !== params.expectedTaskId
  ) return false;
  if (published.provenance.confirmation_status === "confirmed") {
    return selected.contract_digest === published.contract_digest;
  }
  try {
    const expected = isArticulatedTaskSuccessContract(published)
      ? confirmArticulatedTaskSuccessContract(
          published as ArticulatedTaskSuccessContract, params.expectedTeamId)
      : confirmRigidTaskSuccessContract(
          published as RigidTaskSuccessContract, params.expectedTeamId);
    return selected.contract_digest === expected.contract_digest;
  } catch {
    return false;
  }
}
