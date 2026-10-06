// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import vector from "./fixtures/website-withdrawal-vector.json";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
import { signedCaptureLifecycleRequest } from "../utils/captureLifecycleForwarding";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { websiteWithdrawalCommand } from "../utils/websiteCaptureWithdrawal";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL;
  delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL;
});

it("emits the shared Pipeline command on the actual configured signed intake route", async () => {
  delete process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL;
  process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL = vector.intake_forward_url;
  const command = websiteWithdrawalCommand("req1", vector.web_withdrawal);
  expect(command).toEqual(vector.command);
  expect(canonicalArtifactDigest(command, "digest")).toBe(vector.command_digest);
  const fetch = vi.fn(async () => new Response(JSON.stringify({ accepted: true })));
  vi.stubGlobal("fetch", fetch);
  const result = await signedCaptureLifecycleRequest({ path: "/website-capture-withdrawals", method: "POST", body: command,
    token: "synthetic-token", clientId: "test-client", schema: z.object({ accepted: z.literal(true) }), blocker: "synthetic_pending" });
  expect(result.status).toBe("forwarded");
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(new URL(url).pathname).toBe(vector.expected_path);
  expect(JSON.parse(String(init.body))).toEqual(vector.command);
  const headers = init.headers as Record<string, string>;
  expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${createHmac("sha256", "synthetic-token")
    .update(`${headers["x-blueprint-pipeline-timestamp"]}.test-client.${headers["x-blueprint-pipeline-nonce"]}.${init.body}`)
    .digest("hex")}`);
});
