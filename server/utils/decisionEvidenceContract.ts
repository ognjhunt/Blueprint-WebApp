import { z } from "zod";

export const DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION =
  "blueprint.decision_evidence_request.v1" as const;
export const DECISION_ENVELOPE_SCHEMA_VERSION =
  "blueprint.decision_envelope.v1" as const;
export const PHYSICAL_OUTCOME_JOIN_SCHEMA_VERSION =
  "blueprint.physical_outcome_join.v1" as const;
export const DECISION_EVIDENCE_ROUTING_AUTHORITY =
  "BlueprintCapturePipeline" as const;

export const DECISION_EVIDENCE_RUN_STATES = [
  "draft",
  "submitted",
  "accepted",
  "planning",
  "awaiting_authorization",
  "running",
  "aggregating",
  "decision_available",
  "abstained",
  "blocked",
  "failed",
  "superseded",
] as const;

export type DecisionEvidenceRunState =
  (typeof DECISION_EVIDENCE_RUN_STATES)[number];

const sha256Schema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/i, "must be a sha256:<64 hex characters> digest");
const nonEmptyString = z.string().trim().min(1);
const optionalUri = z.string().trim().min(1).optional();

const artifactReferenceSchema = z
  .object({
    artifact_id: nonEmptyString,
    kind: nonEmptyString,
    uri: nonEmptyString,
    version: nonEmptyString,
    digest_sha256: sha256Schema,
    evidence_class: z.enum([
      "fixture",
      "geometry",
      "real_observation",
      "traditional_simulation",
      "world_model",
      "provider_tool",
      "physical",
    ]),
  })
  .strict();

const testbedReferenceSchema = z
  .object({
    testbed_id: nonEmptyString,
    version: nonEmptyString,
    digest_sha256: sha256Schema,
    manifest_uri: optionalUri,
  })
  .strict();

const candidateReferenceSchema = z
  .object({
    candidate_id: nonEmptyString,
    kind: z.enum(["robot", "policy", "checkpoint", "other"]),
    label: nonEmptyString,
    reference: z
      .object({
        external_id: nonEmptyString.optional(),
        uri: optionalUri,
        digest_sha256: sha256Schema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (
      !candidate.reference.external_id &&
      !candidate.reference.uri &&
      !candidate.reference.digest_sha256
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reference"],
        message: "candidate reference requires external_id, uri, or digest_sha256",
      });
    }
  });

