// @vitest-environment node
/** "Which object should the robot move?": one question inside the same job, answered against the exact
 * question and candidate list the Pipeline reported, read back by the Pipeline to resume that job. */
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
const question: TaskTargetChoiceQuestion = { kind: "task_target_choice", question_digest: `sha256:${"1".repeat(64)}`,
  target_id: "target-1", semantic_label: "Tote", candidate_set_digest: `sha256:${"2".repeat(64)}`,
  candidates: [{ candidate_id: "c0123456789abcdef", label: "Tote 1: left side, center of the view", reference_time_ms: 4000 },
    { candidate_id: "cfedcba9876543210", label: "Tote 2: right side, center of the view", reference_time_ms: 4000 }] };

function receipt(state: "awaiting_inputs" | "failed_retryable", withQuestion: TaskTargetChoiceQuestion | null = question) {
  const value = { ...selector, schema_version: "website_preparation_status.v4", state,
    code: state === "awaiting_inputs" ? "preparation_inputs_pending" : "preparation_retryable_failure",
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

describe("status v4 carries the one in-job question", () => {
  it("reads the question only while preparation waits on inputs, and refuses it otherwise", async () => {
    const deps = preparation(receipt("awaiting_inputs"));
    await syncWebsitePreparationStatus(selector, deps);
    const current = await loadCurrentWebsitePreparationStatus("r1", "walkthrough-r1", deps);
    expect(current.state).toBe("awaiting_inputs");
    expect(current.question?.candidates.map(row => row.candidate_id)).toEqual(["c0123456789abcdef", "cfedcba9876543210"]);
    const misplaced = preparation(receipt("failed_retryable"));
    await expect(syncWebsitePreparationStatus(selector, misplaced)).rejects.toThrow();
    const tampered = { ...receipt("awaiting_inputs"), question: { ...question, semantic_label: "Person" } };
    await expect(syncWebsitePreparationStatus(selector, preparation(tampered))).rejects.toThrow();
  });
});

describe("the site's answer", () => {
  it("is bound to the job source, the question and the exact candidate list, and never changes", async () => {
    const store = choiceStore();
    const answer = await answerTaskTargetChoice("r1", "walkthrough-r1",
      { questionDigest: question.question_digest, choice: { kind: "candidate", candidate_id: "cfedcba9876543210" } },
      store.deps, () => new Date("2026-10-29T12:00:00.000Z"));
    expect(answer).toMatchObject({ ...selector, question_digest: question.question_digest, target_id: "target-1",
      candidate_set_digest: question.candidate_set_digest, choice: { kind: "candidate", candidate_id: "cfedcba9876543210" } });
    expect(parseStoredTaskTargetChoice(store.stored)).toEqual(answer);
    expect(answer.answer_digest).toBe(crossRuntimeArtifactDigest(answer as unknown as Record<string, unknown>, "answer_digest"));
    // The same answer again is idempotent; a different one is refused, because the Pipeline may already have applied it.
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "candidate", candidate_id: "cfedcba9876543210" } }, store.deps)).resolves.toEqual(answer);
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "none_of_these" } }, store.deps)).rejects.toThrow("task_target_choice_already_answered");
  });

  it("refuses a stale question, an unknown candidate and a question that is no longer asked", async () => {
    const store = choiceStore();
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: `sha256:${"9".repeat(64)}`,
      choice: { kind: "none_of_these" } }, store.deps)).rejects.toThrow("task_target_choice_question_changed");
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "candidate", candidate_id: "c9999999999999999" } }, store.deps)).rejects.toThrow("task_target_choice_candidate_unknown");
    store.ask(null);
    await expect(answerTaskTargetChoice("r1", "walkthrough-r1", { questionDigest: question.question_digest,
      choice: { kind: "none_of_these" } }, store.deps)).rejects.toThrow("task_target_choice_question_changed");
    expect(store.stored).toBeNull();
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
    // A stored answer to an older question is not an answer to a new one.
    const session = { website_task_target_choice: answer };
    expect(currentTaskTargetChoiceAnswer(session, { state: "awaiting_inputs", question })).toBe("none_of_these");
    expect(currentTaskTargetChoiceAnswer(session, { state: "awaiting_inputs",
      question: { ...question, question_digest: `sha256:${"7".repeat(64)}` } })).toBeNull();
    expect(currentTaskTargetChoiceAnswer(session, { state: "preparing", question })).toBeNull();
  });
});

describe("the job page asks one question and keeps the same job", () => {
  const base = { briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, stage: null, coversScene: null,
    missingViews: [], supplementWouldFinish: false };
  const waiting = { state: "awaiting_inputs" as const, correlationId: null, question };
  it("asks which object the robot moves", () => {
    const status = projectTaskStatus({ ...base, preparationStatus: waiting });
    expect(status).toMatchObject({ decision: "choose_task_object", headline: "Which object should the robot move?" });
    expect(status.operatorAction).toMatch(/which tote in your video the robot should move.*None of these/);
  });
  it("routes none of these to the existing same-job walkthrough update", () => {
    const status = projectTaskStatus({ ...base, preparationStatus: waiting, targetChoiceAnswer: "none_of_these" });
    expect(status.decision).toBe("add_views");
    expect(status.operatorAction).toMatch(/Update walkthrough.*same job and keeps your original video/);
  });
  it("shows a chosen object as continuing from the saved video", () => {
    const status = projectTaskStatus({ ...base, preparationStatus: waiting, targetChoiceAnswer: "candidate" });
    expect(status).toMatchObject({ decision: "assessing" });
    expect(status.headline).toMatch(/saved video, using the object you chose/);
  });
});

describe("cross-repo contract", () => {
  it("mirrors the Pipeline schema byte for byte and its examples parse here", () => {
    const mirror = fs.readFileSync(MIRROR);
    if (fs.existsSync(PIPELINE))
      expect(createHash("sha256").update(fs.readFileSync(PIPELINE)).digest("hex"))
        .toBe(createHash("sha256").update(mirror).digest("hex"));
    const [example, answer, decline] = JSON.parse(mirror.toString()).examples;
    expect(taskTargetChoiceQuestionSchema.parse(example)).toEqual(example);
    // The Pipeline's RFC 8785 digest is the same digest here.
    for (const item of [answer, decline]) expect(parseStoredTaskTargetChoice(taskTargetChoiceAnswerSchema.parse(item))).toEqual(item);
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
      { questionDigest: question.question_digest, choice: { kind: "candidate", candidate_id: "c0123456789abcdef" } }, store.deps);
    const found = await post();
    expect(found.status).toBe(200); expect(await found.json()).toEqual(answer);
    expect((await post(false)).status).not.toBe(200);
  });
});
