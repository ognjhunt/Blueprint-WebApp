import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamEvaluationSelection from "@/pages/app/TeamEvaluationSelection";
import { workspaceRequest } from "@/lib/workspace";
const user={uid:"owner"};
vi.mock("wouter",()=>({useParams:()=>({sourceLaunchId:"source-one"}),Link:({children,href}:any)=><a href={href}>{children}</a>}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({currentUser:user})}));
vi.mock("@/components/blueprint/app/AppShell",()=>({AppShell:({children}:any)=><main>{children}</main>}));
vi.mock("@/lib/firebaseAuthHeaders",()=>({withFirebaseAuthHeaders:async(_u:any,h:any)=>h}));
vi.mock("@/lib/csrf",()=>({withCsrfHeader:async(h:any)=>h}));
vi.mock("@/lib/workspace",()=>({workspaceRequest:vi.fn(async()=>({}))}));
const context={sourceLaunchId:"source-one",sourceProfileDigest:"profile",sceneRevisionDigest:"revision",
  configurations:[{id:"franka",label:"Franka test configuration",binding_digest:"binding",policy_candidates:[{id:"pi05_droid",artifact_digest:"pi"},{id:"groot_n17_droid",artifact_digest:"groot"}]}],
  setups:[{id:"saved-one",name:"My saved robot",policyName:"GR00T",updatedAt:"now"}],
  providerTerms:{openai:{digest:"terms"},vast:{digest:"terms"}},testEnvironment:{label:"Development surface"}};
let posts:any[];
let fail:boolean;
beforeEach(()=>{
  posts=[];fail=false;vi.clearAllMocks();window.history.replaceState(null,"","/");
  vi.stubGlobal("fetch",vi.fn(async(_url:any,options:any)=>{
    if(options.method==="POST") {posts.push(JSON.parse(options.body));return new Response(JSON.stringify(fail?{error:"Retry this request"}:{id:`scene-${"a".repeat(64)}`,state:"forward_pending"}),{status:fail?409:202});}
    return new Response(JSON.stringify(context));
  }));
});
afterEach(()=>vi.unstubAllGlobals());
async function select() {
  await screen.findByText("My saved robot · GR00T");
  expect(screen.getByRole("button",{name:"Run evaluation"})).toBeDisabled();
  expect(workspaceRequest).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Saved robot and policy"),{target:{value:"saved-one"}});
  fireEvent.change(screen.getByLabelText(/Simulation configuration/),{target:{value:"franka"}});
  fireEvent.click(screen.getByRole("checkbox"));
}
describe("team evaluation choice",()=>{
  it("requires explicit selection and saves the executable setup before queueing",async()=>{
    render(<TeamEvaluationSelection/>);await select();
    fireEvent.submit(screen.getByRole("button",{name:"Run evaluation"}).closest("form")!);
    await screen.findByText("Evaluation queued");
    expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({id:"saved-one",executionBindingId:"franka"}));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({setupId:"saved-one",configurationId:"franka",configurationDigest:"binding",
      execution:{max_total_spend_usd:20,policy_candidates:context.configurations[0].policy_candidates}});
  });
  it("reuses the same run id after an uncertain submission instead of creating another run",async()=>{
    fail=true;render(<TeamEvaluationSelection/>);await select();
    fireEvent.submit(screen.getByRole("button",{name:"Run evaluation"}).closest("form")!);
    await screen.findByRole("alert");fail=false;
    await waitFor(()=>expect(screen.getByRole("button",{name:"Run evaluation"})).toBeEnabled());
    fireEvent.submit(screen.getByRole("button",{name:"Run evaluation"}).closest("form")!);
    await screen.findByText("Evaluation queued");
    expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);
  });
});


it("reopens the queued request from its page URL without another submission",async()=>{
  const first=render(<TeamEvaluationSelection/>);await select();
  fireEvent.submit(screen.getByRole("button",{name:"Run evaluation"}).closest("form")!);
  await screen.findByText("Evaluation queued");
  expect(new URLSearchParams(window.location.search).get("intake")).toBe(`scene-${"a".repeat(64)}`);
  first.unmount();render(<TeamEvaluationSelection/>);
  await screen.findByText("Evaluation queued");
  expect(posts).toHaveLength(1);
  expect(screen.queryByRole("button",{name:"Run evaluation"})).not.toBeInTheDocument();
});