export const decisionEvidenceRequestSchema = z
  .object({
    schema_version: z.literal(DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION),
    request_id: nonEmptyString,
    decision_id: nonEmptyString,
    testbed: testbedReferenceSchema,
    decision_question: nonEmptyString,
    site_task: z
      .object({
        site_id: nonEmptyString,
        site_name: nonEmptyString.optional(),
        task_id: nonEmptyString,
        task_description: nonEmptyString,
        conditions: z.array(nonEmptyString).min(1),
      })
      .strict(),
    candidates: z.array(candidateReferenceSchema).default([]),
    claims: z
      .array(
        z
          .object({
            claim_id: nonEmptyString,
            statement: nonEmptyString,
            threshold_ids: z.array(nonEmptyString).default([]),
          })
          .strict(),
      )
      .min(1),
    thresholds: z
      .array(
        z
          .object({
            threshold_id: nonEmptyString,
            metric: nonEmptyString,
            operator: z.enum(["lt", "lte", "eq", "gte", "gt", "inside", "outside"]),
            value: z.union([z.number().finite(), nonEmptyString]),
            unit: nonEmptyString,
          })
          .strict(),
      )
      .default([]),
    false_safe: z
      .object({
        severity: z.enum(["low", "moderate", "high", "critical"]),
        consequence: nonEmptyString,
      })
      .strict(),
    confidence_requirement: z
      .object({
        kind: z.enum([
          "acceptable_risk",
          "max_failure_probability",
          "confidence_level",
          "qualitative",
        ]),
        value: z.union([z.number().finite(), nonEmptyString]).optional(),
        unit: nonEmptyString.optional(),
        description: nonEmptyString,
      })
      .strict(),
    constraints: z
      .object({
        budget: z
          .object({
            amount: z.number().finite().nonnegative().optional(),
            currency: z.string().regex(/^[A-Z]{3}$/),
            hard_cap: z.boolean(),
          })
          .strict(),
        deadline: z.string().datetime({ offset: true }).optional(),
        available_physical_evidence: z.array(artifactReferenceSchema).default([]),
        allowed_site_changes: z.array(nonEmptyString).default([]),
        physical_testing_possible: z.boolean(),
        rights_privacy_provider_restrictions: z.array(nonEmptyString).default([]),
      })
      .strict(),
    requested_audience: z.array(
      z.enum(["robot_team", "site_operator", "safety_reviewer", "executive", "technical"]),
    ).min(1),
    routing_authority: z
      .object({
        system: z.literal(DECISION_EVIDENCE_ROUTING_AUTHORITY),
        method_selection: z.literal("pipeline_qualified_least_cost_sufficient_evidence"),
        webapp_backend_selection_allowed: z.literal(false),
      })
      .strict(),
    idempotency: z
      .object({
        key: nonEmptyString.max(200),
        scope: z.literal("authenticated_owner_and_decision"),
      })
      .strict(),
    provenance: z
      .object({
        source_system: z.literal("Blueprint-WebApp"),
        source_route: nonEmptyString,
        submitted_at_iso: z.string().datetime({ offset: true }),
        request_contract_source: z.literal("pipeline_proposed_mirror"),
      })
      .strict(),
    owner: z
      .object({
        user_id: nonEmptyString,
        tenant_id: nonEmptyString.optional(),
        authenticated_by: z.literal("firebase"),
      })
      .strict(),
    authorization: z
      .object({
        entitlement_id: nonEmptyString.optional(),
        access_state: nonEmptyString.optional(),
        verified_by: nonEmptyString.optional(),
      })
      .strict()
      .optional(),
    commercial: z
      .object({
        engagement: z.literal("scoped_task_evaluation_run"),
        quote_required: z.literal(true),
        client_supplied_price: z.literal(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((request, context) => {
    const thresholdIds = new Set(request.thresholds.map((threshold) => threshold.threshold_id));
    for (const [claimIndex, claim] of request.claims.entries()) {
      for (const thresholdId of claim.threshold_ids) {
        if (!thresholdIds.has(thresholdId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["claims", claimIndex, "threshold_ids"],
            message: `unknown threshold_id ${thresholdId}`,
          });
        }
      }
    }
  });

const decisionOutcomeSchema = z.enum([
  "bounded_positive",
  "bounded_negative",
  "partial",
  "abstained",
  "blocked",
  "failed",
]);

export const decisionEnvelopeSchema = z
  .object({
    schema_version: z.literal(DECISION_ENVELOPE_SCHEMA_VERSION),
    request_id: nonEmptyString,
    decision_id: nonEmptyString,
    state: z.enum(DECISION_EVIDENCE_RUN_STATES),
    requested_decision: nonEmptyString,
    testbed: testbedReferenceSchema,
    overall: z
      .object({
        outcome: decisionOutcomeSchema,
        summary: nonEmptyString,
        decided_claim_ids: z.array(nonEmptyString),
        unresolved_claim_ids: z.array(nonEmptyString),
        selected_candidate_ids: z.array(nonEmptyString).default([]),
      })
      .strict(),
    claim_outcomes: z.array(
      z
        .object({
          claim_id: nonEmptyString,
          statement: nonEmptyString,
          outcome: z.enum(["supported", "not_supported", "inconclusive", "unsupported"]),
          conclusion: nonEmptyString,
          evidence_ref_ids: z.array(nonEmptyString),
          uncertainty: nonEmptyString,
          physical_evidence_required: z.boolean(),
        })
        .strict(),
    ),
    evidence_methods: z.array(
      z
        .object({
          method_id: nonEmptyString,
          evidence_class: z.enum([
            "fixture",
            "geometry",
            "real_observation",
            "traditional_simulation",
            "world_model",
            "provider_tool",
            "physical",
          ]),
          name: nonEmptyString,
          selection_reason: nonEmptyString,
          qualification_profile_ref: artifactReferenceSchema,
          measured: z.array(nonEmptyString),
        })
        .strict(),
    ),
    validation_envelope: z
      .object({
        supported_conditions: z.array(nonEmptyString),
        unsupported_conditions: z.array(nonEmptyString),
        method_profile_versions: z.array(nonEmptyString),
      })
      .strict(),
    coverage: z
      .object({
        evaluated_claim_ids: z.array(nonEmptyString),
        unresolved_claim_ids: z.array(nonEmptyString),
        summary: nonEmptyString,
      })
      .strict(),
    uncertainty: z
      .object({
        summary: nonEmptyString,
        sources: z.array(nonEmptyString),
      })
      .strict(),
    disagreements: z
      .object({
        summary: nonEmptyString,
        items: z.array(
          z
            .object({
              claim_id: nonEmptyString,
              description: nonEmptyString,
              evidence_ref_ids: z.array(nonEmptyString),
            })
            .strict(),
        ),
        correlated_evidence_warning: nonEmptyString.optional(),
      })
      .strict(),
    claim_ceiling: z
      .object({
        level: nonEmptyString,
        summary: nonEmptyString,
        prohibited_claims: z.array(nonEmptyString),
      })
      .strict(),
    next_cheapest_experiment: z
      .object({
        description: nonEmptyString,
        rationale: nonEmptyString,
        estimated_cost: nonEmptyString.optional(),
        estimated_time: nonEmptyString.optional(),
        physical_required: z.boolean(),
      })
      .strict(),
    physical_evidence: z
      .object({
        required: z.boolean(),
        reasons: z.array(nonEmptyString),
        authoritative_join_ids: z.array(nonEmptyString).default([]),
      })
      .strict(),
    consumption: z
      .object({
        cost: nonEmptyString.optional(),
        elapsed_time: nonEmptyString.optional(),
      })
      .strict()
      .optional(),
    artifacts: z.array(artifactReferenceSchema),
    permitted_evidence_uses: z
      .object({
        evaluation: z.boolean(),
        post_training: z.boolean(),
        reason: nonEmptyString,
        qualifying_artifact_ids: z.array(nonEmptyString),
        training_performed: z.literal(false),
        policy_improved: z.literal(false),
      })
      .strict(),
    supersession: z
      .object({
        superseded_by_decision_id: nonEmptyString,
        reason: nonEmptyString,
      })
      .strict()
      .optional(),
    provenance: z
      .object({
        pipeline_run_id: nonEmptyString,
        generated_at_iso: z.string().datetime({ offset: true }),
        contract_source: z.literal("BlueprintCapturePipeline"),
      })
      .strict(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.overall.outcome === "abstained" && result.overall.selected_candidate_ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overall", "selected_candidate_ids"],
        message: "an abstained result must not select or infer a winner",
      });
    }
    if (result.state === "abstained" && result.overall.outcome !== "abstained") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overall", "outcome"],
        message: "state abstained requires overall outcome abstained",
      });
    }
    const artifactIds = new Set(result.artifacts.map((artifact) => artifact.artifact_id));
    for (const artifactId of result.permitted_evidence_uses.qualifying_artifact_ids) {
      if (!artifactIds.has(artifactId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["permitted_evidence_uses", "qualifying_artifact_ids"],
          message: `unknown qualifying artifact ${artifactId}`,
        });
      }
    }
  });

