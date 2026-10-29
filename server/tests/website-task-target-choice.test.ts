// @vitest-environment node
/** "We picked this object; is it the one the robot should move?": one optional question inside the same
 * job, answered against the exact question, guess and candidate list the Pipeline reported, and read back
 * by the Pipeline (confirm: nothing reruns; another object: the same job reruns; none of these: update). */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { projectTaskStatus } from "../utils/taskStatusProjection";
import { taskTargetChoiceQuestionSchema, type TaskTargetChoiceQuestion } from "../utils/taskTargetChoiceContract";
import { loadCurrentWebsitePreparationStatus, mergeWebsitePreparationStatus, syncWebsitePreparationStatus,
  type StoredWebsitePreparation, type WebsitePreparationDeps, type WebsitePreparationSelector } from "../utils/websitePreparationStatus";
import { answerTaskTargetChoice, currentTaskTargetChoiceAnswer, parseStoredTaskTargetChoice,
  readTaskTargetChoiceForPipeline, taskTargetChoiceAnswerSchema, type TaskTargetChoiceAnswer,
  type TaskTargetChoiceDeps } from "../utils/websiteTaskTargetChoice";
import { createWebsitePreparationRouter, websitePreparationRawBody } from "../routes/internal-website-preparation";

vi.mock("../../client/src/lib/firebaseAdmin", async original => ({
  ...await original<typeof import("../../client/src/lib/firebaseAdmin")>(), dbAdmin: null, storageAdmin: null }));

const MIRROR = path.resolve(__dirname, "../../contracts/pipeline/website-task-target-choice.v1.schema.json");
const PIPELINE = path.resolve(__dirname, "../../../BlueprintCapturePipeline/docs/schemas/website_task_target_choice.v1.schema.json");
const selector: WebsitePreparationSelector = { request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1",
  completion_marker_generation: "17", producer_delivery_key: `sha256:${"a".repeat(64)}`,
  source_payload_sha256: "b".repeat(64), task_context_digest: `sha256:${"c".repeat(64)}` };
const GUESS = "c0123456789abcdef", OTHER = "cfedcba9876543210";
const question: TaskTargetChoiceQuestion = { kind: "task_target_choice", question_digest: `sha256:${"1".repeat(64)}`,
  target_id: "target-1", semantic_label: "Tote", candidate_set_digest: `sha256:${"2".repeat(64)}`, guessed_candidate_id: GUESS,
  candidates: [{ candidate_id: GUESS, label: "Tote 1: left side, center of the view", reference_time_ms: 4000 },
    { candidate_id: OTHER, label: "Tote 2: right side, center of the view", reference_time_ms: 4000 }] };

type State = "preparing" | "failed_retryable" | "handed_off" | "authority_ended";
const CODES = { preparing: "preparation_in_progress", failed_retryable: "preparation_retryable_failure",
  handed_off: "preparation_handed_off", authority_ended: "preparation_authority_ended" };
function receipt(state: State, withQuestion: TaskTargetChoiceQuestion | null = question) {
  const value = { ...selector, schema_version: "website_preparation_status.v4", state, code: CODES[state],
    attempt_count: 1, revision: 4, correlation_id: crossRuntimeDigest({ selector }), terminal_reason: null, outcome: null,
    question: withQuestion };
  return { ...value, status_digest: crossRuntimeArtifactDigest(value, "status_digest") };
}
function preparation(ledger: unknown) {
  let stored: StoredWebsitePreparation | null = null;
  const deps: WebsitePreparationDeps = {
    async readLedger() { return ledger; }, async verifyCurrent() { return { fingerprint: "source", owner: "owner1" }; },
    async readStored() { return stored; },
    async commit(input, status) { stored = mergeWebsitePreparationStatus(stored, input, status); },
    async pending() { return []; }, async acknowledge() {}, async findEvent() { return null; },
  };
  return deps;
}
function choiceStore(current: TaskTargetChoiceQuestion | null = question) {
  let stored: TaskTargetChoiceAnswer | null = null;
  const deps: TaskTargetChoiceDeps = {
    async loadQuestion() { return current ? { selector, question: current } : null; },
    async commit(answer) { if (stored?.question_digest !== answer.question_digest) stored = answer; return stored!; },
    async readStored() { return stored; },
  };
  return { deps, get stored() { return stored; }, ask(next: TaskTargetChoiceQuestion | null) { current = next; } };
}

