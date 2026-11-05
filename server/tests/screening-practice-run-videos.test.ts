// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { rm, stat } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: {
  collection: (collection: string) => ({ doc: (id: string) => ({ get: async () => {
    const key = `${collection}/${id}`;
    return { exists: store.rows.has(key), data: () => structuredClone(store.rows.get(key)) };
  } }) }),
} }));

import producer from "./fixtures/pipeline-beta-policy-screening-review-videos.v2.json";
import { parseBetaPolicyScreeningPublication, screeningPublicationTransition,
  type BetaPolicyScreeningPublication } from "../utils/betaPolicyScreeningContract";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { practiceRunVideoCachePath, practiceRunVideoUrl, videoByteRange } from "../utils/screeningPracticeRunVideos";

const realFetch = globalThis.fetch;
const seal = (value: any): any => ({ ...value, publication_digest: crossRuntimeArtifactDigest(value, "publication_digest") });
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const consent = { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-18T00:00:00.000Z" };
const RUN = producer.campaign_id, CANDIDATE = producer.candidates[0].candidate_id;

/** The Pipeline's publication with its first run's first video replaced by `bytes`. */
function withVideo(bytes: Buffer, wrong?: Buffer) {
  const value = structuredClone(producer) as any;
  value.review_videos[0].practice_runs[0].videos[0] = { ...value.review_videos[0].practice_runs[0].videos[0],
    sha256: `sha256:${sha(bytes)}`, size_bytes: bytes.length };
  if (wrong) value.review_videos[0].practice_runs[0].videos[1] = { ...value.review_videos[0].practice_runs[0].videos[1],
    sha256: `sha256:${sha(wrong)}`, size_bytes: wrong.length };
  return seal(value) as BetaPolicyScreeningPublication;
}

describe("the publication's practice-run videos", () => {
  it("accepts the Pipeline's own publication with its practice runs", () => {
    const parsed = parseBetaPolicyScreeningPublication(producer);
    expect(parsed?.review_videos?.[0].practice_runs).toHaveLength(producer.candidates[0].episodes_planned);
    expect(parsed?.review_videos?.[0].practice_runs[0].videos[0]).toMatchObject({ phase: "run", camera: "external" });
  });

  it.each([
    ["a candidate that did not complete", (value: any) => { value.candidates[0].status = "running"; value.status = "running";
      value.candidates[0] = { ...value.candidates[0], episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0,
        success_rate: null, session_result_digest: null }; }],
    ["outcomes that disagree with the counts", (value: any) => { value.review_videos[0].practice_runs[0].outcome = "failure"; }],
    ["fewer runs than planned episodes", (value: any) => { value.review_videos[0].practice_runs.pop(); }],
    ["an unknown candidate", (value: any) => { value.review_videos[0].candidate_id = "someone-else"; }],
    ["the same candidate twice", (value: any) => { value.review_videos.push(structuredClone(value.review_videos[0])); }],
    ["no video at all", (value: any) => { value.review_videos[0].practice_runs.forEach((run: any) => { run.videos = []; }); }],
    ["a path in a video", (value: any) => { value.review_videos[0].practice_runs[0].videos[0].relative_path = "videos/00.mp4"; }],
    ["a video over the size bound", (value: any) => { value.review_videos[0].practice_runs[0].videos[0].size_bytes = 64 * 1024 * 1024 + 1; }],
  ])("refuses %s", (_name, change) => {
    const value = structuredClone(producer) as any;
    change(value);
    expect(parseBetaPolicyScreeningPublication(seal(value))).toBeNull();
  });

  it("lets a later revision add a finished run's videos, never change or drop them", () => {
    const { review_videos: _videos, ...without } = structuredClone(producer) as any;
    const earlier = seal({ ...without, revision: producer.revision - 1 }) as BetaPolicyScreeningPublication;
    const added = parseBetaPolicyScreeningPublication(producer)!;
    expect(screeningPublicationTransition(earlier, added)).toBe("updated");
    const changed = structuredClone(producer) as any;
    changed.revision += 1;
    changed.review_videos[0].manifest_digest = `sha256:${"9".repeat(64)}`;
    expect(() => screeningPublicationTransition(added, seal(changed))).toThrow("screening_review_videos_conflict");
    expect(() => screeningPublicationTransition(added, seal({ ...without, revision: producer.revision + 1 })))
      .toThrow("screening_review_videos_conflict");
  });

  it("projects each completed candidate's practice runs with their outcome and video ids, never a path or code", () => {
    const publication = parseBetaPolicyScreeningPublication(producer)!;
    const run = { run_id: RUN, run_kind: "beta_policy_screening", state: "completed", result_record_id: "result-1",
      job_evidence_binding: { job_id: "job-1", brief_digest: `sha256:${"1".repeat(64)}` },
      job_task_context_digest: publication.source.task_context_digest, configuration_digest: publication.plan_digest,
      source_scene_intent_id: publication.source.scene_intent_id, source_scene_revision_digest: publication.source.scene_revision_digest,
      publication_digest: publication.publication_digest, publication_revision: publication.revision };
    const projected = projectManagedJobEvidence(RUN, run, { record_id: "result-1", publication }, "job-1",
      run.job_evidence_binding.brief_digest, publication.source.task_context_digest, null)!;
    const [candidate] = projected.screening!.candidates;
    expect(candidate.practiceRuns).toHaveLength(10);
    expect(candidate.practiceRuns![0]).toEqual({ number: 1, outcome: "success",
      videos: producer.review_videos[0].practice_runs[0].videos.map(video => ({ videoId: video.sha256.slice(7),
        camera: video.camera, phase: video.phase, durationSeconds: video.duration_seconds })) });
    expect(candidate.practiceRuns!.map(row => row.outcome)).toEqual(producer.review_videos[0].practice_runs.map(row => row.outcome));
    expect(JSON.stringify(candidate.practiceRuns)).not.toMatch(/manifest|cell_id|sha256:|relative_path/);
    expect(JSON.stringify(projected)).not.toMatch(/manifest|cell_id|relative_path/);
  });
});

describe("the practice-run video view route", () => {
  const bytes = Buffer.from("synthetic practice run video bytes, not a real recording");
  const wrong = Buffer.from("the bytes the Pipeline was asked for");
  const videoId = sha(bytes), wrongId = sha(wrong);
  let server: Server, pipeline: Server, base = "";
  const asked: Array<{ path: string; search: string; signed: boolean }> = [];

  beforeEach(async () => {
    store.rows.clear(); asked.length = 0;
    await Promise.all([videoId, wrongId].map(id => rm(practiceRunVideoCachePath(id), { force: true })));
    pipeline = createServer((req, res) => {
      const url = new URL(req.url!, "http://pipeline.invalid");
      asked.push({ path: url.pathname, search: url.search, signed: /^sha256=[a-f0-9]{64}$/.test(String(req.headers["x-blueprint-pipeline-signature"])) });
      // For the second video the Pipeline answers with other bytes than the published ones.
      const body = url.pathname.endsWith(videoId) ? bytes : url.pathname.endsWith(wrongId) ? bytes : null;
      if (!body) { res.statusCode = 404; return res.end(); }
      res.setHeader("content-type", "video/mp4");
      res.end(body);
    });
    await new Promise<void>(resolve => pipeline.listen(0, "127.0.0.1", resolve));
    vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", `http://127.0.0.1:${(pipeline.address() as any).port}`);
    vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-forward-token");
    vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
    const publication = withVideo(bytes, wrong);
    store.rows.set("inboundRequests/job-1", { account_owner_uid: "owner-1", request: { buyerType: "site_operator", consent_attestation: { ...consent } } });
    store.rows.set(`taskEvaluationPolicyRuns/${RUN}`, { run_id: RUN, run_kind: "beta_policy_screening", result_record_id: "result-1",
      job_evidence_binding: { job_id: "job-1" }, publication_digest: publication.publication_digest });
    store.rows.set("captureTaskEvaluationRuns/result-1", { record_id: "result-1", publication });
    const app = express();
    app.use("/api/screening-practice-run-videos", (await import("../routes/screening-practice-run-videos")).default);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    server.closeAllConnections(); pipeline.closeAllConnections();
    await Promise.all([server, pipeline].map(item => new Promise<void>(resolve => item.close(() => resolve()))));
  });
  const watch = (url: string, headers: Record<string, string> = {}) => realFetch(`${base}${url}`,
    { headers: { "sec-fetch-dest": "video", "sec-fetch-mode": "no-cors", ...headers } });
  const urlFor = (id = videoId, owner = "owner-1", now?: number) => practiceRunVideoUrl("job-1", RUN, CANDIDATE, id, owner, now)!;

  it("serves the owner's published video inline, uncached and by range, after one verified signed read", async () => {
    const url = urlFor();
    expect(url).toMatch(new RegExp(`^/api/screening-practice-run-videos/job-1/${RUN}/${CANDIDATE}/${videoId}\\.mp4\\?expires=\\d+&signature=[0-9a-f]{64}$`));
    const whole = await watch(url);
    expect(whole.status).toBe(200);
    expect(Buffer.from(await whole.arrayBuffer())).toEqual(bytes);
    expect(Object.fromEntries(["content-type", "content-disposition", "cache-control", "x-content-type-options", "accept-ranges"]
      .map(name => [name, whole.headers.get(name)]))).toEqual({ "content-type": "video/mp4", "content-disposition": "inline",
      "cache-control": "private, no-store", "x-content-type-options": "nosniff", "accept-ranges": "bytes" });
    expect(asked).toEqual([{ path: `/api/live-pipeline/beta-screening-review-videos/${videoId}`,
      search: "?request_id=job-1&capture_id=walkthrough-job-1", signed: true }]);
    const part = await watch(url, { range: "bytes=0-8" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-8/${bytes.length}`);
    expect(Buffer.from(await part.arrayBuffer())).toEqual(bytes.subarray(0, 9));
    expect((await watch(url, { range: "bytes=999999-" })).status).toBe(416);
    expect(asked).toHaveLength(1);
  });

  it("refuses a direct visit, a forged or expired ticket, another owner's ticket and an unpublished video", async () => {
    const url = urlFor();
    const visited = await watch(url, { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" });
    expect(visited.status).toBe(403);
    expect(await visited.json()).toMatchObject({ code: "screening_practice_run_video_view_only" });
    expect((await watch(url.replace(/signature=[0-9a-f]{64}/, `signature=${"0".repeat(64)}`))).status).toBe(404);
    expect((await watch(urlFor(videoId, "owner-1", Math.floor(Date.now() / 1000) - 16 * 60))).status).toBe(404);
    expect((await watch(urlFor(videoId, "someone-else"))).status).toBe(404);
    expect((await watch(urlFor("c".repeat(64)))).status).toBe(404);
    expect((await watch(url.replace("/job-1/", "/job-2/"))).status).toBe(404);
    expect(asked).toEqual([]);
  });

  it("re-reads ownership and consent on every request, and forgets a cached copy once consent is withdrawn", async () => {
    const url = urlFor();
    expect((await watch(url)).status).toBe(200);
    expect((await stat(practiceRunVideoCachePath(videoId))).size).toBe(bytes.length);
    store.rows.get("inboundRequests/job-1").account_owner_uid = "new-owner";
    expect((await watch(url)).status).toBe(404);
    store.rows.get("inboundRequests/job-1").account_owner_uid = "owner-1";
    store.rows.get("inboundRequests/job-1").request.consent_attestation.withdrawn_at_iso = "2026-11-05T12:00:00Z";
    expect((await watch(url)).status).toBe(404);
    await expect(stat(practiceRunVideoCachePath(videoId))).rejects.toThrow();
  });

  it("never serves bytes that do not match the published digest", async () => {
    const response = await watch(urlFor(wrongId));
    expect(response.status).toBe(503);
    await expect(stat(practiceRunVideoCachePath(wrongId))).rejects.toThrow();
  });

  it("reads one byte range at a time", () => {
    expect(videoByteRange(undefined, 10)).toBeNull();
    expect(videoByteRange("bytes=2-", 10)).toEqual({ start: 2, end: 9 });
    expect(videoByteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(videoByteRange("bytes=4-99", 10)).toEqual({ start: 4, end: 9 });
    for (const header of ["bytes=10-", "bytes=5-2", "bytes=0-1,3-4", "items=0-1", "bytes=-"])
      expect(videoByteRange(header, 10)).toBe("invalid");
  });
});
