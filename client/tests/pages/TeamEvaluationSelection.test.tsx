import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamEvaluationSelection from "@/pages/app/TeamEvaluationSelection";
import { workspaceRequest } from "@/lib/workspace";
const user={uid:"owner"};
vi.mock("wouter",()=>({useParams:()=>({sourceLaunchId:"source-one"}),Link:({children,href}:any)=><a href={href}>{children}</a>}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({currentUser:user})}));
vi.mock("@/components/blueprint/app/AppShell",()=>({AppShell:({children}:any)=><main>{children}</main>}));
vi.mock("@/lib/firebaseAuthHeaders",()=>({withFirebaseAuthHeaders:async(_u:any,h:any)=>h}));
vi.mock("@/components/blueprint/app/OfferingThumbnail",()=>({OfferingThumbnail:()=> <img alt="Task preview"/>}));
vi.mock("@/lib/csrf",()=>({withCsrfHeader:async(h:any)=>h}));
vi.mock("@/lib/workspace",()=>({workspaceRequest:vi.fn(async()=>({}))}));
const context={taskDetails:{title:"Move the blue container",description:"Pick up the container and place it on the target.",requirements:[{label:"Time limit",value:"30 seconds"}]},
  thumbnailUrl:"/api/task/thumbnail",dataSummary:{sceneVersion:"v1",sceneRevisionDigest:"revision",bundleSizeBytes:1024},
  checkout:{priceCents:9900,currency:"USD",developmentNoCharge:true,paymentsEnabled:false},sourceLaunchId:"source-one",sourceProfileDigest:"profile",sceneRevisionDigest:"revision",
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
  expect(screen.getByRole("button",{name:"Start evaluation · $99"})).toBeDisabled();
  expect(workspaceRequest).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Saved robot and policy"),{target:{value:"saved-one"}});
  fireEvent.change(screen.getByLabelText(/Simulation configuration/),{target:{value:"franka"}});
  fireEvent.click(screen.getByRole("checkbox"));
}
describe("team evaluation choice",()=>{
  it("requires explicit selection and saves the executable setup before queueing",async()=>{
    render(<TeamEvaluationSelection/>);await select();
    fireEvent.submit(screen.getByRole("button",{name:"Start evaluation · $99"}).closest("form")!);
    await screen.findByText("Evaluation queued");
    expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({id:"saved-one",executionBindingId:"franka"}));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({setupId:"saved-one",configurationId:"franka",configurationDigest:"binding",
      execution:{max_total_spend_usd:20,policy_candidates:context.configurations[0].policy_candidates}});
  });
  it("reuses the same run id after an uncertain submission instead of creating another run",async()=>{
    fail=true;render(<TeamEvaluationSelection/>);await select();
    fireEvent.submit(screen.getByRole("button",{name:"Start evaluation · $99"}).closest("form")!);
    await screen.findByRole("alert");fail=false;
    await waitFor(()=>expect(screen.getByRole("button",{name:"Start evaluation · $99"})).toBeEnabled());
    fireEvent.submit(screen.getByRole("button",{name:"Start evaluation · $99"}).closest("form")!);
    await screen.findByText("Evaluation queued");
    expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);
  });
});


it("reopens the queued request from its page URL without another submission",async()=>{
  const first=render(<TeamEvaluationSelection/>);await select();
  fireEvent.submit(screen.getByRole("button",{name:"Start evaluation · $99"}).closest("form")!);
  await screen.findByText("Evaluation queued");
  expect(new URLSearchParams(window.location.search).get("intake")).toBe(`scene-${"a".repeat(64)}`);
  first.unmount();render(<TeamEvaluationSelection/>);
  await screen.findByText("Evaluation queued");
  expect(posts).toHaveLength(1);
  expect(screen.queryByRole("button",{name:"Start evaluation · $99"})).not.toBeInTheDocument();
});

