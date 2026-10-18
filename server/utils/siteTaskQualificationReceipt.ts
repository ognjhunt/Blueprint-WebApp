import { z } from "zod";
import type { Firestore } from "firebase-admin/firestore";
import { crossRuntimeCanonicalJson, matchesCrossRuntimeArtifactDigest } from "./crossRuntimeCanonical";

/** These receipts are published only by the HMAC-authenticated Pipeline route.
 * Pipeline's protected registry pins the authority, profile, independent review,
 * and original source bytes before computing the measured checks. This parser
 * verifies the retained receipt's integrity and bindings; a self-consistent
 * receipt supplied by a customer is never an admission authority. No URI is
 * fetched here. Current rights and validity are checked when admitting a run;
 * historical evidence does not disappear when its admission window expires.
 */
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const identity = z.string().min(1).max(200).refine(
  value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value), "identity must preserve nonblank, unpadded bytes",
);
const safeLabel = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const dimension = z.enum(["scale", "registration", "collision", "task_state", "observation", "task_dynamics"]);
const sourceRole = z.enum(["capture", "scene", "testbed", "task_spec", "success_contract", "robot_model", "measurement", "simulator_measurement"]);
const nonnegative = z.number().finite().nonnegative();
const safePositiveInteger = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

const bindingSchema = z.object({
  scene_request_id: identity, site_id: identity, task_id: identity, capture_id: identity,
  source_capture_digest: digest, testbed_digest_sha256: digest, scene_revision_digest: digest,
  task_spec_digest: digest, success_contract_digest: digest, robot_model_digest: digest,
  policy_interface_id: z.enum(["openpi_droid_https.v1", "blueprint_policy_https.v1"]),
}).strict();

const projectionSchema = z.object({
  evidence_scope: z.literal("simulation"), capture_id: identity, scene_revision_digest: digest,
  registration_receipt_digest: digest, fidelity_review_receipt_digest: digest,
}).strict();

const checkSchema = z.object({
  id: safeLabel, dimension, unit: safeLabel, sample_count: safePositiveInteger,
  max_abs_error: nonnegative, rms_error: nonnegative,
  maximum_absolute_error: nonnegative, maximum_rms_error: nonnegative,
}).strict().superRefine((check, ctx) => {
  if (check.max_abs_error > check.maximum_absolute_error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["max_abs_error"], message: "measured error exceeds the frozen maximum_absolute_error" });
  }
  if (check.rms_error > check.maximum_rms_error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rms_error"], message: "measured error exceeds the frozen maximum_rms_error" });
  }
});

function measurementReceiptSchema<T extends string>(version: T, dimensions: ReadonlyArray<z.infer<typeof dimension>>) {
  return z.object({
    schema_version: z.literal(version), binding: bindingSchema,
    request_digest: digest, profile_digest: digest,
    source_measurement_digest: digest, simulator_measurement_digest: digest,
    checks: z.array(checkSchema).min(3).max(1000), receipt_digest: digest,
  }).strict().superRefine((receipt, ctx) => {
    const actual = new Set(receipt.checks.map(check => check.dimension));
    if (actual.size !== dimensions.length || dimensions.some(required => !actual.has(required))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checks"], message: `checks must cover exactly these dimensions: ${dimensions.join(", ")}` });
    }
    if (!matchesCrossRuntimeArtifactDigest(receipt, "receipt_digest")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["receipt_digest"], message: "receipt_digest does not match the canonical measured receipt" });
    }
  });
}

const registrationReceiptSchema = measurementReceiptSchema("blueprint.site_task_registration.v1", ["scale", "registration", "collision"]);
const fidelityReceiptSchema = measurementReceiptSchema("blueprint.site_task_fidelity_review.v1", ["task_state", "observation", "task_dynamics"]);

