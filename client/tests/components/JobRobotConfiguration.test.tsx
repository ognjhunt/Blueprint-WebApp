import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JobRobotConfiguration } from "@/components/admin/JobRobotConfiguration";
import { workspaceRequest } from "@/lib/workspace";
import { deploymentEmbodimentCatalog, deploymentCatalogWithDigest } from "@/lib/deploymentEmbodimentSupport";
import fixture from "../../../server/tests/fixtures/deployment-embodiment/configuration-preflight.v1.json";
import { dreamRobotFixture } from "../../../server/tests/helpers/dream-robot";
const user={uid:"operator"};
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({currentUser:user})}));
vi.mock("@/lib/workspace",()=>({workspaceRequest:vi.fn()}));
vi.mock("@/lib/firebaseAuthHeaders",()=>({withFirebaseAuthHeaders:async(_u:unknown,h:unknown)=>h}));
vi.mock("@/lib/csrf",()=>({withCsrfHeader:async(h:unknown)=>h}));
vi.mock("@/components/workspace/CheckpointRegistration",()=>({CheckpointRegistration:()=> <p>Existing secure checkpoint registration</p>}));
vi.mock("@/components/workspace/PolicyInterfaceGuide",()=>({default:()=>null}));
const setup={id:"saved-robot",name:"Fixture configuration",embodiment:"UR5e",policyName:"Fixture policy",version:"fixture-v1",
  delivery:"endpoint",reference:"https://policy.fixture/actions",notes:"development fixture",updatedAt:"now",
  robotDescription:{source:"support_option",embodimentId:fixture.request.embodiment_id,catalogDigest:fixture.response.catalog_digest,
    policyRouteIds:[deploymentEmbodimentCatalog.embodiments[0].policy_routes[0].route_id]},robotEmbodiment:fixture.request.robot_embodiment};
beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(workspaceRequest).mockImplementation(async(_user,path,method,body)=>{
    if(path==="/setups" && method!=="POST") return {setups:[setup]};
    if(path==="/checkpoints") return {checkpoints:[{checkpointId:"checkpoint-exact",label:"Registered fixture",reference:setup.reference,
      runtime:"policy_endpoint",status:"registered",tokenExpiresAtIso:"2100-01-01T00:00:00Z"}]};
    return body || {};
  });
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({setupId:setup.id,preflight:fixture.response}))));
});
afterEach(()=>vi.unstubAllGlobals());

it("saves a catalog configuration, requests asset validation, then requests the exact registered checkpoint through existing actions",async()=>{
  const changed=vi.fn();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <JobRobotConfiguration jobId="actual-job" onRequested={changed}/></QueryClientProvider>);
  fireEvent.click(screen.getByText("Robot configuration and policy",{selector:"summary"}));
  await screen.findByRole("option",{name:/Fixture configuration/});
  fireEvent.change(screen.getByLabelText("Saved configuration"),{target:{value:setup.id}});
  for(const robot of deploymentEmbodimentCatalog.embodiments) expect(screen.getByRole("option",{name:robot.display_name})).toBeInTheDocument();
  await waitFor(async()=>expect((await deploymentCatalogWithDigest()).catalog_digest).toBe(fixture.response.catalog_digest));
  fireEvent.submit(screen.getByRole("button",{name:"Save configuration"}).closest("form")!);
  await screen.findByText(/Configured; not executed/);
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({
    id:setup.id,robotDescription:setup.robotDescription,robotEmbodiment:setup.robotEmbodiment,reference:setup.reference,
  }));
  expect(fetch).toHaveBeenCalledWith("/api/admin/jobs/actual-job/robot-configuration/preflight",expect.objectContaining({
    method:"POST",body:JSON.stringify({setupId:setup.id}),
  }));
  fireEvent.change(screen.getByLabelText("Policy checkpoint for this evaluation"),{target:{value:"checkpoint-exact"}});
  fireEvent.click(screen.getByLabelText(/I have the right to license/));
  fireEvent.submit(screen.getByRole("button",{name:"Request this job's evaluation"}).closest("form")!);
  await screen.findByText(/Evaluation requested. Use this job's existing evaluation admission/);
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/evaluations","POST",expect.objectContaining({
    opportunityId:"actual-job",setupId:setup.id,checkpointId:"checkpoint-exact",licenseToRun:true,
  }));
  expect(changed).toHaveBeenCalledOnce();
  expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toMatch(/provider|allocate|policy.fixture/);
});