it("keeps task information, setup and fixed pricing on the same page",async()=>{
  render(<TeamEvaluationSelection/>);await select();
  expect(screen.getByRole("heading",{name:"Move the blue container"})).toBeInTheDocument();
  expect(screen.getByText("30 seconds")).toBeInTheDocument();
  expect(screen.getByText("Task data").closest("details")).toBeInTheDocument();
  expect(screen.getByRole("img",{name:"Task preview"})).toBeInTheDocument();
  expect(screen.getByText(/you won’t be charged/)).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.queryByRole("link",{name:/setup/i})).not.toBeInTheDocument();
});

it("adds a missing saved setup inline without submitting an evaluation",async()=>{
  render(<TeamEvaluationSelection/>);await screen.findByText("My saved robot · GR00T");
  fireEvent.click(screen.getByRole("button",{name:"Add a setup"}));
  for (const [label,value] of [["Setup name","New robot"],["Robot / embodiment","Franka"],["Policy name","GR00T"],["Version or checkpoint","1.7"],["Reference URL","https://example.test/checkpoint"]])
    fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.change(screen.getByLabelText("Robot model",{exact:true}),{target:{value:"franka"}});
  fireEvent.submit(screen.getByRole("button",{name:"Save setup"}).closest("form")!);
  await screen.findByText("New robot · GR00T");
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({name:"New robot",reference:"https://example.test/checkpoint"}));
  expect(posts).toHaveLength(0);
});

it("does not offer the development payment bypass to ordinary accounts",async()=>{
  context.checkout.developmentNoCharge=false;
  try {
    render(<TeamEvaluationSelection/>);await select();
    expect(screen.getByRole("button",{name:"Start evaluation · $99"})).toBeDisabled();
    expect(screen.queryByText(/you won’t be charged/)).not.toBeInTheDocument();
  } finally {context.checkout.developmentNoCharge=true;}
});


it("saves a custom physical model independently of a private endpoint policy",async()=>{
  render(<TeamEvaluationSelection/>);await screen.findByText("My saved robot · GR00T");
  fireEvent.click(screen.getByRole("button",{name:"Add a setup"}));
  for (const [label,value] of [["Setup name","Mobile robot"],["Robot / embodiment","Custom"],["Policy name","Private policy"],["Version or checkpoint","v2"],["Reference URL","https://example.test/inference"]])
    fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.change(screen.getByLabelText("Delivery method"),{target:{value:"endpoint"}});
  fireEvent.change(screen.getByLabelText("Robot model",{exact:true}),{target:{value:"model"}});
  fireEvent.change(screen.getByLabelText("Robot model URL"),{target:{value:"https://example.test/robot.urdf"}});
  fireEvent.change(screen.getByLabelText("Robot type"),{target:{value:"mobile"}});
  fireEvent.submit(screen.getByRole("button",{name:"Save setup"}).closest("form")!);
  await screen.findByText("Mobile robot · Private policy");
  expect(workspaceRequest).toHaveBeenCalledWith(user,"/setups","POST",expect.objectContaining({delivery:"endpoint",robotDescription:{source:"model",format:"urdf",reference:"https://example.test/robot.urdf",mobility:"mobile",details:""}}));
  expect(screen.getByText(/needs simulation validation/)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Start evaluation · $99"})).toBeDisabled();
  expect(posts).toHaveLength(0);
});


it("requires refreshing a saved catalog model after its execution configuration changes",async()=>{
  const original=context.setups;
  context.setups=[{...original[0],executionBindingId:"franka",robotDescription:{source:"catalog",configurationId:"franka",configurationDigest:"old"}}] as any;
  try {
    render(<TeamEvaluationSelection/>);await screen.findByText("My saved robot · GR00T");
    fireEvent.change(screen.getByLabelText("Saved robot and policy"),{target:{value:"saved-one"}});
    expect(screen.getByText(/robot configuration has changed/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Start evaluation · $99"})).toBeDisabled();
    fireEvent.submit(screen.getByRole("button",{name:"Start evaluation · $99"}).closest("form")!);
    expect(posts).toHaveLength(0);
  } finally {context.setups=original;}
});