export type DecisionEvidenceRequest = z.infer<typeof decisionEvidenceRequestSchema>;
export type DecisionEnvelope = z.infer<typeof decisionEnvelopeSchema>;

export const physicalOutcomeJoinSchema = z
  .object({
    schema_version: z.literal(PHYSICAL_OUTCOME_JOIN_SCHEMA_VERSION),
    join_id: nonEmptyString,
    request_id: nonEmptyString,
    decision_id: nonEmptyString,
    testbed: testbedReferenceSchema,
    physical_artifact: artifactReferenceSchema.refine(
      (artifact) => artifact.evidence_class === "physical",
      "physical outcome evidence_class must be physical",
    ),
    observed_claim_ids: z.array(nonEmptyString).min(1),
    outcome_summary: nonEmptyString,
    authoritative_source: z
      .object({
        system: nonEmptyString,
        event_id: nonEmptyString,
        captured_at_iso: z.string().datetime({ offset: true }),
      })
      .strict(),
    method_recalibration_allowed: z.literal(false),
  })
  .strict();

export type PhysicalOutcomeJoin = z.infer<typeof physicalOutcomeJoinSchema>;

const SENSITIVE_KEY_PATTERN =
  /(^|_)(secret|token|password|private_key|api_key|raw_weights|policy_weights)($|_)/i;

