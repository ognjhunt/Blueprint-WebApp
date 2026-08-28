import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  resolveTaskEvaluationLaunchLabToken,
  withTaskEvaluationLaunchLabHeader,
} from "@/lib/taskEvaluationLaunchLabAccess";
import {
  defaultTaskEvaluationAuthorityExpiry,
  prefillTaskEvaluationMaxSpend,
  requiredTaskEvaluationMaxSpendUsd,
} from "@/lib/taskEvaluationLaunchForm";

// One definition: the poll loop and the terminal badge must agree on what
// "finished" means, or the page keeps polling a run it already calls done.
const TERMINAL_LAUNCH_STATES = [
  "completed",
  "blocked",
  "dry_run_completed",
  "control_plane_terminal_blocked",
];
const TERMINAL_PREPARATION_STATES = ["materialized", "blocked"];
const TERMINAL_ACTIVATION_STATES = ["prepared", "blocked"];
const TERMINAL_DISCOVERY_STATES = [
  "selection_required",
  "ready_auto_selected",
  "metric_refinement_required",
  "abstained_no_candidates",
  "blocked",
];
const MAX_CONTRACT_FILE_BYTES = 2 * 1024 * 1024;

async function normalizedContractFileJson(file: File): Promise<string> {
  if (file.size < 1 || file.size > MAX_CONTRACT_FILE_BYTES) {
    throw new Error("Contract file must be between 1 byte and 2 MiB.");
  }
  const parsed = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Contract file must contain one JSON object.");
  }
  return JSON.stringify(parsed, null, 2);
}

type LaunchProgress = {
  phase?: string;
  phase_status?: string;
  elapsed_seconds?: number;
  observed_at_iso?: string;
  provider?: {
    instance_state?: string;
    instance_age_seconds?: number | null;
    estimated_cost_usd?: number | null;
  };
};

type PreparationContractPreview = {
  runMode: "scene_configuration" | "episode_evaluation";
  teamNamespace: string;
  sceneId: string;
  sceneVersion: string;
  hardCapUsd: number;
  providerComputeCapUsd: number | null;
  externalServiceCapUsd: number | null;
};

type DiscoveryContractPreview = {
  teamNamespace: string;
  sceneId: string;
  sceneVersion: string;
  taskStatement: string;
  analyzers: string[];
  executionMode: string;
};

function previewDiscoveryContract(value: string): DiscoveryContractPreview | null {
  try {
    const request = JSON.parse(value) as Record<string, any>;
    if (request.schema_version !== "scene_object_discovery_request.v1") return null;
    return {
      teamNamespace: String(request.team_namespace || ""),
      sceneId: String(request.scene?.identity?.id || ""),
      sceneVersion: String(request.scene?.identity?.version || ""),
      taskStatement: String(request.task?.task_statement || ""),
      analyzers: Array.isArray(request.analysis?.analyzers)
        ? request.analysis.analyzers.map(String)
        : [],
      executionMode: String(request.execution?.mode || ""),
    };
  } catch {
    return null;
  }
}

function previewPreparationContract(value: string): PreparationContractPreview | null {
  try {
    const request = JSON.parse(value) as Record<string, any>;
    if (request.run_mode !== "scene_configuration" && request.run_mode !== "episode_evaluation") {
      return null;
    }
    const hardCapUsd = Number(request.spend?.hard_cap_usd);
    if (!Number.isFinite(hardCapUsd)) return null;
    const providerCompute = request.spend?.provider_compute_spend_cap_usd;
    const externalService = request.spend?.external_service_caps?.openai?.maximum_cost_usd;
    return {
      runMode: request.run_mode,
      teamNamespace: String(request.team_namespace || ""),
      sceneId: String(request.scene?.identity?.id || ""),
      sceneVersion: String(request.scene?.identity?.version || ""),
      hardCapUsd,
      providerComputeCapUsd: Number.isFinite(Number(providerCompute)) ? Number(providerCompute) : null,
      externalServiceCapUsd: Number.isFinite(Number(externalService)) ? Number(externalService) : null,
    };
  } catch {
    return null;
  }
}

function formatElapsedSeconds(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
}

