// @vitest-environment node
import express from "express";
import { existsSync, readFileSync } from "node:fs";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), handler: vi.fn(),
  tempPaths: [] as string[],
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  storageAdmin: { bucket: () => ({ name: "private-test-bucket", upload: state.upload, file: (objectPath: string) => ({ getSignedUrl: async () => [`https://storage.example/review/${encodeURIComponent(objectPath)}?signature=test`], delete: state.remove }) }) },
}));
vi.mock("../routes/contact", () => ({ default: state.handler }));
vi.mock("../logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

let server: Server;
let base: string;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); state.tempPaths = [];
  state.upload.mockImplementation(async (filePath: string) => { state.tempPaths.push(filePath); expect(readFileSync(filePath).length).toBeGreaterThan(0); });
  state.handler.mockImplementation(async (_req, res) => { res.locals.contactRequestPersisted = true; res.status(202).json({ success: true }); });
  const { default: handler } = await import("../routes/contact-task-media");
  const { csrfProtection } = await import("../middleware/csrf");
  const app = express(); app.use(express.json()); app.post("/contact", handler); app.post("/contact-csrf", csrfProtection, handler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  await vi.waitFor(() => { for (const path of state.tempPaths) expect(existsSync(path)).toBe(false); });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const fields = { name: "Test Person", email: "person@example.com", company: "Test Site", message: "A pick-and-place task", requestSource: "website-contact-form" };
function form(files = 1, content = Buffer.from("0000ftypisom0000test-video"), type = "video/mp4") {
  const data = new FormData(); Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  for (let i = 0; i < files; i++) data.append("taskVideos", new Blob([content], { type }), `task-${i}.mp4`);
  return data;
}

describe("contact task video ingestion", () => {
  it("rejects multipart requests without CSRF before parsing or storage", async () => {
    const response = await fetch(`${base}/contact-csrf`, { method: "POST", body: form() });
    expect(response.status).toBe(403); expect(state.upload).not.toHaveBeenCalled(); expect(state.handler).not.toHaveBeenCalled();
  });
  it("streams multiple videos to private storage and binds review metadata to the inquiry", async () => {
    const data = form(2); data.set("taskVideoLinks", JSON.stringify(["https://example.com/task"]));
    const response = await fetch(`${base}/contact`, { method: "POST", body: data });
    expect(response.status).toBe(202);
    expect(state.upload).toHaveBeenCalledTimes(2);
    expect(state.upload.mock.calls[0][1]).toMatchObject({ resumable: false, metadata: { contentType: "video/mp4", cacheControl: "private, no-store" } });
    const [req, res] = state.handler.mock.calls[0];
    expect(res.locals.contactTaskMedia.links).toEqual(["https://example.com/task"]);
    expect(res.locals.contactTaskMedia.uploads).toHaveLength(2);
    expect(res.locals.contactTaskMedia.uploads[0]).toMatchObject({ name: "task-0.mp4", contentType: "video/mp4", sizeBytes: Buffer.byteLength("0000ftypisom0000test-video") });
    expect(res.locals.contactTaskMedia.uploads[0].storageUri).toMatch(/^gs:\/\/private-test-bucket\/contact-task-videos\//);
    expect(req.body.message).toContain("https://example.com/task");
    expect(req.body.message).toContain("private review links expire in 7 days");
    expect(state.remove).not.toHaveBeenCalled();
  });
  it("accepts link-only JSON without fetching remote videos or invoking storage", async () => {
    const response = await fetch(`${base}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, taskVideoLinks: ["https://example.com/video", "https://example.com/video"] }) });
    expect(response.status).toBe(202);
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.handler.mock.calls[0][1].locals.contactTaskMedia.links).toEqual(["https://example.com/video"]);
  });
  it("rejects unsafe links before recording or sending an inquiry", async () => {
    const response = await fetch(`${base}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, taskVideoLinks: ["javascript:alert(1)"] }) });
    expect(response.status).toBe(400); expect(state.handler).not.toHaveBeenCalled();
  });
  it("rejects unsupported file types instead of silently dropping them", async () => {
    const response = await fetch(`${base}/contact`, { method: "POST", body: form(1, Buffer.from("not a video"), "text/html") });
    expect(response.status).toBe(400); expect(state.handler).not.toHaveBeenCalled(); expect(state.upload).not.toHaveBeenCalled();
  });
  it("checks video signatures rather than trusting the MIME label", async () => {
    const response = await fetch(`${base}/contact`, { method: "POST", body: form(1, Buffer.from("<html>not a video</html>")) });
    expect(response.status).toBe(400); expect(state.upload).not.toHaveBeenCalled(); expect(state.handler).not.toHaveBeenCalled();
  });
  it("limits attachments to three files", async () => {
    const response = await fetch(`${base}/contact`, { method: "POST", body: form(4) });
    expect(response.status).toBe(400); expect(state.upload).not.toHaveBeenCalled(); expect(state.handler).not.toHaveBeenCalled();
  });
  it("rejects files above the 50 MB server limit", async () => {
    const response = await fetch(`${base}/contact`, { method: "POST", body: form(1, Buffer.alloc(50 * 1024 * 1024 + 1)) });
    expect(response.status).toBe(400); expect(state.upload).not.toHaveBeenCalled(); expect(state.handler).not.toHaveBeenCalled();
  });
  it("cleans partial cloud uploads when storage fails and does not acknowledge success", async () => {
    state.upload.mockImplementationOnce(async (path: string) => { state.tempPaths.push(path); }).mockRejectedValueOnce(new Error("storage unavailable"));
    const response = await fetch(`${base}/contact`, { method: "POST", body: form(2) });
    expect(response.status).toBe(503);
    await vi.waitFor(() => expect(state.remove).toHaveBeenCalledTimes(2));
    expect(state.handler).not.toHaveBeenCalled();
  });
  it("deletes unbound videos if the durable inquiry write fails", async () => {
    state.handler.mockImplementationOnce(async (_req, res) => res.status(503).json({ error: "database unavailable" }));
    const response = await fetch(`${base}/contact`, { method: "POST", body: form() });
    expect(response.status).toBe(503);
    await vi.waitFor(() => expect(state.remove).toHaveBeenCalledTimes(1));
  });
  it("keeps attachments after persistence even if later email delivery throws", async () => {
    state.handler.mockImplementationOnce(async (_req, res) => { res.locals.contactRequestPersisted = true; throw new Error("email unavailable"); });
    const response = await fetch(`${base}/contact`, { method: "POST", body: form() });
    expect(response.status).toBe(503); expect(state.remove).not.toHaveBeenCalled();
  });
});