function findSensitivePaths(value: unknown, path: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSensitivePaths(item, [...path, String(index)]));
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const nextPath = [...path, key];
    return [
      ...(SENSITIVE_KEY_PATTERN.test(key) ? [nextPath.join(".")] : []),
      ...findSensitivePaths(child, nextPath),
    ];
  });
}

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`);
}

export function validateDecisionEvidenceRequest(value: unknown) {
  const result = decisionEvidenceRequestSchema.safeParse(value);
  const errors = result.success ? [] : formatIssues(result.error);
  const sensitivePaths = findSensitivePaths(value);
  if (sensitivePaths.length) {
    errors.push(`client secrets or raw policy weights are not allowed: ${sensitivePaths.join(", ")}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    request: result.success && errors.length === 0 ? result.data : null,
  };
}

export function validateDecisionEnvelope(value: unknown) {
  const result = decisionEnvelopeSchema.safeParse(value);
  return {
    ok: result.success,
    errors: result.success ? [] : formatIssues(result.error),
    envelope: result.success ? result.data : null,
  };
}

export function projectDecisionEnvelope(value: unknown):
  | { supported: true; envelope: DecisionEnvelope }
  | { supported: false; reason: string; raw_state: string | null } {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const rawState = typeof raw.state === "string" ? raw.state : null;
  if (
    rawState &&
    !(DECISION_EVIDENCE_RUN_STATES as readonly string[]).includes(rawState)
  ) {
    return {
      supported: false,
      reason: `Unsupported Pipeline run state: ${rawState}`,
      raw_state: rawState,
    };
  }
  const parsed = validateDecisionEnvelope(value);
  if (!parsed.ok || !parsed.envelope) {
    return {
      supported: false,
      reason: `Unsupported or invalid Pipeline decision envelope: ${parsed.errors.join("; ")}`,
      raw_state: rawState,
    };
  }
  return { supported: true, envelope: parsed.envelope };
}

export function decisionRequestIdentity(value: Record<string, unknown>) {
  const isDecisionRequest =
    value.schema_version === DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION;
  const requestId = String(
    (isDecisionRequest ? value.request_id : value.job_id) || "",
  ).trim();
  const decisionId = String(
    (isDecisionRequest ? value.decision_id : value.buyer_request_id) || requestId,
  ).trim();
  return { isDecisionRequest, requestId, decisionId };
}

export type DecisionRequestNormalizationResult =
  | {
      ok: true;
      request: DecisionEvidenceRequest;
      compatibility: "native" | "translated_robot_eval_job_request_v1";
    }
  | {
      ok: false;
      code: string;
      errors: string[];
    };

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function legacyMigrationError(code: string, message: string): DecisionRequestNormalizationResult {
  return { ok: false, code, errors: [message] };
}

