// @vitest-environment node
/**
 * The job brief through the real runtime and the real OpenAI adapter; only the OpenAI client, the store and the other
 * adapters are fakes. One request on the small tier at low effort, whatever the global settings say, with the lane's
 * own output ceiling; text only; the stored run keeps no copy of the site's words; the hold on the job's cap settles at
 * the run's reported cost; and the brief is stored from the answer, checked by code.
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

const ID = "job-brief-real-1";
const SITE_WORDS = "SITE-WORDS-MARKER-5b1e move the lamp from the round bedside table to the glass shelf.";
const answer = (text: string) => ({ id: "resp_1", output: [{ type: "message", content: [{ type: "output_text", text }] }],
  output_text: text, usage: { input_tokens: 3000, output_tokens: 300, input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 100 } } });
const ROWS = { job_brief: [
  { id: "lamp_size", label: "Lamp size", evidence: "video_estimate", estimate_fields: ["object_largest_side_m"] },
  { id: "table_to_shelf", label: "From table to shelf", evidence: "site_sentence", quote: "from the round bedside table to the glass shelf" },
  { id: "hours", label: "Hours a day", evidence: "site_answer", answer_key: "hours" },
] };

beforeEach(async () => {
  created.mockReset(); anthropic.mockReset();
  state.docs.clear();
  state.docs.set(`inboundRequests/${ID}`, { requestId: ID, walkthrough_job_estimates: { capture_id: `walkthrough-${ID}`,
    job_estimates: { job_kind: "pick_and_place", object: "bedside lamp", object_largest_side_m: 0.45 } } });
  state.docs.set(`siteTaskBriefs/${ID}`, { summary: SITE_WORDS });
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("OPENAI_DEFAULT_MODEL", "a-large-model"); vi.stubEnv("OPENAI_REASONING_EFFORT", "max");
  vi.stubEnv("OPENAI_JOB_BRIEF_MODEL", ""); vi.stubEnv("OPENAI_JOB_BRIEF_REASONING_EFFORT", "");
  vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS", "");
  vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
});
afterEach(async () => { vi.unstubAllEnvs(); (await import("../utils/jobBrief")).resetJobBriefForTests(); });

const storedRuns = () => [...state.docs.entries()].filter(([key]) => key.startsWith("agentRuns/")).map(([, value]) => value as Record<string, any>);
const lanes = () => [...state.docs.entries()].filter(([key]) => key.startsWith(`inboundRequests/${ID}/modelLaneReservations/`))
  .map(([, value]) => value as Record<string, any>);

describe("the job brief through the runtime", () => {
  it("makes one text request on the small tier at low effort, stores the checked brief and settles its hold", async () => {
    created.mockResolvedValue(answer(JSON.stringify(ROWS)));
    const { ensureJobBrief } = await import("../utils/jobBrief");
    const written = await ensureJobBrief(ID);
    const { logger } = await import("../logger");
    expect(created).toHaveBeenCalledTimes(1);
    const request = created.mock.calls[0][0];
    const { getTaskModelByProvider } = await import("../agents/provider-config");
    expect(request).toMatchObject({ model: getTaskModelByProvider("free_text_redaction").openai_responses, reasoning: { effort: "low" },
      max_output_tokens: 2_000 });
    expect(request.model).not.toBe("a-large-model");
    // Text only: no file, image or video part in what was sent.
    expect(JSON.stringify(request)).not.toMatch(/input_file|input_image|input_video|file_id|https?:\/\//);
    expect(JSON.stringify(request)).toContain("SITE-WORDS-MARKER-5b1e");
    expect(written?.rows.map(row => row.id)).toEqual(["lamp_size", "table_to_shelf", "hours"]);
    expect(state.docs.get(`inboundRequests/${ID}`)).toMatchObject({ job_brief: written });
    // The stored run keeps a digest of the site's words, never the words.
    const runs = storedRuns();
    expect(runs.map(run => [run.task_kind ?? run.kind, run.status])).toEqual([["job_brief", "completed"]]);
    expect(JSON.stringify(runs)).not.toContain("SITE-WORDS-MARKER-5b1e");
    expect(lanes()).toEqual([expect.objectContaining({ lane: "job_brief",
      settlement: expect.objectContaining({ basis: "reported_usage", actual_cost_usd: expect.any(Number) }) })]);
    expect(lanes()[0].settlement.actual_cost_usd).toBeLessThanOrEqual(lanes()[0].admission.maximum_cost_usd);
  });

  it("makes one request for an answer that is not JSON, stores nothing and tries again only after its wait", async () => {
    created.mockResolvedValue(answer("The lamp is light."));
    const { ensureJobBrief } = await import("../utils/jobBrief");
    expect(await ensureJobBrief(ID)).toBeNull();
    expect(await ensureJobBrief(ID)).toBeNull();
    expect(created).toHaveBeenCalledTimes(1);
    expect(state.docs.get(`inboundRequests/${ID}`)).not.toHaveProperty("job_brief");
    expect(state.docs.get(`inboundRequests/${ID}`)).toMatchObject({ job_brief_run: { status: "failed", reason: "no_answer" } });
    expect(lanes().every(row => row.settlement)).toBe(true);
  });
});
