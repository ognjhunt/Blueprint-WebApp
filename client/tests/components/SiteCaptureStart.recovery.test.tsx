// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
const identity = vi.hoisted(() => ({ user: null as any }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: identity.user, loading: false }) }));
vi.mock("@/lib/analytics", () => ({ analyticsEvents: { contactFormSubmit: vi.fn(), contactFormError: vi.fn() } }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
const fetchMock = vi.fn();
const sent: {url: string; body: Record<string, any>}[] = [];
function fill(task = "Move sealed cartons") {
  fireEvent.change(document.querySelector("#start-task")!, {target: {value: task}});
  fireEvent.change(document.querySelector("#start-location")!, {target: {value: "Austin, TX"}});
  fireEvent.change(document.querySelector("#start-email")!, {target: {value: "operator@example.test"}});
  fireEvent.change(document.querySelector("#start-company")!, {target: {value: "Fixture company"}});
}
function submit() { fireEvent.submit(screen.getByRole("form")); }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); identity.user = null; sent.length = 0;
  vi.stubGlobal("FormData", window.FormData);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (url: string, init?: any) => {
    if (init?.method === "POST") { sent.push({url, body: JSON.parse(init.body)}); throw new Error("response lost after acceptance"); }
    return {ok: true, status: 200, json: async () => ({features: [], workspaceType: "site_operator"})};
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("RETURN-001: restores the draft after remount and leaves recording consent unchecked", () => {
  const view = render(<SiteCaptureStart />); fill(); fireEvent.click(document.querySelector("#start-rights")!);
  view.unmount(); render(<SiteCaptureStart />);
  expect(document.querySelector("#start-task")).toHaveValue("Move sealed cartons");
  expect(document.querySelector("#start-location")).toHaveValue("Austin, TX");
  expect(document.querySelector("#start-email")).toHaveValue("operator@example.test");
  expect(document.querySelector("#start-rights")).not.toBeChecked();
});
it("RETURN-002: recovers a lost intake response across remount without another identity", async () => {
  const view = render(<SiteCaptureStart />); fill(); submit();
  await screen.findByRole("alert"); expect(sent).toHaveLength(1);
  const original = sent[0].body; view.unmount(); render(<SiteCaptureStart />);
  // The frozen retry is a separate action, so a file input need not survive.
  fireEvent.click(await screen.findByRole("button", {name: /Recover saved job/}));
  await screen.findByRole("alert"); expect(sent).toHaveLength(2);
  expect(sent[1].body).toEqual(original);
});
it("RETURN-003: account changes discard mounted anonymous fields and retry authority", async () => {
  const view = render(<SiteCaptureStart />); fill();
  identity.user = {uid: "other-account", email: "other@example.test", getIdToken: async () => "fixture"};
  view.rerender(<SiteCaptureStart />);
  expect(document.querySelector("#start-task")).toHaveValue("");
  expect(document.querySelector("#start-rights")).not.toBeChecked();
});
it("RETURN-004: an acknowledged upload recovers without requiring lost File bytes or uploading again", async () => {
  const upload = await import("@/lib/selfCaptureVideo");
  const sender = vi.spyOn(upload,"uploadSelfCaptureVideo").mockResolvedValue({status:"failed",message:"interrupted"});
  fetchMock.mockImplementation(async (url: string, init?: any) => {
    if (init?.method === "POST") {sent.push({url,body:JSON.parse(init.body)}); return {ok:true,status:200,json:async()=>({captureUrl:"/capture-upload/fixture"})};}
    return {ok:true,status:200,json:async()=>({state:"pending",captureReceived:false,features:[]})};
  });
  const view=render(<SiteCaptureStart />);fill();fireEvent.click(document.querySelector("#start-method-upload")!);
  fireEvent.change(document.querySelector("#start-footage")!,{target:{files:[new File(["fixture"],"video.mp4",{type:"video/mp4"})]}});
  fireEvent.click(document.querySelector("#start-rights")!);submit();
  await screen.findByRole("heading",{name:"Your job is saved. Check your video upload."});
  view.unmount();render(<SiteCaptureStart />);
  fireEvent.click(screen.getByRole("button",{name:"Return to saved job"}));
  await screen.findByRole("link",{name:"Open the uploader"});
  expect(sent).toHaveLength(2);expect(sent[1].body).toEqual(sent[0].body);expect(sender).toHaveBeenCalledTimes(1);
  sender.mockRestore();
});
it("ACCESS-004: late intake acceptance after account switch cannot start original video upload", async () => {
  const upload=await import("@/lib/selfCaptureVideo"); const sender=vi.spyOn(upload,"uploadSelfCaptureVideo");
  let accept!: (value:any)=>void;
  fetchMock.mockImplementation(async (url:string,init?:any)=>{
    if(init?.method==="POST") {sent.push({url,body:JSON.parse(init.body)});return new Promise(resolve=>{accept=resolve;});}
    return {ok:true,status:200,json:async()=>({features:[],workspaceType:"site_operator"})};
  });
  const view=render(<SiteCaptureStart />);fill();fireEvent.click(document.querySelector("#start-method-upload")!);
  fireEvent.change(document.querySelector("#start-footage")!,{target:{files:[new File(["fixture"],"video.mp4",{type:"video/mp4"})]}});
  fireEvent.click(document.querySelector("#start-rights")!);submit();
  await vi.waitFor(()=>expect(sent).toHaveLength(1));
  identity.user={uid:"another-owner",email:"another@example.test",getIdToken:async()=>"fixture"}; view.rerender(<SiteCaptureStart />);
  accept({ok:true,status:200,json:async()=>({captureUrl:"/capture-upload/fixture"})});
  await vi.waitFor(()=>expect(document.querySelector("#start-task")).toHaveValue(""));
  expect(sender).not.toHaveBeenCalled(); sender.mockRestore();
});
it("INTAKE-REGRESSION-031: malformed failure fields retain a safe actionable error and correlation", async()=>{
  fetchMock.mockImplementation(async(url:string,init?:any)=>init?.method==="POST"
    ? {ok:false,status:400,json:async()=>({message:{stack:"private fixture"},error:["invalid shape"]})}
    : {ok:true,status:200,json:async()=>({features:[]})});
  render(<SiteCaptureStart />);fill();submit();
  await expect(screen.findByRole("alert")).resolves.toHaveTextContent("We could not save that. Please try again");
  expect(screen.getByText(/Job reference: capture-/)).toBeInTheDocument();
  expect(screen.queryByText(/private fixture/)).toBeNull();
});
it("RETURN-REGRESSION-031: unreadable recovery cannot silently create a replacement job",()=>{
  localStorage.setItem("bp-site-capture:v1:anonymous:default","{torn-json");
  render(<SiteCaptureStart />);
  expect(screen.getByRole("status")).toHaveTextContent("could not be read");
  submit();expect(sent).toHaveLength(0);
  expect(localStorage.getItem("bp-site-capture:v1:anonymous:default")).toBe("{torn-json");
  fireEvent.click(screen.getByRole("button",{name:"Clear this browser's draft"}));
  expect(document.querySelector("#start-task")).toBeEnabled();
});
