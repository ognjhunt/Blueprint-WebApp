// @vitest-environment node
/**
 * The simulation use counters (owner, 2026-11-25): one counter per job, company and kind, counted where the bytes are
 * served, fire and forget. A download is counted once per download (not per resumed range), a viewer open once per
 * load of the scene by a company's viewer; nothing is counted for a refused request, the site's own viewer or staff.
 * A write that fails or never ends never holds the bytes back; it only logs.
 */
import express from "express";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { FieldValue } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  writes: [] as Array<{ path: string; data: Record<string, unknown>; options: unknown }>,
  behaviour: "ok" as "ok" | "hang" | "reject" | "throw",
  refusal: null as string | null,
  warn: [] as string[],
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const ref = (path: string): any => ({
    id: path.split("/").at(-1),
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    get: async () => ({ exists: true, data: () => ({}) }),
    set: (data: Record<string, unknown>, options: unknown) => {
      store.writes.push({ path, data, options });
      if (store.behaviour === "throw") throw new Error("store down");
      if (store.behaviour === "reject") return Promise.reject(new Error("store down"));
      if (store.behaviour === "hang") return new Promise(() => undefined);
      return Promise.resolve();
    },
  });
  return { default: {}, dbAdmin: { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(),
  warn: vi.fn((_context: unknown, message: string) => { store.warn.push(message); }) } }));
vi.mock("../utils/companyJobPage", () => ({ companyMediaRefusal: vi.fn(async () => store.refusal) }));

