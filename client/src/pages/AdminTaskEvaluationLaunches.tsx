import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  resolveTaskEvaluationLaunchLabToken,
  withTaskEvaluationLaunchLabHeader,
} from "@/lib/taskEvaluationLaunchLabAccess";
import { defaultTaskEvaluationAuthorityExpiry } from "@/lib/taskEvaluationLaunchForm";

type LaunchProfile = {
  profile_id: string;
  profile_digest: string;
  source_bundle: { bundle_id: string; source_kind: string; uri: string; digest: string };
  evaluation_run_spec: { uri: string; digest: string };
  execution_admission: {
    live_enabled: boolean;
    readiness_receipt: { uri: string; digest: string };
    blockers: string[];
  };
  claim_ceiling: string;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 20_000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function AdminTaskEvaluationLaunches() {
  const { currentUser } = useAuth();
  const [launchLabToken] = useState(resolveTaskEvaluationLaunchLabToken);
  const [profiles, setProfiles] = useState<LaunchProfile[]>([]);
  const [profileKey, setProfileKey] = useState("");
  const [launchId, setLaunchId] = useState("");
  const [runId, setRunId] = useState("");
  const [rightsScope, setRightsScope] = useState("interiorgs_sage_simulator_evaluation");
  const [rightsUri, setRightsUri] = useState("");
  const [rightsDigest, setRightsDigest] = useState("");
  const [maxSpend, setMaxSpend] = useState("2.00");
  const [expiresAt, setExpiresAt] = useState(defaultTaskEvaluationAuthorityExpiry);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [supervision, setSupervision] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recoveringSubmission, setRecoveringSubmission] = useState(false);

  const selected = useMemo(
    () => profiles.find((profile) => `${profile.profile_id}:${profile.profile_digest}` === profileKey),
    [profileKey, profiles],
  );
  const canSubmit = Boolean(
    selected && confirmed && launchId && runId && rightsScope && rightsUri
    && /^sha256:[0-9a-f]{64}$/.test(rightsDigest) && Number(maxSpend) > 0 && expiresAt,
  );

  async function authHeaders(json = false) {
    const headers = await withFirebaseAuthHeaders(
      currentUser,
      await withCsrfHeader(json ? { "content-type": "application/json" } : {}),
    );
    return withTaskEvaluationLaunchLabHeader(launchLabToken, headers);
  }

  async function loadProfiles() {
    if (!currentUser && !launchLabToken) {
      throw new Error("Temporary launch access is missing. Reopen the private launch-lab link.");
    }
    const response = await fetchWithTimeout("/api/admin/task-evaluation-launches/profiles", {
      headers: await authHeaders(),
      credentials: "include",
    });
    if (!response.ok) throw new Error("Published Pipeline launch profiles are unavailable");
    const payload = await response.json();
    setProfiles(payload.profiles || []);
    setError(null);
    try {
      const supervisionResponse = await fetchWithTimeout(
        "/api/admin/task-evaluation-launches/supervision",
        { headers: await authHeaders(), credentials: "include" },
      );
      if (supervisionResponse.ok) setSupervision(await supervisionResponse.json());
    } catch {
      // The optional advisory supervisor must not block deterministic launch authority.
    }
  }

  async function refreshStatus(id = launchId) {
    if ((!currentUser && !launchLabToken) || !id) return;
    const response = await fetchWithTimeout(`/api/admin/task-evaluation-launches/${encodeURIComponent(id)}`, {
      headers: await authHeaders(),
      credentials: "include",
    });
    if (response.ok) {
      setStatus(await response.json());
      setRecoveringSubmission(false);
      setError(null);
      return true;
    }
    if (response.status !== 404) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Task Evaluation launch status is unavailable");
    }
    return false;
  }

  useEffect(() => {
    void loadProfiles().catch((reason) => setError(String(reason)));
  }, [currentUser, launchLabToken]);

  useEffect(() => {
    if (
      !launchId
      || (!status && !recoveringSubmission)
      || ["completed", "blocked", "dry_run_completed"].includes(status?.state)
    ) {
      return undefined;
    }
    const timer = window.setInterval(() => void refreshStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [launchId, status?.state, currentUser, launchLabToken, recoveringSubmission]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetchWithTimeout("/api/admin/task-evaluation-launches", {
        method: "POST",
        headers: await authHeaders(true),
        credentials: "include",
        body: JSON.stringify({
          launch_id: launchId,
          run_id: runId,
          profile_id: selected.profile_id,
          profile_digest: selected.profile_digest,
          rights: { scope: rightsScope, evidence: { uri: rightsUri, digest: rightsDigest } },
          spend: { max_spend_usd: Number(maxSpend), expires_at: new Date(expiresAt).toISOString() },
          confirm_execution: confirmed,
        }),
      });
      const payload = await response.json();
      if (!response.ok && payload.persistence_state === "unknown") {
        setStatus(null);
        setRecoveringSubmission(true);
        setError("Launch persistence is still being resolved. Checking this exact launch ID; do not create a new launch.");
        await refreshStatus(launchId).catch(() => false);
        return;
      }
      setStatus(payload);
      if (!response.ok) throw new Error(payload.error || payload.forward?.blocker || "Launch was blocked");
      await refreshStatus(launchId);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") {
        setRecoveringSubmission(true);
        setError("Launch submission timed out while persistence may still be completing. Checking this exact launch ID; do not create a new launch.");
        await refreshStatus(launchId).catch(() => false);
      } else {
        setError(reason instanceof Error ? reason.message : "Launch was blocked");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const terminal = status && ["completed", "blocked", "dry_run_completed"].includes(status.state);

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-4 py-8 text-stone-950">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-stone-300 pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
            Production control room
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
            Task Evaluation launch
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-stone-600">
            Authorize one immutable Pipeline profile. The website queues it; the canonical allocator,
            watchdog, reconciler, artifact retention, teardown, and provider-zero contracts own execution.
          </p>
          {launchLabToken ? (
            <p className="mt-3 text-sm font-medium text-emerald-800">
              Temporary launch-lab access is active. Firebase sign-in is not required in this tab.
            </p>
          ) : null}
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["1", "Durable state", "Digest-bound identity and idempotent sequencing"],
            ["2", "Independent recovery", "Watchdog, teardown, provider-zero, orphan reaping"],
            ["3", "Canonical allocator", "The only component allowed to mutate GPU providers"],
            ["4", "Optional supervisor", "Explains blockers and recommends admitted profiles only"],
          ].map(([number, title, detail]) => (
            <div key={number} className="border border-stone-300 bg-white/70 p-5">
              <span className="text-xs font-semibold text-stone-400">{number}</span>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{detail}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5 border border-stone-300 bg-white p-6 md:p-8">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Authority envelope</h2>
            </div>
            <label className="block text-sm font-medium">Pipeline-owned profile
              <select className="mt-2 w-full border border-stone-300 bg-white p-3" value={profileKey}
                onChange={(event) => setProfileKey(event.target.value)}>
                <option value="">Select an immutable profile</option>
                {profiles.map((profile) => (
                  <option key={`${profile.profile_id}:${profile.profile_digest}`}
                    value={`${profile.profile_id}:${profile.profile_digest}`}>
                    {profile.profile_id} · {profile.source_bundle.source_kind}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <div className="bg-stone-100 p-4 text-xs leading-6 text-stone-600">
                <p>Bundle {selected.source_bundle.bundle_id} · {selected.source_bundle.digest}</p>
                <p>Profile {selected.profile_digest}</p>
                <p>
                  Execution {selected.execution_admission.live_enabled ? "live-admitted" : "dry-only"}
                </p>
                {selected.execution_admission.blockers.map((blocker) => (
                  <p key={blocker} className="text-amber-800">Readiness blocker · {blocker}</p>
                ))}
                <p>Claim ceiling {selected.claim_ceiling}</p>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Launch ID" value={launchId} onChange={setLaunchId} />
              <Input label="Run ID" value={runId} onChange={setRunId} />
            </div>
            <Input label="Rights scope" value={rightsScope} onChange={setRightsScope} />
            <Input label="Rights evidence URI" value={rightsUri} onChange={setRightsUri}
              placeholder="firestore://taskEvaluationLaunchAuthorities/..." />
            <Input label="Rights evidence digest" value={rightsDigest} onChange={setRightsDigest}
              placeholder="sha256:..." />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Maximum spend (USD)" value={maxSpend} onChange={setMaxSpend} type="number" />
              <Input label="Authority expires" value={expiresAt} onChange={setExpiresAt} type="datetime-local" />
            </div>
            <label className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-4 text-sm leading-6">
              <input className="mt-1" type="checkbox" checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I authorize this exact profile, rights scope, spend ceiling, and execution window.
                There are no automatic paid retries.</span>
            </label>
            <button type="button" onClick={() => void submit()}
              disabled={!canSubmit || submitting || recoveringSubmission}
              className="w-full bg-stone-950 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
              {submitting
                ? "Queuing immutable launch…"
                : recoveringSubmission
                  ? "Checking durable launch…"
                  : "Authorize and queue launch"}
            </button>
          </div>

          <aside className="space-y-4">
            <div className="border border-stone-300 bg-stone-950 p-6 text-stone-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Run state</h2>
                <button type="button" onClick={() => void refreshStatus()} className="p-2" aria-label="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-5 text-2xl font-semibold">{status?.state || status?.status || "Not queued"}</p>
              <p className="mt-2 break-all text-xs leading-5 text-stone-400">
                {status?.request_digest || "No immutable request digest yet."}
              </p>
              {terminal ? (
                <div className="mt-5 flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Terminal receipt retained
                </div>
              ) : null}
            </div>
            {error ? (
              <div className="flex gap-3 border border-rose-300 bg-rose-50 p-5 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            <div className="border border-stone-300 p-5 text-sm leading-6 text-stone-600">
              A completed simulation receipt is development evidence. It does not establish physical
              success, deployment readiness, or safety approval.
            </div>
            <div className="border border-stone-300 bg-white/70 p-5 text-sm leading-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Optional supervisor
              </p>
              <p className="mt-3 font-medium">
                {supervision?.recommendation?.summary || "No Agents SDK recommendation observed."}
              </p>
              {supervision?.recommendation?.recommended_profile_id ? (
                <p className="mt-2 text-stone-600">
                  Recommended admitted profile: {supervision.recommendation.recommended_profile_id}
                </p>
              ) : null}
              {supervision?.recommendation?.human_decision_required ? (
                <p className="mt-3 border-l-2 border-amber-500 pl-3 text-amber-800">
                  {supervision.recommendation.human_decision_prompt}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-stone-500">
                Advisory only: no allocator, provider, retry, spend, rights, or teardown authority.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">{props.label}
      <input className="mt-2 w-full border border-stone-300 p-3" type={props.type || "text"}
        value={props.value} placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
