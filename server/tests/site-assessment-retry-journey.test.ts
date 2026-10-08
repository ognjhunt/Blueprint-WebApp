// Actual HTTP handlers + in-memory Firestore/fake objects + actual SDK with scripted providers.
// Derived from the existing queue fixture; supplemental replay, not a new independent video or journey count.
// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const seams = vi.hoisted(() => ({ objects: new Map<string, any>(), enabled: true, coverageActive: false, run: vi.fn(), manifest: vi.fn(), marker: vi.fn() }));
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
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
afterEach(() => { wakeSpy?.mockRestore(); });
const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "advisory-fixture", scene_id: "site-advisory-fixture",
  capture_id: "walkthrough-advisory-fixture", state: "held", completed_at_iso: "2026-10-08T00:00:00.000Z",
  video: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/walkthrough.mp4", generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/manifest.json", generation: "90071992547409932", size_bytes: 500, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
const request = () => ({ request: { buyerType: "site_operator", capture_mode: "self_capture", taskDescription: "Move a bin; success remains unknown",
  consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } },
  capture_privacy_source_bound_decision: { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened",
    producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
beforeEach(async () => {
  wakeSpy=vi.spyOn(await import("../utils/siteAssessmentQueue"),"tickSiteAssessments").mockResolvedValue();
  seams.enabled = true; seams.coverageActive = false; seams.run.mockReset(); seams.manifest.mockReset().mockResolvedValue(JSON.stringify({capture_rights:{derived_scene_generation_allowed:true,consent_status:"granted",consent_revoked:false}})); seams.marker.mockReset().mockResolvedValue(true); seams.objects.clear(); state.docs.clear(); state.docs.set(`inboundRequests/${pending.request_id}`, request());
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending }); });
it("joins failed provider admission, explicit owner retry, durable worker and safe customer publication (fake stores/scripted providers)", async () => {
  const mode = "programme-bound";
  const { OpenAIProvider, Usage, setTracingDisabled } = await import("@openai/agents");
  setTracingDisabled(true); // No provider telemetry for this offline joined control.
  const gemini = await import("../agents/adapters/gemini-video");
  const { buildBrowserDelivery } = await import("../utils/websiteCaptureDelivery");
  const { projectWebsiteCaptureRights } = await import("../utils/websiteTaskContext");
  const joined = structuredClone(pending);
  const raw = {...request(), contact:{firstName:"Synthetic",lastName:"Fixture",email:"synthetic@example.invalid",roleTitle:"Owner",company:"Synthetic fixture"}};
  const bytes = Buffer.from(JSON.stringify({request_id: joined.request_id, scene_id:joined.scene_id, capture_id:joined.capture_id,
    video_uri:joined.video.object_name,duration_seconds:10,capture_source:"browser_self_capture",capture_rights:projectWebsiteCaptureRights(raw)}));
  joined.manifest.size_bytes=bytes.length;joined.manifest.sha256=`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  raw.capture_privacy_source_bound_decision.producer_source.key=browserPendingDecisionKey(joined);
  state.docs.set(`inboundRequests/${joined.request_id}`,raw);
  state.docs.set(`captureUploadSessions/${joined.capture_id}`,{browser_pending_delivery:joined});
  if (mode === "programme-bound") {
    const { inferenceProgrammeContextDigest } = await import("../utils/inferenceProgrammeAdmission");
    state.docs.get(`inboundRequests/${joined.request_id}`)!.inference_program_id = "synthetic-programme";
    state.docs.set("inferencePrograms/synthetic-programme", {
      schema_version: "inference_program.v1", status: "active", authority_ref: "synthetic-offline-authority",
      ledger_sha256: `sha256:${"f".repeat(64)}`, request_id: joined.request_id, capture_id: joined.capture_id,
      context_digest: inferenceProgrammeContextDigest(raw, null),
      video_sha256: createHash("sha256").update(Buffer.from("video-1")).digest("hex"),
      expires_at_ms: Date.now() + 60_000, cap_micro_usd: 5_000_000,
      slots: [
        { id: "original-gemini", provider: "gemini", model: "gemini-3.8-flash", reserved_micro_usd: 1_818_624, state: "unknown" },
        { id: "original-sol-1", provider: "openai", model: "gpt-6.1-sol", reserved_micro_usd: 331_920, state: "recorded" },
        ...[2, 3, 4].map(n => ({ id: `original-sol-${n}`, provider: "openai", model: "gpt-6.1-sol", reserved_micro_usd: 331_920, state: "held" })),
        { id: "amended-gemini", provider: "gemini", model: "gemini-3.8-flash", reserved_micro_usd: 1_818_624, state: "held" },
      ],
    });
  }
  const put=(name:string,generation:string,body:Buffer,contentType="application/json")=>seams.objects.set(name,{generation,crc32c:"AAAAAA==",bytes:body,contentType});
  put(joined.video.object_name,joined.video.generation,Buffer.from("video-1"),"video/mp4");put(joined.manifest.object_name,joined.manifest.generation,bytes);
  const delivery=buildBrowserDelivery({requestId:joined.request_id,sceneId:joined.scene_id,captureId:joined.capture_id,
    rawPrefix:joined.video.object_name.slice(0,joined.video.object_name.lastIndexOf("/")),video:joined.video,manifest:joined.manifest,completedAtIso:joined.completed_at_iso});
  put(`${delivery.record.raw_prefix}/capture_upload_complete.json`,"30",delivery.markerBytes);put(delivery.objectName,"31",delivery.recordBytes);
  const realUpload=await vi.importActual<typeof import("../utils/websiteBrowserUploadStatus")>("../utils/websiteBrowserUploadStatus");
  seams.manifest.mockImplementation(realUpload.verifiedPendingManifest);seams.marker.mockImplementation(realUpload.verifiedPendingMarker);
  vi.stubEnv("OPENAI_API_KEY","synthetic-no-provider");vi.stubEnv("GEMINI_API_KEY","synthetic-no-provider");
  let calls=0;
  const modelSpy=vi.spyOn(OpenAIProvider.prototype,"getModel").mockResolvedValue({
    async getResponse(input:any) {
      calls++;
      if (calls === 1) throw Error("synthetic_first_provider_response_lost");
      const source=JSON.stringify(input.input).match(/video:walkthrough-advisory-fixture:[a-f0-9]{12}/)?.[0];
      const packet={status:"needs_operator_input",job:[{text:"PRIVATE fabricated robot success",basis:"observed",evidence:[{source_id:source,at_seconds:2,selector:{kind:"video_observation",observation_index:0,field_path:null}}]}],
        objects_motions_conditions_variations:[],operator_success:[],known:[],estimates:[],missing:[],approaches:[],questions:[],
        next_action:{kind:"ask_operator",action:"Clarify success",why:{text:"Success criteria unknown",basis:"unknown",evidence:[]}}};
      return {output:calls===2?[{type:"function_call",callId:"joined-video-call",name:"analyze_site_video",arguments:JSON.stringify({question:"What moves?",processing:"auto",sampling_fps:2})}]:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(packet)}]}],usage:new Usage(),providerData:{usage:{input_tokens:20,output_tokens:10}}} as any;
    },async *getStreamedResponse(){throw Error("unexpected_stream");}
  } as any);
  const videoSpy=vi.spyOn(gemini,"analyseAgenticVideo").mockResolvedValue({text:JSON.stringify({summary:"Carton movement",observations:[{category:"motion",finding:"A carton moves",basis:"observed",start_seconds:1,end_seconds:3,uncertainty:"Hands partly occluded"}],not_observable:["weight"]}),
    usage:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:30},processing:{mode:"static",sampling_fps_requested:2,media_tool_calls:0,media_tool_responses:0}} as any);
  let server:any;
  const originalFetch=globalThis.fetch;
  const fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation((url,options)=> {
    if(new URL(String(url)).hostname!=="127.0.0.1") throw Error("unexpected_external_network");
    return originalFetch(url,options);
  });
  try {
    seams.run.mockImplementation(async(task,options)=>(await vi.importActual<typeof import("../agents/runtime")>("../agents/runtime")).runAgentTask(task,options));
    wakeSpy.mockRestore();
    const queue=await import("../utils/siteAssessmentQueue");
    wakeSpy=vi.spyOn(queue,"tickSiteAssessments");
    await publishBrowserPending(joined);
    await vi.waitFor(() => expect(wakeSpy).toHaveBeenCalledExactlyOnceWith(1));
    await wakeSpy.mock.results[0].value;
    const [oldKey, failed] = selectedJob(), oldRunId = failed.run_id;
    expect(failed.state).toBe("needs_review"); expect(calls).toBe(1); expect(videoSpy).not.toHaveBeenCalled();
    const retainedFailed = structuredClone(state.docs.get(`agentRuns/${oldRunId}`));
    expect(retainedFailed?.status).toBe("failed");
    const express=(await import("express")).default;const {createServer}=await import("node:http");
    const app=express();app.use(express.json());
    app.use("/api/site-task-brief",(await import("../routes/site-task-brief")).default);
    app.use("/api/self-capture/uploads",(await import("../routes/self-capture-uploads")).default);
    server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const {createCaptureUploadToken}=await import("../utils/captureUploadToken");
    const token=createCaptureUploadToken({requestId:joined.request_id,sceneId:joined.scene_id,captureId:joined.capture_id});
    const url=`http://127.0.0.1:${server.address().port}`;
    const read=()=>fetch(`${url}/api/site-task-brief/${token}/status`);
    const statusBefore=await(await read()).json();
    expect(statusBefore).toMatchObject({assessment_retry_available:true,assessment_job_id:oldKey.split("/")[1],assessment_run_id:oldRunId});
    expect(statusBefore.siteAdvisory.state).toBe("needs_review"); expect(calls).toBe(1);
    const retryBody={expected_job_id:statusBefore.assessment_job_id,expected_run_id:oldRunId,retry_identity:"00000000-0000-4000-8000-000000000000"};
    const retry=()=>fetch(`${url}/api/self-capture/uploads/${token}/advisory-retry`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(retryBody)});
    const acknowledged=await retry(); expect(acknowledged.status).toBe(200);const ack=await acknowledged.json();
    expect(ack).toMatchObject({ok:true,state:"queued",job_id:statusBefore.assessment_job_id});expect(ack.run_id).not.toBe(oldRunId);
    await vi.waitFor(()=>expect(wakeSpy).toHaveBeenCalledTimes(2)); await wakeSpy.mock.results[1].value;
    expect(state.docs.get(`agentRuns/${oldRunId}`)).toEqual(retainedFailed);
    const programme=state.docs.get("inferencePrograms/synthetic-programme")!;
    expect(programme.slots.find((slot:any)=>slot.run_id===oldRunId).state).toBe("unknown");
    const repeated=await retry();expect(repeated.status).toBe(200);expect(await repeated.json()).toMatchObject({run_id:ack.run_id,job_id:ack.job_id});
    expect(state.docs.get(oldKey)?.retry_history).toHaveLength(1);expect(calls).toBe(3);
    const {reconcileSiteAssessments}=queue;
    const [key,job]=selectedJob();
    expect(job.state,JSON.stringify(state.docs.get(`agentRuns/${job.run_id}`))).toBe("completed");
    expect(calls).toBe(3);expect(videoSpy).toHaveBeenCalledTimes(1);
    const run=state.docs.get(`agentRuns/${job.run_id}`)!;
    expect(run.artifacts.source_admission).toMatchObject({advisory_job_id:key.split("/")[1],context_digest:job.context_digest,source_key:browserPendingDecisionKey(joined),video_sha256:createHash("sha256").update(Buffer.from("video-1")).digest("hex")});
    expect(run.artifacts.capture_inference_reservations).toHaveLength(3);
    if (mode === "programme-bound") {
      const programme = state.docs.get("inferencePrograms/synthetic-programme")!;
      expect(programme.slots.find((slot:any) => slot.id === "original-gemini").state).toBe("unknown");
      expect(programme.slots.find((slot:any) => slot.id === "original-sol-1").state).toBe("recorded");
      expect(programme.slots.filter((slot:any) => slot.state === "held")).toHaveLength(0);
      expect(programme.slots.filter((slot:any) => slot.run_id === job.run_id && slot.state === "recorded")).toHaveLength(3);
      expect(programme.slots.reduce((total:number, slot:any) => total + slot.reserved_micro_usd, 0)).toBe(4_964_928);
    }
    const response=await read();expect(response.status).toBe(200);const body=await response.json();
    expect(body.siteAdvisory?.state).toBe("ready");expect(JSON.stringify(body.siteAdvisory)).toContain("A carton moves");
    expect(JSON.stringify(body.siteAdvisory)).not.toMatch(/PRIVATE|fabricated|gs:\/\/|signed-no-fetch|raw_model_assessment/);
    const {renderToStaticMarkup}=await import("react-dom/server");const {createElement}=await import("react");
    const {SiteAdvisoryReport}=await import("../../client/src/components/site/SiteAdvisoryReport");
    const html=renderToStaticMarkup(createElement(SiteAdvisoryReport,{advisory:body.siteAdvisory}));expect(html).toContain("Video analysis");expect(html).toContain("A carton moves");
    await reconcileSiteAssessments();expect(calls).toBe(3);
    // The actual private SDK result survived, but the final job/pointer commit
    // was lost. Ordinary owner polling must recover it without paid replay.
    state.docs.set(key,{...state.docs.get(key),state:"running",packet_sha256:null});
    state.docs.get(`inboundRequests/${joined.request_id}`)!.site_advisory.state="running";
    const wakesBeforeReturn=wakeSpy.mock.calls.length;
    const returning=await(await read()).json();expect(returning.siteAdvisory.state).toBe("running");
    await vi.waitFor(()=>expect(wakeSpy.mock.calls.length).toBeGreaterThan(wakesBeforeReturn));
    // The existing rotating scan may wrap its retained cursor on this poll;
    // follow ordinary status polling until its next bounded pass reads the row.
    await vi.waitFor(async()=> {
      await Promise.all(wakeSpy.mock.results.map(result=>result.value));
      expect((await(await read()).json()).siteAdvisory.state).toBe("ready");
    });
    expect(state.docs.get(key)?.state).toBe("completed");expect(calls).toBe(3);expect(videoSpy).toHaveBeenCalledTimes(1);
    const wakesBeforeWithdrawal=wakeSpy.mock.calls.length;
    state.docs.get(`inboundRequests/${joined.request_id}`)!.consent_revoked=true;
    const withdrawn=await(await read()).json();expect(withdrawn.siteAdvisory.state).toBe("authority_ended");expect(withdrawn.siteAdvisory.sections).toEqual([]);
    await Promise.resolve();expect(wakeSpy.mock.calls.length).toBe(wakesBeforeWithdrawal);expect(calls).toBe(3);
  } finally {
    modelSpy.mockRestore();videoSpy.mockRestore();fetchGuard.mockRestore();vi.unstubAllEnvs();
    if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
},30000);
