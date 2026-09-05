import { z } from "zod";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1);
const nonnegative = z.number().finite().nonnegative();

export const rigidTaskSuccessContractSchema = z.object({
  schema_version: z.literal("rigid_task_success_contract.v1"),
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
    destination_containment: z.object({
      mode: z.enum(["required", "ignored"]),
      position_bounds_world_m: z.object({
        minimum: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
        maximum: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
      }).strict(),
    }).strict(),
    orientation: z.object({
      mode: z.enum(["required", "ignored"]),
      reference_xyzw: z.tuple([
        z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite(),
      ]),
      tolerance_rad: nonnegative,
    }).strict(),
    support: z.object({
      height_mode: z.enum(["required", "ignored"]),
      height_interval_m: z.tuple([z.number().finite(), z.number().finite()]),
      contact_mode: z.enum(["required", "ignored"]),
    }).strict(),
    terminal_task_contact: z.object({
      mode: z.enum(["cleared", "maintained", "ignored"]),
    }).strict(),
    gripper_state: z.object({
      mode: z.enum(["released", "closed_at_most", "ignored"]),
      threshold_m: nonnegative.nullable(),
    }).strict(),
    settling: z.object({
      mode: z.enum(["required", "ignored"]),
      window_samples: z.number().int().positive(),
      position_tolerance_m: nonnegative,
      orientation_tolerance_rad: nonnegative,
    }).strict(),
    safety: z.object({ mode: z.literal("required") }).strict(),
    motion: z.object({
      movement_epsilon_m: z.number().finite().positive(),
      minimum_translation_m: nonnegative.nullable(),
      minimum_lift_m: nonnegative.nullable(),
    }).strict(),
    temporal_invariants: z.object({
      schema_version: z.literal("rigid_task_event_ledger_expectation.v1"),
      no_drop: z.object({
        mode: z.enum(["required", "ignored"]),
        minimum_fall_m: z.number().finite().positive(),
      }).strict(),
      maximum_task_contact_force_n: z.number().finite().positive().nullable(),
      forbidden_contact_classes: z.array(nonEmpty),
      containment_excursions: z.enum(["forbidden", "ignored"]),
      workspace_excursions: z.enum(["forbidden", "ignored"]),
      maximum_retries: z.number().int().nonnegative().nullable(),
      maximum_regrasps: z.number().int().nonnegative().nullable(),
    }).strict(),
    retreat: z.object({
      mode: z.literal("required"),
      minimum_clearance_m: z.number().finite().positive(),
      withdrawal_unit_destination_frame: z.tuple([
        z.number().finite(), z.number().finite(), z.number().finite(),
      ]).refine((direction) => Math.abs(direction.reduce((sum, value) => sum + value * value, 0) - 1) <= 1e-6,
        "withdrawal direction must be a unit vector"),
    }).strict().optional(),
  }).strict(),
  contract_digest: digest,
}).strict();

