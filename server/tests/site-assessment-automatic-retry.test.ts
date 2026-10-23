// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const seams = vi.hoisted(() => ({ objects: new Map<string, any>(), enabled: true, coverageActive: false, run: vi.fn(), manifest: vi.fn(), marker: vi.fn() }));
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
// Test video bytes are not real video: strip sound with the in-process fake.
vi.mock("../agents/adapters/video-audio-strip", async (importOriginal) =>
  (await import("./helpers/fake-ffmpeg")).withFakeFfmpeg(await importOriginal()));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
 default: { firestore: {FieldValue: {serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => undefined}}},
 dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
 storageAdmin: {bucket: (name = "blueprint-8c1ca.appspot.com") => ({name, file: (object: string, options?: any) => {
   const get = () => {const row=seams.objects.get(object);if(!row || options?.generation && options.generation!==row.generation) throw Error("synthetic_object_missing");return row;};
   return {getMetadata: async()=>[{name:object,...get(),size:String(get().bytes.length)}], download: async()=>[get().bytes], exists: async()=>[seams.objects.has(object)],
    getSignedUrl: async()=>["https://example.invalid/scripted-no-fetch"], save: async()=>{throw Error("unexpected_object_write")}, delete: async()=>{throw Error("unexpected_object_delete")}};
 }})}
}));
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => seams.enabled }));
vi.mock("../agents/runtime", () => ({ runAgentTask: seams.run }));
vi.mock("../utils/captureCoverageQueue", () => ({ isCoverageReviewActive: () => seams.coverageActive }));
vi.mock("../utils/websiteBrowserUploadStatus", async () => ({ ...await vi.importActual("../utils/websiteBrowserUploadStatus"), verifiedPendingManifest: seams.manifest, verifiedPendingMarker: seams.marker }));
vi.mock("../logger", () => ({ attachRequestMeta: (x:any)=>x, logger: { info:vi.fn(), warn: vi.fn(), error:vi.fn(), debug:vi.fn() } }));
import { publishBrowserPending, browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
let wakeSpy: ReturnType<typeof vi.spyOn>;
const selectedJob = () => [...state.docs].find(([key]) => key.startsWith("siteAssessmentJobs/"))!;
afterEach(() => { wakeSpy?.mockRestore(); });
const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "advisory-fixture", scene_id: "site-advisory-fixture",
  capture_id: "walkthrough-advisory-fixture", state: "held", completed_at_iso: "2026-10-08T00:00:00.000Z",
  video: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/walkthrough.mp4", generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/manifest.json", generation: "90071992547409932", size_bytes: 500, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
const request = () => ({ request: { buyerType: "site_operator", capture_mode: "self_capture", taskDescription: "Move a bin; success remains unknown",
  consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } },
  capture_privacy_source_bound_decision: { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened",
    producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
import { AUTOMATIC_ASSESSMENT_RETRIES, transientAssessmentFailure } from "../utils/siteAssessmentQueue";
beforeEach(async () => {
  wakeSpy=vi.spyOn(await import("../utils/siteAssessmentQueue"),"tickSiteAssessments").mockResolvedValue();
  seams.enabled = true; seams.coverageActive = false; seams.run.mockReset(); seams.manifest.mockReset().mockResolvedValue(JSON.stringify({capture_rights:{derived_scene_generation_allowed:true,consent_status:"granted",consent_revoked:false}})); seams.marker.mockReset().mockResolvedValue(true); seams.objects.clear(); state.docs.clear(); state.docs.set(`inboundRequests/${pending.request_id}`, request());
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending }); });

// A provider timeout is ours to absorb: the worker retries it without the site
// pressing anything (owner direction 2026-10-23). Fake stores, actual SDK,
// scripted providers; derived from the retry journey fixture.
async function joinedCapture(taskDescription?: string) {
  const { buildBrowserDelivery } = await import("../utils/websiteCaptureDelivery");
  const { projectWebsiteCaptureRights } = await import("../utils/websiteTaskContext");
  const joined = structuredClone(pending);
  const raw = {...request(), contact:{firstName:"Synthetic",lastName:"Fixture",email:"synthetic@example.invalid",roleTitle:"Owner",company:"Synthetic fixture"}};
  // Job and run ids derive from the request context; a distinct one keeps runs apart.
  if (taskDescription) raw.request.taskDescription = taskDescription;
  const bytes = Buffer.from(JSON.stringify({request_id: joined.request_id, scene_id:joined.scene_id, capture_id:joined.capture_id,
    video_uri:joined.video.object_name,duration_seconds:10,capture_source:"browser_self_capture",capture_rights:projectWebsiteCaptureRights(raw)}));
  joined.manifest.size_bytes=bytes.length;joined.manifest.sha256=`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  raw.capture_privacy_source_bound_decision.producer_source.key=browserPendingDecisionKey(joined);
  state.docs.set(`inboundRequests/${joined.request_id}`,raw);
  state.docs.set(`captureUploadSessions/${joined.capture_id}`,{browser_pending_delivery:joined});
  const put=(name:string,generation:string,body:Buffer,contentType="application/json")=>seams.objects.set(name,{generation,crc32c:"AAAAAA==",bytes:body,contentType});
  put(joined.video.object_name,joined.video.generation,Buffer.from("video-1"),"video/mp4");put(joined.manifest.object_name,joined.manifest.generation,bytes);
  const delivery=buildBrowserDelivery({requestId:joined.request_id,sceneId:joined.scene_id,captureId:joined.capture_id,
    rawPrefix:joined.video.object_name.slice(0,joined.video.object_name.lastIndexOf("/")),video:joined.video,manifest:joined.manifest,completedAtIso:joined.completed_at_iso});
  put(`${delivery.record.raw_prefix}/capture_upload_complete.json`,"30",delivery.markerBytes);put(delivery.objectName,"31",delivery.recordBytes);
  const realUpload=await vi.importActual<typeof import("../utils/websiteBrowserUploadStatus")>("../utils/websiteBrowserUploadStatus");
  seams.manifest.mockImplementation(realUpload.verifiedPendingManifest);seams.marker.mockImplementation(realUpload.verifiedPendingMarker);
  return joined;
}

async function scriptedProviders(timeouts: number) {
  const { OpenAIProvider, Usage, setTracingDisabled } = await import("@openai/agents");
  const { APIConnectionTimeoutError } = await import("openai");
  setTracingDisabled(true);
  const gemini = await import("../agents/adapters/gemini-video");
  const counter = { calls: 0 };
  const modelSpy=vi.spyOn(OpenAIProvider.prototype,"getModel").mockResolvedValue({
    async getResponse(input:any) {
      counter.calls++;
      if (counter.calls <= timeouts) throw new APIConnectionTimeoutError();
      const source=JSON.stringify(input.input).match(/video:walkthrough-advisory-fixture:[a-f0-9]{12}/)?.[0];
      const packet={status:"needs_operator_input",job:[{text:"A carton moves",basis:"observed",evidence:[{source_id:source,at_seconds:2,selector:{kind:"video_observation",observation_index:0,field_path:null}}]}],
        objects_motions_conditions_variations:[],operator_success:[],known:[],estimates:[],missing:[],approaches:[],questions:[],
        next_action:{kind:"ask_operator",action:"Clarify success",why:{text:"Success criteria unknown",basis:"unknown",evidence:[]}}};
      return {output:counter.calls===timeouts+1?[{type:"function_call",callId:"auto-retry-video-call",name:"analyze_site_video",arguments:JSON.stringify({question:"What moves?",processing:"auto",sampling_fps:2})}]:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(packet)}]}],usage:new Usage(),providerData:{usage:{input_tokens:20,output_tokens:10}}} as any;
    },async *getStreamedResponse(){throw Error("unexpected_stream");}
  } as any);
  const videoSpy=vi.spyOn(gemini,"analyseAgenticVideo").mockResolvedValue({text:JSON.stringify({summary:"Carton movement",observations:[{category:"motion",finding:"A carton moves",basis:"observed",start_seconds:1,end_seconds:3,uncertainty:"Hands partly occluded"}],not_observable:["weight"]}),
    usage:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:30},processing:{mode:"static",sampling_fps_requested:2,media_tool_calls:0,media_tool_responses:0}} as any);
  const fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation(()=>{throw Error("unexpected_external_network");});
  vi.stubEnv("OPENAI_API_KEY","synthetic-no-provider");vi.stubEnv("GEMINI_API_KEY","synthetic-no-provider");
  seams.run.mockImplementation(async(task,options)=>(await vi.importActual<typeof import("../agents/runtime")>("../agents/runtime")).runAgentTask(task,options));
  return { counter, videoSpy, restore: () => { modelSpy.mockRestore(); videoSpy.mockRestore(); fetchGuard.mockRestore(); vi.unstubAllEnvs(); } };
}

it("retries a provider timeout on its own and completes, with nothing asked of the site", async () => {
  const joined = await joinedCapture();
  const providers = await scriptedProviders(1);
  try {
    const queue = await import("../utils/siteAssessmentQueue");
    await publishBrowserPending(joined);
    await queue.reconcileSiteAssessments();
    const [key, retried] = selectedJob();
    expect(providers.counter.calls).toBe(1);
    expect(retried.state).toBe("queued");
    expect(retried.retry_history).toHaveLength(1);
    expect(retried.retry_history[0].retry_identity).toMatch(/^auto-1-site-assessment-/);
    expect(state.docs.get(`inboundRequests/${joined.request_id}`)?.site_advisory.state).toBe("queued");
    // The bounded queue resumes after its retained cursor, so a pass may wrap first.
    for (let pass = 0; pass < 4 && state.docs.get(key)!.state !== "completed"; pass++) await queue.reconcileSiteAssessments();
    const done = state.docs.get(key)!;
    expect(done.state, JSON.stringify(state.docs.get(`agentRuns/${done.run_id}`))).toBe("completed");
    expect(providers.counter.calls).toBe(3); expect(providers.videoSpy).toHaveBeenCalledTimes(1);
  } finally { providers.restore(); }
}, 30000);

it(`stops after ${AUTOMATIC_ASSESSMENT_RETRIES} automatic retries and leaves the job for review`, async () => {
  const joined = await joinedCapture("Move a bin; the provider never answers");
  const providers = await scriptedProviders(Number.POSITIVE_INFINITY);
  try {
    const queue = await import("../utils/siteAssessmentQueue");
    await publishBrowserPending(joined);
    // Each retry may need one wrapping pass of the bounded queue before it is claimed.
    for (let pass = 0; pass < 4 * (AUTOMATIC_ASSESSMENT_RETRIES + 1); pass++) await queue.reconcileSiteAssessments();
    const [, job] = selectedJob();
    expect(job.state).toBe("needs_review");
    expect(job.retry_history.map((row: any) => row.retry_identity.split("-").slice(0, 2).join("-"))).toEqual(["auto-1", "auto-2"]);
    expect(providers.counter.calls).toBe(AUTOMATIC_ASSESSMENT_RETRIES + 1);
  } finally { providers.restore(); }
}, 30000);

it("treats only provider timeouts, connection errors, rate limits and 5xx as transient", () => {
  for (const exception_class of ["APIConnectionTimeoutError", "APIConnectionError", "InternalServerError", "RateLimitError"])
    expect(transientAssessmentFailure({ exception_class, http_status: null })).toBe(true);
  expect(transientAssessmentFailure({ exception_class: "APIError", http_status: 503 })).toBe(true);
  expect(transientAssessmentFailure({ exception_class: "APIError", http_status: 429 })).toBe(true);
  expect(transientAssessmentFailure({ exception_class: "BadRequestError", http_status: 400 })).toBe(false);
  expect(transientAssessmentFailure({ exception_class: "Error", http_status: null })).toBe(false);
  expect(transientAssessmentFailure(null)).toBe(false);
});
