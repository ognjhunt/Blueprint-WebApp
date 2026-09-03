import { describe, expect, it } from "vitest";

import { canonicalArtifactDigest, stableJson } from "../utils/taskCandidateContract";
import {
  policyCanaryScoreCorrectionStorageDecision,
  policyCanaryScoreCorrectionTransition,
  publicPolicyCanaryScoreCorrectionAudit,
  verifyPolicyCanaryScoreCorrectionIngest,
} from "../utils/policyCanaryScoreCorrectionContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function fixture() {
  const runId = "scene839873-policy-canary-run";
  const recordId = "capture-run-corrected";
  const sourceResultDigest = sha("a");
  const sourceFileDigest = sha("b");
  const projectionDigest = sha("c");
  const deliveryDigest = sha("d");
  const scorerIdentity: Record<string, any> = {
    schema_version: "task_evaluation_deterministic_scorer_identity.v1",
    scorer: "blueprint_pipeline.adp_task_scoring.score_task_episode_from_spec",
    scorer_commit: "e".repeat(40),
    source_files: [{ path: "src/blueprint_pipeline/adp_task_scoring.py", sha256: sha("e") }],
    source_files_digest: "",
    scoring_version_digest: "",
  };
  scorerIdentity.source_files_digest = canonicalArtifactDigest(
    { value: scorerIdentity.source_files },
    "__no_digest_field__",
  );
  scorerIdentity.scoring_version_digest = canonicalArtifactDigest(
    scorerIdentity,
    "scoring_version_digest",
  );
  const projectionEpisodes: Record<string, any>[] = [];
  const deliveryEpisodes: Record<string, any>[] = [];
  const scoreUpdates: Record<string, any>[] = [];
  const receipts: Record<string, any>[] = [];
  for (let index = 0; index < 20; index += 1) {
    const candidateId = index < 10 ? "pi05_droid" : "groot_n17_droid";
    const cell = index % 10;
    const cellId = `scene839873.quick10.${String(cell).padStart(2, "0")}`;
    const seed = 1000 + cell;
    const oldScore = { status: "scored", task_succeeded: false, outcome: "moved_below_threshold", report_digest: sha("1") };
    const newScore = {
      status: "scored",
      task_succeeded: true,
      outcome: "pushed_and_settled",
      failed_criteria: [],
      failure_reason_plain_english: null,
      measurements: { settle_destination_inside: true },
      task_success_contract: { contract_digest: sha("7"), criteria: { temporal_invariants: { no_drop: { mode: "ignored" } } } },
      task_success_contract_digest: sha("7"),
      criteria_satisfied: { destination_containment: true, no_drop: true },
      event_ledger: {
        schema_version: "rigid_task_event_ledger.v1",
        drop_events: cell === 9 ? [{ step_index: 22, fall_m: 0.04 }] : [],
        peak_task_contact_force_n: 6.4,
        task_contact_force_sources: ["native_contact_sensor"],
        observed_contact_classes: ["task_object"],
        observed_forbidden_contact_classes: [],
        containment_excursion_steps: [],
        workspace_excursion_steps: [],
        maximum_retries_observed: 0,
        maximum_regrasps_observed: 0,
        required_readback_gaps: [],
        derived_only_from_episode_samples: true,
      },
      report_digest: sha("2"),
    };
    const update: Record<string, any> = {
      candidate_id: candidateId,
      cell_id: cellId,
      seed,
      source_episode_identity_digest: sha("3"),
      source_evidence_artifact_bindings_digest: sha("4"),
      old_score_digest: sha("5"),
      new_score_digest: sha("6"),
      new_score: newScore,
      success_contract_digest: sha("7"),
      scoring_version_digest: scorerIdentity.scoring_version_digest,
      derived_rescore_receipt: {
        relative_path: `episodes/${String(index).padStart(2, "0")}.json`,
        sha256: sha("8"),
        size_bytes: 1000 + index,
        receipt_digest: "",
      },
    };
    const receipt: Record<string, any> = {
      schema_version: "task_evaluation_policy_canary_rescore_episode.v1",
      status: "rescored",
      derived_only: true,
      source_run_id: runId,
      source_result_digest: sourceResultDigest,
      source_result_file_sha256: sourceFileDigest,
      candidate_id: candidateId,
      cell_id: cellId,
      seed,
      source_episode_identity_digest: update.source_episode_identity_digest,
      source_episode_digest: sha("9"),
      source_episode_receipt_digest: sha("0"),
      source_evidence_artifact_bindings_digest: update.source_evidence_artifact_bindings_digest,
      task_spec_digest: sha("a"),
      success_contract_digest: update.success_contract_digest,
      state_trace_digest: sha("b"),
      old_score_digest: update.old_score_digest,
      new_score_digest: update.new_score_digest,
      old_score: oldScore,
      new_score: newScore,
      scorer_commit: scorerIdentity.scorer_commit,
      scorer_source_files_digest: scorerIdentity.source_files_digest,
      scoring_version_digest: scorerIdentity.scoring_version_digest,
      original_provider_output_overwritten: false,
      original_score_receipt_overwritten: false,
      receipt_digest: "",
    };
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    update.derived_rescore_receipt.receipt_digest = receipt.receipt_digest;
    scoreUpdates.push(update);
    receipts.push(receipt);
    projectionEpisodes.push({
      episode_id: `episode-${index}`,
      candidate_id: candidateId,
      cell_id: cellId,
      seed,
      evidence: { score_receipt: { artifact_id: `score-${index}`, digest: sha("8"), size_bytes: 1000 } },
    });
    deliveryEpisodes.push({
      episode_id: `episode-${index}`,
      episode_kind: "learned_candidate",
      subject_id: candidateId,
      policy_candidate_id: candidateId,
      variation: { cell_id: cellId, seed },
      score: { status: oldScore.status, task_succeeded: oldScore.task_succeeded },
    });
  }
  const correction: Record<string, any> = {
    schema_version: "task_evaluation_policy_canary_score_correction.v1",
    status: "completed_unqualified_score_correction_ready",
    correction_id: "",
    source_run_id: runId,
    source_result_status: "completed_unqualified",
    corrected_result_status: "completed_unqualified",
    source_result_digest: sourceResultDigest,
    source_result_file_sha256: sourceFileDigest,
    source_artifact_inventory_digest: sha("c"),
    source_episode_identity_set_digest: sha("d"),
    source_score_set_digest: sha("e"),
    corrected_score_set_digest: sha("f"),
    success_contract_set_digest: sha("1"),
    scorer_identity: scorerIdentity,
    scoring_version_digest: scorerIdentity.scoring_version_digest,
    episode_count: 20,
    score_updates: scoreUpdates,
    publication_constraints: {
      source_status: "completed_unqualified",
      corrected_status: "completed_unqualified",
      episode_identity_must_be_unchanged: true,
      artifact_inventory_must_be_unchanged: true,
      original_provider_result_must_be_retained: true,
      original_score_receipts_must_be_retained: true,
      allowed_score_overlay_fields: ["episode.score", "deterministic_score_digest", "scoring_version_digest"],
      correction_authority: "derived_deterministic_rescore_receipt",
    },
    correction_digest: "",
  };
  correction.correction_id = canonicalArtifactDigest({
    source_result_digest: correction.source_result_digest,
    source_result_file_sha256: correction.source_result_file_sha256,
    scoring_version_digest: correction.scoring_version_digest,
  }, "__no_digest_field__").slice(7, 31);
  correction.correction_digest = canonicalArtifactDigest(correction, "correction_digest");
  const payload: Record<string, any> = {
    schema_version: "task_evaluation_policy_canary_score_correction_ingest.v1",
    source_binding: {
      run_id: runId,
      record_id: recordId,
      policy_canary_projection_digest: projectionDigest,
      result_delivery_digest: deliveryDigest,
    },
    correction,
    derived_rescore_receipts: receipts,
    ingest_digest: "",
  };
  payload.ingest_digest = canonicalArtifactDigest(payload, "ingest_digest");
  const publication = {
    schema_version: "task_evaluation_run_publication.v4",
    run_id: runId,
    run_kind: "internal_policy_canary",
    result_status: "completed_unqualified",
    policy_canary_result: {
      result_status: "completed_unqualified",
      projection_digest: projectionDigest,
      episodes: projectionEpisodes,
      report: {
        result_digest: sourceResultDigest,
        machine_readable_report: { digest: sourceFileDigest },
      },
    },
    result_delivery: {
      result_status: "completed_unqualified",
      status: "ready",
      delivery_digest: deliveryDigest,
      episodes: deliveryEpisodes,
    },
  };
  return { payload, publication, recordId };
}