export type RigidTaskSuccessContract = z.infer<typeof rigidTaskSuccessContractSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function canonicalDigest(value: Record<string, unknown>, digestField: string) {
  const normalized = structuredClone(value);
  delete normalized[digestField];
  const bytes = new TextEncoder().encode(stableJson(normalized));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function confirmRigidTaskSuccessContractProposal(
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
  confirmed.contract_digest = await canonicalDigest(
    confirmed as unknown as Record<string, unknown>,
    "contract_digest",
  );
  return rigidTaskSuccessContractSchema.parse(confirmed);
}

function meters(value: number) {
  return `${value.toFixed(3)} m`;
}

function optionalLimit(value: number | null, unit = "") {
  return value === null ? "No task-specific limit" : `${value}${unit}`;
}

export type TaskSuccessCriterionRow = {
  label: string;
  value: string;
  detail: string;
};

export function describeRigidTaskSuccessContract(
  contract: RigidTaskSuccessContract,
): TaskSuccessCriterionRow[] {
  const criteria = contract.criteria;
  const temporal = criteria.temporal_invariants;
  const bounds = criteria.destination_containment.position_bounds_world_m;
  return [
    {
      label: "Destination containment",
      value: criteria.destination_containment.mode === "required" ? "Required" : "Ignored",
      detail: `World bounds min ${bounds.minimum.map(meters).join(", ")} · max ${bounds.maximum.map(meters).join(", ")}`,
    },
    {
      label: "Orientation",
      value: criteria.orientation.mode === "required" ? "Required" : "Ignored",
      detail: criteria.orientation.mode === "required"
        ? `Quaternion ${criteria.orientation.reference_xyzw.join(", ")} · tolerance ${criteria.orientation.tolerance_rad} rad`
        : "Final object rotation does not affect task completion.",
    },
    {
      label: "Support",
      value: `Height ${criteria.support.height_mode} · contact ${criteria.support.contact_mode}`,
      detail: `Accepted support height ${criteria.support.height_interval_m.map(meters).join("–")}`,
    },
    {
      label: "Terminal task contact",
      value: criteria.terminal_task_contact.mode,
      detail: criteria.terminal_task_contact.mode === "cleared"
        ? "Robot-to-task-object contact must be cleared at the terminal state."
        : criteria.terminal_task_contact.mode === "maintained"
          ? "Robot-to-task-object contact must remain at the terminal state."
          : "Terminal robot-to-task-object contact is not scored.",
    },
    {
      label: "Gripper state",
      value: criteria.gripper_state.mode.replaceAll("_", " "),
      detail: criteria.gripper_state.threshold_m === null
        ? "Final gripper opening is not scored."
        : `Threshold ${meters(criteria.gripper_state.threshold_m)}`,
    },
    {
      label: "Settling",
      value: criteria.settling.mode === "required" ? "Required" : "Ignored",
      detail: `${criteria.settling.window_samples} samples · position tolerance ${meters(criteria.settling.position_tolerance_m)} · orientation tolerance ${criteria.settling.orientation_tolerance_rad} rad`,
    },
    ...(criteria.retreat ? [{
      label: "Gripper retreat",
      value: `At least ${meters(criteria.retreat.minimum_clearance_m)}`,
      detail: "Measured clearance from the object along the qualified destination withdrawal direction throughout the final settle window.",
    }] : []),
    {
      label: "Safety",
      value: "Required",
      detail: "Unsafe state or collision cannot be overridden by task authorship.",
    },
    {
      label: "Minimum motion",
      value: `Translation ${optionalLimit(criteria.motion.minimum_translation_m, " m")} · lift ${optionalLimit(criteria.motion.minimum_lift_m, " m")}`,
      detail: `Movement epsilon ${meters(criteria.motion.movement_epsilon_m)}`,
    },
    {
      label: "Drop / recovery",
      value: temporal.no_drop.mode === "required" ? "No drop required" : "Eventual placement",
      detail: temporal.no_drop.mode === "required"
        ? `A fall of ${meters(temporal.no_drop.minimum_fall_m)} or more fails the episode even after recovery.`
        : "Earlier drops do not fail this contract if the final placement satisfies every required terminal criterion.",
    },
    {
      label: "Maximum task force",
      value: optionalLimit(temporal.maximum_task_contact_force_n, " N"),
      detail: temporal.maximum_task_contact_force_n === null
        ? "No customer-authored force ceiling is active; baseline safety remains required."
        : "Any observed task-contact force above this ceiling fails the episode.",
    },
    {
      label: "Forbidden contacts",
      value: temporal.forbidden_contact_classes.length
        ? temporal.forbidden_contact_classes.join(", ")
        : "None task-specific",
      detail: "The whole episode event ledger is checked, not only the final frame.",
    },
    {
      label: "Excursions",
      value: `Destination ${temporal.containment_excursions} · workspace ${temporal.workspace_excursions}`,
      detail: "Forbidden excursions fail even if the object later returns to an accepted state.",
    },
    {
      label: "Retries / regrasps",
      value: `${optionalLimit(temporal.maximum_retries)} retries · ${optionalLimit(temporal.maximum_regrasps)} regrasps`,
      detail: "Limits apply across the complete episode event ledger.",
    },
  ];
}

export function findPublishedTaskSuccessContract(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const publication = value as Record<string, any>;
  const candidates = [
    publication.policy_canary_result?.task_success_contract,
    publication.task_success_contract,
    publication.result_delivery?.reproducibility?.task_success_contract,
  ];
  for (const candidate of candidates) {
    const parsed = rigidTaskSuccessContractSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}
