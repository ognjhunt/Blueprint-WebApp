// @vitest-environment node
/** Actual Express route/auth execution in memory; no listening socket or provider call. */
import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const preview = vi.hoisted(() => ({load: vi.fn(), evidence: [] as any[]}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const {sharedFakeFirestore} = await import("./helpers/fake-firestore");
  return {dbAdmin: sharedFakeFirestore, storageAdmin: null, default: {}, authAdmin: {verifyIdToken: async (token: string) => {
    if (token === "development-ops") return {uid: "ops", role: "ops", email: "ops@example.test"};
    return {uid: "ordinary", email: "ordinary@example.test"};
  }}};
});
vi.mock("../utils/websiteCandidateReadiness", async importOriginal => ({...await importOriginal<any>(), loadJobCandidateReadiness: preview.load}));
vi.mock("../utils/siteWalkthrough", () => ({siteWalkthroughIdentity: (requestId: string) => ({requestId}), savedWalkthrough: async () => ({received: true})}));
vi.mock("../utils/jobManagedEvaluation", () => ({loadManagedJobEvidenceForWorkspace: async () => ({managedEvidence: preview.evidence}), assertManagedJobEvidenceReference: vi.fn()}));
vi.mock("../utils/jobEvidenceStore", async importOriginal => ({...await importOriginal<any>(), readJobEvidence: async () => ({evidence: []})}));
vi.mock("../logger", () => ({logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()}}));
vi.mock("express-rate-limit", () => ({default: () => (_req: unknown, _res: unknown, next: () => void) => next()}));
import router from "../routes/job-workflow";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
const token = (requestId = "development-job", scope: "owner" | "film" = "owner") => createCaptureUploadToken({requestId,
  captureId: `walkthrough-${requestId}`, sceneId: `site-${requestId}`, scope});
function get(path: string, authorization?: string): Promise<{status: number; body: any; cache: unknown}> {
  const app = express(); app.use(router);
  const request = new IncomingMessage(new Socket()); request.method = "GET"; request.url = path;
  request.headers = authorization ? {authorization: `Bearer ${authorization}`} : {};
  const response = new ServerResponse(request);
  return new Promise((resolve, reject) => {
    response.end = ((chunk: any) => {resolve({status: response.statusCode, body: JSON.parse(String(chunk)), cache: response.getHeader("cache-control")}); return response;}) as typeof response.end;
    app.handle(request, response, (error?: any) => reject(error ?? Error("route not handled")));
  });
}
beforeEach(() => {
  state.docs.clear(); preview.load.mockReset(); preview.evidence = [];
  for (const id of ["development-job", "other-job"]) {
    state.docs.set(`inboundRequests/${id}`, {request: {buyerType: "site_operator"}, active_capture_id: `walkthrough-${id}`});
    state.docs.set(`siteTaskBriefs/${id}`, {requestId: id, summary: "Development task"});
    state.docs.set(`captureUploadSessions/walkthrough-${id}`, {website_preparation: {selector: {request_id: id}}});
  }
  preview.load.mockImplementation(async (requestId: string) => ({state: "available", revision: "opaque", catalogCandidateCount: 2,
    candidates: ["a", "b"].map(candidateId => ({candidateId, configurationDigest: "sha256:" + "a".repeat(64), name: `${requestId} ${candidateId}`, compatibility: "not_evaluated", kind: "learned_policy", notes: []}))}));
});
it("owner route uses its verified job identity, no-cache and separate preparation, with genuine published IDs taking precedence", async () => {
  preview.evidence = [{current: true, screening: {candidates: [{candidateId: "a", configurationDigest: "sha256:" + "a".repeat(64)}]}}];
  const response = await get(`/owner/${token()}`);
  expect(response.status).toBe(200); expect(response.cache).toBe("no-store");
  expect(preview.load).toHaveBeenCalledWith("development-job", "walkthrough-development-job");
  expect(response.body.candidateReadiness.candidates.map((row: any) => row.candidateId)).toEqual(["b"]);
  expect(response.body.managedEvidence[0].screening.candidates[0].candidateId).toBe("a");
  expect(JSON.stringify(response.body)).not.toContain("other-job");
});
it("film and invalid links cannot access candidate preparation; authorized admin can", async () => {
  expect((await get(`/owner/${token("development-job", "film")}`)).status).toBe(403);
  expect((await get("/owner/invalid")).status).toBe(403);
  expect(preview.load).not.toHaveBeenCalled();
  expect((await get("/admin/development-job", "development-ops")).status).toBe(200);
  expect(preview.load).toHaveBeenCalledTimes(1);
});
it("read-only companion unavailability preserves the job and its genuine results", async () => {
  preview.load.mockResolvedValue({state: "unavailable", message: "Candidate preparation details are temporarily unavailable."});
  const response = await get(`/owner/${token()}`);
  expect(response.status).toBe(200); expect(response.body.jobId).toBe("development-job");
  expect(response.body.candidateReadiness.state).toBe("unavailable"); expect(response.body.managedEvidence).toEqual([]);
});
