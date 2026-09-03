import { z } from "zod";

import { canonicalArtifactDigest, stableJson } from "./taskCandidateContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const nonEmpty = z.string().trim().min(1).max(512);
const jsonRecord = z.record(z.string(), z.unknown());
const scoreDocumentSchema = z.object({
  status: nonEmpty,
  outcome: nonEmpty,
  task_succeeded: z.boolean(),
  report_digest: digest,
}).passthrough();
const correctedScoreDocumentSchema = scoreDocumentSchema.extend({
  task_success_contract: jsonRecord,
  task_success_contract_digest: digest,
  criteria_satisfied: z.record(z.string(), z.boolean()),
  failed_criteria: z.array(nonEmpty),
  failure_reason_plain_english: nonEmpty.nullable(),
  measurements: jsonRecord,
  event_ledger: z.object({
    schema_version: z.literal("rigid_task_event_ledger.v1"),
    drop_events: z.array(jsonRecord),
    peak_task_contact_force_n: z.number().finite().nonnegative().nullable(),
    task_contact_force_sources: z.array(nonEmpty),
    observed_contact_classes: z.array(nonEmpty),
    observed_forbidden_contact_classes: z.array(nonEmpty),
    containment_excursion_steps: z.array(z.number().int().nonnegative()),
    workspace_excursion_steps: z.array(z.number().int().nonnegative()),
    maximum_retries_observed: z.number().int().nonnegative().nullable(),
    maximum_regrasps_observed: z.number().int().nonnegative().nullable(),
    required_readback_gaps: z.array(nonEmpty),
    derived_only_from_episode_samples: z.literal(true),
  }).strict(),
}).passthrough();

const scorerIdentitySchema = z.object({
  schema_version: z.literal("task_evaluation_deterministic_scorer_identity.v1"),
  scorer: z.literal("blueprint_pipeline.adp_task_scoring.score_task_episode_from_spec"),
  scorer_commit: z.string().regex(/^[0-9a-f]{40}$/),
  source_files: z.array(z.object({ path: nonEmpty, sha256: digest }).strict()).min(1),
  source_files_digest: digest,
  scoring_version_digest: digest,
}).strict();

const receiptDescriptorSchema = z.object({
  relative_path: z.string().regex(/^episodes\/[0-9]{2}\.json$/),
  sha256: digest,
  size_bytes: z.number().int().positive(),
  receipt_digest: digest,
}).strict();

const scoreUpdateSchema = z.object({
  candidate_id: identifier,
  cell_id: identifier,
  seed: z.number().int().nonnegative(),
  source_episode_identity_digest: digest,
  source_evidence_artifact_bindings_digest: digest,
  old_score_digest: digest,
  new_score_digest: digest,
  new_score: correctedScoreDocumentSchema,
  success_contract_digest: digest,
  scoring_version_digest: digest,
  derived_rescore_receipt: receiptDescriptorSchema,
}).strict();

const publicationConstraintsSchema = z.object({
  source_status: z.literal("completed_unqualified"),
  corrected_status: z.literal("completed_unqualified"),
  episode_identity_must_be_unchanged: z.literal(true),
  artifact_inventory_must_be_unchanged: z.literal(true),
  original_provider_result_must_be_retained: z.literal(true),
  original_score_receipts_must_be_retained: z.literal(true),
  allowed_score_overlay_fields: z.tuple([
    z.literal("episode.score"),
    z.literal("deterministic_score_digest"),
    z.literal("scoring_version_digest"),
  ]),
  correction_authority: z.literal("derived_deterministic_rescore_receipt"),
}).strict();

export const policyCanaryScoreCorrectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_score_correction.v1"),
  status: z.literal("completed_unqualified_score_correction_ready"),
  correction_id: z.string().regex(/^[0-9a-f]{24}$/),
  source_run_id: identifier,
  source_result_status: z.literal("completed_unqualified"),
  corrected_result_status: z.literal("completed_unqualified"),
  source_result_digest: digest,
  source_result_file_sha256: digest,
  source_artifact_inventory_digest: digest,
  source_episode_identity_set_digest: digest,
  source_score_set_digest: digest,
  corrected_score_set_digest: digest,
  success_contract_set_digest: digest,
  scorer_identity: scorerIdentitySchema,
  scoring_version_digest: digest,
  episode_count: z.literal(20),
  score_updates: z.array(scoreUpdateSchema).length(20),
  publication_constraints: publicationConstraintsSchema,
  correction_digest: digest,
}).strict();

const rescoreReceiptSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_rescore_episode.v1"),
  status: z.literal("rescored"),
  derived_only: z.literal(true),
  source_run_id: identifier,
  source_result_digest: digest,
  source_result_file_sha256: digest,
  candidate_id: identifier,
  cell_id: identifier,
  seed: z.number().int().nonnegative(),
  source_episode_identity_digest: digest,
  source_episode_digest: digest,
  source_episode_receipt_digest: digest,
  source_evidence_artifact_bindings_digest: digest,
  task_spec_digest: digest,
  success_contract_digest: digest,
  state_trace_digest: digest,
  old_score_digest: digest,
  new_score_digest: digest,
  old_score: scoreDocumentSchema,
  new_score: correctedScoreDocumentSchema,
  scorer_commit: z.string().regex(/^[0-9a-f]{40}$/),
  scorer_source_files_digest: digest,
  scoring_version_digest: digest,
  original_provider_output_overwritten: z.literal(false),
  original_score_receipt_overwritten: z.literal(false),
  receipt_digest: digest,
}).strict();

const policyCanaryScoreCorrectionIngestV1Schema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_score_correction_ingest.v1"),
  source_binding: z.object({
    run_id: identifier,
    record_id: identifier,
    policy_canary_projection_digest: digest,
    result_delivery_digest: digest,
  }).strict(),
  correction: policyCanaryScoreCorrectionSchema,
  derived_rescore_receipts: z.array(rescoreReceiptSchema).length(20),
  ingest_digest: digest,
}).strict();

const policyCanaryScoreCorrectionIngestV2Schema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_score_correction_ingest.v2"),
  source_binding: z.object({
    run_id: identifier,
    record_id: identifier,
    policy_canary_projection_digest: digest,
    result_delivery_digest: digest,
  }).strict(),
  successor: z.object({
    correction_sequence: z.number().int().min(2).max(9),
    supersedes_correction_digest: digest,
    supersedes_sidecar_digest: digest,
    supersedes_scoring_version_digest: digest,
  }).strict(),
  correction: policyCanaryScoreCorrectionSchema,
  derived_rescore_receipts: z.array(rescoreReceiptSchema).length(20),
  ingest_digest: digest,
}).strict();

export const policyCanaryScoreCorrectionIngestSchema = z.discriminatedUnion(
  "schema_version",
  [policyCanaryScoreCorrectionIngestV1Schema, policyCanaryScoreCorrectionIngestV2Schema],
);

export type PolicyCanaryScoreCorrection = z.infer<typeof policyCanaryScoreCorrectionSchema>;
export type PolicyCanaryScoreCorrectionIngest = z.infer<
  typeof policyCanaryScoreCorrectionIngestSchema
>;

export type VerifiedPolicyCanaryScoreCorrectionSidecar = {
  schema_version: "task_evaluation_policy_canary_score_correction_sidecar.v1";
  correction: PolicyCanaryScoreCorrection;
  source_binding: {
    run_id: string;
    record_id: string;
    source_result_digest: string;
    source_result_file_sha256: string;
    source_artifact_inventory_digest: string;
    source_projection_digest: string;
    source_delivery_digest: string;
  };
  audit: {
    verified_at_iso: string;
    ingest_digest: string;
    original_publication_preserved: true;
    original_score_receipts_preserved: true;
    corrected_result_status: "completed_unqualified";
    winner_declared: false;
    correction_sequence?: number;
    supersedes_correction_digest?: string | null;
    supersedes_sidecar_digest?: string | null;
    supersedes_scoring_version_digest?: string | null;
  };
  sidecar_digest: string;
};

function key(value: Record<string, any>) {
  return `${value.candidate_id}\0${value.cell_id}\0${value.seed}`;
}

function sameJson(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right);
}

function publicationEpisodeKey(value: Record<string, any>) {
  return key({
    candidate_id: value.candidate_id ?? value.policy_candidate_id,
    cell_id: value.cell_id ?? value.variation?.cell_id,
    seed: value.seed ?? value.variation?.seed,
  });
}

