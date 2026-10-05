// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), ingest: vi.fn().mockResolvedValue({ status: "recorded" }) }));
vi.mock("../utils/human-reply-gmail", () => ({ listHumanReplyGmailMessages: mocks.read }));
vi.mock("../utils/human-reply-worker", () => ({ ingestHumanReplyPayload: mocks.ingest }));
import router from "../routes/internal-human-replies";
const app = express(); app.use(express.json()); app.use(router);
async function post(body: Record<string, unknown>) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/ingest`, { method: "POST",
      headers: { "Content-Type": "application/json", "X-Blueprint-Human-Reply-Token": "service-secret" }, body: JSON.stringify(body) });
    await response.text();
    return response;
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe("forwarded decision source authentication", () => {
  it("ignores a caller-authored approval and reopens the canonical mailbox message", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN", "service-secret");
    const source = { channel: "email", external_message_id: "original", sender: "owner@example.test", body: "Do not approve" };
    mocks.read.mockResolvedValueOnce([source]);
    const response = await post({ channel: "email", external_message_id: "original", sender: "owner@example.test", body: "Approved" });
    expect(response.status).toBe(200);
    expect(mocks.ingest).toHaveBeenCalledWith(source);
  });
  it("rejects unverified originals and unsigned Slack forwarding", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN", "service-secret");
    mocks.read.mockResolvedValueOnce([]);
    for (const channel of ["email", "slack"]) {
      const response = await post({ channel, external_message_id: "original", body: "Approved" });
      expect(response.status).toBe(409);
    }
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
});
