import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TeamEvaluationResults } from "@/components/blueprint/app/TeamEvaluationResults";
import { fetchEvaluationReadyRun } from "@/lib/evaluationReadyRuns";
import { useTaskEvaluationResult } from "@/lib/taskEvaluationResults";

const user={uid:"owner"};
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({currentUser:user})}));
vi.mock("@/lib/evaluationReadyRuns",()=>({fetchEvaluationReadyRun:vi.fn()}));
vi.mock("@/lib/taskEvaluationResults",()=>({useTaskEvaluationResult:vi.fn()}));
vi.mock("@/pages/app/TaskEvaluationResultDetail",()=>({ResultContent:()=> <p>Existing episode report</p>}));
beforeEach(()=>{
  vi.mocked(fetchEvaluationReadyRun).mockResolvedValue({run_id:"policy-one",source_launch_id:"source-one",
    result:{record_id:"result-one"}} as any);
  vi.mocked(useTaskEvaluationResult).mockReturnValue({result:{publication:{run_id:"policy-one"}},
    currentUser:user,error:null,isLoading:false} as any);
});
it("loads the authenticated result on the task page",async()=>{
  render(<TeamEvaluationResults runId="policy-one" sourceLaunchId="source-one"/>);
  expect(await screen.findByText("Existing episode report")).toBeInTheDocument();
  expect(screen.getByText("Results and episode videos").closest("details")).toBeInTheDocument();
  expect(useTaskEvaluationResult).toHaveBeenCalledWith("result-one");
});
it("refuses a result from another source scene",async()=>{
  vi.mocked(fetchEvaluationReadyRun).mockResolvedValue({run_id:"policy-one",source_launch_id:"another-scene",
    result:{record_id:"result-one"}} as any);
  render(<TeamEvaluationResults runId="policy-one" sourceLaunchId="source-one"/>);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("Existing episode report")).not.toBeInTheDocument();
});
it("refuses a published report from another run",async()=>{
  vi.mocked(useTaskEvaluationResult).mockReturnValue({result:{publication:{run_id:"another-run"}},error:null,isLoading:false} as any);
  render(<TeamEvaluationResults runId="policy-one" sourceLaunchId="source-one"/>);
  expect(await screen.findByText("The result does not match this evaluation.")).toBeInTheDocument();
  expect(screen.queryByText("Existing episode report")).not.toBeInTheDocument();
});
