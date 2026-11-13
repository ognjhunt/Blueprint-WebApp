// @vitest-environment node
/**
 * No new model run starts for a withdrawn job: each server lane that binds a run to its request refuses when the
 * request it already loaded has its consent revoked, and the two background loops skip such requests.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const runAgentTask = vi.hoisted(() => vi.fn());
const decryptInboundRequestForAdmin = vi.hoisted(() => vi.fn(async (value: unknown) => value));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null, authAdmin: null,
}));
vi.mock("../agents/runtime", () => ({ runAgentTask }));
vi.mock("../utils/field-encryption", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/field-encryption")>(), decryptInboundRequestForAdmin }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../config/env", async (importOriginal) => ({
  ...await importOriginal<typeof import("../config/env")>(), isSiteTaskBriefReadingEnabled: () => true }));

beforeEach(() => {
  state.docs.clear(); runAgentTask.mockReset(); decryptInboundRequestForAdmin.mockClear();
  runAgentTask.mockResolvedValue({ status: "completed", output: { question_ids: ["item_weight"] } });
});

describe("a withdrawn job gets no new model run", () => {
  it("the follow-up picker gives the fixed list without a run", async () => {
    vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); // a lane that could run, so only the withdrawal stops it
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps({ requestId: "req1", consentRevoked: true, taskStatement: "Move totes", briefSummary: "b",
      itemLabels: [], eligible: ["success_target", "item_photos", "item_weight", "item_make_model"] }))
      .toEqual(["success_target", "item_photos", "item_weight"]);
    expect(runAgentTask).not.toHaveBeenCalled();
  });

  it("brief reading starts no run", async () => {
    const { readBriefFromDescription } = await import("../utils/siteTaskBriefReading");
    expect(await readBriefFromDescription({ requestId: "req1", taskStatement: "Move totes", consentRevoked: true })).toBe(false);
    expect(runAgentTask).not.toHaveBeenCalled();
  });

  it("inbound qualification refuses before it writes or sends anything", async () => {
    state.docs.set("inboundRequests/req1", { consent_revoked: true });
    const before = structuredClone(state.docs.get("inboundRequests/req1"));
    const { runInboundQualificationForRequest } = await import("../agents/workflows");
    await expect(runInboundQualificationForRequest({ requestId: "req1", consent_revoked: true } as never)).rejects.toThrow("website_job_withdrawn");
    expect(runAgentTask).not.toHaveBeenCalled();
    expect(state.docs.get("inboundRequests/req1")).toEqual(before);
  });

  it("the inbound qualification and preview diagnosis loops skip a withdrawn request", async () => {
    state.docs.set("inboundRequests/req1", { requestId: "req1", consent_revoked: true,
      ops_automation: { intent: "inbound_qualification", status: "pending" },
      evaluation_readiness: { provider_run: { status: "failed" } } });
    const { runInboundQualificationLoop, runPreviewDiagnosisLoop } = await import("../agents/workflows");
    await runInboundQualificationLoop();
    await runPreviewDiagnosisLoop();
    expect(decryptInboundRequestForAdmin).not.toHaveBeenCalled();
    expect(runAgentTask).not.toHaveBeenCalled();
  });

  it("robot fit refuses a withdrawn job (unchanged)", async () => {
    const { rankTeamsForJob } = await import("../utils/siteRobotFit");
    state.docs.set("inboundRequests/req1", { consent_revoked: true, request: {} });
    await expect(rankTeamsForJob("req1", { actor: "admin" })).rejects.toThrow();
    expect(runAgentTask).not.toHaveBeenCalled();
  });
});
