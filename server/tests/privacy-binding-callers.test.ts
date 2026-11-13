// @vitest-environment node
/**
 * The server lanes that load a run's data from one stored request bind the run to it (runAgentTask's
 * privacyRequestBinding option); without it the run stays on the strictest Privacy table.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
vi.mock("../agents/runtime", () => ({ runAgentTask }));
vi.mock("../config/env", async (importOriginal) => ({
  ...await importOriginal<typeof import("../config/env")>(), isSiteTaskBriefReadingEnabled: () => true }));
vi.mock("../utils/siteTaskBrief", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/siteTaskBrief")>(), mergeBriefProposals: vi.fn(async () => undefined) }));

beforeEach(() => { runAgentTask.mockReset(); runAgentTask.mockResolvedValue({ status: "failed", error: "fixture" }); });

describe("server lanes bind a run to the request its data came from", () => {
  it("brief reading binds its run to the job it reads", async () => {
    const { readBriefFromDescription } = await import("../utils/siteTaskBriefReading");
    await readBriefFromDescription({ requestId: "req-brief", taskStatement: "Move totes" });
    expect(runAgentTask).toHaveBeenCalledTimes(1);
    expect(runAgentTask.mock.calls[0][0]).toMatchObject({ kind: "site_task_brief_reading" });
    expect(runAgentTask.mock.calls[0][1]).toEqual({ privacyRequestBinding: { request_id: "req-brief" } });
  });
});