export function verifyPolicyCanaryScoreCorrectionIngest(params: {
  payload: unknown;
  publication: Record<string, any>;
  recordId: string;
  nowIso?: string;
}) {
  const parsed = policyCanaryScoreCorrectionIngestSchema.safeParse(params.payload);
  if (!parsed.success) return {
    ok: false as const,
    code: "POLICY_CANARY_SCORE_CORRECTION_SCHEMA_INVALID",
    details: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."), message: issue.message,
    })),
  };
  const payload = parsed.data;
  const correction = payload.correction;
  if (
    canonicalArtifactDigest(payload as unknown as Record<string, unknown>, "ingest_digest")
      !== payload.ingest_digest
    || canonicalArtifactDigest(
      correction as unknown as Record<string, unknown>,
      "correction_digest",
    ) !== correction.correction_digest
    || canonicalArtifactDigest(
      correction.scorer_identity as unknown as Record<string, unknown>,
      "scoring_version_digest",
    ) !== correction.scoring_version_digest
    || canonicalArtifactDigest(
      { value: correction.scorer_identity.source_files },
      "__no_digest_field__",
    ) !== correction.scorer_identity.source_files_digest
    || correction.scoring_version_digest !== correction.scorer_identity.scoring_version_digest
    || correction.correction_id !== canonicalArtifactDigest({
      source_result_digest: correction.source_result_digest,
      source_result_file_sha256: correction.source_result_file_sha256,
      scoring_version_digest: correction.scoring_version_digest,
    }, "__no_digest_field__").slice(7, 31)
  ) return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_DIGEST_INVALID" };

  const publication = params.publication;
  const projection = publication.policy_canary_result || {};
  const delivery = publication.result_delivery || {};
  if (
    publication.schema_version !== "task_evaluation_run_publication.v4"
    || publication.run_kind !== "internal_policy_canary"
    || publication.result_status !== "completed_unqualified"
    || projection.result_status !== "completed_unqualified"
    || delivery.result_status !== "completed_unqualified"
    || delivery.status !== "ready"
    || correction.source_run_id !== publication.run_id
    || payload.source_binding.run_id !== publication.run_id
    || payload.source_binding.record_id !== params.recordId
    || payload.source_binding.policy_canary_projection_digest !== projection.projection_digest
    || payload.source_binding.result_delivery_digest !== delivery.delivery_digest
    || projection.report?.result_digest !== correction.source_result_digest
  ) return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_SOURCE_BINDING_INVALID" };

  const projectionEpisodes = Array.isArray(projection.episodes) ? projection.episodes : [];
  const deliveryEpisodes = Array.isArray(delivery.episodes) ? delivery.episodes : [];
  if (
    projectionEpisodes.length !== 20
    || deliveryEpisodes.length !== 20
  ) return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_EPISODE_COUNT_INVALID" };

  const projectionByKey = new Map<string, Record<string, any>>(projectionEpisodes.map((row: Record<string, any>) => [
    publicationEpisodeKey(row), row,
  ]));
  const deliveryByKey = new Map<string, Record<string, any>>(deliveryEpisodes.map((row: Record<string, any>) => [
    publicationEpisodeKey(row), row,
  ]));
  const receiptsByKey = new Map(payload.derived_rescore_receipts.map((row) => [key(row), row]));
  const updatesByKey = new Map(correction.score_updates.map((row) => [key(row), row]));
  if ([projectionByKey, deliveryByKey, receiptsByKey, updatesByKey]
    .some((rows) => rows.size !== 20)) {
    return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_EPISODE_IDENTITY_INVALID" };
  }
  const counts = new Map<string, number>();
  for (const update of correction.score_updates) {
    const episodeKey = key(update);
    const projectedEpisode = projectionByKey.get(episodeKey);
    const deliveredEpisode = deliveryByKey.get(episodeKey);
    const receipt = receiptsByKey.get(episodeKey);
    counts.set(update.candidate_id, (counts.get(update.candidate_id) || 0) + 1);
    if (!projectedEpisode || !deliveredEpisode || !receipt) {
      return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_EPISODE_IDENTITY_INVALID" };
    }
    const oldScore = receipt.old_score;
    if (
      !projectedEpisode.evidence?.score_receipt?.digest
      || deliveredEpisode.score?.status !== oldScore?.status
      || deliveredEpisode.score?.task_succeeded !== oldScore?.task_succeeded
      || !sameJson(receipt.new_score, update.new_score)
      || receipt.old_score_digest !== update.old_score_digest
      || receipt.new_score_digest !== update.new_score_digest
      || receipt.source_episode_identity_digest !== update.source_episode_identity_digest
      || receipt.source_evidence_artifact_bindings_digest
        !== update.source_evidence_artifact_bindings_digest
      || receipt.success_contract_digest !== update.success_contract_digest
      || update.new_score.task_success_contract_digest !== update.success_contract_digest
      || update.new_score.task_success_contract.contract_digest !== update.success_contract_digest
      || receipt.scoring_version_digest !== update.scoring_version_digest
      || receipt.source_result_digest !== correction.source_result_digest
      || receipt.source_result_file_sha256 !== correction.source_result_file_sha256
      || receipt.receipt_digest !== update.derived_rescore_receipt.receipt_digest
      || canonicalArtifactDigest(
        receipt as unknown as Record<string, unknown>,
        "receipt_digest",
      ) !== receipt.receipt_digest
    ) return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_UPDATE_BINDING_INVALID" };
  }
  if (
    counts.size !== 2
    || [...counts.values()].some((count) => count !== 10)
    || correction.score_updates.some((row) => row.scoring_version_digest !== correction.scoring_version_digest)
  ) return { ok: false as const, code: "POLICY_CANARY_SCORE_CORRECTION_CANDIDATE_COUNT_INVALID" };

  const sidecar: VerifiedPolicyCanaryScoreCorrectionSidecar = {
    schema_version: "task_evaluation_policy_canary_score_correction_sidecar.v1",
    correction,
    source_binding: {
      run_id: publication.run_id,
      record_id: params.recordId,
      source_result_digest: correction.source_result_digest,
      source_result_file_sha256: correction.source_result_file_sha256,
      source_artifact_inventory_digest: correction.source_artifact_inventory_digest,
      source_projection_digest: projection.projection_digest,
      source_delivery_digest: delivery.delivery_digest,
    },
    audit: {
      verified_at_iso: params.nowIso || new Date().toISOString(),
      ingest_digest: payload.ingest_digest,
      original_publication_preserved: true,
      original_score_receipts_preserved: true,
      corrected_result_status: "completed_unqualified",
      winner_declared: false,
      correction_sequence: payload.schema_version === "task_evaluation_policy_canary_score_correction_ingest.v2"
        ? payload.successor.correction_sequence
        : 1,
      supersedes_correction_digest: payload.schema_version === "task_evaluation_policy_canary_score_correction_ingest.v2"
        ? payload.successor.supersedes_correction_digest
        : null,
      supersedes_sidecar_digest: payload.schema_version === "task_evaluation_policy_canary_score_correction_ingest.v2"
        ? payload.successor.supersedes_sidecar_digest
        : null,
      supersedes_scoring_version_digest: payload.schema_version === "task_evaluation_policy_canary_score_correction_ingest.v2"
        ? payload.successor.supersedes_scoring_version_digest
        : null,
    },
    sidecar_digest: `sha256:${"0".repeat(64)}`,
  };
  sidecar.sidecar_digest = canonicalArtifactDigest(
    sidecar as unknown as Record<string, unknown>,
    "sidecar_digest",
  );
  return { ok: true as const, payload, sidecar };
}