describe("status v4 carries the optional question without holding the job", () => {
  it("reads it in the job's own state and refuses it once authority ended or tampered", async () => {
    for (const state of ["preparing", "failed_retryable", "handed_off"] as const) {
      const deps = preparation(receipt(state));
      await syncWebsitePreparationStatus(selector, deps);
      const current = await loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1", deps);
      expect(current.state).toBe(state);
      expect(current.question?.guessed_candidate_id).toBe(GUESS);
    }
    await expect(syncWebsitePreparationStatus(selector, preparation(receipt("authority_ended")))).rejects.toThrow();
    const tampered = { ...receipt("preparing"), question: { ...question, semantic_label: "Person" } };
    await expect(syncWebsitePreparationStatus(selector, preparation(tampered))).rejects.toThrow();
    const unguessed = { ...question, guessed_candidate_id: "c9999999999999999" };
    expect(taskTargetChoiceQuestionSchema.safeParse(unguessed).success).toBe(false);
  });
});

describe("the site's answer", () => {
  it("confirms the guess or names another object, bound to source, question, guess and candidate list", async () => {
    const store = choiceStore();
    const answer = await answerTaskTargetChoice("r1", "walkthrough-r1",
      { questionDigest: question.question_digest, choice: { kind: "confirm_guess" } },
      store.deps, () => new Date("2026-10-29T12:00:00.000Z"));
    expect(answer).toMatchObject({ ...selector, question_digest: question.question_digest, target_id: "target-1",
      candidate_set_digest: question.candidate_set_digest, guessed_candidate_id: GUESS,
      choice: { kind: "confirm_guess", candidate_id: GUESS } });
    expect(parseStoredTaskTargetChoice(store.stored)).toEqual(answer);
    expect(answer.answer_digest).toBe(crossRuntimeArtifactDigest(answer as unknown as Record<string, unknown>, "answer_digest"));
    // The same answer again is idempotent; a different one is refused, because the Pipeline may already have read it.
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "confirm_guess" } }, store.deps)).resolves.toEqual(answer);
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "other_candidate", candidate_id: OTHER } }, store.deps)).rejects.toThrow("task_target_choice_already_answered");
    const other = choiceStore();
    expect((await answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "other_candidate", candidate_id: OTHER } }, other.deps)).choice).toEqual({ kind: "other_candidate", candidate_id: OTHER });
  });

  it("refuses a stale question, the guess named as another object, an unknown one and an unasked question", async () => {
    const store = choiceStore();
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: `sha256:${"9".repeat(64)}`,
      choice: { kind: "none_of_these" } }, store.deps)).rejects.toThrow("task_target_choice_question_changed");
    for (const candidate_id of [GUESS, "c9999999999999999"])
      await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
        choice: { kind: "other_candidate", candidate_id } }, store.deps)).rejects.toThrow("task_target_choice_candidate_unknown");
    store.ask(null);
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "none_of_these" } }, store.deps)).rejects.toThrow("task_target_choice_question_changed");
    expect(store.stored).toBeNull();
    const forged = { ...(await answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "none_of_these" } }, choiceStore().deps)), choice: { kind: "confirm_guess", candidate_id: OTHER } };
    expect(parseStoredTaskTargetChoice({ ...forged, answer_digest: crossRuntimeArtifactDigest(forged, "answer_digest") })).toBeNull();
  });

  it("is read back by the Pipeline only for the exact question and source it names", async () => {
    const store = choiceStore();
    const answer = await answerTaskTargetChoice("r1", "walkthrough-r1",
      { questionDigest: question.question_digest, choice: { kind: "none_of_these" } }, store.deps);
    const read = { ...selector, question_digest: question.question_digest };
    expect(await readTaskTargetChoiceForPipeline("walkthrough-r1", read, store.deps)).toEqual(answer);
    expect(await readTaskTargetChoiceForPipeline("walkthrough-r1", { ...read, question_digest: `sha256:${"8".repeat(64)}` }, store.deps)).toBeNull();
    expect(await readTaskTargetChoiceForPipeline("walkthrough-r1", { ...read, completion_marker_generation: "18" }, store.deps)).toBeNull();
    await expect(readTaskTargetChoiceForPipeline("walkthrough-other", read, store.deps)).rejects.toThrow();
    const session = { website_task_target_choice: answer };
    expect(currentTaskTargetChoiceAnswer(session, { state: "preparing", question })).toBe("none_of_these");
    expect(currentTaskTargetChoiceAnswer(session, { state: "preparing",
      question: { ...question, question_digest: `sha256:${"7".repeat(64)}` } })).toBeNull();
    expect(currentTaskTargetChoiceAnswer(session, { state: "authority_ended", question })).toBeNull();
  });
});