const ZIP = Buffer.from("PK-ZIP-BYTES");
vi.mock("../utils/websiteCompanySimulation", () => ({
  verifyCompanySimulationTicket: () => true,
  storedCompanySimulation: () => ({ capture_id: "walkthrough-job-1" }),
  fetchCompanySimulation: vi.fn(async (_jobId: string, _reference: unknown, range: string | null) => ({ ok: true,
    status: range ? 206 : 200, body: Readable.from([ZIP]),
    headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="simulation.zip"' } })),
}));

const files = vi.hoisted(() => ({ splat: "", settings: "" }));
vi.mock("../utils/websiteScenePreview", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/websiteScenePreview")>(),
  verifyWebsiteScenePreviewCompanyViewTicket: () => true,
  verifyWebsiteScenePreviewViewTicket: () => true,
  verifyWebsiteScenePreviewAdminViewTicket: () => true,
  viewableWebsiteScenePreview: () => ({ scene_revision: 1 }),
  adminViewableWebsiteScenePreview: () => ({ scene_revision: 1 }),
  websiteScenePreviewViewerFiles: async () => files,
}));

import { SIMULATION_USE_COLLECTION, recordSimulationUse, simulationUseRowOf, startsSimulationDownload } from "../utils/simulationUse";

const JOB = "job-1", COMPANY = "a".repeat(64);
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

beforeEach(() => {
  store.writes.length = 0;
  store.warn.length = 0;
  store.behaviour = "ok";
  store.refusal = null;
});

describe("the counter", () => {
  it("adds one to the job's counter for the company and kind, and names nothing but the company's id", () => {
    recordSimulationUse(JOB, COMPANY, "download");
    expect(store.writes).toHaveLength(1);
    const [write] = store.writes;
    expect(write.path).toBe(`inboundRequests/${JOB}/${SIMULATION_USE_COLLECTION}/${COMPANY}-download`);
    expect(Object.keys(write.data).sort()).toEqual(["companyId", "count", "kind", "lastAtIso"]);
    expect(write.data).toMatchObject({ companyId: COMPANY, kind: "download" });
    expect((write.data.count as FirebaseFirestore.FieldValue).isEqual(FieldValue.increment(1))).toBe(true);
    expect(write.options).toEqual({ merge: true });
    // Not a billable event: nothing is written outside the job's own counter.
    expect(store.writes.some(entry => entry.path.startsWith("billableEvents"))).toBe(false);
  });

  it("writes nothing for an id that is not a job's or a company's, or a kind it does not know", () => {
    recordSimulationUse("../job", COMPANY, "download");
    recordSimulationUse(JOB, "someone@example.com", "download");
    recordSimulationUse(JOB, COMPANY, "share" as never);
    expect(store.writes).toEqual([]);
  });

  it("returns at once, and a write that fails, throws or never ends only logs", async () => {
    store.behaviour = "hang";
    expect(recordSimulationUse(JOB, COMPANY, "viewer_open")).toBeUndefined();
    store.behaviour = "reject";
    recordSimulationUse(JOB, COMPANY, "viewer_open");
    store.behaviour = "throw";
    expect(() => recordSimulationUse(JOB, COMPANY, "viewer_open")).not.toThrow();
    await settle();
    expect(store.warn).toEqual(["Could not count a company's use of the simulation", "Could not count a company's use of the simulation"]);
  });

  it("counts a download once: no range or a range from the first byte; never a resumed part", () => {
    expect(startsSimulationDownload(undefined)).toBe(true);
    expect(startsSimulationDownload("")).toBe(true);
    expect(startsSimulationDownload("bytes=0-")).toBe(true);
    expect(startsSimulationDownload("bytes=0-1023")).toBe(true);
    expect(startsSimulationDownload("bytes=1024-")).toBe(false);
    expect(startsSimulationDownload("bytes=-500")).toBe(false);
    expect(startsSimulationDownload("bytes=0-10,20-30")).toBe(false);
  });

  it("reads back only a well-formed counter", () => {
    expect(simulationUseRowOf({ companyId: COMPANY, kind: "download", count: 2 })).toEqual({ companyId: COMPANY, kind: "download", count: 2 });
    expect(simulationUseRowOf({ companyId: COMPANY, kind: "download", count: -1 })).toBeNull();
    expect(simulationUseRowOf({ companyId: "x", kind: "download", count: 1 })).toBeNull();
    expect(simulationUseRowOf({ companyId: COMPANY, kind: "share", count: 1 })).toBeNull();
    expect(simulationUseRowOf(undefined)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- at the two routes */

let server: Server;
let base: string;
beforeEach(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "simulation-use-"));
  files.splat = path.join(dir, "scene.ply");
  files.settings = path.join(dir, "settings.json");
  writeFileSync(files.splat, "ply");
  writeFileSync(files.settings, "{}");
  const { default: media } = await import("../routes/company-media");
  const { default: views } = await import("../routes/website-atlas-preview-views");
  const app = express();
  app.use("/api/company-media", media);
  app.use("/api/website-atlas-preview-views", views);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const download = (headers: Record<string, string> = {}) =>
  fetch(`${base}/api/company-media/jobs/${JOB}/simulation.zip?capture=walkthrough-${JOB}&viewer=${COMPANY}&expires=1&signature=x`, { headers });
const view = (file: string, query: string) =>
  fetch(`${base}/api/website-atlas-preview-views/${JOB}/walkthrough-${JOB}/${file}?source=scene&expires=1&signature=x${query}`);
const counted = (kind: string) => store.writes.filter(write => write.path.endsWith(`-${kind}`));

describe("the download route", () => {
  it("counts a download started, and not a resumed part of one", async () => {
    const whole = await download();
    expect(whole.status).toBe(200);
    expect(Buffer.from(await whole.arrayBuffer()).equals(ZIP)).toBe(true);
    expect(counted("download")).toHaveLength(1);
    await (await download({ range: "bytes=0-" })).arrayBuffer();
    await (await download({ range: "bytes=4-" })).arrayBuffer();
    expect(counted("download")).toHaveLength(2);
    expect(counted("download")[0].path).toBe(`inboundRequests/${JOB}/simulationUse/${COMPANY}-download`);
  });

  it("counts nothing for a refused request", async () => {
    store.refusal = "not_listed";
    expect((await download()).status).toBe(404);
    expect(store.writes).toEqual([]);
  });

  it("serves the bytes whether or not the count is written", async () => {
    store.behaviour = "hang";
    const pending = await download();
    expect(pending.status).toBe(200);
    expect(Buffer.from(await pending.arrayBuffer()).equals(ZIP)).toBe(true);
    store.behaviour = "reject";
    expect((await download()).status).toBe(200);
  });
});

describe("the viewer route", () => {
  it("counts an open when a company's viewer loads the scene, not its settings", async () => {
    expect((await view("settings.json", `&viewer=${COMPANY}`)).status).toBe(200);
    expect(store.writes).toEqual([]);
    const scene = await view("scene.ply", `&viewer=${COMPANY}`);
    expect(scene.status).toBe(200);
    expect(await scene.text()).toBe("ply");
    expect(counted("viewer_open").map(write => write.path)).toEqual([`inboundRequests/${JOB}/simulationUse/${COMPANY}-viewer_open`]);
  });

  it("counts nothing for the site's own viewer, staff, or a company refused", async () => {
    expect((await view("scene.ply", "")).status).toBe(200);
    expect((await view("scene.ply", "&admin=1")).status).toBe(200);
    store.refusal = "not_listed";
    expect((await view("scene.ply", `&viewer=${COMPANY}`)).status).toBe(404);
    expect(store.writes).toEqual([]);
  });
});