export function verifiedPolicyCanaryScoreCorrectionSidecar(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sidecar = value as VerifiedPolicyCanaryScoreCorrectionSidecar;
  if (
    sidecar.schema_version !== "task_evaluation_policy_canary_score_correction_sidecar.v1"
    || sidecar.audit?.original_publication_preserved !== true
    || sidecar.audit?.original_score_receipts_preserved !== true
    || sidecar.audit?.corrected_result_status !== "completed_unqualified"
    || sidecar.audit?.winner_declared !== false
    || !Number.isInteger(sidecar.audit?.correction_sequence ?? 1)
    || (sidecar.audit?.correction_sequence ?? 1) < 1
    || (sidecar.audit?.correction_sequence ?? 1) > 9
    || ((sidecar.audit?.correction_sequence ?? 1) > 1 && (
      !/^sha256:[0-9a-f]{64}$/.test(String(sidecar.audit?.supersedes_correction_digest || ""))
      || !/^sha256:[0-9a-f]{64}$/.test(String(sidecar.audit?.supersedes_sidecar_digest || ""))
      || !/^sha256:[0-9a-f]{64}$/.test(String(sidecar.audit?.supersedes_scoring_version_digest || ""))
    ))
    || !policyCanaryScoreCorrectionSchema.safeParse(sidecar.correction).success
    || canonicalArtifactDigest(
      sidecar.correction as unknown as Record<string, unknown>,
      "correction_digest",
    ) !== sidecar.correction?.correction_digest
    || canonicalArtifactDigest(
      sidecar as unknown as Record<string, unknown>,
      "sidecar_digest",
    ) !== sidecar.sidecar_digest
  ) return null;
  return sidecar;
}

