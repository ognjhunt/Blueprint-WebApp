import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { useAuth } from "@/contexts/AuthContext";

type BlockedJob = { jobId: string; prospectId: string; briefDigest: string; attempts: number; reason: string; leaseUntil: number;
  state?: string; sessionId?: string | null; expectedJobDigest?: string; expectedCheckpointDigest?: string };
type Readiness = { sourceCommit: string | null; existingProcess: boolean; providerKeyConfigured: boolean; headroomAvailable: boolean;
  outreachControlsOff: boolean; headroomReserveBytes: number; memory: { observedAt: string; rss: number; cgroup: { current: number; limit: number } | null };
  draftScopeGranted: boolean };
const hash = /^[a-f0-9]{64}$/;
const ready = (value?: Readiness) => Boolean(value && /^[a-f0-9]{40}$/.test(value.sourceCommit ?? "")
  && value.existingProcess && value.providerKeyConfigured && value.headroomAvailable && value.outreachControlsOff && value.draftScopeGranted);
const mib = (value: number) => (value / 1024 / 1024).toFixed(1);

/** The ordinary founder app transport; an explicit saved-output action never
 * enters the generic retry or Gmail-copy/send paths. Evidence pins stay private. */
function SavedOutputRecovery({ job, onRecovered }: { job: BlockedJob; onRecovered: (jobId: string, ledgerId: string) => void }) {
  const { currentUser } = useAuth();
  const actor = useRef(currentUser?.uid); actor.current = currentUser?.uid;
  const [pins, setPins] = useState({ expectedJobDigest: "", expectedCheckpointDigest: "", rawOutputSha256: "" });
  const [reviewed, setReviewed] = useState(false);
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
  const validPins = Object.values(pins).every(value => hash.test(value)) && pins.expectedJobDigest === job.expectedJobDigest
    && pins.expectedCheckpointDigest === job.expectedCheckpointDigest;
  const recovery = useMutation({ retry: false, mutationFn: async () => {
    if (!reviewed || !validPins || !job.sessionId || job.attempts >= 3 || job.leaseUntil > Date.now()) throw new Error("Review the original job and retained evidence pins first.");
    const displayedSource = readiness.data?.sourceCommit, originalPins = { ...pins };
    const fresh = await readReadiness();
    if (!ready(fresh)) throw new Error("Owner runtime, compose capability, outreach controls or memory reserve is unavailable. Check readiness again.");
    if (fresh.sourceCommit !== displayedSource) throw new Error("Deployed source changed. Review the new source and check readiness again.");
    const inventory = await request("/api/admin/outbound-prospects/communications/blocked-jobs");
    const current = inventory.jobs?.find((row: BlockedJob) => row.jobId === job.jobId);
    if (!current || current.prospectId !== job.prospectId || current.briefDigest !== job.briefDigest || current.sessionId !== job.sessionId
      || current.expectedJobDigest !== originalPins.expectedJobDigest || current.expectedCheckpointDigest !== originalPins.expectedCheckpointDigest
      || current.attempts >= 3 || current.leaseUntil > Date.now()) throw new Error("Original job context changed. Check recovery status before another action.");
    const result = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications/${job.jobId}/recover-saved-draft`, {
      briefDigest: job.briefDigest, ...originalPins, sessionId: job.sessionId, expectedSourceCommit: fresh.sourceCommit,
    });
    if (result.ok !== true || !["pending_approval", "no_op"].includes(result.state) || result.ledgerId !== `communications_${job.jobId}`
      || result.sent !== false || result.gmailDraftCreated !== false || result.sessionCreated !== false || result.existingProcess !== true) {
      throw new Error("Recovery acknowledgement is unverified. Check recovery status before another action.");
    }
    onRecovered(job.jobId, result.ledgerId);
  }, onError: () => { setReviewed(false); } });
  const status = useMutation({ retry: false, mutationFn: async () => {
    const result = await request(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications`);
    const saved = result.jobs?.find((row: any) => row.jobId === job.jobId), owner = saved?.savedOutputRecovery?.ownerAction;
    if (saved?.state === "pending_approval" && saved.ledgerId === `communications_${job.jobId}` && saved.outputSource?.rawOutputSha256 === pins.rawOutputSha256
      && owner?.actorUid === currentUser?.uid && owner.originalJobDigest === pins.expectedJobDigest && owner.sourceCommit === readiness.data?.sourceCommit) {
      onRecovered(job.jobId, saved.ledgerId); return "Original saved output is in Approvals. No Gmail copy or send occurred.";
    }
    return `Current job state: ${saved?.state ?? "unknown"}. No recovery action was taken. Preserve the original pins and inspect the retained context.`;
  } });
  useEffect(() => { setPins({ expectedJobDigest: "", expectedCheckpointDigest: "", rawOutputSha256: "" }); setReviewed(false);
    readiness.reset(); recovery.reset(); status.reset(); }, [currentUser?.uid, job.jobId]);
  const busy = readiness.isPending || recovery.isPending || status.isPending;
  return <div className="mt-3 space-y-3 border-t border-runway-line pt-3">
    <p>This job has an existing session. Recover its reviewed saved output into Approvals. Gmail copying stays a separate action.</p>
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" disabled={!currentUser || busy}
      onClick={() => { setReviewed(false); readiness.mutate(); }}>Check saved-output readiness</button>
    {readiness.isPending && <p role="status">Checking the existing founder runtime…</p>}
    {readiness.isError && <p role="alert">{readiness.error.message} No recovery was requested.</p>}
    {!readiness.isError && readiness.data && <div aria-label="Saved-output readiness">
      <p>Founder owner access: verified. Source: <code className="break-all">{readiness.data.sourceCommit ?? "unknown"}</code>.</p>
      <p>Provider configured: {readiness.data.providerKeyConfigured ? "yes" : "no"}. Compose access: {readiness.data.draftScopeGranted ? "verified" : "unavailable"}.</p>
      <p>Outreach controls: {readiness.data.outreachControlsOff ? "all four off" : "recovery blocked"}.</p>
      <p>Web process RSS: {mib(readiness.data.memory.rss)} MiB. Full memory group: {readiness.data.memory.cgroup
        ? `${mib(readiness.data.memory.cgroup.current)} / ${mib(readiness.data.memory.cgroup.limit)} MiB` : "unavailable"}.</p>
      <p>{mib(readiness.data.headroomReserveBytes)} MiB reserve: {readiness.data.headroomAvailable ? "available" : "unavailable"}. Cache is included in full usage.</p>
      <p>Measured: {readiness.data.memory.observedAt}. Readiness is checked again before recovery.</p>
    </div>}
    <p>Enter the three SHA256 pins from the retained original-output recovery packet. Current job and checkpoint must still match.</p>
    {([["expectedJobDigest", "Original job digest"], ["expectedCheckpointDigest", "Original checkpoint digest"], ["rawOutputSha256", "Reviewed output SHA256"]] as const).map(([field, label]) =>
      <label key={field} className="block">{label}<input aria-label={label} className="mt-1 block w-full border border-runway-line bg-transparent p-2 font-mono text-xs"
        value={pins[field]} maxLength={64} autoComplete="off" disabled={busy} onChange={event => { setReviewed(false); setPins({ ...pins, [field]: event.target.value.trim() }); }} /></label>)}
    {Object.values(pins).every(value => hash.test(value)) && !validPins && <p role="alert">Original job or checkpoint digest does not match the current record. Preserve the original evidence; do not replace its pins.</p>}
    <label className="flex gap-2"><input type="checkbox" checked={reviewed} disabled={busy || !validPins || !ready(readiness.data) || readiness.isError}
      onChange={event => setReviewed(event.target.checked)} />I reviewed this original job, saved output and displayed source under the retained recovery authorization.</label>
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" disabled={busy || !currentUser || !reviewed || !validPins
      || !ready(readiness.data) || readiness.isError || job.attempts >= 3 || job.leaseUntil > Date.now()}
      onClick={() => recovery.mutate()}>{recovery.isPending ? "Recovering saved output…" : "Recover saved output"}</button>
    <button type="button" className="runway-cta-ghost ml-2 min-h-0 px-3 py-2 text-sm" disabled={busy || !currentUser} onClick={() => status.mutate()}>Check recovery status</button>
    {recovery.isError && <p role="alert">{recovery.error.message} Check recovery status before retrying. No new inference, Gmail copy or send is authorized.</p>}
    {status.isError && <p role="alert">{status.error.message}</p>}{status.data && <p role="status">{status.data}</p>}
  </div>;
}
export function CommunicationsRecovery() {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [recovered, setRecovered] = useState<{ jobId: string; ledgerId: string } | null>(null);
  useEffect(() => { setRecovered(null); }, [currentUser?.uid]);
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
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" aria-expanded={expanded}
      onClick={() => setExpanded(!expanded)}>Review blocked communications jobs</button>
    {expanded && <div className="mt-3 space-y-3 text-sm text-runway-body">
      <p>Review the same job and its retained context. An existing session uses saved-output recovery; its three-attempt budget and human send approval remain in force.</p>
      {recovered && <p role="status">Saved output for {recovered.jobId} is in Approvals ({recovered.ledgerId}). Use the separate Save to Gmail Drafts action on that exact original revision. Nothing was sent.</p>}
      {jobs.isLoading && <p>Loading blocked jobs…</p>}
      {jobs.isError && <p role="alert">Could not read blocked jobs.</p>}
      {retry.isError && <p role="alert">{retry.error.message}</p>}
      {jobs.data?.length === 0 && <p>No blocked communications jobs.</p>}
      {jobs.data?.map(job => <div key={job.jobId} className="border border-runway-line p-3">
        <p>Prospect: {job.prospectId}</p><p>Job: {job.jobId}</p><p>{job.reason}</p>
        <p>{job.attempts} of 3 attempts used.</p>
        {job.sessionId ? <SavedOutputRecovery job={job} onRecovered={(jobId, ledgerId) => {
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