it("saves and requests a generic custom model through existing staging without a catalog preflight or stale receipt",async()=>{
  let custom:any={...setup,nativePreflight:fixture.response};
  const ordinary=vi.mocked(workspaceRequest).getMockImplementation()!;
  vi.mocked(workspaceRequest).mockImplementation(async(...args)=>{
    const [,path,method,body]=args;
    if(path==="/setups") {
      if(method==="POST") custom={...(body as object),updatedAt:"now"};
      return {setups:[custom]};
    }
    return ordinary(...args);
  });
  const changed=vi.fn();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <JobRobotConfiguration jobId="actual-job" onRequested={changed}/></QueryClientProvider>);
  fireEvent.click(screen.getByText("Robot configuration and policy",{selector:"summary"}));
  await screen.findByRole("option",{name:/Fixture configuration/});
  fireEvent.change(screen.getByLabelText("Saved configuration"),{target:{value:setup.id}});
  expect(screen.getByText(/Configured; not executed/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Robot model",{exact:true}),{target:{value:"model"}});
  fireEvent.change(screen.getByLabelText("Robot model URL"),{target:{value:setup.robotEmbodiment.model.url}});
  fireEvent.change(screen.getByLabelText("Model format"),{target:{value:"usd"}});
  fireEvent.change(screen.getByLabelText("Robot manifest (JSON)"),{target:{value:JSON.stringify({...setup.robotEmbodiment,embodiment_id:"acme-custom-arm"})}});
  fireEvent.submit(screen.getByRole("button",{name:"Save configuration"}).closest("form")!);
  await screen.findByText(/existing model-and-scene staging checks this custom robot before allocation/);
  expect(fetch).not.toHaveBeenCalled();
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({
    robotDescription:expect.objectContaining({source:"model"}),robotEmbodiment:expect.objectContaining({embodiment_id:"acme-custom-arm"}),
  }));
  expect(custom).not.toHaveProperty("nativePreflight");
  expect(screen.queryByText(/Configured; not executed/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Validate saved assets again"})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Policy checkpoint for this evaluation"),{target:{value:"checkpoint-exact"}});
  fireEvent.click(screen.getByLabelText(/I have the right to license/));
  fireEvent.submit(screen.getByRole("button",{name:"Request this job's evaluation"}).closest("form")!);
  await screen.findByText(/Evaluation requested. Use this job's existing evaluation admission/);
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/evaluations","POST",expect.objectContaining({
    opportunityId:"actual-job",setupId:setup.id,checkpointId:"checkpoint-exact",licenseToRun:true,
  }));
  expect(fetch).not.toHaveBeenCalled();expect(changed).toHaveBeenCalledOnce();
});

it("retains a Dream model/camera configuration and offers only checkpoints for that exact model",async()=>{
  const robotEmbodiment=dreamRobotFixture();
  const policyConfig={policy_interface_id:"dreamlabs_dream1.v1",model_id:"account/exact-model-v2",
    camera_roles:{overhead:"overview",wrist_l:"left_wrist",wrist_r:"right_wrist"}};
  const selected={...setup,reference:"https://api.dreamlabs.ai/v1/get_action",robotEmbodiment,policyConfig,
    robotDescription:{source:"model",format:"usd",reference:robotEmbodiment.model.url,mobility:"fixed",details:"Declared dual arms"}};
  vi.mocked(workspaceRequest).mockImplementation(async(_user,path,method,body)=>{
    if(path==="/setups" && method!=="POST") return {setups:[selected]};
    if(path==="/checkpoints") return {checkpoints:[
      {checkpointId:"old-model",label:"Old model",reference:selected.reference,runtime:"policy_endpoint",status:"registered",
        policyConfig:{...policyConfig,model_id:"account/old-model"},tokenExpiresAtIso:"2100-01-01T00:00:00Z"},
      {checkpointId:"current-model",label:"Current model",reference:selected.reference,runtime:"policy_endpoint",status:"registered",
        policyConfig,tokenExpiresAtIso:"2100-01-01T00:00:00Z"},
    ]};
    return body || {};
  });
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <JobRobotConfiguration jobId="actual-job" onRequested={()=>{}}/></QueryClientProvider>);
  fireEvent.click(screen.getByText("Robot configuration and policy",{selector:"summary"}));
  await screen.findByRole("option",{name:/Fixture configuration/});
  fireEvent.change(screen.getByLabelText("Saved configuration"),{target:{value:setup.id}});
  expect(screen.getByLabelText("Protocol settings (JSON)")).toHaveValue(JSON.stringify(policyConfig,null,2));
  fireEvent.submit(screen.getByRole("button",{name:"Save configuration"}).closest("form")!);
  await screen.findByText(/existing model-and-scene staging checks this custom robot/);
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({policyConfig,robotEmbodiment}));
  expect(screen.queryByRole("option",{name:"Old model · registered"})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Policy checkpoint for this evaluation"),{target:{value:"current-model"}});
  fireEvent.click(screen.getByLabelText(/I have the right to license/));
  fireEvent.submit(screen.getByRole("button",{name:"Request this job's evaluation"}).closest("form")!);
  await screen.findByText(/Evaluation requested. Use this job's existing evaluation admission/);
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/evaluations","POST",expect.objectContaining({checkpointId:"current-model"}));
  expect(fetch).not.toHaveBeenCalled();
});
