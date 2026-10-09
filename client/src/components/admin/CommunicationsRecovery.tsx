import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { useAuth } from "@/contexts/AuthContext";

type BlockedJob = { jobId: string; prospectId: string; briefDigest: string; attempts: number; reason: string; leaseUntil: number;
  state?: string; sessionId?: string | null; expectedJobDigest?: string; expectedCheckpointDigest?: string;
  savedOutputRecovery?: { rawOutputSha256: string; ownerAction?: { actorUid: string; sourceCommit: string; originalJobDigest: string; requestDigest: string } } | null };
type Readiness = { sourceCommit: string | null; existingProcess: boolean; providerKeyConfigured: boolean; headroomAvailable: boolean;
  outreachControlsOff: boolean; headroomReserveBytes: number; memory: { observedAt: string; rss: number; cgroup: { current: number; limit: number } | null } | null;
  executionPlacement: string; workerServiceId: string | null; workerFresh: boolean; founderBindingConfigured: boolean; controls: Record<string, string> | null;
  draftScopeGranted: boolean };
const hash = /^[a-f0-9]{64}$/;
const ready = (value?: Readiness) => Boolean(value && /^[a-f0-9]{40}$/.test(value.sourceCommit ?? "")
  && value.existingProcess && value.executionPlacement === "existing_background_worker" && value.workerServiceId && value.workerFresh
  && value.founderBindingConfigured && value.providerKeyConfigured && value.memory && value.headroomAvailable && value.outreachControlsOff && value.draftScopeGranted);
const mib = (value: number) => (value / 1024 / 1024).toFixed(1);
// Both the legacy flat owner pin and the nested queue intent use the same
// canonical sorted-key JSON as communicationsDigest. No server/provider import.
const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const requestDigest = async (input: unknown) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(input)));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
};

/** The ordinary founder app transport; an explicit saved-output action never
 * enters the generic retry or Gmail-copy/send paths. Evidence pins stay private. */
