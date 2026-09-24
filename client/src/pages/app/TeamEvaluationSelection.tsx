import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { workspaceRequest } from "@/lib/workspace";
import { OfferingThumbnail } from "@/components/blueprint/app/OfferingThumbnail";
import type { RobotSetup } from "@/types/workspace";
import { RobotDescriptionFields, readRobotDescription } from "@/components/workspace/RobotDescriptionFields";
import { TeamEvaluationResults } from "@/components/blueprint/app/TeamEvaluationResults";

type Configuration={id:string;label:string;binding_digest:string;policy_candidates:Array<{id:string;artifact_digest:string}>};
type Context={sourceLaunchId:string;sourceProfileDigest:string;sceneRevisionDigest:string;
  configurations:Configuration[];setups:RobotSetup[];
  providerTerms:Record<string,{digest:string;label:string;url:string}>;
  testEnvironment:{label?:string}|null;
  taskDetails:{title:string;description:string;requirements:Array<{label:string;value:string}>};
  thumbnailUrl:string;
  dataSummary:{sceneVersion:string;sceneRevisionDigest:string;bundleSizeBytes:number};
  checkout:{priceCents:number;currency:string;developmentNoCharge:boolean;paymentsEnabled:boolean}};

export default function TeamEvaluationSelection() {
  const {sourceLaunchId=""}=useParams<{sourceLaunchId?:string}>();
  const {currentUser}=useAuth();
  const [context,setContext]=useState<Context|null>(null);
  const [setupId,setSetupId]=useState("");
  const [configurationId,setConfigurationId]=useState("");
  const [addingSetup,setAddingSetup]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState<{id:string;state:string;pipeline_status?:{status:string;result_run_id?:string}}|null>(()=>{
    const id=new URLSearchParams(window.location.search).get("intake");
    return id && /^scene-[a-f0-9]{64}$/.test(id)?{id,state:"loading"}:null;
  });
  const runId=useMemo(()=>`team-eval-${crypto.randomUUID()}`,[sourceLaunchId]);
  const expires=useMemo(()=>Math.floor(Date.now()/1000)+86400,[sourceLaunchId]);
  async function request(path:string,body?:unknown) {
    const headers=await withFirebaseAuthHeaders(currentUser,body ? await withCsrfHeader({"Content-Type":"application/json"}):{});
    const response=await fetch(path,{method:body?"POST":"GET",credentials:"include",headers,
      ...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json();
    if (!response.ok) throw new Error(value.error || "The evaluation could not be updated.");
    return value;
  }
  useEffect(()=>{
    if (!currentUser) return;
    let cancelled=false;
    void request(`/api/configured-scene-offerings/${encodeURIComponent(sourceLaunchId)}/team-evaluation-context`)
      .then(value=>{if(!cancelled)setContext(value);})
      .catch(reason=>{if(!cancelled)setError(reason.message);});
    return ()=>{cancelled=true;};
  },[currentUser,sourceLaunchId]);
  useEffect(()=>{
    if (!receipt || !currentUser) return;
    let cancelled=false;
    const refresh=()=>{
      void request(`/api/task-evaluation-scene-intakes/${encodeURIComponent(receipt.id)}`)
        .then(value=>{if(!cancelled)setReceipt(value);})
        .catch(reason=>{if(!cancelled)setError(reason.message);});
    };
    refresh();
    const timer=setInterval(refresh,10000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[receipt?.id,currentUser]);
  const setup=context?.setups.find(s=>s.id===setupId);
  const configuration=setup?.robotDescription?.source==="model" ? undefined : context?.configurations.find(c=>c.id===(setup?.executionBindingId || configurationId));
  const robotVersionChanged=setup?.robotDescription?.source==="catalog"
    && setup.robotDescription.configurationDigest!==configuration?.binding_digest;
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !setup || !configuration || robotVersionChanged) return;
    setBusy(true);setError("");
    try {
      const openai=context.providerTerms.openai, vast=context.providerTerms.vast;
      if (!openai || !vast || openai.digest!==vast.digest) throw new Error("Provider terms are unavailable. Please try again shortly.");
      if (!setup.executionBindingId) {
        const {updatedAt:_,...saved}=setup;
        await workspaceRequest(currentUser,"/setups","POST",{...saved,executionBindingId:configuration.id});
      }
      const result=await request(`/api/configured-scene-offerings/${encodeURIComponent(sourceLaunchId)}/team-evaluations`,{
        id:runId,sourceLaunchId,setupId:setup.id,configurationId:configuration.id,
        configurationDigest:configuration.binding_digest,sourceProfileDigest:context.sourceProfileDigest,
        sceneRevisionDigest:context.sceneRevisionDigest,
        execution:{max_total_spend_usd:20,max_paid_attempts:8,max_retries:1,expires_at_epoch:expires,
          allowed_providers:["vast","openai"],policy_candidates:configuration.policy_candidates,claim_scope:"development_only"},
        consent:{provider_terms_reference:openai.digest,private_processing_authorized:true,
          provider_training_authorized:false,task_confirmed:true,spend_authorized:true},
      });
      const url=new URL(window.location.href);
      url.searchParams.set("intake",result.id);
      window.history.replaceState(null,"",url);
      setReceipt(result);
    } catch(reason) { setError(reason instanceof Error?reason.message:"Could not queue the evaluation."); }
    finally {setBusy(false);}
  }
  async function saveSetup(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values=new FormData(event.currentTarget);
    const value=(name:string)=>String(values.get(name) || "");
    const saved={id:`setup-${crypto.randomUUID()}`,name:value("name"),embodiment:value("embodiment"),
      policyName:value("policyName"),version:value("version"),delivery:value("delivery") as RobotSetup["delivery"],
      reference:value("reference"),notes:""};
    setBusy(true);setError("");
    try {
      const robotDescription=readRobotDescription(values,context?.configurations || []);
      if (!robotDescription) throw new Error("Choose a robot model.");
      const payload={...saved,robotDescription,...(robotDescription.source==="catalog"?{executionBindingId:robotDescription.configurationId}:{})};
      await workspaceRequest(currentUser,"/setups","POST",payload);
      setContext(previous=>previous?{...previous,setups:[...previous.setups,{...payload,updatedAt:new Date().toISOString()}]}:previous);
      setSetupId(saved.id);setConfigurationId("");setAddingSetup(false);
    } catch(reason) {setError(reason instanceof Error?reason.message:"Could not save the setup.");}
    finally {setBusy(false);}
  }
  const status=receipt?.pipeline_status?.status || receipt?.state;
  const statusCopy:Record<string,[string,string]>={
    loading:["Checking evaluation", "Loading your saved request."],
    completed:["Evaluation complete", "Your evaluation has finished."],
    running:["Evaluation running", "Your robot is being tested. This page will update as results arrive."],
    preparing:["Preparing evaluation", "The scene and selected robot setup are being prepared."],
    awaiting_source:["Preparing evaluation", "The scene and selected robot setup are being prepared."],
    awaiting_execution:["Preparing evaluation", "Your request is admitted and waiting for execution."],
    forward_blocked:["Evaluation paused", "Your request is saved. It needs attention before execution can continue."],
    blocked:["Evaluation paused", "Your request is saved. It needs attention before execution can continue."],
    needs_input:["Evaluation needs attention", "Your request is saved. More information is needed to continue."],
    expired:["Evaluation authorization expired", "This request can no longer start new execution."],
    revoked:["Evaluation cancelled", "This request can no longer start new execution."],
    revocation_pending:["Cancellation requested", "Waiting for the controller to confirm cancellation."],
    closeout_pending:["Finishing evaluation", "Waiting for final results and execution closeout."],
    commercial_authorization_required:["Funding required", "Execution will begin after funding is authorized."],
  };
  const [statusTitle,statusDescription]=statusCopy[status || ""] || ["Evaluation queued", "Your request is saved. This page will update as the evaluation progresses."];
  const canStart=context?.checkout.developmentNoCharge || context?.checkout.paymentsEnabled;
  return <AppShell active="runs" breadcrumb="task">
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/app/packs" className="ws-link text-sm">Back to tasks</Link>
      <h1 className="mt-6 text-3xl font-medium">{context?.taskDetails.title || "Task evaluation"}</h1>
      {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      {!context && !error && <p className="mt-6">Loading task…</p>}
      {context && <>
        <div className="mt-6 overflow-hidden rounded">
          <OfferingThumbnail thumbnailUrl={context.thumbnailUrl} label="Task preview" currentUser={currentUser} />
        </div>
        <p className="mt-5 text-ink-700">{context.taskDetails.description}</p>
        <section aria-label="Task requirements" className="mt-6">
          <h2 className="text-lg font-medium">Requirements</h2>
          {context.taskDetails.requirements.length ? <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {context.taskDetails.requirements.map(row=><div key={row.label}>
              <dt className="text-sm text-ink-500">{row.label}</dt><dd>{row.value}</dd>
            </div>)}
          </dl> : <p className="mt-2 text-sm text-ink-500">Requirements have not been provided.</p>}
        </section>
        <details className="mt-6 border-y border-line py-4">
          <summary className="cursor-pointer">Task data</summary>
          <p className="mt-3 text-sm">Configured scene and task assets · {(context.dataSummary.bundleSizeBytes/1024/1024).toFixed(1)} MB</p>
          <p className="mt-2 text-sm">{context.testEnvironment?.label || "Development simulation. Results describe this test setup."}</p>
          <p className="mt-2 text-sm text-ink-500">Generated geometry and estimated physics are not measured real-world performance.</p>
          <dl className="mt-3 text-xs text-ink-500">
            <dt>Scene version</dt><dd className="break-all">{context.dataSummary.sceneVersion}</dd>
            <dt className="mt-2">Revision</dt><dd className="break-all">{context.dataSummary.sceneRevisionDigest}</dd>
          </dl>
        </details>
      </>}
      {receipt ? <div role="status" className="mt-6 border-t pt-5">
        <h2 className="text-xl">{statusTitle}</h2>
        <p className="mt-2 text-sm">{statusDescription}</p>
        {receipt.pipeline_status?.result_run_id && <TeamEvaluationResults
          key={`${currentUser?.uid}:${currentUser?.tenantId}:${sourceLaunchId}:${receipt.pipeline_status.result_run_id}`}
          runId={receipt.pipeline_status.result_run_id} sourceLaunchId={sourceLaunchId} />}
      </div> : context && <section aria-label="Run this task" className="mt-7">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-medium">Test your robot</h2>
          <p className="text-xl font-medium">$99 <span className="text-sm font-normal text-ink-500">per policy entry</span></p>
        </div>
        {addingSetup && <form onSubmit={saveSetup} className="mt-5 space-y-4 rounded border border-line p-4">
          <h3 className="font-medium">Add a setup</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[["name","Setup name"],["embodiment","Robot / embodiment"],["policyName","Policy name"],["version","Version or checkpoint"]].map(([name,label])=>
              <label className="block text-sm" key={name}>{label}<input name={name} required maxLength={160} className="mt-1 block w-full rounded border border-line p-2" /></label>)}
            <label className="block text-sm">Delivery method<select name="delivery" className="mt-1 block w-full rounded border border-line p-2">
              <option value="checkpoint">Checkpoint</option><option value="container">Container</option><option value="endpoint">Endpoint</option>
            </select></label>
            <label className="block text-sm">Reference URL<input name="reference" required maxLength={1000} className="mt-1 block w-full rounded border border-line p-2" /></label>
          </div>
          <RobotDescriptionFields configurations={context.configurations} />
          <button disabled={busy} className="ws-primary">Save setup</button>
          <button type="button" onClick={()=>setAddingSetup(false)} className="ml-4 text-sm underline">Cancel</button>
        </form>}
        <form onSubmit={submit} className="mt-5 space-y-5">
          <label className="block">Saved robot and policy
            <select required value={setupId} onChange={e=>{setSetupId(e.target.value);setConfigurationId("");}}
              className="mt-2 block w-full rounded border border-line bg-white p-3">
              <option value="">Choose a saved setup</option>
              {context.setups.map(s=><option key={s.id} value={s.id}>{s.name} · {s.policyName}</option>)}
            </select>
          </label>
          {!addingSetup && <button type="button" onClick={()=>setAddingSetup(true)} className="text-sm underline">Add a setup</button>}
          {setup?.robotDescription?.source==="model" && <p className="text-sm">This robot model needs simulation validation before this task can run. Your setup is saved.</p>}
          {robotVersionChanged && <p className="text-sm">This robot configuration has changed. Update your saved setup before starting.</p>}
          {setup && !setup.executionBindingId && !setup.robotDescription && <label className="block">Simulation configuration
            <select required value={configurationId} onChange={e=>setConfigurationId(e.target.value)}
              className="mt-2 block w-full rounded border border-line bg-white p-3">
              <option value="">Connect this saved setup</option>
              {context.configurations.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <span className="mt-1 block text-sm text-ink-500">Saved for your next evaluation.</span>
          </label>}
          {configuration && <p className="text-sm">Policies: {configuration.policy_candidates.map(p=>p.id.replaceAll("_"," ")).join(" and ")}</p>}
          {context.checkout.developmentNoCharge && <p className="text-sm">Development test — you won’t be charged.</p>}
          {!canStart && <p className="text-sm">Payment is not enabled for this task yet.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />
            <span>I confirm the task and authorize evaluation with this setup.</span>
          </label>
          <button disabled={busy || !configuration || robotVersionChanged || !canStart} className="ws-primary">
            {busy?"Queueing…":"Start evaluation · $99"}
          </button>
        </form>
      </section>}
    </div>
  </AppShell>;
}
