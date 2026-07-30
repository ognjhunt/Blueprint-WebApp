import { z } from "zod";

import { canonicalArtifactDigest, stableJson } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const nonEmpty = z.string().trim().min(1);

const artifactUri = nonEmpty.refine((value) => {
  const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  if (!match || !["artifact", "fixture", "gs", "https", "s3", "testbed"].includes(match[1].toLowerCase())) {
    return false;
  }
  const lowered = value.toLowerCase();
  return !value.includes("@") && ![
    "?token=", "&token=", "?signature=", "&signature=", "x-amz-credential",
  ].some((marker) => lowered.includes(marker));
}, "artifact URI must use an allowed credential-free scheme");

const artifactReferenceSchema = z
  .object({ uri: artifactUri, digest })
  .passthrough();

const cardSchema = z
  .object({ schema_version: nonEmpty, card_digest: digest })
  .passthrough();

export const maintainedSiteTaskTestbedSchema = z
  .object({
    schema_version: z.literal("maintained_site_task_testbed.v1"),
    testbed_id: identifier,
    version: identifier,
    predecessor_testbed_digest: digest.nullable(),
    supersedes: z.array(digest),
    source_capture_bundles: z.array(z.record(z.string(), z.unknown())).min(1),
    artifact_references: z
      .object({
        site_card: artifactReferenceSchema,
        task_cards: z.array(artifactReferenceSchema).min(1),
        scenario_cards: z.array(artifactReferenceSchema).min(1),
        eval_cards: z.array(artifactReferenceSchema).min(1),
        evaluator: artifactReferenceSchema,
        reset: artifactReferenceSchema,
      })
      .passthrough(),
    compiled_cards: z
      .object({
        site_card: cardSchema,
        task_cards: z.array(cardSchema).min(1),
        scenario_cards: z.array(cardSchema).min(1),
        eval_cards: z.array(cardSchema).min(1),
      })
      .strict(),
    approved_task_definition: z
      .object({
        approved_task_id: identifier,
        digest,
        approval_decision_digest: digest,
      })
      .strict(),
    task_distribution: z.record(z.string(), z.unknown()),
    supported_condition_ranges: z.record(z.string(), z.unknown()),
    robot_sensor_controller_bindings: z.record(z.string(), z.unknown()),
    governance: z.record(z.string(), z.unknown()),
    evidence_inventory: z.array(z.record(z.string(), z.unknown())),
    validation_envelope: z.record(z.string(), z.unknown()),
    known_unsupported_conditions: z.array(nonEmpty),
    invalidation_triggers: z.array(nonEmpty),
    physical_outcome_history_refs: z.array(z.unknown()),
    lifecycle_state: z.enum(["draft", "active", "invalidated", "superseded", "retired"]),
    proof_boundary: z
      .object({
        appearance_is_collision_truth: z.literal(false),
        generated_completion_is_observed_truth: z.literal(false),
        simulation_is_physical_success: z.literal(false),
        deployment_or_safety_approved: z.literal(false),
        comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
      })
      .strict(),
    testbed_digest: digest,
  })
  .passthrough();

export const siteTaskTestbedPublicationSchema = z
  .object({
    schema_version: z.literal("site_task_testbed_publication.v1"),
    capture_session_id: identifier,
    intake_id: identifier,
    approved_task_digest: digest,
    testbed_id: identifier,
    version: identifier,
    testbed_digest: digest,
    artifact_reference: artifactReferenceSchema,
    testbed: maintainedSiteTaskTestbedSchema,
    status: z.literal("testbed_ready"),
    proof_boundary: maintainedSiteTaskTestbedSchema.shape.proof_boundary,
  })
  .strict();

function secretPaths(value: unknown, prefix = ""): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((child, index) => paths.push(...secretPaths(child, `${prefix}[${index}]`)));
    return paths;
  }
  if (!value || typeof value !== "object") return paths;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const normalized = key.toLowerCase();
    const secretKey = [
      "password", "secret", "credential", "credentials", "api_key", "access_token",
      "authorization_token", "private_key",
    ].some((word) => normalized === word || normalized.endsWith(`_${word}`)) ||
      normalized === "token" || normalized.endsWith("_token");
    if (secretKey && ![null, ""].includes(child as null | string)) {
      paths.push(path);
    }
    paths.push(...secretPaths(child, path));
  }
  return paths;
}

export function parseVerifiedMaintainedSiteTaskTestbed(value: unknown) {
  const parsed = maintainedSiteTaskTestbedSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false as const, blockers: ["maintained_testbed_schema_invalid"] };
  }
  const testbed = parsed.data;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(testbed, "testbed_digest") !== testbed.testbed_digest) {
    blockers.push("maintained_testbed_digest_mismatch");
  }
  const cardGroups = [
    [testbed.compiled_cards.site_card],
    testbed.compiled_cards.task_cards,
    testbed.compiled_cards.scenario_cards,
    testbed.compiled_cards.eval_cards,
  ];
  const referenceGroups = [
    [testbed.artifact_references.site_card],
    testbed.artifact_references.task_cards,
    testbed.artifact_references.scenario_cards,
    testbed.artifact_references.eval_cards,
  ];
  cardGroups.forEach((cards, groupIndex) => {
    cards.forEach((card, index) => {
      if (canonicalArtifactDigest(card, "card_digest") !== card.card_digest) {
        blockers.push("maintained_testbed_card_digest_mismatch");
      }
      if (referenceGroups[groupIndex]?.[index]?.digest !== card.card_digest) {
        blockers.push("maintained_testbed_card_reference_mismatch");
      }
    });
    if (referenceGroups[groupIndex]?.length !== cards.length) {
      blockers.push("maintained_testbed_card_reference_count_mismatch");
    }
  });
  if (secretPaths(testbed).length) blockers.push("maintained_testbed_secret_value_forbidden");
  if (blockers.length) {
    return { ok: false as const, blockers: [...new Set(blockers)].sort() };
  }
  return { ok: true as const, testbed };
}

export function exactTestbedPublicationFingerprint(value: unknown) {
  return stableJson(value);
}

export type MaintainedSiteTaskTestbed = z.infer<typeof maintainedSiteTaskTestbedSchema>;
export type SiteTaskTestbedPublication = z.infer<typeof siteTaskTestbedPublicationSchema>;
