// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { captureSavedEvidence, compareAssessmentRuns, experimentCostStatus, experimentErrorCode, experimentHash, experimentVersions, openExperimentLedger,
  sanitizeExperiment, validateExperimentRetention, validateSavedEvidence, writeExperimentJson } from "../agents/assessment-experiment";
import { SiteAssessmentBudget } from "../agents/adapters/site-assessment-budget";

// Synthetic contract fixture only. Never exported as a real-evidence cache or model-quality result.
const source = { request_id: "synthetic-one", capture_id: "walkthrough-synthetic-one", source_key: "synthetic-source",
  video_ref: "gs://synthetic/scenes/one#generation=1", video_sha256: "a".repeat(64), video_bytes: 32, duration_seconds: 30,
  operator_messages_sha256: "e".repeat(64), experiment_context_digest: "b".repeat(64), producer_source: { kind: "browser_pending", key: "synthetic-source" } };
const retention = () => ({ local_evidence_allowed: true, authority_ref: "synthetic-no-retention-grant", expires_at_ms: Date.now() + 60_000 });
const dirs: string[] = [];
function ledger() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assessment-contract-")); dirs.push(dir);
  return path.join(dir, "accounting.json"); }
const open = (file: string, runId = "synthetic-run", mode: "fresh-video" | "saved-evidence" = "fresh-video") =>
  openExperimentLedger(file, source.request_id, runId, mode, retention());
afterEach(() => { vi.unstubAllEnvs(); dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true })); });