type LaunchProfile = {
  profile_id: string;
  profile_digest: string;
  source_commit?: string;
  source_bundle: { bundle_id: string; source_kind: string; uri: string; digest: string };
  evaluation_run_spec: { uri: string; digest: string };
  execution_admission: {
    live_enabled: boolean;
    readiness_receipt: { uri: string; digest: string };
    blockers: string[];
  };
  claim_ceiling: string;
  required_authorization?: { max_spend_usd: number; hard_ttl_seconds: number };
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
  const [releaseInstanceId, setReleaseInstanceId] = useState("");
  const [releaseExpectedLabel, setReleaseExpectedLabel] = useState("");
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [preparationJson, setPreparationJson] = useState("");
  const [preparationId, setPreparationId] = useState("");
  const [preparationStatus, setPreparationStatus] = useState<Record<string, any> | null>(null);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [discoveryJson, setDiscoveryJson] = useState("");
  const [discoveryId, setDiscoveryId] = useState("");
  const [discoveryStatus, setDiscoveryStatus] = useState<Record<string, any> | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(null);
  const [activationJson, setActivationJson] = useState("");
  const [activationId, setActivationId] = useState("");
  const [activationStatus, setActivationStatus] = useState<Record<string, any> | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const selected = useMemo(
    () => profiles.find((profile) => `${profile.profile_id}:${profile.profile_digest}` === profileKey),
    [profileKey, profiles],
  );
  const preparationPreview = useMemo(
    () => previewPreparationContract(preparationJson),
    [preparationJson],
  );
  const discoveryPreview = useMemo(
    () => previewDiscoveryContract(discoveryJson),
    [discoveryJson],
  );
  const requiredSpend = requiredTaskEvaluationMaxSpendUsd(selected);
  useEffect(() => {
    setMaxSpend((current) => prefillTaskEvaluationMaxSpend(selected, current));
  }, [selected]);
  const canSubmit = Boolean(
    selected && confirmed && launchId && runId && rightsScope && rightsUri
    && /^sha256:[0-9a-f]{64}$/.test(rightsDigest) && Number(maxSpend) > 0 && expiresAt
    && (requiredSpend === null || Number(maxSpend) >= requiredSpend),
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
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.code || payload.error || "Published Pipeline launch profiles are unavailable");
    }
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

  async function refreshPreparationStatus(id = preparationId) {
    if ((!currentUser && !launchLabToken) || !id) return false;
    const response = await fetchWithTimeout(
      `/api/admin/task-evaluation-launches/preparations/${encodeURIComponent(id)}`,
      { headers: await authHeaders(), credentials: "include" },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(
      payload.code || payload.error || "Task Evaluation preparation status is unavailable",
    );
    setPreparationStatus(payload);
    setPreparationError(null);
    return true;
  }

  async function refreshDiscoveryStatus(id = discoveryId) {
    if ((!currentUser && !launchLabToken) || !id) return false;
    const response = await fetchWithTimeout(
      `/api/admin/task-evaluation-launches/discoveries/${encodeURIComponent(id)}`,
      { headers: await authHeaders(), credentials: "include" },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(
      payload.code || payload.error || "Scene object discovery status is unavailable",
    );
    setDiscoveryStatus(payload);
    setDiscoveryError(null);
    return true;
  }

  async function refreshActivationStatus(id = activationId) {
    if ((!currentUser && !launchLabToken) || !id) return false;
    const response = await fetchWithTimeout(
      `/api/admin/task-evaluation-launches/activations/${encodeURIComponent(id)}`,
      { headers: await authHeaders(), credentials: "include" },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(
      payload.code || payload.error || "Task Evaluation activation status is unavailable",
    );
    setActivationStatus(payload);
    setActivationError(null);
    return true;
  }

  useEffect(() => {
    void loadProfiles().catch((reason) => setError(String(reason)));
  }, [currentUser, launchLabToken]);

  useEffect(() => {
    if (
      !launchId
      || (!status && !recoveringSubmission)
      || TERMINAL_LAUNCH_STATES.includes(status?.state)
    ) {
      return undefined;
    }
    const timer = window.setInterval(() => void refreshStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [launchId, status?.state, currentUser, launchLabToken, recoveringSubmission]);

  useEffect(() => {
    const state = preparationStatus?.state || preparationStatus?.status;
    if (!preparationId || !preparationStatus || TERMINAL_PREPARATION_STATES.includes(state)) {
      return undefined;
    }
    const timer = window.setInterval(
      () => void refreshPreparationStatus().catch((reason) => setPreparationError(String(reason))),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [preparationId, preparationStatus?.state, preparationStatus?.status, currentUser, launchLabToken]);

  useEffect(() => {
    const state = discoveryStatus?.state || discoveryStatus?.status;
    if (!discoveryId || !discoveryStatus || TERMINAL_DISCOVERY_STATES.includes(state)) {
      return undefined;
    }
    const timer = window.setInterval(
      () => void refreshDiscoveryStatus().catch((reason) => setDiscoveryError(String(reason))),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [discoveryId, discoveryStatus?.state, discoveryStatus?.status, currentUser, launchLabToken]);

  useEffect(() => {
    const state = activationStatus?.state || activationStatus?.status;
    if (!activationId || !activationStatus || TERMINAL_ACTIVATION_STATES.includes(state)) {
      return undefined;
    }
    const timer = window.setInterval(
      () => void refreshActivationStatus().catch((reason) => setActivationError(String(reason))),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [activationId, activationStatus?.state, activationStatus?.status, currentUser, launchLabToken]);

  async function submitPreparation() {
    setPreparing(true);
    setPreparationError(null);
    try {
      let request: Record<string, unknown>;
      try {
        request = JSON.parse(preparationJson) as Record<string, unknown>;
      } catch {
        throw new Error("Preparation JSON is invalid.");
      }
      const id = typeof request.preparation_id === "string" ? request.preparation_id : "";
      if (!id) throw new Error("Preparation JSON must include preparation_id.");
      setPreparationId(id);
      const response = await fetchWithTimeout(
        "/api/admin/task-evaluation-launches/preparations",
        {
          method: "POST",
          headers: await authHeaders(true),
          credentials: "include",
          body: JSON.stringify(request),
        },
      );
      const payload = await response.json().catch(() => ({}));
      setPreparationStatus(payload);
      if (!response.ok) throw new Error(payload.code || payload.error || "Preparation was blocked");
      await refreshPreparationStatus(id);
    } catch (reason) {
      setPreparationError(reason instanceof Error ? reason.message : "Preparation was blocked");
    } finally {
      setPreparing(false);
    }
  }

  async function submitDiscovery() {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      let request: Record<string, any>;
      try {
        request = JSON.parse(discoveryJson) as Record<string, any>;
      } catch {
        throw new Error("Discovery JSON is invalid.");
      }
      const id = typeof request.discovery_id === "string" ? request.discovery_id : "";
      if (!id) throw new Error("Discovery JSON must include discovery_id.");
      setDiscoveryId(id);
      const response = await fetchWithTimeout(
        "/api/admin/task-evaluation-launches/discoveries",
        {
          method: "POST",
          headers: await authHeaders(true),
          credentials: "include",
          body: JSON.stringify(request),
        },
      );
      const payload = await response.json().catch(() => ({}));
      setDiscoveryStatus(payload);
      if (!response.ok) throw new Error(payload.code || payload.error || "Discovery was blocked");
      await refreshDiscoveryStatus(id);
    } catch (reason) {
      setDiscoveryError(reason instanceof Error ? reason.message : "Discovery was blocked");
    } finally {
      setDiscovering(false);
    }
  }

  async function selectDiscoveryCandidate(candidateId: string) {
    const pipeline = discoveryStatus?.pipeline;
    if (!discoveryId || !pipeline?.request_digest || !pipeline?.discovery_digest) return;
    setSelectingCandidateId(candidateId);
    setDiscoveryError(null);
    try {
      const expectedProductionCommit = String(
        pipeline.expected_production_commit || discoveryStatus?.expected_production_commit || "",
      );
      const response = await fetchWithTimeout(
        `/api/admin/task-evaluation-launches/discoveries/${encodeURIComponent(discoveryId)}/selection`,
        {
          method: "POST",
          headers: await authHeaders(true),
          credentials: "include",
          body: JSON.stringify({
            schema_version: "scene_object_discovery_selection_request.v1",
            discovery_id: discoveryId,
            expected_production_commit: expectedProductionCommit,
            request_digest: pipeline.request_digest,
            discovery_digest: pipeline.discovery_digest,
            candidate_id: candidateId,
            confirm_selection: true,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.code || payload.error || "Candidate selection was blocked");
      setDiscoveryStatus((current) => ({ ...(current || {}), state: "selection_sealed", selection: payload }));
      await refreshDiscoveryStatus(discoveryId);
    } catch (reason) {
      setDiscoveryError(reason instanceof Error ? reason.message : "Candidate selection was blocked");
    } finally {
      setSelectingCandidateId(null);
    }
  }

  async function submitActivation() {
    setActivating(true);
    setActivationError(null);
    try {
      let request: Record<string, unknown>;
      try {
        request = JSON.parse(activationJson) as Record<string, unknown>;
      } catch {
        throw new Error("Activation JSON is invalid.");
      }
      const id = typeof request.activation_id === "string" ? request.activation_id : "";
      if (!id) throw new Error("Activation JSON must include activation_id.");
      setActivationId(id);
      const response = await fetchWithTimeout(
        "/api/admin/task-evaluation-launches/activations",
        {
          method: "POST",
          headers: await authHeaders(true),
          credentials: "include",
          body: JSON.stringify(request),
        },
      );
      const payload = await response.json().catch(() => ({}));
      setActivationStatus(payload);
      if (!response.ok) throw new Error(payload.code || payload.error || "Activation was blocked");
      await refreshActivationStatus(id);
    } catch (reason) {
      setActivationError(reason instanceof Error ? reason.message : "Activation was blocked");
    } finally {
      setActivating(false);
    }
  }

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

  async function submitTerminalResourceRelease() {
    const id = String(status?.launch_id || launchId || "");
    if (!id) return;
    setReleasing(true);
    setError(null);
    try {
      const response = await fetchWithTimeout(
        `/api/admin/task-evaluation-launches/${encodeURIComponent(id)}/terminal-resource-releases`,
        {
          method: "POST",
          headers: await authHeaders(true),
          credentials: "include",
          body: JSON.stringify({
            provider: "vast",
            instance_id: releaseInstanceId,
            expected_label: releaseExpectedLabel,
            confirm_terminal_resource_release: releaseConfirmed,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || payload.forward?.blocker || "Terminal resource release was blocked");
        return;
      }
      setStatus((current) => ({
        ...(current || {}),
        terminal_resource_release: payload,
      }));
      await refreshStatus(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terminal resource release was blocked");
    } finally {
      setReleasing(false);
    }
  }

  const terminal = status && TERMINAL_LAUNCH_STATES.includes(status.state);
  const canReleaseTerminalResource = Boolean(
    status?.state === "control_plane_terminal_blocked"
    && /^[1-9][0-9]{0,18}$/.test(releaseInstanceId)
    && /^blueprint-adp009d-[1-9][0-9]{9,}$/.test(releaseExpectedLabel)
    && releaseConfirmed,
  );
  // Only shown while the run is still in flight. A phase label left standing
  // beside a terminal receipt would read as a result, which it never is.
  const progress: LaunchProgress | null = terminal ? null : status?.progress || null;
  const elapsed = formatElapsedSeconds(progress?.elapsed_seconds);

  return (
    <main className="min-h-screen bg-runway-deep px-4 py-8 text-runway-text">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-runway-line pb-7">
          <p className="runway-eyebrow-muted">
            Production control room
          </p>
          <h1 className="mt-3 font-display uppercase text-4xl font-semibold tracking-[0.005em] text-runway-text md:text-6xl">
            Task Evaluation launch
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-runway-mute">
            A scene's first run configures its observed appearance, derived collision geometry, source-object
            replacement, cameras, and task into one immutable revision. Every later robot or policy run reuses
            that revision. The website queues both run types; the canonical allocator, watchdog, reconciler,
            artifact retention, teardown, and provider-zero contracts own execution.
          </p>
          {launchLabToken ? (
            <p className="mt-3 text-sm font-medium text-runway-green">
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
            <div key={number} className="runway-panel p-5">
              <span className="runway-num text-xs font-semibold text-runway-faint">{number}</span>
              <h2 className="mt-3 font-display uppercase text-base font-semibold tracking-[0.005em] text-runway-text">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-runway-mute">{detail}</p>
            </div>
          ))}
        </section>

        <section className="runway-panel grid gap-6 p-6 md:grid-cols-[1.05fr_0.95fr] md:p-8">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-runway-signal" />
              <h2 className="font-display uppercase text-xl font-semibold tracking-[0.005em] text-runway-text">Discover objects in a new splat</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-runway-mute">
              Start with a full-scene survey before any target close-up. Pipeline binds the exact splat,
              registration, camera plan, renderer, and rendered pixels, then combines Splat Analyzer,
              SAM 3.1, publisher labels, or a rendered-scene agent behind one deterministic gate. Visual
              proposals stay candidates until publisher metric labels or independently validated production
              semantic geometry support them.
            </p>
            <label className="runway-label mt-5" htmlFor="scene-object-discovery-json">
              Discovery contract JSON
            </label>
            <textarea
              id="scene-object-discovery-json"
              className="runway-input min-h-72 font-mono text-xs leading-5"
              value={discoveryJson}
              onChange={(event) => setDiscoveryJson(event.target.value)}
              placeholder="Paste scene_object_discovery_request.v1 JSON"
              spellCheck={false}
            />
            <label className="runway-label mt-3" htmlFor="scene-object-discovery-file">
              Or upload a versioned discovery contract
            </label>
            <input
              id="scene-object-discovery-file"
              type="file"
              accept="application/json,.json"
              className="mt-2 block w-full text-sm text-runway-mute file:mr-3 file:cursor-pointer file:rounded-none file:border file:border-runway-line-strong file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-[10px] file:font-semibold file:uppercase file:tracking-[0.14em] file:text-runway-text"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                void normalizedContractFileJson(file)
                  .then((value) => {
                    setDiscoveryJson(value);
                    setDiscoveryError(null);
                  })
                  .catch((reason) => setDiscoveryError(
                    reason instanceof SyntaxError
                      ? "Discovery contract file is not valid JSON."
                      : String(reason instanceof Error ? reason.message : reason),
                  ));
              }}
            />
            {discoveryPreview ? (
              <div className="mt-4 border border-runway-line bg-runway-black p-4 text-sm leading-6 text-runway-body">
                <p className="font-semibold text-runway-text">Whole-scene discovery · metric selection required</p>
                <p>
                  {discoveryPreview.teamNamespace || "Missing team namespace"} · {discoveryPreview.sceneId || "Missing scene"}
                  {discoveryPreview.sceneVersion ? ` @ ${discoveryPreview.sceneVersion}` : ""}
                </p>
                <p>{discoveryPreview.taskStatement || "Missing task statement"}</p>
                <p>
                  Analyzers: {discoveryPreview.analyzers.length
                    ? discoveryPreview.analyzers.join(" · ")
                    : "missing"}
                </p>
                <p>Execution preparation: {discoveryPreview.executionMode || "missing"}</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="runway-cta-ghost disabled:cursor-not-allowed disabled:opacity-40"
                disabled={discovering || !discoveryJson.trim()}
                onClick={() => void submitDiscovery()}
              >
                {discovering ? "Preparing discovery…" : "Validate and discover"}
              </button>
              {discoveryId ? (
                <button
                  type="button"
                  className="runway-cta-ghost"
                  onClick={() => void refreshDiscoveryStatus().catch((reason) => setDiscoveryError(String(reason)))}
                >
                  <RefreshCw className="mr-2 inline h-4 w-4" /> Refresh
                </button>
              ) : null}
            </div>
            {discoveryError ? (
              <p className="mt-4 border-l-2 border-runway-red pl-3 text-sm text-runway-red">{discoveryError}</p>
            ) : null}
          </div>
          <aside className="border border-runway-line bg-runway-black p-5">
            <p className="runway-eyebrow-muted">
              Discovery state
            </p>
            <p className="runway-num mt-3 text-lg font-semibold text-runway-text">
              {discoveryStatus?.state || discoveryStatus?.status || "Not submitted"}
            </p>
            {discoveryId ? <p className="runway-num mt-2 break-all text-xs text-runway-faint">{discoveryId}</p> : null}
            {discoveryStatus?.pipeline?.discovery_digest ? (
              <p className="runway-num mt-3 break-all text-xs leading-5 text-runway-mute">
                Discovery digest: {discoveryStatus.pipeline.discovery_digest}
              </p>
            ) : null}
            {(discoveryStatus?.pipeline?.unseen_regions || []).length ? (
              <div className="mt-4 border border-runway-signal-dim bg-runway-panel p-3 text-sm text-runway-body">
                <p className="font-semibold text-runway-signal">Unseen or uncaptured regions</p>
                {(discoveryStatus?.pipeline?.unseen_regions || []).map((region: string) => (
                  <p key={region} className="mt-1">{region}</p>
                ))}
                <p className="mt-2 text-xs leading-5">
                  Moving a virtual camera cannot recover observations absent from the source splat.
                </p>
              </div>
            ) : null}
            {(discoveryStatus?.pipeline?.candidates || []).length ? (
              <div className="mt-5 space-y-3">
                <p className="runway-eyebrow-muted">
                  Candidate objects
                </p>
                {(discoveryStatus?.pipeline?.candidates || []).map((candidate: Record<string, any>) => (
                  <article key={candidate.candidate_id} className="runway-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-runway-text">{candidate.label}</p>
                        <p className="runway-num mt-1 text-xs text-runway-faint">
                          {candidate.backend} · confidence {Number(candidate.confidence).toFixed(2)} · task {Number(candidate.task_match_score).toFixed(2)}
                        </p>
                      </div>
                      <span className={`runway-chip ${candidate.eligible_for_automatic_source_object ? "runway-chip-live" : "runway-chip-open"}`}>
                        {candidate.eligible_for_automatic_source_object ? "metric candidate" : "visual only"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-runway-mute">
                      {candidate.candidate_claim_boundary}
                    </p>
                    {discoveryStatus?.state === "selection_required" && candidate.eligible_for_automatic_source_object ? (
                      <button
                        type="button"
                        className="runway-cta-ghost mt-3 min-h-0 px-3 py-2 text-xs disabled:opacity-40"
                        disabled={selectingCandidateId !== null}
                        onClick={() => void selectDiscoveryCandidate(candidate.candidate_id)}
                      >
                        {selectingCandidateId === candidate.candidate_id ? "Sealing…" : "Select this metric candidate"}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
            {discoveryStatus?.pipeline?.source_object ? (
              <div className="mt-4 border border-runway-green-dim bg-runway-panel p-3 text-sm text-runway-body">
                <p className="font-semibold text-runway-green">Source object sealed</p>
                <p className="mt-1">{discoveryStatus.pipeline.source_object.label}</p>
                <p className="runway-num mt-1 break-all text-xs">
                  {discoveryStatus.pipeline.source_object.source_object_artifact?.digest}
                </p>
              </div>
            ) : null}
            {(discoveryStatus?.pipeline?.blockers || []).map((blocker: string) => (
              <p key={blocker} className="mt-3 flex gap-2 text-sm text-runway-signal">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {blocker}
              </p>
            ))}
            <p className="mt-5 text-xs leading-5 text-runway-faint">
              Splat Analyzer boxes and RGB masks never self-authorize metric placement, physics,
              robot execution, or physical truth. Provider execution remains separately authority-gated.
            </p>
          </aside>
        </section>

        <section className="runway-panel grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-runway-signal" />
              <h2 className="font-display uppercase text-xl font-semibold tracking-[0.005em] text-runway-text">Prepare versioned inputs</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-runway-mute">
              Upload one strict Task Evaluation contract. Choose <code>scene_configuration</code> once to run
              the production construction recipe and produce a reusable immutable scene revision. Choose
              <code>episode_evaluation</code> later to bind a robot or policy to that exact revision without
              rebuilding the scene. Pipeline validates every reference and spend envelope before it can reach
              execution. Preparation itself cannot publish a launch profile, allocate a GPU, spend money, or start an
              episode.
            </p>
            <label className="runway-label mt-5" htmlFor="task-evaluation-preparation-json">
              Preparation contract JSON
            </label>
            <textarea
              id="task-evaluation-preparation-json"
              className="runway-input min-h-72 font-mono text-xs leading-5"
              value={preparationJson}
              onChange={(event) => setPreparationJson(event.target.value)}
              placeholder="Paste task_evaluation_launch_preparation_request.v1 JSON"
              spellCheck={false}
            />
            <label className="runway-label mt-3" htmlFor="task-evaluation-preparation-file">
              Or upload a versioned preparation contract
            </label>
            <input
              id="task-evaluation-preparation-file"
              type="file"
              accept="application/json,.json"
              className="mt-2 block w-full text-sm text-runway-mute file:mr-3 file:cursor-pointer file:rounded-none file:border file:border-runway-line-strong file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-[10px] file:font-semibold file:uppercase file:tracking-[0.14em] file:text-runway-text"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                void normalizedContractFileJson(file)
                  .then((value) => {
                    setPreparationJson(value);
                    setPreparationError(null);
                  })
                  .catch((reason) => setPreparationError(
                    reason instanceof SyntaxError
                      ? "Preparation contract file is not valid JSON."
                      : String(reason instanceof Error ? reason.message : reason),
                  ));
              }}
            />
            {preparationPreview ? (
              <div className="mt-4 border border-runway-line bg-runway-black p-4 text-sm leading-6 text-runway-body">
                <p className="font-semibold text-runway-text">
                  {preparationPreview.runMode === "scene_configuration"
                    ? "First run · configure and seal a reusable scene revision"
                    : "Evaluation run · reuse a configured scene revision"}
                </p>
                <p>
                  {preparationPreview.teamNamespace || "Missing team namespace"} · {preparationPreview.sceneId || "Missing scene"}
                  {preparationPreview.sceneVersion ? ` @ ${preparationPreview.sceneVersion}` : ""}
                </p>
                <p>Total run authority: ${preparationPreview.hardCapUsd.toFixed(2)}</p>
                {preparationPreview.runMode === "scene_configuration" ? (
                  <p>
                    Provider compute: {preparationPreview.providerComputeCapUsd === null
                      ? "missing"
                      : `$${preparationPreview.providerComputeCapUsd.toFixed(2)}`}
                    {" · "}Construction services: {preparationPreview.externalServiceCapUsd === null
                      ? "missing"
                      : `$${preparationPreview.externalServiceCapUsd.toFixed(2)}`}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="runway-cta-ghost disabled:cursor-not-allowed disabled:opacity-40"
                disabled={preparing || !preparationJson.trim()}
                onClick={() => void submitPreparation()}
              >
                {preparing ? "Preparing…" : "Validate and prepare"}
              </button>
              {preparationId ? (
                <button
                  type="button"
                  className="runway-cta-ghost"
                  onClick={() => void refreshPreparationStatus().catch((reason) => setPreparationError(String(reason)))}
                >
                  <RefreshCw className="mr-2 inline h-4 w-4" /> Refresh
                </button>
              ) : null}
            </div>
            {preparationError ? (
              <p className="mt-4 border-l-2 border-runway-red pl-3 text-sm text-runway-red">{preparationError}</p>
            ) : null}
          </div>
          <aside className="border border-runway-line bg-runway-black p-5">
            <p className="runway-eyebrow-muted">
              Preparation state
            </p>
            <p className="runway-num mt-3 text-lg font-semibold text-runway-text">
              {preparationStatus?.state || preparationStatus?.status || "Not submitted"}
            </p>
            {preparationId ? <p className="runway-num mt-2 break-all text-xs text-runway-faint">{preparationId}</p> : null}
            {preparationStatus?.pipeline?.worker_status ? (
              <p className="mt-4 text-sm leading-6 text-runway-body">
                Pipeline: {preparationStatus.pipeline.worker_status}
              </p>
            ) : null}
            {preparationStatus?.pipeline?.full_byte_service_account_readback_passed === true ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-runway-green">
                <CheckCircle2 className="h-4 w-4" /> Full-byte service-account readback passed
              </p>
            ) : null}
            {preparationStatus?.pipeline?.request_digest ? (
              <p className="runway-num mt-4 break-all text-xs leading-5 text-runway-mute">
                Request digest: {preparationStatus.pipeline.request_digest}
              </p>
            ) : null}
            {preparationStatus?.pipeline?.result_digest ? (
              <p className="runway-num mt-2 break-all text-xs leading-5 text-runway-mute">
                Result digest: {preparationStatus.pipeline.result_digest}
              </p>
            ) : null}
            {preparationStatus?.pipeline?.source_commit ? (
              <p className="runway-num mt-2 break-all text-xs leading-5 text-runway-mute">
                Source commit: {preparationStatus.pipeline.source_commit}
              </p>
            ) : null}
            {preparationStatus?.pipeline?.configured_scene_revision_digest ? (
              <div className="mt-4 border border-runway-green-dim bg-runway-panel p-3 text-sm text-runway-body">
                <p className="font-semibold text-runway-green">Reusable configured scene revision sealed</p>
                <p className="runway-num mt-1 break-all text-xs leading-5">
                  {preparationStatus.pipeline.configured_scene_revision_digest}
                </p>
                {preparationStatus.pipeline.configured_scene_bundle_digest ? (
                  <p className="runway-num mt-1 break-all text-xs leading-5">
                    Bundle {preparationStatus.pipeline.configured_scene_bundle_digest}
                  </p>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-runway-mute">
                  Use this revision for subsequent zero-action, scripted-positive, robot, and policy runs.
                </p>
              </div>
            ) : null}
            {(preparationStatus?.pipeline?.blockers || []).map((blocker: string) => (
              <p key={blocker} className="mt-3 flex gap-2 text-sm text-runway-signal">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {blocker}
              </p>
            ))}
            <p className="mt-5 text-xs leading-5 text-runway-faint">
              A materialized preparation is verified input readiness, not execution or scientific success.
              Launch authority remains a separate step below.
            </p>
          </aside>
        </section>

        <section className="runway-panel grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-runway-signal" />
              <h2 className="font-display uppercase text-xl font-semibold tracking-[0.005em] text-runway-text">Activate verified inputs</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-runway-mute">
              After preparation is materialized, submit its digest-bound activation contract. The
              authority-gated Pipeline worker verifies the released mutation window, predecessor or
              project lineage, and exact production commit before publishing the immutable profile,
              catalog entry, and standing authorization. Activation never submits a paid request or
              allocates a provider resource; execution remains the separate authority envelope below.
            </p>
            <label className="runway-label mt-5" htmlFor="task-evaluation-activation-json">
              Activation contract JSON
            </label>
            <textarea
              id="task-evaluation-activation-json"
              className="runway-input min-h-64 font-mono text-xs leading-5"
              value={activationJson}
              onChange={(event) => setActivationJson(event.target.value)}
              placeholder="Paste task_evaluation_launch_activation_request.v1 JSON"
              spellCheck={false}
            />
            <label className="runway-label mt-3" htmlFor="task-evaluation-activation-file">
              Or upload a coordinator-authorized activation contract
            </label>
            <input
              id="task-evaluation-activation-file"
              type="file"
              accept="application/json,.json"
              className="mt-2 block w-full text-sm text-runway-mute file:mr-3 file:cursor-pointer file:rounded-none file:border file:border-runway-line-strong file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-[10px] file:font-semibold file:uppercase file:tracking-[0.14em] file:text-runway-text"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                void normalizedContractFileJson(file)
                  .then((value) => {
                    setActivationJson(value);
                    setActivationError(null);
                  })
                  .catch((reason) => setActivationError(
                    reason instanceof SyntaxError
                      ? "Activation contract file is not valid JSON."
                      : String(reason instanceof Error ? reason.message : reason),
                  ));
              }}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="runway-cta-ghost disabled:cursor-not-allowed disabled:opacity-40"
                disabled={activating || !activationJson.trim()}
                onClick={() => void submitActivation()}
              >
                {activating ? "Activating…" : "Validate and activate"}
              </button>
              {activationId ? (
                <button
                  type="button"
                  className="runway-cta-ghost"
                  onClick={() => void refreshActivationStatus().catch((reason) => setActivationError(String(reason)))}
                >
                  <RefreshCw className="mr-2 inline h-4 w-4" /> Refresh
                </button>
              ) : null}
            </div>
            {activationError ? (
              <p className="mt-4 border-l-2 border-runway-red pl-3 text-sm text-runway-red">{activationError}</p>
            ) : null}
          </div>
          <aside className="border border-runway-line bg-runway-black p-5">
            <p className="runway-eyebrow-muted">
              Activation state
            </p>
            <p className="runway-num mt-3 text-lg font-semibold text-runway-text">
              {activationStatus?.state || activationStatus?.status || "Not submitted"}
            </p>
            {activationId ? <p className="runway-num mt-2 break-all text-xs text-runway-faint">{activationId}</p> : null}
            {activationStatus?.pipeline?.worker_status ? (
              <p className="mt-4 text-sm leading-6 text-runway-body">
                Pipeline: {activationStatus.pipeline.worker_status}
              </p>
            ) : null}
            {activationStatus?.pipeline?.profile_id ? (
              <p className="runway-num mt-4 break-all text-sm text-runway-body">
                Published profile: {activationStatus.pipeline.profile_id}
              </p>
            ) : null}
            {(activationStatus?.pipeline?.blockers || []).map((blocker: string) => (
              <p key={blocker} className="mt-3 flex gap-2 text-sm text-runway-signal">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {blocker}
              </p>
            ))}
            <p className="mt-5 text-xs leading-5 text-runway-faint">
              A prepared activation proves profile and authority publication only. It is not a GPU
              allocation, simulator episode, or scientific result.
            </p>
          </aside>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="runway-panel space-y-5 p-6 md:p-8">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-runway-signal" />
              <h2 className="font-display uppercase text-xl font-semibold tracking-[0.005em] text-runway-text">Authority envelope</h2>
            </div>
            <label className="block"><span className="runway-label">Pipeline-owned profile</span>
              <select className="runway-input" value={profileKey}
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
              <div className="runway-num border border-runway-line bg-runway-black p-4 text-xs leading-6 text-runway-mute">
                <p>Bundle {selected.source_bundle.bundle_id} · {selected.source_bundle.digest}</p>
                <p>Profile {selected.profile_digest}</p>
                {selected.source_commit ? <p>Source commit {selected.source_commit}</p> : null}
                <p>
                  Execution {selected.execution_admission.live_enabled ? "live-admitted" : "dry-only"}
                </p>
                {selected.execution_admission.blockers.map((blocker) => (
                  <p key={blocker} className="text-runway-signal">Readiness blocker · {blocker}</p>
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
              <div>
                <Input label="Maximum spend (USD)" value={maxSpend} onChange={setMaxSpend} type="number" />
                {requiredSpend !== null ? (
                  <p className={`mt-1 text-xs ${Number(maxSpend) >= requiredSpend ? "text-runway-faint" : "text-runway-red"}`}>
                    This profile requires at least ${requiredSpend.toFixed(2)} of authorized spend.
                  </p>
                ) : null}
              </div>
              <Input label="Authority expires" value={expiresAt} onChange={setExpiresAt} type="datetime-local" />
            </div>
            <label className="flex items-start gap-3 border border-runway-signal-dim bg-runway-black p-4 text-sm leading-6 text-runway-body">
              <input className="mt-1 accent-runway-signal" type="checkbox" checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I authorize this exact profile, rights scope, spend ceiling, and execution window.
                There are no automatic paid retries.</span>
            </label>
            <button type="button" onClick={() => void submit()}
              disabled={!canSubmit || submitting || recoveringSubmission}
              className="runway-cta w-full disabled:cursor-not-allowed disabled:opacity-40">
              {submitting
                ? "Queuing immutable launch…"
                : recoveringSubmission
                  ? "Checking durable launch…"
                  : "Authorize and queue launch"}
            </button>
          </div>

          <aside className="space-y-4">
            <div className="border border-runway-line bg-runway-black p-6 text-runway-body">
              <div className="flex items-center justify-between">
                <h2 className="font-display uppercase text-xl font-semibold tracking-[0.005em] text-runway-text">Run state</h2>
                <button type="button" onClick={() => void refreshStatus()} className="p-2 text-runway-mute transition-colors hover:text-runway-signal" aria-label="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="runway-num mt-5 text-2xl font-semibold text-runway-text">{status?.state || status?.status || "Not queued"}</p>
              <p className="runway-num mt-2 break-all text-xs leading-5 text-runway-faint">
                {status?.request_digest || "No immutable request digest yet."}
              </p>
              {status?.terminal_receipt?.source_commit ? (
                <p className="runway-num mt-2 break-all text-xs leading-5 text-runway-faint">
                  Source commit {status.terminal_receipt.source_commit}
                </p>
              ) : null}
              {progress ? (
                <div className="mt-5 space-y-1 border-t border-runway-line pt-4">
                  <p className="runway-eyebrow-muted">
                    In flight
                  </p>
                  <p className="text-sm font-medium text-runway-text">
                    {progress.phase || "starting"}
                    {progress.phase_status ? ` · ${progress.phase_status}` : ""}
                  </p>
                  {elapsed ? (
                    <p className="runway-num text-xs leading-5 text-runway-mute">{elapsed} elapsed</p>
                  ) : null}
                  {progress.provider ? (
                    <p className="runway-num text-xs leading-5 text-runway-mute">
                      Instance {progress.provider.instance_state || "unknown"}
                      {typeof progress.provider.estimated_cost_usd === "number"
                        ? ` · ~$${progress.provider.estimated_cost_usd.toFixed(2)} estimated so far`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {status?.state === "control_plane_terminal_blocked" ? (
                <div className="mt-5 flex items-center gap-2 text-runway-signal">
                  <AlertTriangle className="h-4 w-4" /> Control-plane blocker retained; no execution result was observed
                </div>
              ) : terminal ? (
                <div className="mt-5 flex items-center gap-2 text-runway-green">
                  <CheckCircle2 className="h-4 w-4" /> Terminal receipt retained
                </div>
              ) : null}
            </div>
            {error ? (
              <div className="flex gap-3 border border-runway-red-dim bg-runway-panel p-5 text-sm text-runway-red">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            {status?.state === "control_plane_terminal_blocked" ? (
              <div className="border border-runway-signal-dim bg-runway-panel p-5 text-sm leading-6 text-runway-body">
                <p className="font-semibold text-runway-signal">Release one retained stopped provider record</p>
                <p className="mt-2">
                  This is an operational recovery only. It cannot start, retry, or score an evaluation.
                  Pipeline will inspect the exact ID and label before its canonical allocator may delete it,
                  then retain an independent provider-zero receipt.
                </p>
                <div className="mt-4 grid gap-3">
                  <Input label="Stopped Vast instance ID" value={releaseInstanceId}
                    onChange={setReleaseInstanceId} placeholder="Exact numeric provider ID" />
                  <Input label="Expected immutable instance label" value={releaseExpectedLabel}
                    onChange={setReleaseExpectedLabel} placeholder="blueprint-adp009d-..." />
                  <label className="flex items-start gap-3 text-sm">
                    <input className="mt-1 accent-runway-signal" type="checkbox" checked={releaseConfirmed}
                      onChange={(event) => setReleaseConfirmed(event.target.checked)} />
                    <span>I authorize release of only this stopped record. No evaluation will be launched or retried.</span>
                  </label>
                  <button type="button" onClick={() => void submitTerminalResourceRelease()}
                    disabled={!canReleaseTerminalResource || releasing}
                    className="runway-cta-ghost disabled:cursor-not-allowed disabled:opacity-40">
                    {releasing ? "Queuing release-only recovery…" : "Authorize and queue resource release"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="border border-runway-line p-5 text-sm leading-6 text-runway-mute">
              A completed simulation receipt is development evidence. It does not establish physical
              success, deployment readiness, or safety approval.
            </div>
            <div className="runway-panel p-5 text-sm leading-6">
              <p className="runway-eyebrow-muted">
                Optional supervisor
              </p>
              <p className="mt-3 font-medium text-runway-text">
                {supervision?.recommendation?.summary || "No Agents SDK recommendation observed."}
              </p>
              {supervision?.recommendation?.recommended_profile_id ? (
                <p className="mt-2 text-runway-mute">
                  Recommended admitted profile: {supervision.recommendation.recommended_profile_id}
                </p>
              ) : null}
              {supervision?.recommendation?.human_decision_required ? (
                <p className="mt-3 border-l-2 border-runway-signal pl-3 text-runway-signal">
                  {supervision.recommendation.human_decision_prompt}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-runway-faint">
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
    <label className="block"><span className="runway-label">{props.label}</span>
      <input className="runway-input" type={props.type || "text"}
        value={props.value} placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}