export const siteTaskQualificationReceiptSchema = z.object({
  schema_version: z.literal("blueprint.site_task_simulation_qualification.v1"), evidence_scope: z.literal("simulation"),
  binding: bindingSchema, qualification: projectionSchema,
  registration_receipt: registrationReceiptSchema, fidelity_review_receipt: fidelityReceiptSchema,
  source_artifacts: z.array(z.object({
    role: sourceRole, uri: z.string().min(1).max(4096).regex(/^(gs|s3|https):\/\//), sha256: digest,
    size_bytes: safePositiveInteger,
  }).strict()).length(8),
  request_digest: digest, profile_digest: digest, review_digest: digest, authority_digest: digest,
  reviewed_by: identity, reviewed_at_iso: z.string().datetime(), expires_at_iso: z.string().datetime(),
  physical_performance_claimed: z.literal(false), adp_qualified_evidence_eligible: z.literal(false), receipt_digest: digest,
}).strict().superRefine((receipt, ctx) => {
  const issue = (path: Array<string | number>, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if (!matchesCrossRuntimeArtifactDigest(receipt, "receipt_digest")) {
    issue(["receipt_digest"], "receipt_digest does not match the complete canonical qualification receipt");
  }
  if (Date.parse(receipt.expires_at_iso) <= Date.parse(receipt.reviewed_at_iso)) {
    issue(["expires_at_iso"], "expires_at_iso must be after reviewed_at_iso");
  }
  if (new Set(receipt.source_artifacts.map(source => source.role)).size !== 8) {
    issue(["source_artifacts"], "source_artifacts must retain every source role exactly once");
  }
  const sourceHashes = new Map(receipt.source_artifacts.map(source => [source.role, source.sha256]));
  if (sourceHashes.get("robot_model") !== receipt.binding.robot_model_digest) {
    issue(["binding", "robot_model_digest"], "robot_model_digest must match the retained robot model bytes");
  }
  for (const field of ["registration_receipt", "fidelity_review_receipt"] as const) {
    const measured = receipt[field];
    if (crossRuntimeCanonicalJson(measured.binding) !== crossRuntimeCanonicalJson(receipt.binding)) {
      issue([field, "binding"], "contained binding must match the qualification binding");
    }
    for (const pin of ["request_digest", "profile_digest"] as const) {
      if (measured[pin] !== receipt[pin]) issue([field, pin], `${pin} must match the qualification receipt`);
    }
    if (measured.source_measurement_digest !== sourceHashes.get("measurement")) {
      issue([field, "source_measurement_digest"], "source_measurement_digest must match the retained measurement bytes");
    }
    if (measured.simulator_measurement_digest !== sourceHashes.get("simulator_measurement")) {
      issue([field, "simulator_measurement_digest"], "simulator_measurement_digest must match the retained simulator measurement bytes");
    }
  }
  const checks = [...receipt.registration_receipt.checks, ...receipt.fidelity_review_receipt.checks];
  if (new Set(checks.map(check => check.id)).size !== checks.length) {
    issue(["registration_receipt", "checks"], "check IDs must be unique across both measured receipts");
  }
  for (const [field, expected] of Object.entries({
    capture_id: receipt.binding.capture_id, scene_revision_digest: receipt.binding.scene_revision_digest,
    registration_receipt_digest: receipt.registration_receipt.receipt_digest,
    fidelity_review_receipt_digest: receipt.fidelity_review_receipt.receipt_digest,
  })) {
    if (receipt.qualification[field as keyof typeof receipt.qualification] !== expected) {
      issue(["qualification", field], `${field} must match its retained binding or measured receipt`);
    }
  }
});

export type SiteTaskQualificationReceipt = z.infer<typeof siteTaskQualificationReceiptSchema>;

export function validateSiteTaskQualificationReceipt(value: unknown): SiteTaskQualificationReceipt {
  return siteTaskQualificationReceiptSchema.parse(value);
}

/** Called only after route authentication. Immutable digest-addressed storage
 * preserves the complete portable JSON; identical canonical retries are safe.
 */
export async function publishSiteTaskQualificationReceipt(
  value: unknown,
  database: Pick<Firestore, "collection"> | null,
): Promise<{ created: boolean; receiptDigest: string }> {
  const receipt = validateSiteTaskQualificationReceipt(value);
  // The authenticated route supplies its configured store. There is no hidden
  // Firebase/ADC fallback, including when concurrent tests inject a fake store.
  if (!database) throw new Error("site_task_qualification_database_unavailable");
  const ref = database.collection("siteTaskQualifications").doc(receipt.receipt_digest.slice(7));
  try {
    await ref.create({ receipt, publishedAtIso: new Date().toISOString() });
    return { created: true, receiptDigest: receipt.receipt_digest };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code !== 6 && code !== "already-exists" && code !== "ALREADY_EXISTS") throw error;
  }
  const prior = await ref.get();
  try {
    if (prior.exists && crossRuntimeCanonicalJson(prior.data()?.receipt) === crossRuntimeCanonicalJson(receipt)) {
      return { created: false, receiptDigest: receipt.receipt_digest };
    }
  } catch { /* A corrupt retained record is a conflict, never an overwrite. */ }
  throw new Error("site_task_qualification_receipt_conflict");
}