describe("local real-assessment experiment contracts — OFFLINE / NO MODEL-QUALITY EVIDENCE", () => {
  it("identifies exact owned encryption configuration failures without exposing arbitrary prose", () => {
    expect(experimentErrorCode("KMS key name is required for KMS decryption.")).toBe("experiment_kms_configuration_missing");
    expect(experimentErrorCode("FIELD_ENCRYPTION_MASTER_KEY is required when KMS is not configured.")).toBe("experiment_local_encryption_key_missing");
    expect(experimentErrorCode("FIELD_ENCRYPTION_MASTER_KEY must be 32 bytes base64.")).toBe("experiment_local_encryption_key_invalid");
    expect(experimentErrorCode("PRIVATE exception with a credential")).toBe("experiment_failed");
    expect(experimentErrorCode("site_assessment_source_changed")).toBe("site_assessment_source_changed");
  });
  it("requires valid retention permission, with no spending approval or dollar/call limits", () => {
    expect(validateExperimentRetention(retention()).local_evidence_allowed).toBe(true);
    expect(() => validateExperimentRetention(undefined)).toThrow();
    expect(() => validateExperimentRetention({ ...retention(), expires_at_ms: 1 })).toThrow("retention_expired");
  });
  it("persists dispatch and unknown usage while allowing the next call without spending gates", async () => {
    const file = ledger(), run = open(file); run.bind(source);
    const reservation = await run.reserve("gpt-6.1-sol", {}, "openai", {});
    expect(JSON.parse(fs.readFileSync(file, "utf8")).slots[0].state).toBe("admitted");
    await reservation.assertDispatchAllowed(); await reservation.record(null);
    expect(run.status().slots[0]).toMatchObject({ state: "unknown", usage_estimate_micro_usd: null });
    const next = await run.reserve("gpt-6.1-sol", {}, "openai", {});
    await next.record({ input_tokens: 100, output_tokens: 20 });
    expect(run.status().slots.map((slot: any) => slot.state)).toEqual(["unknown", "recorded"]);
    expect(run.status().slots[1]).toMatchObject({ usage_pricing_status: "reported_complete", above_estimate: false });
    const upperBound = await run.reserve("gemini-3.8-flash", {}, "gemini", {});
    await upperBound.record({ promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 15 });
    expect(run.status().slots[2]).toMatchObject({ state: "recorded", usage_pricing_status: "unattributed_total_upper_bound",
      usage: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 15 } });
    expect(run.status().slots[0]).toMatchObject({ state: "unknown", usage_estimate_micro_usd: null });
    expect(run.status().spending_gates).toBe(false); run.close();
  });
  it("preserves an unanswered call after process death and refuses overwriting accounting", async () => {
    const file = ledger(), run = open(file); run.bind(source);
    expect(() => open(file, "other")).toThrow("accounting_exists");
    await run.reserve("gpt-6.1-sol", {}, "openai", {}); run.close();
    expect(JSON.parse(fs.readFileSync(file, "utf8")).slots[0]).toMatchObject({ state: "admitted", reserved_call_micro_usd: 331_920 });
  });
  it("records late usage after retention expires while stopping new dispatch and preserving unknown charges", async () => {
    const permission = retention(), file = ledger();
    const run = openExperimentLedger(file, source.request_id, "synthetic-late-run", "fresh-video", permission);
    run.bind(source);
    const earlier = await run.reserve("gpt-6.1-sol", {}, "openai", {}); await earlier.record(null);
    const late = await run.reserve("gpt-6.1-sol", {}, "openai", {});
    const clock = vi.spyOn(Date, "now").mockReturnValue(permission.expires_at_ms + 1);
    try {
      await expect(late.assertDispatchAllowed()).rejects.toThrow("retention_expired");
      await late.record({ input_tokens: 100, output_tokens: 20 });
      expect(run.status().slots.map((slot: any) => slot.state)).toEqual(["unknown", "recorded"]);
      expect(run.status().slots[0].usage_estimate_micro_usd).toBeNull();
      expect(run.status().slots[1].usage_estimate_micro_usd).toBeGreaterThan(0);
      await expect(run.reserve("gpt-6.1-sol", {}, "openai", {})).rejects.toThrow("retention_expired");
      run.close();
    } finally { clock.mockRestore(); }
  });
  it("does not require preset slots or reset earlier charges to record more calls", async () => {
    const file = ledger(), run = open(file); run.bind(source);
    for (let i = 0; i < 6; i++) { const call = await run.reserve("gpt-6.1-sol", {}, "openai", {});
      await call.record({ input_tokens: 100, output_tokens: 20 }); }
    expect(run.status().slots.filter((slot: any) => slot.state === "recorded")).toHaveLength(6); run.close();
  });
  it("denies source mismatch and fresh Gemini in saved mode without a financial gate", async () => {
    const file = ledger(), run = open(file, "synthetic-run", "saved-evidence");
    expect(() => run.bind({ ...source, request_id: "other" })).toThrow("source_binding_changed");
    run.bind(source); await expect(run.reserve("gemini-3.8-flash", {}, "gemini")).rejects.toThrow("saved_evidence_miss");
    expect(run.status().slots).toEqual([]);
    run.pause("experiment_saved_evidence_miss"); expect(() => run.assertActive()).toThrow("saved_evidence_miss"); run.close();
  });
  it("stops on accounting corruption between record and dispatch", async () => {
    const file = ledger(), run = open(file); run.bind(source);
    const reservation = await run.reserve("gpt-6.1-sol", {}, "openai", {});
    const changed = JSON.parse(fs.readFileSync(file, "utf8")); changed.source_digest = "f".repeat(64); writeExperimentJson(file, changed);
    await expect(reservation.assertDispatchAllowed()).rejects.toThrow("accounting_changed");
  });
  it("validates retained tool query, source bytes, real-response binding and perception version", async () => {
    const versions = experimentVersions(process.cwd()), args = { question: "Synthetic question", processing: "auto", sampling_fps: 2 };
    const evidence = { summary: "Synthetic", observations: [{ category: "motion", finding: "Synthetic movement", basis: "observed",
      start_seconds: 1, end_seconds: 2, uncertainty: null }], not_observable: [] };
    const text = JSON.stringify({ ...evidence, provider_metadata: { harmless: true } }), receipt = { source_sha256: source.video_sha256, bytes: source.video_bytes,
      model_requested: "gemini-3.8-flash", analysis_sha256: experimentHash(text), question: args.question,
      inspection: { processing: args.processing, sampling_fps: args.sampling_fps }, operator_messages_sha256: source.operator_messages_sha256,
      prompt_sha256: "f".repeat(64), processing: { model_version: "synthetic-not-a-provider", mode: "static", sampling_fps_requested: 2 } };
    const result = { artifacts: { site_assessment_packet: { sources: [{ source_id: `video:${source.capture_id}:${experimentHash(args).slice(0, 12)}`,
      kind: "video", canonical_ref: source.video_ref, sha256: source.video_sha256, checked_at: null, content: { ...args, evidence, receipt } }] },
      provider_responses: [{ provider: "gemini", model: "gemini-3.8-flash", response: { text, usage: { promptTokenCount: 100, candidatesTokenCount: 20 },
        processing: receipt.processing } }] } };
    const saved = (await captureSavedEvidence(result, source, versions, retention(), new Date().toISOString()))!;
    expect(await validateSavedEvidence(saved, source, versions)).toHaveLength(1);
    expect(saved.responses[0].response.text).toContain("provider_metadata");
    expect(saved.sources[0].content.evidence).not.toHaveProperty("provider_metadata");
    await expect(validateSavedEvidence(saved, { ...source, video_sha256: "d".repeat(64) }, versions)).rejects.toThrow("source_mismatch");
    await expect(validateSavedEvidence(saved, { ...source, operator_messages_sha256: "f".repeat(64) }, versions)).rejects.toThrow("analysis_context_changed");
    await expect(validateSavedEvidence(saved, source, { ...versions, analysis_sha256: "d".repeat(64) })).rejects.toThrow("fresh_evidence_required");
    const injected = structuredClone(saved); injected.sources[0].content.evidence.unsourced_extra = "Synthetic injected field";
    injected.content_sha256 = experimentHash(Object.fromEntries(Object.entries(injected).filter(([key]) => key !== "content_sha256")));
    await expect(validateSavedEvidence(injected, source, versions)).rejects.toThrow("provenance_invalid");
    const relabeled = structuredClone(saved); relabeled.sources[0].content.question = "Different question";
    relabeled.sources[0].content.sampling_fps = 4;
    relabeled.sources[0].source_id = `video:${source.capture_id}:${experimentHash({ question: "Different question", processing: "auto", sampling_fps: 4 }).slice(0, 12)}`;
    relabeled.content_sha256 = experimentHash(Object.fromEntries(Object.entries(relabeled).filter(([key]) => key !== "content_sha256")));
    await expect(validateSavedEvidence(relabeled, source, versions)).rejects.toThrow("provenance_invalid");
    saved.sources[0].content.evidence.summary = "Corrupted";
    await expect(validateSavedEvidence(saved, source, versions)).rejects.toThrow("digest_changed");
    saved.content_sha256 = experimentHash(Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "content_sha256")));
    await expect(validateSavedEvidence(saved, source, versions)).rejects.toThrow("provenance_invalid");
  });
  it("reports unresolved reservation exposure when a response or final ledger read is lost", () => {
    const reservation = { state: "admitted", reserved_call_micro_usd: 331_920 };
    const lostResponse = { status: "failed", provider_call_may_have_happened: true,
      allocation: { slots: [reservation] } };
    expect(experimentCostStatus({ provider_call_may_have_happened: false })).toBe("no_new_provider_dispatch");
    expect(experimentCostStatus(lostResponse)).toBe("provider_usage_or_charge_unresolved");
    const lostLedger = { ...lostResponse, allocation_read_error: { code: "experiment_authority_changed" },
      result: { status: "completed", artifacts: { cost_status: "reported_usage" } } };
    const comparison = compareAssessmentRuns(lostResponse, lostLedger);
    expect(comparison.after.cost_status).toBe("experiment_ledger_reconciliation_required");
    expect(comparison.after.assessment_status).toBe("completed");
    expect(comparison.after.accounting.slots[0]).toEqual(reservation);
    expect(experimentCostStatus({ ...lostResponse, allocation_close_error: {} })).toBe("experiment_ledger_reconciliation_required");
  });
  it("redacts access URLs, secrets, personal emails and hidden reasoning without fabricating zero usage", () => {
    const clean = sanitizeExperiment({ authorization: "private", url: "https://example.invalid/signed?key=secret", text: "See https://example.invalid/x?token=secret and synthetic@example.invalid",
      output: [{ type: "reasoning", encrypted_content: "hidden" }, { type: "message", content: "visible" }], usage: null });
    expect(JSON.stringify(clean)).not.toContain("secret"); expect(JSON.stringify(clean)).not.toContain("hidden");
    expect(clean.text).toContain("[redacted-email]"); expect(clean.usage).toBeNull();
  });
  it("shows material section differences and cost/latency without asserting quality", () => {
    const run = (missing: string[]) => ({ mode: "saved-evidence", wall_ms: 100, source, versions: { analysis_sha256: "same" },
      result: { status: "completed", artifacts: { site_assessment_packet: { assessment: { missing }, verification: { unverified_claims: 0 } }, usage: { cost_usd: null } } } });
    const comparison = compareAssessmentRuns(run([]), run(["unseen task endpoint"]));
    expect(comparison.changed_sections).toEqual(["missing"]); expect(comparison.same_source).toBe(true);
    expect(comparison.after.usage.cost_usd).toBeNull(); expect(comparison.quality_verdict).toContain("unverified");
    const failed = compareAssessmentRuns({ status: "failed", versions: {} }, { status: "completed", versions: {} });
    expect(failed.changed_runtime_status).toBe(true); expect(failed.changed_sections).toEqual([]);
    expect(failed.same_source).toBe(false); expect(failed.same_analysis_version).toBe(false);
    const retentionFailed = compareAssessmentRuns(run([]), { ...run([]), status: "failed", stage: "evidence_retention" });
    expect(retentionFailed.after.status).toBe("failed"); expect(retentionFailed.after.assessment_status).toBe("completed");
  });
  it("runs both real command modes without an approved-budget argument and retains nonfinancial failures and writes readable nonzero results without model dispatch", () => {
    const file = ledger(), dir = path.dirname(file), input = path.join(dir, "input.json");
    writeExperimentJson(input, { message: "Synthetic offline plumbing", context: { request_id: source.request_id } });
    let commands = 0;
    const command = (mode: string, extra: string[], configured = false) => {
      const output = path.join(dir, mode + "-" + commands++);
      const env = { ...process.env, NODE_ENV: "test", BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: "true", OPENAI_API_KEY: configured ? "synthetic-not-a-provider-key" : "",
        GEMINI_API_KEY: configured ? "synthetic-not-a-provider-key" : "", GOOGLE_GENERATIVE_AI_API_KEY: "", GOOGLE_AI_STUDIO_API_KEY: "", FIREBASE_SERVICE_ACCOUNT_JSON: "",
        GOOGLE_APPLICATION_CREDENTIALS: "", GOOGLE_CLOUD_PROJECT: "", K_SERVICE: "", FUNCTION_TARGET: "" };
      const execution = spawnSync(path.resolve("node_modules/.bin/tsx"), ["scripts/site-assessment-iterate.ts", "--mode", mode,
        "--input", input, "--output", output, ...extra], { encoding: "utf8", env });
      expect(execution.status, execution.stderr).toBe(1);
      const result = JSON.parse(fs.readFileSync(path.join(output, "run.json"), "utf8"));
      expect(result.provider_call_may_have_happened).toBe(false);
      expect(fs.readFileSync(path.join(output, "summary.md"), "utf8")).toContain("Error:");
      return result;
    };
    expect(command("fresh-video", []).error.code).toBe("experiment_openai_credential_missing");
    expect(command("saved-evidence", ["--evidence", path.join(dir, "not-borrowed.json")]).error.code).toBe("experiment_openai_credential_missing");
    expect(command("fresh-video", [], true).error.code).toBe("experiment_video_binding_required");
    writeExperimentJson(input, { message: "Synthetic offline plumbing", context: { request_id: source.request_id }, retention: retention(),
      video_binding: { sha256: source.video_sha256, bytes: source.video_bytes } });
    const admitted = command("fresh-video", [], true);
    expect(admitted.result?.error, JSON.stringify(admitted.error)).toBe("site_assessment_lane_unavailable");
    expect(admitted.accounting.slots).toEqual([]);
  });
  it("retains the unchanged production pricing reservation", () => {
    const budget = new SiteAssessmentBudget(); budget.authorize("gemini", "gemini-3.8-flash");
    expect(budget.calls[0].reserved_usd).toBe(1.818624);
  });
});
