import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JobRobotConfiguration } from "@/components/admin/JobRobotConfiguration";
import { workspaceRequest } from "@/lib/workspace";
import { deploymentEmbodimentCatalog, deploymentCatalogWithDigest } from "@/lib/deploymentEmbodimentSupport";
import fixture from "../../../server/tests/fixtures/deployment-embodiment/configuration-preflight.v1.json";
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

it("saves a complete configuration, validates real assets, then requests the exact registered checkpoint through existing actions",async()=>{
  const changed=vi.fn();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <JobRobotConfiguration jobId="actual-job" onRequested={changed}/></QueryClientProvider>);
  fireEvent.click(screen.getByText("Robot configuration and policy",{selector:"summary"}));
  await screen.findByRole("option",{name:/Fixture configuration/});
  fireEvent.change(screen.getByLabelText("Saved configuration"),{target:{value:setup.id}});
  for(const robot of deploymentEmbodimentCatalog.embodiments) expect(screen.getByRole("option",{name:robot.display_name})).toBeInTheDocument();
  await waitFor(async()=>expect((await deploymentCatalogWithDigest()).catalog_digest).toBe(fixture.response.catalog_digest));
  fireEvent.submit(screen.getByRole("button",{name:"Save and validate configuration"}).closest("form")!);
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
