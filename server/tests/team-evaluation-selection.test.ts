// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin",()=>({dbAdmin:null}));
import { buildTeamEvaluationRequest, fetchTeamEvaluationContext, type TeamEvaluationContext } from "../utils/teamEvaluationSelection";
import { sceneDigest } from "../utils/taskEvaluationSceneIntake";
const sha=(c:string)=>`sha256:${c.repeat(64)}`;
const owner={user_id:"owner",organization_id:"user:owner"};
const policies=[{id:"pi05_droid",artifact_digest:sha("a")},{id:"groot_n17_droid",artifact_digest:sha("b")}];
function fixture() {
  const base={schema_version:"task_evaluation_team_context.v1" as const,owner,source_launch_id:"source-one",
    source_profile_digest:sha("c"),configured_scene_revision_digest:sha("d"),
    source:{binding_id:"capture-one"},task:{task_id:"task-one",subject:{description:"blue container"}},
    rights_reference:"retained-owner-rights", configurations:[{id:"franka-droid",label:"Franka",binding_digest:sha("e"),policy_candidates:policies}],
    claim_scope:"development_only" as const,provider_mutation_performed:false as const};
  const context:TeamEvaluationContext={...base,context_digest:sceneDigest(base)};
  const command={id:"eval-one",setupId:"saved-one",sourceLaunchId:"source-one",configurationId:"franka-droid",
    configurationDigest:sha("e"),sourceProfileDigest:sha("c"),sceneRevisionDigest:sha("d"),
    execution:{max_total_spend_usd:20,max_paid_attempts:8,max_retries:1,expires_at_epoch:2000,
      allowed_providers:["vast","openai"],policy_candidates:policies,claim_scope:"development_only"},
    consent:{provider_terms_reference:sha("f"),private_processing_authorized:true,provider_training_authorized:false,
      task_confirmed:true,spend_authorized:true}};
  const setup={id:"saved-one",executionBindingId:"franka-droid",name:"My Franka",embodiment:"Franka",policyName:"GR00T",
    version:"1.7",delivery:"checkpoint" as const,reference:"https://example.test/model",notes:"",updatedAt:"now"};
  return {context,command,setup};
}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("team evaluation selection",()=>{
  it("reuses retained scene inputs under a new independent request and exact selected binding",()=>{
    const {context,command,setup}=fixture();
    const original=JSON.stringify(context);
    const request=buildTeamEvaluationRequest(command,context,setup,owner,1000);
    expect(request).toMatchObject({submission_id:"eval-one",owner,source:context.source,
      task:{task_id:"task-one",robot_binding_digest:sha("e"),evaluation_source:{evaluation_run_id:"eval-one",source_launch_id:"source-one"}},
      consent:{accepted_by:"owner",accepted_at_epoch:1000,rights_reference:"retained-owner-rights"}});
    expect(JSON.stringify(context)).toBe(original);
  });
  it.each(["owner","setup","binding","profile","revision","policy","expiry"])("refuses changed %s before forwarding",mode=>{
    const {context,command,setup}=fixture();
    if(mode==="owner") context.owner={...owner,user_id:"other"};
    if(mode==="setup") setup.executionBindingId="other";
    if(mode==="binding") command.configurationDigest=sha("9");
    if(mode==="profile") command.sourceProfileDigest=sha("9");
    if(mode==="revision") command.sceneRevisionDigest=sha("9");
    if(mode==="policy") command.execution.policy_candidates=[{...policies[0],artifact_digest:sha("9")},policies[1]];
    if(mode==="expiry") command.execution.expires_at_epoch=999;
    expect(()=>buildTeamEvaluationRequest(command,context,setup,owner,1000)).toThrow();
  });
  it("signs the read-only request and verifies the exact response digest",async()=>{
    const {context}=fixture();
    vi.stubEnv("TASK_EVALUATION_LAUNCH_URL","https://pipeline.test/old-path");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN","test-secret");
    const fetchMock=vi.fn(async(_url:unknown,options:any)=>{
      const h=options.headers;
      const expected=createHmac("sha256","test-secret").update(`${h["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${h["x-blueprint-pipeline-nonce"]}.${options.body}`).digest("hex");
      expect(h["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
      expect(JSON.parse(options.body)).toEqual({source_launch_id:"source-one",owner});
      return new Response(JSON.stringify(context));
    });
    vi.stubGlobal("fetch",fetchMock);
    await expect(fetchTeamEvaluationContext("source-one",owner)).resolves.toEqual(context);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://pipeline.test/api/live-pipeline/task-evaluation-team-context");
    context.task={task_id:"tampered"};
    await expect(fetchTeamEvaluationContext("source-one",owner)).rejects.toThrow("evaluation_context_binding_invalid");
  });
});
