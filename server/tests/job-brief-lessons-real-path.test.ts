// @vitest-environment node
/**
 * The job brief's lesson lane through the real runtime and the real OpenAI adapter; only the OpenAI client, the store and
 * the other adapters are fakes. One text request on the small tier at low effort, whatever the global settings say, with
 * the lane's own output ceiling; the stored run keeps no copy of the company's words; the hold on the answering job's cap
 * settles at the run's reported cost; and the lesson is kept from the answer, checked by code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const created = vi.hoisted(() => vi.fn());
const anthropic = vi.hoisted(() => vi.fn());

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class FakeOpenAI { responses = { create: created }; embeddings = { create: vi.fn() }; }
  Object.assign(FakeOpenAI, { APIError: actual.default.APIError });
  return { ...actual, default: FakeOpenAI };
});
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../agents/adapters/anthropic-agent-sdk", () => ({ runAnthropicAgentSdkTask: anthropic }));
vi.mock("../logger", () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger };
  return { logger, attachRequestMeta: (meta: unknown) => meta, default: logger };
});

const ID = "job-lesson-real-1";
const COMPANY = "c".repeat(64);
const WORDS = "COMPANY-WORDS-MARKER-7d2a how often is the lamp moved each day?";
const answer = (text: string) => ({ id: "resp_1", output: [{ type: "message", content: [{ type: "output_text", text }] }],
  output_text: text, usage: { input_tokens: 1500, output_tokens: 120, input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 60 } } });

beforeEach(async () => {
  created.mockReset(); anthropic.mockReset();
  state.docs.clear();
  state.docs.set(`inboundRequests/${ID}`, { requestId: ID, walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`,
    job_estimates: { job_kind: "pick_and_place", object: "bedside lamp" } } });
  const { COMPANY_RESPONSE_STATEMENT_VERSION } = await import("../../client/src/lib/companyResponses");
  state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${COMPANY}`, { state: "needs_something", inputs: WORDS,
    statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, recordedBy: "company", submittedBy: "uid-1", company: "Larkspur Robotics",
    email: "ines@larkspur.example", updatedAtIso: "2026-11-25T12:00:00.000Z" });
  state.docs.set(`robotTeamAccess/${COMPANY}`, { company: "Larkspur Robotics", email: "ines@larkspur.example", status: "approved",
    partnerRole: "deployment" });
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("OPENAI_DEFAULT_MODEL", "a-large-model"); vi.stubEnv("OPENAI_REASONING_EFFORT", "max");
  vi.stubEnv("OPENAI_JOB_BRIEF_LESSON_MODEL", ""); vi.stubEnv("OPENAI_JOB_BRIEF_LESSON_REASONING_EFFORT", "");
  vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS", "");
  vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
});
afterEach(async () => { vi.unstubAllEnvs(); (await import("../utils/jobBriefLessons")).resetJobBriefLessonsForTests(); });

const storedRuns = () => [...state.docs.entries()].filter(([key]) => key.startsWith("agentRuns/")).map(([, value]) => value as Record<string, any>);
const lanes = () => [...state.docs.entries()].filter(([key]) => key.startsWith(`inboundRequests/${ID}/modelLaneReservations/`))
  .map(([, value]) => value as Record<string, any>);

describe("the lesson lane through the runtime", () => {
  it("makes one text request on the small tier at low effort, keeps the checked lesson and settles its hold", async () => {
    created.mockResolvedValueOnce(answer(JSON.stringify({ job_brief_lesson: { topic: "how_often_moved", question: "How often is the item moved?" } })))
      // The model pass over the kept question: nothing to take out.
      .mockResolvedValueOnce(answer(JSON.stringify({ remove: [] })));
    const { ensureJobBriefLesson } = await import("../utils/jobBriefLessons");
    expect(await ensureJobBriefLesson(ID, COMPANY)).toEqual({ type: "question", topic: "how_often_moved", question: "How often is the item moved?" });
    expect(created).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(created.mock.calls[1][0])).toContain("How often is the item moved?");
    const request = created.mock.calls[0][0];
    const { getTaskModelByProvider } = await import("../agents/provider-config");
    expect(request).toMatchObject({ model: getTaskModelByProvider("job_brief").openai_responses, reasoning: { effort: "low" },
      max_output_tokens: 1_000 });
    expect(request.model).not.toBe("a-large-model");
    expect(JSON.stringify(request)).not.toMatch(/input_file|input_image|input_video|file_id|https?:\/\//);
    expect(JSON.stringify(request)).toContain("COMPANY-WORDS-MARKER-7d2a");
    expect(state.docs.get("jobBriefLessons/pick_and_place")).toMatchObject({ questions: [{ topic: "how_often_moved", count: 1 }] });
    // The stored run keeps a digest of the company's words, never the words.
    const runs = storedRuns();
    expect(runs.map(run => [run.task_kind ?? run.kind, run.status])).toEqual([["job_brief_lesson", "completed"],
      ["free_text_redaction", "completed"]]);
    expect(JSON.stringify(runs)).not.toContain("COMPANY-WORDS-MARKER-7d2a");
    expect(JSON.stringify([...state.docs.values()].filter(value => value !== state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${COMPANY}`))))
      .not.toContain("COMPANY-WORDS-MARKER-7d2a");
    // Both calls held against the answering job's cap and settled at what they cost.
    expect(lanes().map(row => row.lane).sort()).toEqual(["free_text_redaction", "job_brief_lesson"]);
    for (const row of lanes()) {
      expect(row.settlement).toMatchObject({ basis: "reported_usage", actual_cost_usd: expect.any(Number) });
      expect(row.settlement.actual_cost_usd).toBeLessThanOrEqual(row.admission.maximum_cost_usd);
    }
  });

  it("makes one request for an answer that is not JSON, keeps nothing and tries again only after its wait", async () => {
    created.mockResolvedValue(answer("It is moved often."));
    const { ensureJobBriefLesson } = await import("../utils/jobBriefLessons");
    expect(await ensureJobBriefLesson(ID, COMPANY)).toBeNull();
    expect(await ensureJobBriefLesson(ID, COMPANY)).toBeNull();
    expect(created).toHaveBeenCalledTimes(1);
    expect(state.docs.get("jobBriefLessons/pick_and_place")).toBeUndefined();
    expect(state.docs.get(`inboundRequests/${ID}/jobBriefLessonRuns/${COMPANY}`)).toMatchObject({ status: "failed", reason: "no_answer" });
    expect(lanes().every(row => row.settlement)).toBe(true);
  });
});
