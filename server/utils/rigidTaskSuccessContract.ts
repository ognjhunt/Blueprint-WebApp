import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1).max(240);
const finiteNonnegative = z.number().finite().nonnegative();

const destinationContainmentSchema = z.object({
  mode: z.enum(["required", "ignored"]),
  position_bounds_world_m: z.object({
    minimum: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
    maximum: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  }).strict(),
}).strict().superRefine((value, context) => {
  value.position_bounds_world_m.minimum.forEach((minimum, index) => {
    if (minimum >= value.position_bounds_world_m.maximum[index]) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["position_bounds_world_m"],
      message: "destination minimum must be below maximum on every axis",
    });
  });
});

const orientationSchema = z.object({
  mode: z.enum(["required", "ignored"]),
  reference_xyzw: z.tuple([
    z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite(),
  ]),
  tolerance_rad: finiteNonnegative,
}).strict().superRefine((value, context) => {
  const normSquared = value.reference_xyzw.reduce((total, component) => (
    total + component * component
  ), 0);
  if (Math.abs(normSquared - 1) > 1e-6) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["reference_xyzw"],
    message: "orientation reference must be a unit quaternion",
  });
});

const supportSchema = z.object({
  height_mode: z.enum(["required", "ignored"]),
  height_interval_m: z.tuple([z.number().finite(), z.number().finite()]),
  contact_mode: z.enum(["required", "ignored"]),
}).strict().superRefine((value, context) => {
  if (value.height_interval_m[0] >= value.height_interval_m[1]) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["height_interval_m"],
    message: "support height minimum must be below maximum",
  });
});

const gripperSchema = z.object({
  mode: z.enum(["released", "closed_at_most", "ignored"]),
  threshold_m: finiteNonnegative.nullable(),
}).strict().superRefine((value, context) => {
  if (value.mode === "ignored" && value.threshold_m !== null) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["threshold_m"],
    message: "ignored gripper state cannot carry a threshold",
  });
  if (value.mode !== "ignored" && value.threshold_m === null) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["threshold_m"],
    message: "required gripper state needs a threshold",
  });
});

const temporalInvariantsSchema = z.object({
  schema_version: z.literal("rigid_task_event_ledger_expectation.v1"),
  no_drop: z.object({
    mode: z.enum(["required", "ignored"]),
    minimum_fall_m: z.number().finite().positive(),
  }).strict(),
  maximum_task_contact_force_n: z.number().finite().positive().nullable(),
  forbidden_contact_classes: z.array(nonEmpty).max(100).refine(
    (values) => new Set(values).size === values.length,
    "forbidden contact classes must be unique",
  ),
  containment_excursions: z.enum(["forbidden", "ignored"]),
  workspace_excursions: z.enum(["forbidden", "ignored"]),
  maximum_retries: z.number().int().nonnegative().nullable(),
  maximum_regrasps: z.number().int().nonnegative().nullable(),
}).strict();

export const rigidTaskSuccessCriteriaSchema = z.object({
  destination_containment: destinationContainmentSchema,
  orientation: orientationSchema,
  support: supportSchema,
  terminal_task_contact: z.object({
    mode: z.enum(["cleared", "maintained", "ignored"]),
  }).strict(),
  gripper_state: gripperSchema,
  settling: z.object({
    mode: z.enum(["required", "ignored"]),
    window_samples: z.number().int().positive(),
    position_tolerance_m: finiteNonnegative,
    orientation_tolerance_rad: finiteNonnegative,
  }).strict(),
  safety: z.object({ mode: z.literal("required") }).strict(),
  motion: z.object({
    movement_epsilon_m: z.number().finite().positive(),
    minimum_translation_m: finiteNonnegative.nullable(),
    minimum_lift_m: finiteNonnegative.nullable(),
  }).strict(),
  temporal_invariants: temporalInvariantsSchema,
}).strict();

export const rigidTaskSuccessContractSchema = z.object({
  schema_version: z.literal("rigid_task_success_contract.v1"),
  scope: z.object({
    site_id: nonEmpty,
    task_id: nonEmpty,
  }).strict(),
  provenance: z.object({
    author_source: z.enum([
      "compatibility_default", "site_robot_team", "task_owner", "agent_proposal",
    ]),
    author_id: nonEmpty,
    confirmation_status: z.enum(["proposal_only", "confirmed"]),
    confirmed_by_team_id: nonEmpty.nullable(),
    proposal_digest: digest.nullable(),
  }).strict(),
  criteria: rigidTaskSuccessCriteriaSchema,
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

export const confirmedRigidTaskSuccessContractSchema = rigidTaskSuccessContractSchema.refine(
  (contract) => contract.provenance.confirmation_status === "confirmed",
  { path: ["provenance", "confirmation_status"], message: "task success contract is not confirmed" },
);

export type RigidTaskSuccessContract = z.infer<typeof rigidTaskSuccessContractSchema>;
export type ConfirmedRigidTaskSuccessContract = z.infer<
  typeof confirmedRigidTaskSuccessContractSchema
>;

export function sealRigidTaskSuccessContract(params: {
  siteId: string;
  taskId: string;
  authorSource: RigidTaskSuccessContract["provenance"]["author_source"];
  authorId: string;
  confirmationStatus: RigidTaskSuccessContract["provenance"]["confirmation_status"];
  confirmedByTeamId?: string | null;
  criteria: RigidTaskSuccessContract["criteria"];
}) {
  const contract: RigidTaskSuccessContract = {
    schema_version: "rigid_task_success_contract.v1",
    scope: { site_id: params.siteId, task_id: params.taskId },
    provenance: {
      author_source: params.authorSource,
      author_id: params.authorId,
      confirmation_status: params.confirmationStatus,
      confirmed_by_team_id: params.confirmedByTeamId ?? null,
      proposal_digest: null,
    },
    criteria: structuredClone(params.criteria),
    contract_digest: `sha256:${"0".repeat(64)}`,
  };
  contract.contract_digest = canonicalArtifactDigest(
    contract as unknown as Record<string, unknown>,
    "contract_digest",
  );
  return rigidTaskSuccessContractSchema.parse(contract);
}

export function confirmRigidTaskSuccessContract(
  proposal: RigidTaskSuccessContract,
  confirmedByTeamId: string,
) {
  const parsed = rigidTaskSuccessContractSchema.parse(proposal);
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
  return confirmedRigidTaskSuccessContractSchema.parse(confirmed);
}

export function rigidTaskSuccessContractMatchesSelection(params: {
  published: RigidTaskSuccessContract;
  selected: ConfirmedRigidTaskSuccessContract;
  expectedSiteId: string;
  expectedTaskId: string;
  expectedTeamId: string;
}) {
  if (
    params.published.scope.site_id !== params.expectedSiteId
    || params.published.scope.task_id !== params.expectedTaskId
    || params.selected.scope.site_id !== params.expectedSiteId
    || params.selected.scope.task_id !== params.expectedTaskId
  ) return false;
  if (params.published.provenance.confirmation_status === "confirmed") {
    return params.selected.contract_digest === params.published.contract_digest;
  }
  try {
    const expected = confirmRigidTaskSuccessContract(
      params.published,
      params.expectedTeamId,
    );
    return params.selected.contract_digest === expected.contract_digest;
  } catch {
    return false;
  }
}