describe("the job page keeps the job moving", () => {
  const base = { briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, stage: null, coversScene: null,
    missingViews: [], supplementWouldFinish: false };
  const preparing = { state: "preparing" as const, correlationId: null, question };
  it("an unanswered question, a confirmation or a correction leaves the job's own status", () => {
    const plain = projectTaskStatus({ ...base, preparationStatus: { state: "preparing", correlationId: null } });
    for (const targetChoiceAnswer of [null, "confirm_guess", "other_candidate"] as const)
      expect(projectTaskStatus({ ...base, preparationStatus: preparing, targetChoiceAnswer })).toEqual(plain);
  });
  it("routes none of these to the existing same-job walkthrough update", () => {
    const status = projectTaskStatus({ ...base, preparationStatus: preparing, targetChoiceAnswer: "none_of_these" });
    expect(status.decision).toBe("add_views");
    expect(status.operatorAction).toMatch(/Update walkthrough.*same job and keeps your original video/);
  });
});

describe("cross-repo contract", () => {
  it("mirrors the Pipeline schema byte for byte and its examples parse here", () => {
    const mirror = fs.readFileSync(MIRROR);
    if (fs.existsSync(PIPELINE))
      expect(createHash("sha256").update(fs.readFileSync(PIPELINE)).digest("hex"))
        .toBe(createHash("sha256").update(mirror).digest("hex"));
    const [example, ...answers] = JSON.parse(mirror.toString()).examples;
    expect(taskTargetChoiceQuestionSchema.parse(example)).toEqual(example);
    expect(answers.map((row: { choice: { kind: string } }) => row.choice.kind)).toEqual(["other_candidate", "confirm_guess", "none_of_these"]);
    // The Pipeline's RFC 8785 digest is the same digest here.
    for (const item of answers) expect(parseStoredTaskTargetChoice(taskTargetChoiceAnswerSchema.parse(item))).toEqual(item);
  });
});

describe("signed Pipeline read route", () => {
  let server: Server | null = null;
  afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = null; vi.unstubAllEnvs(); });
  it("returns the bound answer, or pending, only to a signed Pipeline request", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "isolated-test-secret");
    const store = choiceStore();
    const app = express(); app.use(websitePreparationRawBody);
    app.use("/api/internal/pipeline", createWebsitePreparationRouter(undefined, store.deps));
    server = createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw Error("missing_port");
    const body = JSON.stringify({ ...selector, question_digest: question.question_digest });
    const post = (signed = true) => {
      const timestamp = new Date().toISOString();
      return fetch(`http://127.0.0.1:${address.port}/api/internal/pipeline/creator-captures/walkthrough-r1/task-target-choice`, {
        method: "POST", body, headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
          "X-Blueprint-Pipeline-Signature": signed ? buildPipelineSyncSignature({ secret: "isolated-test-secret", timestamp, body }) : "bad" } });
    };
    const pending = await post();
    expect(pending.status).toBe(404); expect((await pending.json()).code).toBe("website_task_target_choice_pending");
    const answer = await answerTaskTargetChoice("r1", "walkthrough-r1",
      { questionDigest: question.question_digest, choice: { kind: "other_candidate", candidate_id: OTHER } }, store.deps);
    const found = await post();
    expect(found.status).toBe(200); expect(await found.json()).toEqual(answer);
    expect((await post(false)).status).not.toBe(200);
  });
});