export function normalizeDecisionEvidenceRequest(params: {
  value: unknown;
  authenticatedUserId: string;
  authenticatedTenantId?: string | null;
  sourceRoute: string;
  receivedAtIso: string;
}): DecisionRequestNormalizationResult {
  const raw = objectValue(params.value);
  if (raw.schema_version === DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION) {
    const normalized = {
      ...raw,
      provenance: {
        source_system: "Blueprint-WebApp",
        source_route: params.sourceRoute,
        submitted_at_iso: params.receivedAtIso,
        request_contract_source: "pipeline_proposed_mirror",
      },
      owner: {
        user_id: params.authenticatedUserId,
        ...(params.authenticatedTenantId
          ? { tenant_id: params.authenticatedTenantId }
          : {}),
        authenticated_by: "firebase",
      },
      commercial: {
        engagement: "scoped_task_evaluation_run",
        quote_required: true,
        client_supplied_price: false,
      },
    };
    const validation = validateDecisionEvidenceRequest(normalized);
    return validation.ok && validation.request
      ? { ok: true, request: validation.request, compatibility: "native" }
      : {
          ok: false,
          code: "invalid_decision_evidence_request",
          errors: validation.errors,
        };
  }

  if (raw.schema_version !== "robot_eval_job_request.v1") {
    return legacyMigrationError(
      "unsupported_request_contract",
      `schema_version must be ${DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION} or robot_eval_job_request.v1`,
    );
  }

  const serialized = JSON.stringify(raw);
  if (
    /Policy Shortlist|Robot Match|Policy Improvement Run|Post-Training Data Package/i.test(
      serialized,
    )
  ) {
    return legacyMigrationError(
      "legacy_commercial_intent_requires_manual_migration",
      "Legacy paid or customer-visible product intent cannot be silently reinterpreted. Resubmit it as a scoped Task Evaluation Run decision request.",
    );
  }

  const sitePackage = objectValue(raw.site_package);
  const testbedDigest = textValue(
    sitePackage.testbed_digest_sha256 ||
      sitePackage.package_digest_sha256 ||
      sitePackage.manifest_sha256,
  );
  if (!testbedDigest) {
    return legacyMigrationError(
      "legacy_testbed_digest_required",
      "Legacy robot_eval_job_request.v1 migration requires site_package.testbed_digest_sha256 (or package_digest_sha256/manifest_sha256).",
    );
  }
  const decisionQuestion = textValue(raw.decision_question);
  if (!decisionQuestion) {
    return legacyMigrationError(
      "legacy_decision_question_required",
      "Legacy robot_eval_job_request.v1 migration requires an explicit decision_question; WebApp will not infer customer intent from simulator fields.",
    );
  }
  if (!Array.isArray(raw.claims) || raw.claims.length === 0) {
    return legacyMigrationError(
      "legacy_claims_required",
      "Legacy robot_eval_job_request.v1 migration requires an explicit claims list.",
    );
  }
  if (!Array.isArray(raw.thresholds)) {
    return legacyMigrationError(
      "legacy_thresholds_required",
      "Legacy robot_eval_job_request.v1 migration requires explicit thresholds and units (an empty array is allowed).",
    );
  }

  const source = objectValue(raw.source);
  const selectionState = objectValue(source.selection_state);
  const requestedTasks = Array.isArray(raw.requested_tasks)
    ? raw.requested_tasks.map(objectValue)
    : [];
  const firstTask = requestedTasks[0] || {};
  const taskId =
    textValue(firstTask.task_id) || textValue(selectionState.task_id) || "legacy-task";
  const policyId = textValue(selectionState.policy_id);
  const legacyFalseSafe = objectValue(raw.false_safe);
  const legacyConfidence = objectValue(raw.confidence_requirement);
  const legacyConstraints = objectValue(raw.constraints);
  const legacyBudget = objectValue(legacyConstraints.budget || raw.budget);
  const legacyAuthorization = objectValue(raw.entitlement);
  const requestId = textValue(raw.job_id);
  const decisionId = textValue(raw.buyer_request_id) || requestId;

  const translated = {
    schema_version: DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION,
    request_id: requestId,
    decision_id: decisionId,
    testbed: {
      testbed_id:
        textValue(sitePackage.testbed_id) ||
        textValue(sitePackage.site_id) ||
        textValue(sitePackage.site_slug),
      version:
        textValue(sitePackage.testbed_version) ||
        textValue(sitePackage.package_version) ||
        "legacy-unversioned",
      digest_sha256: testbedDigest,
      ...(textValue(sitePackage.package_uri)
        ? { manifest_uri: textValue(sitePackage.package_uri) }
        : {}),
    },
    decision_question: decisionQuestion,
    site_task: {
      site_id: textValue(sitePackage.site_id) || textValue(sitePackage.site_slug),
      ...(textValue(sitePackage.site_name)
        ? { site_name: textValue(sitePackage.site_name) }
        : {}),
      task_id: taskId,
      task_description: textValue(raw.task_description) || taskId,
      conditions:
        Array.isArray(raw.site_task_conditions) && raw.site_task_conditions.length
          ? raw.site_task_conditions.map(String)
          : ["legacy request; conditions require review"],
    },
    candidates: policyId
      ? [
          {
            candidate_id: policyId,
            kind: "policy",
            label: policyId,
            reference: { external_id: policyId },
          },
        ]
      : [],
    claims: raw.claims,
    thresholds: raw.thresholds,
    false_safe: {
      severity: textValue(legacyFalseSafe.severity) || "high",
      consequence:
        textValue(legacyFalseSafe.consequence) ||
        "Legacy request did not record the false-safe consequence; manual review is required.",
    },
    confidence_requirement: {
      kind: textValue(legacyConfidence.kind) || "qualitative",
      ...(legacyConfidence.value !== undefined
        ? { value: legacyConfidence.value }
        : {}),
      ...(textValue(legacyConfidence.unit)
        ? { unit: textValue(legacyConfidence.unit) }
        : {}),
      description:
        textValue(legacyConfidence.description) ||
        "Legacy confidence requirement requires manual review.",
    },
    constraints: {
      budget: {
        ...(typeof legacyBudget.amount === "number"
          ? { amount: legacyBudget.amount }
          : typeof legacyBudget.budget_usd === "number"
            ? { amount: legacyBudget.budget_usd }
            : {}),
        currency: textValue(legacyBudget.currency) || "USD",
        hard_cap: legacyBudget.hard_cap !== false,
      },
      ...(textValue(legacyConstraints.deadline)
        ? { deadline: textValue(legacyConstraints.deadline) }
        : {}),
      available_physical_evidence: Array.isArray(
        legacyConstraints.available_physical_evidence,
      )
        ? legacyConstraints.available_physical_evidence
        : [],
      allowed_site_changes: Array.isArray(legacyConstraints.allowed_site_changes)
        ? legacyConstraints.allowed_site_changes.map(String)
        : [],
      physical_testing_possible:
        legacyConstraints.physical_testing_possible === true,
      rights_privacy_provider_restrictions: Array.isArray(
        legacyConstraints.rights_privacy_provider_restrictions,
      )
        ? legacyConstraints.rights_privacy_provider_restrictions.map(String)
        : [],
    },
    requested_audience: Array.isArray(raw.requested_audience)
      ? raw.requested_audience
      : ["technical"],
    routing_authority: {
      system: DECISION_EVIDENCE_ROUTING_AUTHORITY,
      method_selection: "pipeline_qualified_least_cost_sufficient_evidence",
      webapp_backend_selection_allowed: false,
    },
    idempotency: {
      key: textValue(raw.idempotency_key) || requestId,
      scope: "authenticated_owner_and_decision",
    },
    provenance: {
      source_system: "Blueprint-WebApp",
      source_route: params.sourceRoute,
      submitted_at_iso: params.receivedAtIso,
      request_contract_source: "pipeline_proposed_mirror",
    },
    owner: {
      user_id: params.authenticatedUserId,
      ...(params.authenticatedTenantId
        ? { tenant_id: params.authenticatedTenantId }
        : {}),
      authenticated_by: "firebase",
    },
    ...(textValue(legacyAuthorization.entitlement_id)
      ? {
          authorization: {
            entitlement_id: textValue(legacyAuthorization.entitlement_id),
          },
        }
      : {}),
    commercial: {
      engagement: "scoped_task_evaluation_run",
      quote_required: true,
      client_supplied_price: false,
    },
  };

  const validation = validateDecisionEvidenceRequest(translated);
  return validation.ok && validation.request
    ? {
        ok: true,
        request: validation.request,
        compatibility: "translated_robot_eval_job_request_v1",
      }
    : {
        ok: false,
        code: "legacy_request_translation_invalid",
        errors: validation.errors,
      };
}