export function policyCanaryScoreCorrectionStorageDecision(
  existingValue: unknown,
  incoming: VerifiedPolicyCanaryScoreCorrectionSidecar,
) {
  if (existingValue === undefined || existingValue === null) return {
    outcome: "created" as const,
    sidecar: incoming,
  };
  const existing = verifiedPolicyCanaryScoreCorrectionSidecar(existingValue);
  if (!existing || existing.correction.correction_digest !== incoming.correction.correction_digest) {
    return { outcome: "conflict" as const, sidecar: null };
  }
  return { outcome: "replayed" as const, sidecar: existing };
}

export type PolicyCanaryScoreCorrectionHistoryEntry = {
  correction_sequence: number;
  correction_digest: string;
  scoring_version_digest: string;
  sidecar_digest: string;
  sidecar: VerifiedPolicyCanaryScoreCorrectionSidecar;
};

export type PolicyCanaryScoreCorrectionHistory = {
  schema_version: "task_evaluation_policy_canary_score_correction_history.v1";
  entries: PolicyCanaryScoreCorrectionHistoryEntry[];
  history_digest: string;
};

function historyEntry(sidecar: VerifiedPolicyCanaryScoreCorrectionSidecar) {
  return {
    correction_sequence: sidecar.audit.correction_sequence ?? 1,
    correction_digest: sidecar.correction.correction_digest,
    scoring_version_digest: sidecar.correction.scoring_version_digest,
    sidecar_digest: sidecar.sidecar_digest,
    sidecar,
  } satisfies PolicyCanaryScoreCorrectionHistoryEntry;
}

export function verifiedPolicyCanaryScoreCorrectionHistory(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const history = value as PolicyCanaryScoreCorrectionHistory;
  if (
    history.schema_version !== "task_evaluation_policy_canary_score_correction_history.v1"
    || !Array.isArray(history.entries)
    || history.entries.length > 8
    || canonicalArtifactDigest(
      history as unknown as Record<string, unknown>,
      "history_digest",
    ) !== history.history_digest
  ) return null;
  const seenCorrections = new Set<string>();
  const seenVersions = new Set<string>();
  for (let index = 0; index < history.entries.length; index += 1) {
    const entry = history.entries[index];
    const sidecar = verifiedPolicyCanaryScoreCorrectionSidecar(entry?.sidecar);
    if (
      !sidecar
      || entry.correction_sequence !== index + 1
      || entry.correction_sequence !== (sidecar.audit.correction_sequence ?? 1)
      || entry.correction_digest !== sidecar.correction.correction_digest
      || entry.scoring_version_digest !== sidecar.correction.scoring_version_digest
      || entry.sidecar_digest !== sidecar.sidecar_digest
      || seenCorrections.has(entry.correction_digest)
      || seenVersions.has(entry.scoring_version_digest)
    ) return null;
    seenCorrections.add(entry.correction_digest);
    seenVersions.add(entry.scoring_version_digest);
  }
  return history;
}

function sealHistory(entries: PolicyCanaryScoreCorrectionHistoryEntry[]) {
  const history: PolicyCanaryScoreCorrectionHistory = {
    schema_version: "task_evaluation_policy_canary_score_correction_history.v1",
    entries,
    history_digest: `sha256:${"0".repeat(64)}`,
  };
  history.history_digest = canonicalArtifactDigest(
    history as unknown as Record<string, unknown>,
    "history_digest",
  );
  return history;
}