function SavedOutputRecovery({ job, onSelected, onRecovered }: { job: BlockedJob; onSelected: () => void; onRecovered: (jobId: string, ledgerId: string) => void }) {
  const { currentUser } = useAuth();
  const actor = useRef(currentUser?.uid); actor.current = currentUser?.uid;
  const [pins, setPins] = useState({ expectedJobDigest: "", expectedCheckpointDigest: "", rawOutputSha256: "" });
  const [reviewed, setReviewed] = useState(false);
  const [intent, setIntent] = useState<{ generation: number; requestDigest: string; state: string; cancelRequested: boolean; sourceCommit: string } | null>(null);
  const request = async (path: string, body?: unknown) => {
    const user = currentUser;
    if (!user || actor.current !== user.uid) throw new Error("Sign in as the existing founder owner.");
    let headers = await withFirebaseAuthHeaders(user, body === undefined ? {} : { "Content-Type": "application/json" });
    if (body !== undefined) headers = await withCsrfHeader(headers, { refresh: true });
    if (actor.current !== user.uid) throw new Error("Owner session changed. Check readiness again.");
    const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers, credentials: "include", cache: "no-store",
      redirect: "error", signal: AbortSignal.timeout(body === undefined ? 20000 : 90000), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (actor.current !== user.uid) throw new Error("Owner session changed. Check readiness again.");
    if (!response.ok) throw new Error(result.error ?? `Recovery request failed (${response.status}).`);
    return result;
  };
  const readReadiness = async (): Promise<Readiness> => {
    const runtime = await request("/api/admin/outbound-prospects/communications/recovery-runtime");
    const consent = await request("/api/communications/gmail/oauth/status");
    return { ...runtime, draftScopeGranted: consent.enabled === true && consent.draftScopeGranted === true && consent.sendsEnabled === false };
  };
  const readiness = useMutation({ mutationFn: readReadiness, retry: false });
  const validPins = Object.values(pins).every(value => hash.test(value)) && (job.savedOutputRecovery?.ownerAction
    ? job.savedOutputRecovery.ownerAction.actorUid === currentUser?.uid && job.savedOutputRecovery.ownerAction.originalJobDigest === pins.expectedJobDigest
      && job.savedOutputRecovery.rawOutputSha256 === pins.rawOutputSha256
    : pins.expectedJobDigest === job.expectedJobDigest && pins.expectedCheckpointDigest === job.expectedCheckpointDigest);
  const inputFor = (sourceCommit: string) => ({ prospectId: job.prospectId, jobId: job.jobId, briefDigest: job.briefDigest,
    ...pins, sessionId: job.sessionId!, expectedSourceCommit: sourceCommit });
  const ownedByOriginalAction = async (saved: any, sourceCommit: string) => {
    const requesterUid = currentUser?.uid;
    const pin = saved?.savedOutputRecovery, owner = pin?.ownerAction;
    const matches = Boolean(owner && saved.jobId === job.jobId && saved.prospectId === job.prospectId && saved.briefDigest === job.briefDigest
      && saved.checkpoint?.sessionId === job.sessionId && owner.actorUid === requesterUid && owner.sourceCommit === sourceCommit
      && owner.originalJobDigest === pins.expectedJobDigest && pin.rawOutputSha256 === pins.rawOutputSha256
      && owner.requestDigest === await requestDigest(inputFor(sourceCommit)));
    if (!requesterUid || actor.current !== requesterUid) throw new Error("Owner session changed. Check readiness again.");
    return matches;
  };
  const rememberIntent = async (value: any, sourceCommit: string) => {
    const requesterUid = currentUser?.uid;
    if (!value || !requesterUid || value.actorUid !== requesterUid || value.expectedSourceCommit !== sourceCommit || value.sessionId !== job.sessionId
      || !Number.isSafeInteger(value.generation) || value.generation < 1 || !["queued", "running", "completed", "failed", "cancelled"].includes(value.state)
      || value.requestDigest !== await requestDigest({ input: inputFor(sourceCommit), actorUid: requesterUid })) throw new Error("Recovery intent acknowledgement is unverified. Check recovery status.");
    if (actor.current !== requesterUid) throw new Error("Owner session changed. Check readiness again.");
    setIntent({ generation: value.generation, requestDigest: value.requestDigest, state: value.state, cancelRequested: value.cancelRequested === true, sourceCommit });
  };
  const confirmRecovered = async (sourceCommit: string) => {
    const result = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications`);
    const saved = result.jobs?.find((row: any) => row.jobId === job.jobId);
    if (saved?.state === "pending_approval" && saved.ledgerId === `communications_${job.jobId}` && saved.outputSource?.rawOutputSha256 === pins.rawOutputSha256
      && await ownedByOriginalAction(saved, sourceCommit)) {
      onRecovered(job.jobId, saved.ledgerId); return true;
    }
    return false;
  };
  const recovery = useMutation({ retry: false, mutationFn: async () => {
    if (!reviewed || !validPins || !job.sessionId || job.attempts >= 3 || job.leaseUntil > Date.now()) throw new Error("Review the original job and retained evidence pins first.");
    const displayedSource = readiness.data?.sourceCommit, originalPins = { ...pins };
    const fresh = await readReadiness();
    if (!ready(fresh)) throw new Error("Owner runtime, compose capability, outreach controls or memory reserve is unavailable. Check readiness again.");
    if (fresh.sourceCommit !== displayedSource) throw new Error("Deployed source changed. Review the new source and check readiness again.");
    const history = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications`);
    const saved = history.jobs?.find((row: any) => row.jobId === job.jobId);
    const owned = await ownedByOriginalAction(saved, fresh.sourceCommit!);
    if (!owned) {
      const inventory = await request("/api/admin/outbound-prospects/communications/blocked-jobs");
      const current = inventory.jobs?.find((row: BlockedJob) => row.jobId === job.jobId);
      if (!current || current.prospectId !== job.prospectId || current.briefDigest !== job.briefDigest || current.sessionId !== job.sessionId
        || current.expectedJobDigest !== originalPins.expectedJobDigest || current.expectedCheckpointDigest !== originalPins.expectedCheckpointDigest
        || saved?.savedOutputRecovery?.ownerAction) throw new Error("Original job context changed. Check recovery status before another action.");
    }
    if (!saved || !["blocked", "queued", "running", "retry", "pending_approval"].includes(saved.state)
      || saved.attempts >= 3 || (saved.lease?.until ?? 0) > Date.now()) throw new Error("Original job context changed. Check recovery status before another action.");
    const result = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications/${job.jobId}/recover-saved-draft`, {
      briefDigest: job.briefDigest, ...originalPins, sessionId: job.sessionId, expectedSourceCommit: fresh.sourceCommit,
    });
    if (result.ok !== true || result.executionPlacement !== "existing_background_worker"
      || result.sent !== false || result.gmailDraftCreated !== false || result.sessionCreated !== false || result.existingProcess !== true) {
      throw new Error("Recovery acknowledgement is unverified. Check recovery status before another action.");
    }
    await rememberIntent(result.request, fresh.sourceCommit!);
    setReviewed(false);
    if (result.request.state === "completed" && await confirmRecovered(fresh.sourceCommit!)) return "Original saved output is in Approvals. No Gmail copy or send occurred.";
    return `Recovery intent is ${result.request.state} in the existing worker. Check recovery status; no new inference, Gmail copy or send is authorized.`;
  }, onError: () => { setReviewed(false); } });
  const status = useMutation({ retry: false, mutationFn: async () => {
    const sourceCommit = readiness.data?.sourceCommit;
    if (sourceCommit && await confirmRecovered(sourceCommit)) return "Original saved output is in Approvals. No Gmail copy or send occurred.";
    const result = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications/${job.jobId}/saved-recovery`);
    if (result.request && /^[a-f0-9]{40}$/.test(result.request.expectedSourceCommit ?? "")) {
      await rememberIntent(result.request, result.request.expectedSourceCommit);
      return `Recovery intent: ${result.request.state}${result.request.cancelRequested ? "; cancellation requested" : ""}. ${result.request.error ?? "Preserve the original evidence pins."}`;
    }
    return "No owner recovery intent is recorded. No recovery action was taken.";
  } });
  const cancellation = useMutation({ retry: false, mutationFn: async () => {
    if (!intent) throw new Error("Check recovery status before cancelling this exact intent.");
    const result = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications/${job.jobId}/saved-recovery/cancel`, {
      generation: intent.generation, requestDigest: intent.requestDigest,
    });
    await rememberIntent(result.request, intent.sourceCommit);
    setReviewed(false); return "Cancellation recorded for this exact generation. Check recovery status; an existing approval remains retained.";
  } });
  useEffect(() => { setPins({ expectedJobDigest: "", expectedCheckpointDigest: "", rawOutputSha256: "" }); setReviewed(false);
    setIntent(null); readiness.reset(); recovery.reset(); status.reset(); cancellation.reset(); }, [currentUser?.uid, job.jobId]);
  const busy = readiness.isPending || recovery.isPending || status.isPending || cancellation.isPending;
  const activeIntent = intent && ["queued", "running"].includes(intent.state);
  return <div className="mt-3 space-y-3 border-t border-runway-line pt-3">
    <p>This job has an existing session. Recover its reviewed saved output into Approvals. Gmail copying stays a separate action.</p>
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" disabled={!currentUser || busy}
      onClick={() => { onSelected(); setReviewed(false); readiness.mutate(); }}>Check saved-output readiness</button>
    {readiness.isPending && <p role="status">Checking the existing founder runtime…</p>}
    {readiness.isError && <p role="alert">{readiness.error.message} No recovery was requested.</p>}
    {!readiness.isError && readiness.data && <div aria-label="Saved-output readiness">
      <p>Founder owner access: verified. Source: <code className="break-all">{readiness.data.sourceCommit ?? "unknown"}</code>.</p>
      <p>Existing worker: <code>{readiness.data.workerServiceId ?? "unavailable"}</code>. Measurement: {readiness.data.workerFresh ? "fresh and source-bound" : "unavailable or stale"}.</p>
      <p>Worker provider configured: {readiness.data.providerKeyConfigured ? "yes" : "no"}. Compose access: {readiness.data.draftScopeGranted ? "verified" : "unavailable"}.</p>
      <p>Worker founder binding: {readiness.data.founderBindingConfigured ? "configured; verified again before execution" : "unavailable"}.</p>
      <p>Outreach controls: {readiness.data.outreachControlsOff ? "all four off" : "recovery blocked"}.</p>
      {readiness.data.controls && <ul>{Object.entries(readiness.data.controls).map(([name, state]) => <li key={name}>{name}: {state}</li>)}</ul>}
      <p>Worker process RSS: {readiness.data.memory ? mib(readiness.data.memory.rss) : "unavailable"} MiB. Full memory group: {readiness.data.memory?.cgroup
        ? `${mib(readiness.data.memory.cgroup.current)} / ${mib(readiness.data.memory.cgroup.limit)} MiB` : "unavailable"}.</p>
      <p>{mib(readiness.data.headroomReserveBytes)} MiB reserve: {readiness.data.headroomAvailable ? "available" : "unavailable"}. Cache is included in full usage.</p>
      <p>Measured: {readiness.data.memory?.observedAt ?? "unavailable"}. Readiness is checked again before recovery.</p>
    </div>}
    <p>Enter the three SHA256 pins from the retained original-output recovery packet. Current job and checkpoint must still match.</p>
    {([["expectedJobDigest", "Original job digest"], ["expectedCheckpointDigest", "Original checkpoint digest"], ["rawOutputSha256", "Reviewed output SHA256"]] as const).map(([field, label]) =>
      <label key={field} className="block">{label}<input aria-label={label} className="mt-1 block w-full border border-runway-line bg-transparent p-2 font-mono text-xs"
        value={pins[field]} maxLength={64} autoComplete="off" disabled={busy || Boolean(activeIntent)} onChange={event => { onSelected(); setReviewed(false); setPins({ ...pins, [field]: event.target.value.trim() }); }} /></label>)}
    {Object.values(pins).every(value => hash.test(value)) && !validPins && <p role="alert">Original job or checkpoint digest does not match the current record. Preserve the original evidence; do not replace its pins.</p>}
    <label className="flex gap-2"><input type="checkbox" checked={reviewed} disabled={busy || Boolean(activeIntent) || !validPins || !ready(readiness.data) || readiness.isError}
      onChange={event => setReviewed(event.target.checked)} />I reviewed this original job, saved output and displayed source under the retained recovery authorization.</label>
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" disabled={busy || Boolean(activeIntent) || !currentUser || !reviewed || !validPins
      || !ready(readiness.data) || readiness.isError || job.attempts >= 3 || job.leaseUntil > Date.now()}
      onClick={() => recovery.mutate()}>{recovery.isPending ? "Recovering saved output…" : "Recover saved output"}</button>
    <button type="button" className="runway-cta-ghost ml-2 min-h-0 px-3 py-2 text-sm" disabled={busy || !currentUser} onClick={() => status.mutate()}>Check recovery status</button>
    <button type="button" className="runway-cta-ghost ml-2 min-h-0 px-3 py-2 text-sm" disabled={busy || !activeIntent || intent?.cancelRequested}
      onClick={() => cancellation.mutate()}>Cancel saved recovery</button>
    {recovery.data && <p role="status">{recovery.data}</p>}
    {cancellation.isError && <p role="alert">{cancellation.error.message} Check recovery status before another action.</p>}
    {cancellation.data && <p role="status">{cancellation.data}</p>}
    {recovery.isError && <p role="alert">{recovery.error.message} Check recovery status before retrying. No new inference, Gmail copy or send is authorized.</p>}
    {status.isError && <p role="alert">{status.error.message}</p>}{status.data && <p role="status">{status.data}</p>}
  </div>;
}
function OwnerDraftRequest() {
  const { currentUser } = useAuth();
  const actor = useRef(currentUser?.uid); actor.current = currentUser?.uid;
  const empty = { prospectId: "", briefId: "", expectedBriefDigest: "", expectedSourceCommit: "", sessionSpendLimitCents: "",
    regenerationOf: "", expectedJobDigest: "" };
  const [input, setInput] = useState(empty);
  const [result, setResult] = useState<{ actorUid: string; message: string } | null>(null);
  useEffect(() => { setInput(empty); setResult(null); }, [currentUser?.uid]);
  const request = useMutation({
    retry: false,
    mutationFn: async () => {
      const user = currentUser, uid = user?.uid;
      if (!user || !uid) throw new Error("Sign in as the founder owner before requesting a draft.");
      const headers = await withCsrfHeader(await withFirebaseAuthHeaders(user, { "Content-Type": "application/json" }), { refresh: true });
      if (actor.current !== uid) throw new Error("Account changed. Review the draft request again.");
      const response = await fetch(`/api/admin/outbound-prospects/${encodeURIComponent(input.prospectId)}/communications/generate`, {
        method: "POST", credentials: "include", headers,
        body: JSON.stringify({ briefId: input.briefId, expectedBriefDigest: input.expectedBriefDigest,
          expectedSourceCommit: input.expectedSourceCommit, sessionSpendLimitCents: Number(input.sessionSpendLimitCents),
          ...(input.regenerationOf ? { regenerationOf: input.regenerationOf, expectedJobDigest: input.expectedJobDigest } : {}) }),
      });
      const body = await response.json();
      if (actor.current !== uid) return;
      if (!response.ok) throw new Error(body.error ?? "Draft request was not accepted.");
      const job = { prospectId: input.prospectId, briefId: input.briefId,
        briefDigest: input.expectedBriefDigest, intent: "outreach", inboundMessageId: null,
        ...(input.regenerationOf ? { regenerationOf: input.regenerationOf } : {}) };
      const digest = await requestDigest({ job, actorUid: uid,
        sourceCommit: input.expectedSourceCommit, sessionSpendLimitCents: Number(input.sessionSpendLimitCents) });
      const jobId = await requestDigest(job);
      if (actor.current !== uid) return;
      if (response.status !== 202 || body.ok !== true || body.jobId !== jobId || body.sent !== false || body.gmailDraftCreated !== false
        || body.request?.actorUid !== uid || body.request?.sourceCommit !== input.expectedSourceCommit
        || body.request?.sessionSpendLimitCents !== Number(input.sessionSpendLimitCents) || body.request?.requestDigest !== digest
        || !["requested", "completed", "failed"].includes(body.request?.state)
        || body.executionPlacement !== "existing_background_worker") throw new Error("Draft acknowledgement could not be verified.");
      const status = body.request.state === "requested" ? "Request recorded for the existing worker; execution is not yet verified."
        : body.request.state === "completed" ? "Existing request is completed. Inspect its saved draft; no new attempt was requested."
        : "Existing request is failed. Inspect its retained diagnostic; no new attempt was requested.";
      setResult({ actorUid: uid, message: `Agent draft ${body.jobId}. ${status} No email was sent or copied to Gmail.` });
    },
  });
  const limit = Number(input.sessionSpendLimitCents);
  const valid = /^[a-zA-Z0-9_.:-]{1,160}$/.test(input.prospectId) && /^[a-zA-Z0-9_.:-]{1,160}$/.test(input.briefId)
    && /^[a-f0-9]{64}$/.test(input.expectedBriefDigest) && /^[a-f0-9]{40}$/.test(input.expectedSourceCommit)
    && /^[0-9]+$/.test(input.sessionSpendLimitCents) && Number.isSafeInteger(limit) && limit > 0
    && limit <= Math.floor(Number.MAX_SAFE_INTEGER / 10000)
    && (!input.regenerationOf && !input.expectedJobDigest || hash.test(input.regenerationOf) && hash.test(input.expectedJobDigest));
  return <details className="mt-3 text-sm text-runway-body"><summary>Request an agent draft</summary>
    <p className="mt-2">Use the admitted research brief and current deployed revision. This requests model work under the existing budget; the session limit is not an invoice guarantee. Only the configured founder owner can submit. Sending and Gmail copying are separate.</p>
    <form className="mt-2 space-y-2" onSubmit={event => { event.preventDefault(); if (valid && currentUser && !request.isPending) { setResult(null); request.mutate(); } }}>
      {([ ["prospectId", "Prospect ID"], ["briefId", "Reviewed brief ID"], ["expectedBriefDigest", "Reviewed brief digest"],
        ["expectedSourceCommit", "Expected deployed revision"], ["sessionSpendLimitCents", "Session limit in cents"],
        ["regenerationOf", "Original unsent job ID (optional)"], ["expectedJobDigest", "Original job digest (required for replacement)"] ] as const).map(([key, label]) =>
        <label key={key} className="block">{label}<input className="block w-full border border-runway-line p-2" value={input[key]}
          disabled={request.isPending} required={key !== "regenerationOf" && key !== "expectedJobDigest"}
          onChange={event => setInput(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
      <button type="submit" className="runway-cta-ghost px-3 py-2" disabled={!currentUser || !valid || request.isPending}>
        {request.isPending ? "Requesting draft…" : "Request agent draft"}</button>
    </form>
    {request.isError && <p role="alert">{request.error.message} Check the existing job before submitting again; this request is never automatically replayed.</p>}
    {result && result.actorUid === currentUser?.uid && <p role="status">{result.message}</p>}
  </details>;
}

export function CommunicationsRecovery() {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [recovered, setRecovered] = useState<{ jobId: string; ledgerId: string } | null>(null);
  const [selected, setSelected] = useState<BlockedJob | null>(null);
  useEffect(() => { setRecovered(null); setSelected(null); }, [currentUser?.uid]);
  const queryClient = useQueryClient();
  const key = ["blocked-communications-jobs", currentUser?.uid];
  const jobs = useQuery<BlockedJob[]>({
    queryKey: key, enabled: expanded && Boolean(currentUser), retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/outbound-prospects/communications/blocked-jobs", {
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser)),
      });
      if (!response.ok) throw new Error("Could not read blocked jobs.");
      return (await response.json()).jobs;
    },
  });
  const retry = useMutation({
    mutationFn: async (job: BlockedJob) => {
      if (!currentUser) throw new Error("Sign in before retrying a communications job.");
      const response = await fetch(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications/${encodeURIComponent(job.jobId)}/retry`, {
        method: "POST", headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" })),
        body: JSON.stringify({ briefDigest: job.briefDigest }),
      });
      if (!response.ok) throw new Error("Job is not eligible. Recheck its current context, attempt budget and active lease.");
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: key }); },
  });
  return <section className="runway-panel p-5">
    <OwnerDraftRequest />
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" aria-expanded={expanded}
      onClick={() => setExpanded(!expanded)}>Review blocked communications jobs</button>
    {expanded && <div className="mt-3 space-y-3 text-sm text-runway-body">
      <p>Review the same job and its retained context. An existing session uses saved-output recovery; its three-attempt budget and human send approval remain in force.</p>
      {recovered && <p role="status">Saved output for {recovered.jobId} is in Approvals ({recovered.ledgerId}). Use the separate Save to Gmail Drafts action on that exact original revision. Nothing was sent.</p>}
      {jobs.isLoading && <p>Loading blocked jobs…</p>}
      {jobs.isError && <p role="alert">Could not read blocked jobs.</p>}
      {retry.isError && <p role="alert">{retry.error.message}</p>}
      {jobs.data?.length === 0 && <p>No blocked communications jobs.</p>}
      {[...(jobs.data ?? []), ...(selected && !jobs.data?.some(job => job.jobId === selected.jobId) ? [selected] : [])].map(job => <div key={job.jobId} className="border border-runway-line p-3">
        <p>Prospect: {job.prospectId}</p><p>Job: {job.jobId}</p><p>{job.reason}</p>
        <p>{job.attempts} of 3 attempts used.</p>
        {job.sessionId ? <SavedOutputRecovery job={job} onSelected={() => setSelected(job)} onRecovered={(jobId, ledgerId) => {
          setRecovered({ jobId, ledgerId }); void queryClient.invalidateQueries({ queryKey: key });
          void queryClient.invalidateQueries({ queryKey: ["admin-action-queue", currentUser?.uid] });
        }} /> : <button type="button" className="runway-cta-ghost mt-2 min-h-0 px-3 py-2 text-sm"
          disabled={!currentUser || retry.isPending || job.attempts >= 3 || job.leaseUntil > Date.now()}
          onClick={() => retry.mutate(job)}>Retry job</button>}
      </div>)}
      {jobs.data && jobs.data.length >= 20 && <p>Showing up to 20 blocked jobs.</p>}
    </div>}
  </section>;
}