function successor(
  value: ReturnType<typeof fixture>,
  prior: Extract<ReturnType<typeof verifyPolicyCanaryScoreCorrectionIngest>, { ok: true }>["sidecar"],
) {
  const payload = structuredClone(value.payload);
  payload.schema_version = "task_evaluation_policy_canary_score_correction_ingest.v2";
  payload.successor = {
    correction_sequence: (prior.audit.correction_sequence ?? 1) + 1,
    supersedes_correction_digest: prior.correction.correction_digest,
    supersedes_sidecar_digest: prior.sidecar_digest,
    supersedes_scoring_version_digest: prior.correction.scoring_version_digest,
  };
  payload.correction.scorer_identity.scorer_commit = "f".repeat(40);
  payload.correction.scorer_identity.source_files[0].sha256 = sha("f");
  payload.correction.scorer_identity.source_files_digest = canonicalArtifactDigest(
    { value: payload.correction.scorer_identity.source_files },
    "__no_digest_field__",
  );
  payload.correction.scorer_identity.scoring_version_digest = canonicalArtifactDigest(
    payload.correction.scorer_identity,
    "scoring_version_digest",
  );
  payload.correction.scoring_version_digest =
    payload.correction.scorer_identity.scoring_version_digest;
  payload.correction.score_updates.forEach((update: Record<string, any>, index: number) => {
    update.scoring_version_digest = payload.correction.scoring_version_digest;
    update.new_score.event_ledger.observed_contact_classes = ["task_object", "support_surface"];
    const receipt = payload.derived_rescore_receipts[index];
    receipt.scorer_commit = payload.correction.scorer_identity.scorer_commit;
    receipt.scorer_source_files_digest = payload.correction.scorer_identity.source_files_digest;
    receipt.scoring_version_digest = payload.correction.scoring_version_digest;
    receipt.new_score = update.new_score;
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    update.derived_rescore_receipt.receipt_digest = receipt.receipt_digest;
  });
  payload.correction.correction_id = canonicalArtifactDigest({
    source_result_digest: payload.correction.source_result_digest,
    source_result_file_sha256: payload.correction.source_result_file_sha256,
    scoring_version_digest: payload.correction.scoring_version_digest,
  }, "__no_digest_field__").slice(7, 31);
  payload.correction.correction_digest = canonicalArtifactDigest(
    payload.correction,
    "correction_digest",
  );
  payload.ingest_digest = canonicalArtifactDigest(payload, "ingest_digest");
  return payload;
}

