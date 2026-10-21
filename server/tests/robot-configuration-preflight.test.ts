// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/deployment-embodiment/configuration-preflight.v1.json";
import { robotEmbodimentSchema } from "../../client/src/types/robotEmbodiment";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { preflightRobotConfiguration } from "../utils/robotConfigurationPreflight";

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function arrange(response:unknown=fixture.response,status=200) {
  vi.stubEnv("TASK_EVALUATION_RUN_PLAN_URL","https://pipeline.fixture/api/live-pipeline/old-path");
  vi.stubEnv("TASK_EVALUATION_RUN_FORWARD_TOKEN","synthetic-service-token");
  vi.stubEnv("TASK_EVALUATION_RUN_FORWARD_CLIENT_ID","configured-client");
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(response),{status}));vi.stubGlobal("fetch",fetcher);return fetcher;
}
describe("real Pipeline configuration producer to WebApp consumer",()=>{
  it("accepts the real Python/JCS receipt and signs exact declared configuration, with no policy secret",async()=>{
    const fetcher=arrange();
    const receipt=await preflightRobotConfiguration(fixture.request.embodiment_id,robotEmbodimentSchema.parse(fixture.request.robot_embodiment));
    expect(receipt).toEqual(fixture.response);
    const [url,options]=fetcher.mock.calls[0] as unknown as [URL,RequestInit];
    expect(url.pathname).toBe("/api/live-pipeline/deployment-embodiment-native-preflight");
    expect(JSON.parse(options.body as string)).toEqual(fixture.request);
    const headers=options.headers as Record<string,string>;
    expect(headers["x-blueprint-pipeline-client-id"]).toBe("configured-client");
    expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${createHmac("sha256","synthetic-service-token")
      .update(`${headers["x-blueprint-pipeline-timestamp"]}.configured-client.${headers["x-blueprint-pipeline-nonce"]}.${options.body}`).digest("hex")}`);
    expect(options.body).not.toMatch(/credential_ref|policy_token|Authorization/);
    expect(receipt.execution_authorized).toBe(false);
  });
  it("refuses a valid old receipt when joints changed but model bytes stayed the same",async()=>{
    arrange();const robot=robotEmbodimentSchema.parse(fixture.request.robot_embodiment);robot.control_hz=60;
    await expect(preflightRobotConfiguration(fixture.request.embodiment_id,robot)).rejects.toThrow("did not match");
  });
  it("refuses elevated authority even with a fresh digest and shows typed missing model inputs",async()=>{
    const changed={...fixture.response,execution_authorized:true};changed.preflight_digest=crossRuntimeArtifactDigest(changed,"preflight_digest");
    arrange(changed);await expect(preflightRobotConfiguration(fixture.request.embodiment_id,robotEmbodimentSchema.parse(fixture.request.robot_embodiment))).rejects.toThrow();
    arrange({detail:"robot_model_joint_missing:left_elbow"},422);
    await expect(preflightRobotConfiguration(fixture.request.embodiment_id,robotEmbodimentSchema.parse(fixture.request.robot_embodiment))).rejects.toThrow("robot_model_joint_missing:left_elbow");
  });
  it("cancels an oversized body while reading, before retaining or parsing it",async()=>{
    arrange();const cancelled=vi.fn();
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(new ReadableStream<Uint8Array>({
      pull(controller){controller.enqueue(new Uint8Array(256_001));},cancel:cancelled,
    }))));
    await expect(preflightRobotConfiguration(fixture.request.embodiment_id,robotEmbodimentSchema.parse(fixture.request.robot_embodiment))).rejects.toThrow("size limit");
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
