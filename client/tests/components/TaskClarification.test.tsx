import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TaskClarification } from "@/components/site/TaskClarification";
vi.mock("@/lib/csrf", () => ({withCsrfHeader: async (headers: Record<string,string>) => ({...headers, "x-csrf-token":"fixture"})}));
afterEach(() => vi.unstubAllGlobals());
const revision = "a".repeat(64);
const questions = {revision,needed:true,questions:["What is the measured pull force? — Gripper choice"],response:null};
describe("inline owner questions", () => {
  it("shows real questions immediately and retains an answer without an account or contact", async () => {
    const fetch = vi.fn().mockImplementation((_url,options) => Promise.resolve({ok:true,json:async()=>options?.method === "POST" ? {id:"answer",state:"review_required"}:questions}));
    vi.stubGlobal("fetch",fetch);render(<TaskClarification token="owner-fixture" />);
    await screen.findByText(questions.questions[0]);
    fireEvent.change(screen.getByRole("textbox",{name:"Your answers"}),{target:{value:"30 N"}});
    fireEvent.click(screen.getByRole("button",{name:"Save answers"}));
    await screen.findByText("Your answer is saved with this job for review.");
    expect(fetch.mock.calls[1][1]).toMatchObject({method:"POST",headers:{"x-csrf-token":"fixture"}});
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({revision,explanation:"30 N"});
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("keeps a failed or stale answer for retry, and refreshes questions inline", async () => {
    const fetch=vi.fn().mockImplementation((_url,options)=>Promise.resolve(options?.method === "POST"?{ok:false,json:async()=>({error:"The questions may have changed. Reload this page and try again."})}:{ok:true,json:async()=>questions}));
    vi.stubGlobal("fetch",fetch);render(<TaskClarification token="owner-fixture" />);
    fireEvent.change(await screen.findByRole("textbox",{name:"Your answers"}),{target:{value:"30 N"}});
    fireEvent.click(screen.getByRole("button",{name:"Save answers"}));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button",{name:"Retry questions"}));
    expect(await screen.findByDisplayValue("30 N")).toBeInTheDocument();
  });
  it("distinguishes a failed read from no questions and provides inline retry",async()=>{
    const fetch=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true,json:async()=>questions});
    vi.stubGlobal("fetch",fetch);render(<TaskClarification token="owner-fixture" />);
    await screen.findByRole("alert");expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Retry questions"}));
    await screen.findByText(questions.questions[0]);
  });
  it("shows retained answers on return without resubmitting",async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({...questions,response:{revision,explanation:"Measured force: 30 N.",state:"review_required"}})});
    vi.stubGlobal("fetch",fetch);render(<TaskClarification token="owner-fixture" />);
    await screen.findByText("Your answer is saved with this job for review.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Edit your answer"}));
    expect(screen.getByDisplayValue("Measured force: 30 N.")).toBeInTheDocument();
  });
});