describe("policy canary score correction contract", () => {
  it("binds 20 corrected scores to the current immutable publication", () => {
    const value = fixture();
    const verified = verifyPolicyCanaryScoreCorrectionIngest(value);
    expect(verified).toMatchObject({
      ok: true,
      sidecar: {
        audit: { original_publication_preserved: true, winner_declared: false },
      },
    });
    expect(stableJson(value.publication)).not.toContain("score_correction");
  });

  it("rejects an old-score binding that differs from the current delivery", () => {
    const value = fixture();
    value.payload.derived_rescore_receipts[0].old_score.task_succeeded = true;
    value.payload.derived_rescore_receipts[0].receipt_digest = canonicalArtifactDigest(
      value.payload.derived_rescore_receipts[0],
      "receipt_digest",
    );
    value.payload.correction.score_updates[0].derived_rescore_receipt.receipt_digest =
      value.payload.derived_rescore_receipts[0].receipt_digest;
    value.payload.correction.correction_digest = canonicalArtifactDigest(
      value.payload.correction,
      "correction_digest",
    );
    value.payload.ingest_digest = canonicalArtifactDigest(value.payload, "ingest_digest");
    expect(verifyPolicyCanaryScoreCorrectionIngest(value)).toMatchObject({
      ok: false,
      code: "POLICY_CANARY_SCORE_CORRECTION_UPDATE_BINDING_INVALID",
    });
  });

  it("replays only the same immutable correction digest", () => {
    const value = fixture();
    const verified = verifyPolicyCanaryScoreCorrectionIngest(value);
    if (!verified.ok) throw new Error(verified.code);
    expect(policyCanaryScoreCorrectionStorageDecision(null, verified.sidecar).outcome)
      .toBe("created");
    expect(policyCanaryScoreCorrectionStorageDecision(verified.sidecar, verified.sidecar).outcome)
      .toBe("replayed");
    const conflicting = structuredClone(verified.sidecar);
    conflicting.correction.correction_digest = sha("9");
    expect(policyCanaryScoreCorrectionStorageDecision(verified.sidecar, conflicting).outcome)
      .toBe("conflict");
  });

  it("advances only a strictly linked new scoring version and retains prior history", () => {
    const value = fixture();
    const first = verifyPolicyCanaryScoreCorrectionIngest(value);
    if (!first.ok) throw new Error(first.code);
    const secondPayload = successor(value, first.sidecar);
    const second = verifyPolicyCanaryScoreCorrectionIngest({
      payload: secondPayload,
      publication: value.publication,
      recordId: value.recordId,
    });
    if (!second.ok) throw new Error(second.code);
    const advanced = policyCanaryScoreCorrectionTransition({
      currentValue: first.sidecar,
      historyValue: null,
      incoming: second.sidecar,
      payload: second.payload,
    });
    expect(advanced).toMatchObject({
      outcome: "advanced",
      current: { correction: { correction_digest: second.sidecar.correction.correction_digest } },
      history: { entries: [{ correction_digest: first.sidecar.correction.correction_digest }] },
    });
    if (advanced.outcome !== "advanced") throw new Error(advanced.code);
    expect(policyCanaryScoreCorrectionTransition({
      currentValue: advanced.current,
      historyValue: advanced.history,
      incoming: first.sidecar,
      payload: first.payload,
    }).outcome).toBe("historical_replayed");
    expect(policyCanaryScoreCorrectionTransition({
      currentValue: advanced.current,
      historyValue: advanced.history,
      incoming: second.sidecar,
      payload: second.payload,
    }).outcome).toBe("current_replayed");
    const audit = publicPolicyCanaryScoreCorrectionAudit(advanced.current, advanced.history);
    expect(audit).toMatchObject({
      current_correction_sequence: 2,
      history: [{ correction_sequence: 1, sidecar_digest: first.sidecar.sidecar_digest }],
    });
    expect(stableJson(audit)).not.toContain("score_updates");
  });

  it("rejects a successor that does not supersede current or omits the versioned envelope", () => {
    const value = fixture();
    const first = verifyPolicyCanaryScoreCorrectionIngest(value);
    if (!first.ok) throw new Error(first.code);
    const secondPayload = successor(value, first.sidecar);
    secondPayload.successor.supersedes_correction_digest = sha("0");
    secondPayload.ingest_digest = canonicalArtifactDigest(secondPayload, "ingest_digest");
    const second = verifyPolicyCanaryScoreCorrectionIngest({
      payload: secondPayload,
      publication: value.publication,
      recordId: value.recordId,
    });
    if (!second.ok) throw new Error(second.code);
    expect(policyCanaryScoreCorrectionTransition({
      currentValue: first.sidecar,
      historyValue: null,
      incoming: second.sidecar,
      payload: second.payload,
    })).toMatchObject({ outcome: "conflict", code: "successor_or_downgrade_invalid" });

    const unversioned = successor(value, first.sidecar);
    unversioned.schema_version = "task_evaluation_policy_canary_score_correction_ingest.v1";
    delete unversioned.successor;
    unversioned.ingest_digest = canonicalArtifactDigest(unversioned, "ingest_digest");
    const parsedUnversioned = verifyPolicyCanaryScoreCorrectionIngest({
      payload: unversioned,
      publication: value.publication,
      recordId: value.recordId,
    });
    if (!parsedUnversioned.ok) throw new Error(parsedUnversioned.code);
    expect(policyCanaryScoreCorrectionTransition({
      currentValue: first.sidecar,
      historyValue: null,
      incoming: parsedUnversioned.sidecar,
      payload: parsedUnversioned.payload,
    })).toMatchObject({ outcome: "conflict", code: "successor_envelope_required" });

    const reusedVersion = successor(value, first.sidecar);
    reusedVersion.correction.scorer_identity = structuredClone(first.sidecar.correction.scorer_identity);
    reusedVersion.correction.scoring_version_digest = first.sidecar.correction.scoring_version_digest;
    reusedVersion.correction.score_updates.forEach((update: Record<string, any>, index: number) => {
      update.scoring_version_digest = reusedVersion.correction.scoring_version_digest;
      const receipt = reusedVersion.derived_rescore_receipts[index];
      receipt.scorer_commit = reusedVersion.correction.scorer_identity.scorer_commit;
      receipt.scorer_source_files_digest = reusedVersion.correction.scorer_identity.source_files_digest;
      receipt.scoring_version_digest = reusedVersion.correction.scoring_version_digest;
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      update.derived_rescore_receipt.receipt_digest = receipt.receipt_digest;
    });
    reusedVersion.correction.correction_id = first.sidecar.correction.correction_id;
    reusedVersion.correction.correction_digest = canonicalArtifactDigest(
      reusedVersion.correction,
      "correction_digest",
    );
    reusedVersion.ingest_digest = canonicalArtifactDigest(reusedVersion, "ingest_digest");
    const parsedReused = verifyPolicyCanaryScoreCorrectionIngest({
      payload: reusedVersion,
      publication: value.publication,
      recordId: value.recordId,
    });
    if (!parsedReused.ok) throw new Error(parsedReused.code);
    expect(policyCanaryScoreCorrectionTransition({
      currentValue: first.sidecar,
      historyValue: null,
      incoming: parsedReused.sidecar,
      payload: parsedReused.payload,
    })).toMatchObject({ outcome: "conflict", code: "successor_or_downgrade_invalid" });

    const beyondBound = successor(value, first.sidecar);
    beyondBound.successor.correction_sequence = 10;
    beyondBound.ingest_digest = canonicalArtifactDigest(beyondBound, "ingest_digest");
    expect(verifyPolicyCanaryScoreCorrectionIngest({
      payload: beyondBound,
      publication: value.publication,
      recordId: value.recordId,
    })).toMatchObject({ ok: false, code: "POLICY_CANARY_SCORE_CORRECTION_SCHEMA_INVALID" });
  });
});
