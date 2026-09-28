import { useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Field } from "@/components/workspace/WorkspaceUI";
import type { PacketPlanningSetup } from "@/lib/policyPacketPlanning";
import {
  fetchTeamPolicyDeliveries,
  registerTeamPolicyDelivery,
  submitG1TeamPolicyRun,
  type TeamPolicyDelivery,
  type TeamPolicyDeliveryProfile,
} from "@/lib/teamPolicyDeliveries";

type Mode = TeamPolicyDelivery["mode"];
const protocol = "jsonl_observation_action_v1" as const;

export function TeamPolicyDeliveryConfig({ currentUser, setup, robotPresetId }: {
  currentUser: FirebaseUser;
  setup: PacketPlanningSetup;
  robotPresetId: string;
}) {
  const robot = setup.robot_presets.find((item) => item.robot_preset_id === robotPresetId);
  const [mode, setMode] = useState<Mode>("authenticated_endpoint");
  const [label, setLabel] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [secretRef, setSecretRef] = useState("");
  const [imageRef, setImageRef] = useState("");
  const [artifactUri, setArtifactUri] = useState("");
  const [artifactSha, setArtifactSha] = useState("");
  const [entrypoint, setEntrypoint] = useState("");
  const [profiles, setProfiles] = useState<TeamPolicyDeliveryProfile[]>([]);
  const [registeredDigest, setRegisteredDigest] = useState<string | null>(null);
  const [selectedDigest, setSelectedDigest] = useState("");
  const [objectiveId, setObjectiveId] = useState<"task_success" | "g1_navigation_goal">("task_success");
  const [maximumCostInput, setMaximumCostInput] = useState("12.00");
  const [runAuthorized, setRunAuthorized] = useState(false);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runIntentId, setRunIntentId] = useState<string | null>(null);
  const runAuthority = useRef<{ runId: string; expiresAt: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTeamPolicyDeliveries(currentUser).then((rows) => {
      if (!cancelled) setProfiles(rows);
    }).catch(() => {
      if (!cancelled) setProfiles([]);
    });
    return () => { cancelled = true; };
  }, [currentUser]);

  if (!robot) return null;

  async function save() {
    if (!robot || !label.trim() || saving) return;
    const delivery: TeamPolicyDelivery = mode === "authenticated_endpoint"
      ? { mode, endpoint_url: endpointUrl.trim(), auth_secret_ref: secretRef.trim(), timeout_ms: 5000 }
      : mode === "container"
        ? { mode, image_ref: imageRef.trim(), protocol }
        : { mode, artifact_uri: artifactUri.trim(), artifact_sha256: artifactSha.trim(),
          entrypoint: entrypoint.trim(), protocol };
    setError(null);
    setSaving(true);
    try {
      const digest = await registerTeamPolicyDelivery({ currentUser, setupDigest: setup.setup_digest,
        robotPresetId, label: label.trim(), delivery });
      setRegisteredDigest(digest);
      setSelectedDigest(digest);
      setProfiles(await fetchTeamPolicyDeliveries(currentUser).catch(() => profiles));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Policy delivery could not be registered.");
    } finally {
      setSaving(false);
    }
  }

  const matching = profiles.filter((row) => row.source_setup_digest === setup.setup_digest
    && row.robot_preset_id === robotPresetId
    && row.embodiment_id === robot.embodiment_id
    && row.observation_schema_id === robot.observation_schema.schema_id
    && row.action_schema_id === robot.action_schema.schema_id);
  const selected = matching.find((row) => row.profile_digest === selectedDigest);
  const maximumCostUsd = Number(maximumCostInput);
  const maximumCostValid = maximumCostInput.trim() !== ""
    && Number.isFinite(maximumCostUsd) && maximumCostUsd >= 1 && maximumCostUsd <= 12
    && Number.isInteger(maximumCostUsd * 100);

  async function submitRun() {
    if (!selected || !runAuthorized || !maximumCostValid || runSubmitting || runIntentId) return;
    setError(null);
    setRunSubmitting(true);
    try {
      if (!runAuthority.current || runAuthority.current.expiresAt <= Date.now() / 1000) {
        const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        runAuthority.current = {
          runId: `team-g1-${suffix}`,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        };
      }
      const intentId = await submitG1TeamPolicyRun({
        currentUser, runId: runAuthority.current.runId, setupDigest: setup.setup_digest,
        profileDigest: selected.profile_digest, objectiveId,
        maximumCostUsd, authorizationExpiresAtEpoch: runAuthority.current.expiresAt,
      });
      setRunIntentId(intentId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The team policy run could not be submitted.");
    } finally {
      setRunSubmitting(false);
    }
  }

  return <section aria-labelledby="team-policy-delivery" className="mt-8">
    <h2 id="team-policy-delivery">Your policy runtime</h2>
    <p className="ws-note mt-2">Register an endpoint, pinned container, or noncontainer artifact for this robot's observation and action interface. You can then choose it for this same task packet. The four built-in policies above use their separate sealed campaign.</p>
    <div className="ws-fields mt-5">
      <Field label="Policy version" wide><input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="Your policy name and version" /></Field>
      <Field label="Delivery" wide><select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
        <option value="authenticated_endpoint">Authenticated HTTPS endpoint</option>
        <option value="container">Pinned container image</option>
        <option value="noncontainer_artifact">Noncontainer executable artifact</option>
      </select></Field>
      {mode === "authenticated_endpoint" ? <>
        <Field label="Policy endpoint" wide><input type="url" value={endpointUrl} onChange={(event) => setEndpointUrl(event.target.value)} placeholder="https://policy.example.com/v1/action" /></Field>
        <Field label="Credential reference" wide><input value={secretRef} onChange={(event) => setSecretRef(event.target.value)} placeholder="secretref:robot-team/policy-v1" /></Field>
      </> : mode === "container" ?
        <Field label="Image pinned by digest" wide><input value={imageRef} onChange={(event) => setImageRef(event.target.value)} placeholder="registry.example.com/team/policy@sha256:…" /></Field>
        : <>
          <Field label="HTTPS artifact URL" wide><input type="url" value={artifactUri} onChange={(event) => setArtifactUri(event.target.value)} placeholder="https://files.example.com/policy.tar.gz" /></Field>
          <Field label="Artifact SHA-256" wide><input value={artifactSha} onChange={(event) => setArtifactSha(event.target.value)} placeholder="sha256:…" /></Field>
          <Field label="Entrypoint inside artifact" wide><input value={entrypoint} onChange={(event) => setEntrypoint(event.target.value)} placeholder="policy/run.py" /></Field>
        </>}
    </div>
    <p className="ws-note mt-3">Use a credential reference, never a token or password. Registration does not call the policy or authorize GPU spend.</p>
    <button type="button" className="ws-secondary mt-4" disabled={saving || !label.trim()} onClick={() => { void save(); }}>
      {saving ? "Registering…" : "Register policy runtime"}
    </button>
    {error ? <p role="alert" className="ws-note mt-3">{error}</p> : null}
    {registeredDigest ? <p role="status" className="ws-note mt-3">Saved for runtime review: <span className="break-all">{registeredDigest}</span></p> : null}
    {matching.length ? <div className="mt-5" aria-label="Registered policy runtimes">
      <h3>Registered for this robot interface</h3>
      <ul>{matching.map((row) => <li key={row.profile_digest} className="ws-note">
        {row.label} · {row.delivery.mode.replaceAll("_", " ")} · runtime review pending
      </li>)}</ul>
    </div> : null}
    {matching.length ? <div className="mt-6" aria-label="Team policy development run">
      <h3>Run your policy in this G1 scene</h3>
      <div className="ws-fields mt-4">
        <Field label="Registered policy" wide><select value={selectedDigest} onChange={(event) => {
          setSelectedDigest(event.target.value); setRunAuthorized(false); setRunIntentId(null);
          runAuthority.current = null;
        }}>
          <option value="">Choose a policy runtime</option>
          {matching.map((row) => <option key={row.profile_digest} value={row.profile_digest}>
            {row.label} · {row.delivery.mode.replaceAll("_", " ")}
          </option>)}
        </select></Field>
        <Field label="Objective" wide><select value={objectiveId} onChange={(event) => {
          setObjectiveId(event.target.value as typeof objectiveId); setRunAuthorized(false);
          setRunIntentId(null); runAuthority.current = null;
        }}>
          <option value="task_success">Place the book in the marked area</option>
          <option value="g1_navigation_goal">Move toward the marked goal</option>
        </select></Field>
        <Field label="Maximum provider cost (USD, up to $12)" wide><input type="number" min="1" max="12" step="0.01"
          value={maximumCostInput} onChange={(event) => {
            setMaximumCostInput(event.target.value); setRunAuthorized(false);
            setRunIntentId(null); runAuthority.current = null;
          }} /></Field>
      </div>
      <label className="ws-check mt-4"><input type="checkbox" checked={runAuthorized}
        disabled={!selected || !maximumCostValid} onChange={(event) => setRunAuthorized(event.target.checked)} />
        <span>I authorize one development simulation, up to ${maximumCostValid ? maximumCostUsd.toFixed(2) : "—"} and four hours with no paid retry. The selected policy receives this task's simulated camera and robot observations. Results stay private.</span>
      </label>
      <button type="button" className="ws-primary mt-4" disabled={!selected || !runAuthorized
        || !maximumCostValid || runSubmitting || Boolean(runIntentId)} onClick={() => { void submitRun(); }}>
        {runSubmitting ? "Submitting…" : "Submit team policy run"}
      </button>
      {runIntentId ? <p role="status" className="ws-note mt-3">Request {runIntentId} was accepted for operator runtime approval. No GPU has launched from this submission yet.</p> : null}
    </div> : null}
  </section>;
}
