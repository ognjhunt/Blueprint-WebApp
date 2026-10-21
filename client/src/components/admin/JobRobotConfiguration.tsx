import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { workspaceRequest } from "@/lib/workspace";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { RobotDescriptionFields, RobotEmbodimentFields, readRobotDescription, readRobotEmbodiment } from "@/components/workspace/RobotDescriptionFields";
import { CheckpointRegistration, type WorkspaceCheckpoint } from "@/components/workspace/CheckpointRegistration";
import PolicyInterfaceGuide from "@/components/workspace/PolicyInterfaceGuide";
import type { RobotSetup } from "@/types/workspace";
import type { RobotConfigurationPreflight } from "@/types/robotConfiguration";

/** The existing job console operates the same saved setup/checkpoint/admission path as a robot team. */
export function JobRobotConfiguration({ jobId, onRequested }: { jobId: string; onRequested: () => void }) {
  const { currentUser } = useAuth();
  const client = useQueryClient();
  const setupKey = ["robot-configurations", currentUser?.uid];
  const setups = useQuery({ queryKey: setupKey, enabled: Boolean(currentUser),
    queryFn: async () => {
      const result = await workspaceRequest<{ setups: RobotSetup[] }>(currentUser, "/setups");
      if (!Array.isArray(result.setups)) throw new Error("Saved robot configurations could not be confirmed.");
      return result;
    } });
  const checkpoints = useQuery({ queryKey: ["workspace-checkpoints", currentUser?.uid], enabled: Boolean(currentUser),
    queryFn: async () => {
      const result = await workspaceRequest<{ checkpoints: WorkspaceCheckpoint[] }>(currentUser, "/checkpoints");
      if (!Array.isArray(result.checkpoints)) throw new Error("Registered policy checkpoints could not be confirmed.");
      return result;
    } });
  const [setupId, setSetupId] = useState("");
  const [newSetupId, setNewSetupId] = useState(() => `setup-${crypto.randomUUID()}`);
  const [requestId, setRequestId] = useState(() => `robot-eval-${crypto.randomUUID()}`);
  const [checkpointId, setCheckpointId] = useState("");
  const [preflight, setPreflight] = useState<RobotConfigurationPreflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requested, setRequested] = useState(false);
  const selected = setups.data?.setups.find(row => row.id === setupId);
  const receipt = preflight ?? selected?.nativePreflight;
  const matching = (checkpoints.data?.checkpoints || []).filter(row => row.reference === selected?.reference
    && ["policy_endpoint", "customer_hosted"].includes(row.runtime) && row.status !== "retired");
  const checkpoint = matching.find(row => row.checkpointId === checkpointId);

  async function validate(id: string) {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}/robot-configuration/preflight`, {
      method: "POST", credentials: "include", headers: await withFirebaseAuthHeaders(currentUser,
        await withCsrfHeader({ "Content-Type": "application/json" })), body: JSON.stringify({ setupId: id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Robot validation could not be confirmed. The setup is saved.");
    setPreflight(result.preflight);
    await client.invalidateQueries({ queryKey: setupKey });
    return result.preflight as RobotConfigurationPreflight;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice(""); setPreflight(null); setRequested(false);
    try {
      const robotDescription = readRobotDescription(form, []);
      const robotEmbodiment = readRobotEmbodiment(form);
      if (!robotDescription) throw new Error("Choose the actual robot.");
      const text = (name: string) => String(form.get(name) || "").trim();
      const id = selected?.id || newSetupId;
      await workspaceRequest(currentUser, "/setups", "POST", { id, name: text("name"), embodiment: text("embodiment"),
        policyName: text("policyName"), version: text("version"), delivery: "endpoint", reference: text("reference"),
        notes: text("notes"), robotDescription, ...(robotEmbodiment ? { robotEmbodiment } : {}) });
      setSetupId(id); setCheckpointId(""); setRequestId(`robot-eval-${crypto.randomUUID()}`);
      setNewSetupId(`setup-${crypto.randomUUID()}`);
      await client.invalidateQueries({ queryKey: setupKey });
      setNotice("Configuration saved. No evaluation has run.");
      if (robotEmbodiment) await validate(id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The configuration could not be saved."); }
    finally { setBusy(false); }
  }

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected || !checkpoint || requested) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await workspaceRequest(currentUser, "/evaluations", "POST", { id: requestId, opportunityId: jobId,
        setupId: selected.id, checkpointId: checkpoint.checkpointId, notes: "Evaluate this saved robot configuration and registered policy on this job.", licenseToRun: true });
      setRequested(true); setNotice("Evaluation requested. Use this job's existing evaluation admission below; no execution has been authorized by saving the configuration.");
      onRequested();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The evaluation request could not be confirmed. Retry reuses its identity."); }
    finally { setBusy(false); }
  }

  return <details className="border-t border-line pt-4">
    <summary className="cursor-pointer font-medium">Robot configuration and policy</summary>
    <p className="mt-3 text-sm">Save the exact robot assets, cameras, controls and independent grippers, then register its hosted policy.
      A configuration is not an executed evaluation. Existing task applicability, access, rights and resource authority still apply.</p>
    {setups.error ? <p role="alert">{(setups.error as Error).message}</p> : null}
    {checkpoints.error ? <p role="alert">{(checkpoints.error as Error).message}</p> : null}
    <label className="mt-4 block text-sm">Saved configuration<select value={setupId} disabled={busy} onChange={event => {
      setSetupId(event.target.value); setCheckpointId(""); setPreflight(null); setRequested(false); setError(""); setNotice("");
      setRequestId(`robot-eval-${crypto.randomUUID()}`);
    }} className="mt-1 block w-full rounded border border-line p-2">
      <option value="">New configuration</option>{setups.data?.setups.map(row => <option key={row.id} value={row.id}>{row.name} · {row.policyName} {row.version}</option>)}
    </select></label>
    <form key={selected?.id || "new"} onSubmit={save} className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[["name", "Configuration name"], ["embodiment", "Robot description"], ["policyName", "Policy name"], ["version", "Policy version or checkpoint"]].map(([name, label]) =>
          <label className="text-sm" key={name}>{label}<input name={name} required maxLength={160}
            defaultValue={selected?.[name as "name" | "embodiment" | "policyName" | "version"]} className="mt-1 block w-full rounded border border-line p-2" /></label>)}
      </div>
      <label className="block text-sm">Hosted policy HTTPS URL<input name="reference" type="url" required maxLength={1000}
        defaultValue={selected?.reference} className="mt-1 block w-full rounded border border-line p-2" /></label>
      <p className="text-xs">Use a URL without credentials or query parameters. Enter the bearer token separately in Policy token below.</p>
      <RobotDescriptionFields value={selected?.robotDescription} allowSupportOptions />
      <RobotEmbodimentFields value={selected?.robotEmbodiment} />
      <label className="block text-sm">Configuration notes<textarea name="notes" maxLength={3000} defaultValue={selected?.notes} className="mt-1 block w-full rounded border border-line p-2" /></label>
      <button className="ws-secondary" disabled={busy}>Save and validate configuration</button>
    </form>
    {receipt ? <div className="mt-4 text-sm" role="status">
      <p>{receipt.status === "configured_not_executed" ? "Configured; not executed" : "Configuration needs changes"} · {receipt.claim_ceiling}</p>
      <p>Model SHA verified: {receipt.model_file_digest_verified ? "yes" : "no"}. {receipt.structure.joint_count} joints, {receipt.structure.rigid_body_count} rigid bodies.</p>
      {[...receipt.blockers, ...receipt.limitations].map((line, index) => <p key={index}>{line}</p>)}
    </div> : null}
    {selected?.robotEmbodiment ? <button type="button" disabled={busy} className="mt-3 text-sm underline" onClick={() => {
      setBusy(true); setError(""); void validate(selected.id).catch(caught => setError(caught.message)).finally(() => setBusy(false));
    }}>Validate saved assets again</button> : null}
    {selected ? <>
      <CheckpointRegistration key={selected.id} setups={[selected]} />
      <PolicyInterfaceGuide />
      <form onSubmit={request} className="mt-4 space-y-3">
        <label className="block text-sm">Policy checkpoint for this evaluation<select value={checkpointId} required
          onChange={event => { setCheckpointId(event.target.value); setRequestId(`robot-eval-${crypto.randomUUID()}`); setRequested(false); }}
          className="mt-1 block w-full rounded border border-line p-2">
          <option value="">Choose a registered checkpoint</option>{matching.map(row => <option key={row.checkpointId} value={row.checkpointId}>{row.label} · {row.status}</option>)}
        </select></label>
        {checkpoint && <p className="text-sm">{checkpoint.tokenExpiresAtIso ? `Policy token expires ${new Date(checkpoint.tokenExpiresAtIso).toLocaleString()}.` : "Save this endpoint's policy token before requesting."}</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" required />I have the right to license Blueprint to run this policy for this job. This grants no training permission.</label>
        <p className="text-sm">Blueprint may evaluate a private job under its existing robot-evaluation permission. This does not publish the job to technology teams.</p>
        <button className="ws-primary" disabled={busy || requested || !selected.robotEmbodiment || !checkpoint
          || !checkpoint.tokenExpiresAtIso || Date.parse(checkpoint.tokenExpiresAtIso) <= Date.now()}>Request this job's evaluation</button>
      </form>
    </> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm">{notice}</p> : null}
  </details>;
}
