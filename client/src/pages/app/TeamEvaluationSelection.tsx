import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { workspaceRequest } from "@/lib/workspace";
import type { RobotSetup } from "@/types/workspace";

type Configuration={id:string;label:string;binding_digest:string;policy_candidates:Array<{id:string;artifact_digest:string}>};
type Context={sourceLaunchId:string;sourceProfileDigest:string;sceneRevisionDigest:string;
  configurations:Configuration[];setups:RobotSetup[];
  providerTerms:Record<string,{digest:string;label:string;url:string}>;
  testEnvironment:{label?:string}|null};

export default function TeamEvaluationSelection() {
  const {sourceLaunchId=""}=useParams<{sourceLaunchId?:string}>();
  const {currentUser}=useAuth();
  const [context,setContext]=useState<Context|null>(null);
  const [setupId,setSetupId]=useState("");
  const [configurationId,setConfigurationId]=useState("");
  const [cap,setCap]=useState(20);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState<{id:string;state:string;pipeline_status?:{status:string}}|null>(null);
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
    const timer=setInterval(()=>{
      void request(`/api/task-evaluation-scene-intakes/${encodeURIComponent(receipt.id)}`)
        .then(value=>{if(!cancelled)setReceipt(value);})
        .catch(reason=>{if(!cancelled)setError(reason.message);});
    },10000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[receipt?.id,currentUser]);
  const setup=context?.setups.find(s=>s.id===setupId);
  const configuration=context?.configurations.find(c=>c.id===(setup?.executionBindingId || configurationId));
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !setup || !configuration) return;
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
        execution:{max_total_spend_usd:cap,max_paid_attempts:8,max_retries:1,expires_at_epoch:expires,
          allowed_providers:["vast","openai"],policy_candidates:configuration.policy_candidates,claim_scope:"development_only"},
        consent:{provider_terms_reference:openai.digest,private_processing_authorized:true,
          provider_training_authorized:false,task_confirmed:true,spend_authorized:true},
      });
      setReceipt(result);
    } catch(reason) { setError(reason instanceof Error?reason.message:"Could not queue the evaluation."); }
    finally {setBusy(false);}
  }
  const status=receipt?.pipeline_status?.status || receipt?.state;
  return <AppShell active="runs" breadcrumb="task / evaluation">
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/app/packs" className="text-sm underline">Back to tasks</Link>
      <h1 className="mt-6 text-3xl font-medium">Test your robot on this task</h1>
      <p className="mt-3 text-sm text-ink-600">{context?.testEnvironment?.label || "Development simulation. Results describe this test setup."}</p>
      {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      {!context && !error && <p className="mt-6">Loading saved setups…</p>}
      {receipt ? <div role="status" className="mt-6 border-t pt-5">
        <h2 className="text-xl">{status==="completed"?"Evaluation complete":status==="commercial_authorization_required"?"Funding required":status==="blocked"?"Evaluation paused":"Evaluation queued"}</h2>
        <p className="mt-2 text-sm">{status==="commercial_authorization_required"?"Execution will begin after funding is authorized.":"Your request is saved. This page will update as the evaluation progresses."}</p>
      </div> : context && <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block">Saved robot and policy
          <select required value={setupId} onChange={e=>{setSetupId(e.target.value);setConfigurationId("");}}
            className="mt-2 block w-full rounded border border-line bg-white p-3">
            <option value="">Choose a saved setup</option>
            {context.setups.map(s=><option key={s.id} value={s.id}>{s.name} · {s.policyName}</option>)}
          </select>
        </label>
        <Link href="/settings?tab=robots" className="inline-block text-sm underline">Manage saved setups</Link>
        {setup && !setup.executionBindingId && <label className="block">Simulation configuration
          <select required value={configurationId} onChange={e=>setConfigurationId(e.target.value)}
            className="mt-2 block w-full rounded border border-line bg-white p-3">
            <option value="">Connect this saved setup</option>
            {context.configurations.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <span className="mt-1 block text-sm text-ink-500">Saved for your next evaluation.</span>
        </label>}
        {configuration && <p className="text-sm">Policies: {configuration.policy_candidates.map(p=>p.id.replaceAll("_"," ")).join(" and ")}</p>}
        <label className="block">Maximum evaluation spend (USD)
          <input type="number" min="1" max="1000" step="0.01" required value={cap}
            onChange={e=>setCap(Number(e.target.value))} className="mt-2 block w-full rounded border border-line p-3" />
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />
          <span>I authorize this development evaluation up to ${cap.toFixed(2)} using the selected setup.</span>
        </label>
        <button disabled={busy || !configuration} className="rounded bg-ink-900 px-5 py-3 text-white disabled:opacity-40">
          {busy?"Queueing…":"Run evaluation"}
        </button>
      </form>}
    </div>
  </AppShell>;
}
