import { useEffect, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Field } from "@/components/workspace/WorkspaceUI";
import type { PacketPlanningSetup } from "@/lib/policyPacketPlanning";
import {
  fetchTeamPolicyDeliveries,
  registerTeamPolicyDelivery,
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
      setProfiles(await fetchTeamPolicyDeliveries(currentUser).catch(() => profiles));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Policy delivery could not be registered.");
    } finally {
      setSaving(false);
    }
  }

  const matching = profiles.filter((row) => row.embodiment_id === robot.embodiment_id
    && row.observation_schema_id === robot.observation_schema.schema_id
    && row.action_schema_id === robot.action_schema.schema_id);

  return <section aria-labelledby="team-policy-delivery" className="mt-8">
    <h2 id="team-policy-delivery">Your policy runtime</h2>
    <p className="ws-note mt-2">Register an endpoint, pinned container, or noncontainer artifact for this robot's observation and action interface. This records a team-owned configuration for runtime review. The four policies in the current G1 campaign remain the sealed choices above.</p>
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
  </section>;
}