export function policyCanaryScoreCorrectionTransition(params: {
  currentValue: unknown;
  historyValue: unknown;
  incoming: VerifiedPolicyCanaryScoreCorrectionSidecar;
  payload: PolicyCanaryScoreCorrectionIngest;
}) {
  const current = verifiedPolicyCanaryScoreCorrectionSidecar(params.currentValue);
  const history = params.historyValue === undefined || params.historyValue === null
    ? sealHistory([])
    : verifiedPolicyCanaryScoreCorrectionHistory(params.historyValue);
  if (!history) return { outcome: "conflict" as const, code: "history_invalid" };
  if (current?.correction.correction_digest === params.incoming.correction.correction_digest) {
    return { outcome: "current_replayed" as const, current, history };
  }
  const historical = history.entries.find((entry) => (
    entry.correction_digest === params.incoming.correction.correction_digest
  ));
  if (historical) return {
    outcome: "historical_replayed" as const,
    current,
    history,
    replayed: historical.sidecar,
  };
  if (!current) {
    if (params.currentValue || params.payload.schema_version !== "task_evaluation_policy_canary_score_correction_ingest.v1") {
      return { outcome: "conflict" as const, code: "initial_correction_invalid" };
    }
    return { outcome: "created" as const, current: params.incoming, history };
  }
  if (params.payload.schema_version !== "task_evaluation_policy_canary_score_correction_ingest.v2") {
    return { outcome: "conflict" as const, code: "successor_envelope_required" };
  }
  const successor = params.payload.successor;
  const currentSequence = current.audit.correction_sequence ?? 1;
  const sameSource = [
    "run_id",
    "record_id",
    "source_result_digest",
    "source_result_file_sha256",
    "source_artifact_inventory_digest",
    "source_projection_digest",
    "source_delivery_digest",
  ].every((field) => (
    (current.source_binding as Record<string, unknown>)[field]
      === (params.incoming.source_binding as Record<string, unknown>)[field]
  ));
  const knownVersions = new Set([
    current.correction.scoring_version_digest,
    ...history.entries.map((entry) => entry.scoring_version_digest),
  ]);
  const knownCorrectionIds = new Set([
    current.correction.correction_id,
    ...history.entries.map((entry) => entry.sidecar.correction.correction_id),
  ]);
  if (
    !sameSource
    || successor.correction_sequence !== currentSequence + 1
    || params.incoming.audit.correction_sequence !== successor.correction_sequence
    || successor.supersedes_correction_digest !== current.correction.correction_digest
    || successor.supersedes_sidecar_digest !== current.sidecar_digest
    || successor.supersedes_scoring_version_digest !== current.correction.scoring_version_digest
    || params.incoming.correction.correction_digest === current.correction.correction_digest
    || knownVersions.has(params.incoming.correction.scoring_version_digest)
    || knownCorrectionIds.has(params.incoming.correction.correction_id)
  ) return { outcome: "conflict" as const, code: "successor_or_downgrade_invalid" };
  if (history.entries.length >= 8) {
    return { outcome: "conflict" as const, code: "history_limit_reached" };
  }
  const nextHistory = sealHistory([...history.entries, historyEntry(current)]);
  return {
    outcome: "advanced" as const,
    current: params.incoming,
    history: nextHistory,
  };
}

export function publicPolicyCanaryScoreCorrectionAudit(
  currentValue: unknown,
  historyValue: unknown,
) {
  const current = verifiedPolicyCanaryScoreCorrectionSidecar(currentValue);
  if (
    current
    && (current.audit.correction_sequence ?? 1) > 1
    && (historyValue === undefined || historyValue === null)
  ) return null;
  const history = historyValue === undefined || historyValue === null
    ? sealHistory([])
    : verifiedPolicyCanaryScoreCorrectionHistory(historyValue);
  if (!current || !history) return null;
  const entries = history.entries.map(({ sidecar: _sidecar, ...entry }) => entry);
  return {
    schema_version: "task_evaluation_policy_canary_score_correction_audit.v1",
    current_correction_sequence: current.audit.correction_sequence ?? 1,
    current_correction_digest: current.correction.correction_digest,
    current_scoring_version_digest: current.correction.scoring_version_digest,
    current_sidecar_digest: current.sidecar_digest,
    history: entries,
    history_digest: history.history_digest,
    history_projection_digest: canonicalArtifactDigest(
      { entries },
      "__no_digest_field__",
    ),
  };
}
