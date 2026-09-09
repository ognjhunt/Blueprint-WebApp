// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { executeWorkTool, workOperation, workProjection } from "../utils/blueprintWorkOperations";
import { MemoryWorkStore } from "./helpers/work-memory-store";

const identity = { uid: "operator-1", tenantId: null, authTime: 1000 };
const request = { launch_id: "work-launch-1", run_id: "work-run-1", profile_id: "profile-1", profile_digest: "sha256:" + "a".repeat(64),
  rights: { scope: "admitted test", evidence: { uri: "gs://rights/evidence.json", digest: "sha256:" + "b".repeat(64) } },
  spend: { max_spend_usd: 10, expires_at: "2030-01-01T00:00:00Z" }, confirm_execution: true as const };

describe("Blueprint Work run submission boundary", () => {
  it("submits only exact reviewed bytes and reuses the same launch on retries", async () => {
    const store = new MemoryWorkStore();
    const call = vi.fn(async () => ({ status: 200, body: { status: "ready", candidate_request_digest: "sha256:" + "c".repeat(64) } }));
    const preflight = await executeWorkTool("preflight_run", { request }, identity, ["blueprint:runs:read"], store, call, 1000);
    expect(call.mock.calls).toHaveLength(1);
    const input = { preflight_id: preflight.body.preflight_id, confirm_execution: true };
    await executeWorkTool("submit_run", input, identity, ["blueprint:runs:launch"], store, call, 1001);
    await executeWorkTool("submit_run", input, identity, ["blueprint:runs:launch"], store, call, 1002);
    expect(call.mock.calls[2]).toEqual(call.mock.calls[4]);
    expect(call.mock.calls[2][0]).toMatchObject({ method: "POST", path: "/", body: { launch_id: request.launch_id, spend: request.spend } });
  });
  it("rejects missing scope, another user, expiry and changed preflight", async () => {
    const store = new MemoryWorkStore();
    const call = vi.fn(async () => ({ status: 200, body: { status: "ready", candidate_request_digest: "digest-1" } }));
    const result = await executeWorkTool("preflight_run", { request }, identity, ["blueprint:runs:read"], store, call, 1000);
    const input = { preflight_id: result.body.preflight_id, confirm_execution: true };
    await expect(executeWorkTool("submit_run", input, identity, ["blueprint:runs:read"], store, call, 1001)).rejects.toThrow("work_scope_required");
    await expect(executeWorkTool("submit_run", input, { ...identity, uid: "other" }, ["blueprint:runs:launch"], store, call, 1001)).rejects.toThrow("work_preflight_binding_invalid");
    await expect(executeWorkTool("submit_run", input, identity, ["blueprint:runs:launch"], store, call, 1301)).rejects.toThrow("work_preflight_expired");
    call.mockResolvedValueOnce({ status: 200, body: { status: "ready", candidate_request_digest: "digest-2" } });
    expect((await executeWorkTool("submit_run", input, identity, ["blueprint:runs:launch"], store, call, 1001)).status).toBe(409);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("does not persist a failed preflight or accept arbitrary fields", async () => {
    const store = new MemoryWorkStore();
    const call = vi.fn(async () => ({ status: 409, body: { status: "blocked" } }));
    await executeWorkTool("preflight_run", { request }, identity, ["blueprint:runs:read"], store, call, 1000);
    expect(store.rows.size).toBe(0);
    await expect(executeWorkTool("get_run_status", { launch_id: "../../secrets" }, identity, ["blueprint:runs:read"], store, call)).rejects.toThrow();
    await expect(executeWorkTool("list_launch_profiles", { url: "https://evil.example" }, identity, ["blueprint:runs:read"], store, call)).rejects.toThrow();
  });
  it("redacts credentials, signed URLs and local paths from tool projections", () => {
    expect(workProjection({ api_key: "never", detail: "Bearer ABCDEFG /etc/blueprint/secret", url: "https://example.com/result?token=secret", value: "sk-proj-abcdefghijklmnop" }))
      .toEqual({ detail: "Bearer [redacted] [host-path]", url: "https://example.com/result?[redacted]", value: "[redacted]" });
  });
  it("never maps resource release to an active-instance deletion API", () => {
    expect(workOperation("request_resource_release", { launch_id: "one", request: {} })).toEqual({ method: "POST", path: "/one/terminal-resource-releases", body: {} });
  });
});
