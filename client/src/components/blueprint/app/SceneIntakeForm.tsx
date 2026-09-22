import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Field } from "@/components/workspace/WorkspaceUI";
import {
  apiRequest,
  CaptureUploadRequestError,
  type CaptureUploadSession,
} from "@/lib/captureUploads";

// Destination placement defaults. Orientation is fixed to identity (level); the
// position origin is a placeholder the owner must set to the real drop point.
const DESTINATION_DEFAULTS = {
  relation: "on" as "on" | "inside",
  visible_label: "",
  x: 0,
  y: 0,
  z: 0,
};
// Structured success-criteria defaults for a rigid-object pick-and-place. The
// factory requires control_frequency_hz * maximum_episode_seconds to be a whole
// number of steps; 15 * 24 = 360 satisfies it.
const SUCCESS_DEFAULTS = {
  control_frequency_hz: 15,
  maximum_episode_seconds: 24,
  minimum_lift_m: 0.05,
  pregrasp_clearance_m: 0.1,
  minimum_planar_displacement_m: 0.1,
  maximum_final_planar_target_error_m: 0.05,
};
// The contract requires exactly zero retries and regrasps; not owner-tunable.
const SUCCESS_FIXED = { maximum_retries: 0, maximum_regrasps: 0 } as const;

export function SceneIntakeForm({
  currentUser,
  sessions,
}: {
  currentUser: User;
  sessions: CaptureUploadSession[];
}) {
  const retryStorageKey = `scene-intake-pending:${JSON.stringify([currentUser.uid, currentUser.tenantId || null])}`;
  const [source, setSource] = useState("");
  const [collisionSource, setCollisionSource] = useState("");
  const [collisionFrameConfirmed, setCollisionFrameConfirmed] = useState(false);
  const [task, setTask] = useState({ subject: "", support: "" });
  const [destination, setDestination] = useState(DESTINATION_DEFAULTS);
  const [success, setSuccess] = useState(SUCCESS_DEFAULTS);
  const [policies, setPolicies] = useState([
    { id: "", artifact_digest: "" },
    { id: "", artifact_digest: "" },
  ]);
  const [spend, setSpend] = useState(35);
  const [attempts, setAttempts] = useState(8);
  const [retries, setRetries] = useState(0);
  const [provider, setProvider] = useState("vast");
  const [additionalProviders, setAdditionalProviders] = useState<string[]>([]);
  const [hours, setHours] = useState(24);
  const [terms, setTerms] = useState("");
  const [providerTerms, setProviderTerms] = useState<
    Record<string, { digest: string; label: string; url: string }>
  >({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [error, setError] = useState("");
  const [intakes, setIntakes] = useState<Array<Record<string, any>>>([]);
  const [nativeSources, setNativeSources] = useState<
    Array<{
      id: string;
      label: string;
      validation_status: string;
      selectable: boolean;
      kind?: string;
      task_proposal?: Record<string, any>;
      required_providers?: string[];
    }>
  >([]);
  const publicChoice = nativeSources.find((row) => row.id === source && row.kind === "public_scene");
  const refresh = async () => {
    const result = await apiRequest<{ intakes: Array<Record<string, any>> }>(
      currentUser,
      "/api/task-evaluation-scene-intakes",
    );
    if (!Array.isArray(result.intakes))
      throw new Error("Invalid intake status response");
    setIntakes(result.intakes);
  };
  useEffect(() => {
    void apiRequest<{
      provider_terms: typeof providerTerms;
      policy_pairs: Array<typeof policies>;
    }>(currentUser, "/api/task-evaluation-scene-intakes/options")
      .then((options) => {
        setProviderTerms(options.provider_terms || {});
        if (
          !sessionStorage.getItem(retryStorageKey)
        ) {
          setTerms(options.provider_terms?.vast?.digest || "");
          if (options.policy_pairs?.[0])
            setPolicies((previous) =>
              previous.every((policy) => !policy.id && !policy.artifact_digest)
                ? options.policy_pairs[0]
                : previous,
            );
        }
      })
      .catch(() =>
        setError("Provider terms and the policy list couldn't be loaded."),
      );
    try {
      const retained = sessionStorage.getItem(
        retryStorageKey,
      );
      if (retained) {
        const command = JSON.parse(retained);
        setPendingCommand(command);
        setSource(command.source_session_id);
        setCollisionSource(command.collision_source_session_id || "");
        setCollisionFrameConfirmed(command.collision_same_frame_confirmed === true);
        setTask({
          subject: command.task.subject?.description ?? "",
          support: command.task.support?.description ?? "",
        });
        const retainedDestination = command.task.destination || {};
        const retainedPosition = Array.isArray(
          retainedDestination.position_world_m,
        )
          ? retainedDestination.position_world_m
          : [0, 0, 0];
        setDestination({
          relation:
            retainedDestination.relation === "inside" ? "inside" : "on",
          visible_label: retainedDestination.visible_label ?? "",
          x: Number(retainedPosition[0]) || 0,
          y: Number(retainedPosition[1]) || 0,
          z: Number(retainedPosition[2]) || 0,
        });
        setSuccess({
          control_frequency_hz:
            command.task.success?.control_frequency_hz ??
            SUCCESS_DEFAULTS.control_frequency_hz,
          maximum_episode_seconds:
            command.task.success?.maximum_episode_seconds ??
            SUCCESS_DEFAULTS.maximum_episode_seconds,
          minimum_lift_m:
            command.task.success?.minimum_lift_m ??
            SUCCESS_DEFAULTS.minimum_lift_m,
          pregrasp_clearance_m:
            command.task.success?.pregrasp_clearance_m ??
            SUCCESS_DEFAULTS.pregrasp_clearance_m,
          minimum_planar_displacement_m:
            command.task.success?.minimum_planar_displacement_m ??
            SUCCESS_DEFAULTS.minimum_planar_displacement_m,
          maximum_final_planar_target_error_m:
            command.task.success?.maximum_final_planar_target_error_m ??
            SUCCESS_DEFAULTS.maximum_final_planar_target_error_m,
        });
        setPolicies(command.execution.policy_candidates);
        setSpend(command.execution.max_total_spend_usd);
        setAttempts(command.execution.max_paid_attempts);
        setRetries(command.execution.max_retries);
        setProvider(command.execution.allowed_providers[0]);
        setAdditionalProviders(command.execution.allowed_providers.slice(1));
        setTerms(command.consent.provider_terms_reference);
        setConfirmed(true);
      }
    } catch {
      setError(
        "Your last submission couldn't be restored. Check your requests before submitting again.",
      );
    }
    void apiRequest<{ sources: typeof nativeSources }>(
      currentUser,
      "/api/task-evaluation-scene-intakes/sources",
    )
      .then((value) => {
        if (!Array.isArray(value.sources))
          throw new Error("Invalid sources response");
        setNativeSources(value.sources);
      })
      .catch(() =>
        setError("Scenes couldn't be loaded. Reload to try again."),
      );
    void refresh().catch(() =>
      setError("Request status couldn't be loaded. Reload to try again."),
    );
    const interval = setInterval(
      () => void refresh().catch(() => undefined),
      15000,
    );
    return () => clearInterval(interval);
  }, [currentUser, retryStorageKey]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (
      !pendingCommand &&
      !Number.isInteger(
        success.control_frequency_hz * success.maximum_episode_seconds,
      )
    ) {
      setError(
        "Control frequency × maximum episode seconds must be a whole number of simulation steps.",
      );
      setBusy(false);
      return;
    }
    const command = pendingCommand || {
      submission_id: `scene-${crypto.randomUUID()}`,
      source_session_id: source,
      ...(collisionSource ? { collision_source_session_id: collisionSource, collision_same_frame_confirmed: collisionFrameConfirmed } : {}),
      task: publicChoice?.task_proposal || {
        task_id: `task-${source}`,
        strategy: "pick_and_place",
        subject: { description: task.subject, authority: "owner_confirmed" },
        support: { description: task.support, authority: "owner_confirmed" },
        destination: {
          relation: destination.relation,
          visible_label: destination.visible_label,
          position_world_m: [destination.x, destination.y, destination.z],
          orientation_xyzw: [0, 0, 0, 1],
        },
        success: { ...success, ...SUCCESS_FIXED },
      },
      execution: {
        max_total_spend_usd: spend,
        max_paid_attempts: attempts,
        max_retries: retries,
        expires_at_epoch: Math.floor(Date.now() / 1000) + hours * 3600,
        allowed_providers: [provider, ...additionalProviders],
        policy_candidates: policies,
        claim_scope: "development_only",
      },
      consent: {
        provider_terms_reference: terms,
        private_processing_authorized: true,
        provider_training_authorized: false,
        task_confirmed: true,
        spend_authorized: true,
      },
    };
    setPendingCommand(command);
    try {
      sessionStorage.setItem(
        retryStorageKey,
        JSON.stringify(command),
      );
      await apiRequest(currentUser, "/api/task-evaluation-scene-intakes", {
        method: "POST",
        body: JSON.stringify(command),
      });
      sessionStorage.removeItem(retryStorageKey);
      setPendingCommand(null);
      setConfirmed(false);
      await refresh();
    } catch (reason) {
      if (
        reason instanceof CaptureUploadRequestError &&
        ([400, 401, 403, 404, 422].includes(reason.status) ||
          (reason.status === 409 &&
            [
              "source_validation_required",
              "source_revoked",
              "consent_expiry_invalid",
              "provider_terms_not_configured_or_changed",
              "source_rights_binding_required",
              "public_scene_task_selection_changed",
              "public_scene_required_provider_missing",
            ].includes(reason.code || "")))
      ) {
        setPendingCommand(null);
        setConfirmed(false);
        sessionStorage.removeItem(retryStorageKey);
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Submission failed. Retrying sends the same request.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    try {
      await apiRequest(
        currentUser,
        `/api/task-evaluation-scene-intakes/${encodeURIComponent(id)}/revoke`,
        { method: "POST" },
      );
      await refresh();
    } catch {
      setError("That couldn't be stopped. Try again.");
    }
  }
  const successRows = [
    { key: "control_frequency_hz", label: "Control frequency (Hz)", min: "1", step: "1" },
    { key: "maximum_episode_seconds", label: "Maximum episode seconds", min: "0.01", step: "any" },
    { key: "minimum_lift_m", label: "Minimum lift (m)", min: "0.001", step: "any" },
    { key: "pregrasp_clearance_m", label: "Pre-grasp clearance (m)", min: "0.001", step: "any" },
    { key: "minimum_planar_displacement_m", label: "Minimum planar displacement (m)", min: "0.001", step: "any" },
    { key: "maximum_final_planar_target_error_m", label: "Maximum final planar target error (m)", min: "0.001", step: "any" },
  ] as const;
  const splatSource = sessions.some((session) => session.session_id === source && session.capture_authority_profile === "provided_scene_splat");
  const humanize = (value: string) => value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
  return (
    <div className="ws-form">
      <p className="text-ink-600">
        Choose a completed or public scene and describe one pick-and-place task. Supplied geometry stays separate from
        observed capture, and results are development-only simulation.
      </p>
      <form onSubmit={submit} className="mt-6">
        {pendingCommand ? (
          <p className="ws-alert" role="status">
            Your last submission is saved until{" "}
            {new Date(
              Number(
                (pendingCommand.execution as { expires_at_epoch: number })
                  .expires_at_epoch,
              ) * 1000,
            ).toLocaleString()}
            . Retrying sends the same request.
          </p>
        ) : null}
        <fieldset disabled={busy || Boolean(pendingCommand)}>
          <div className="ws-fields">
            <Field label="Source" wide>
              <select
                required
                value={source}
                onChange={(e) => {
                  setSource(e.target.value); setCollisionSource(""); setCollisionFrameConfirmed(false);
                  const choice = nativeSources.find((row) => row.id === e.target.value && row.kind === "public_scene");
                  const proposal = choice?.task_proposal;
                  if (proposal) {
                    setTask({ subject: proposal.subject.description, support: proposal.support.description });
                    setDestination({ relation: proposal.destination.relation, visible_label: proposal.destination.visible_label,
                      x: proposal.destination.position_world_m[0], y: proposal.destination.position_world_m[1], z: proposal.destination.position_world_m[2] });
                    setSuccess(proposal.success as typeof SUCCESS_DEFAULTS);
                    setProvider(choice.required_providers?.[0] || "vast");
                    setAdditionalProviders(choice.required_providers?.slice(1) || ["openai"]);
                  }
                }}
              >
                <option value="">Choose a completed or public scene</option>
                {nativeSources.filter((s) => ["mesh", "gaussian_splat", "public_scene"].includes(s.kind || "")).map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.selectable}>
                    {s.label} · {s.kind === "public_scene" ? "Public scene" : "Completed scene"} ·{" "}
                    {s.validation_status.replace(/_/g, " ")}
                  </option>
                ))}
                {sessions
                  .filter(
                    (s) =>
                      s.pipeline_handoff?.status === "forwarded" &&
                      s.capture_authority_profile.startsWith("provided_scene_") &&
                      !["revoked", "revocation_in_progress"].includes(s.status),
                  )
                  .map((s) => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.scene_id} ·{" "}
                      {s.capture_authority_profile === "provided_scene_mesh"
                        ? "Provided geometry"
                        : s.capture_authority_profile === "provided_scene_splat" ? "Completed 3DGS"
                        : "Capture"}
                    </option>
                  ))}
              </select>
            </Field>
            {splatSource ? (
              <Field
                label="Collision mesh in the same frame"
                hint={collisionSource ? undefined : "A splat supplies appearance, not contact geometry. Attach the matching mesh if you have one; missing geometry is reported before any paid work."}
                wide
              >
                <select value={collisionSource} onChange={(event) => { setCollisionSource(event.target.value); setCollisionFrameConfirmed(false); }}>
                  <option value="">No mesh attached yet</option>
                  {sessions.filter((session) => session.capture_authority_profile === "provided_scene_mesh" && session.pipeline_handoff?.status === "forwarded" && !["revoked", "revocation_in_progress"].includes(session.status)).map((session) =>
                    <option key={session.session_id} value={session.session_id}>{session.scene_id} · {session.original_filename}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="Object to move">
              <input required value={task.subject} readOnly={Boolean(publicChoice)} onChange={(e) => setTask({ ...task, subject: e.target.value })} />
            </Field>
            <Field label="Starting support surface">
              <input required value={task.support} readOnly={Boolean(publicChoice)} onChange={(e) => setTask({ ...task, support: e.target.value })} />
            </Field>
          </div>
          {splatSource && collisionSource ? (
            <label className="ws-check">
              <input type="checkbox" required checked={collisionFrameConfirmed} onChange={(event) => setCollisionFrameConfirmed(event.target.checked)} />
              <span>I confirm these exports use the same declared coordinate frame. This doesn&apos;t certify physical scale or collision accuracy.</span>
            </label>
          ) : null}

          <fieldset className="mt-8" disabled={Boolean(publicChoice)}>
            <legend className="text-sm font-medium">Where it should end up</legend>
            <p className="mt-1 text-sm text-ink-500">
              Use the scene&apos;s world coordinates. (0, 0, 0) is only a placeholder, so set the real drop point.
              Orientation stays level.
            </p>
            <div className="ws-fields mt-4">
              <Field label="Placement relation">
                <select value={destination.relation} onChange={(e) => setDestination({ ...destination, relation: e.target.value as "on" | "inside" })}>
                  <option value="on">On the surface</option>
                  <option value="inside">Inside the container</option>
                </select>
              </Field>
              <Field label="Destination surface or container">
                <input required value={destination.visible_label} onChange={(e) => setDestination({ ...destination, visible_label: e.target.value })} />
              </Field>
              <Field label="Target X (m)"><input type="number" required step="any" value={destination.x} onChange={(e) => setDestination({ ...destination, x: Number(e.target.value) })} /></Field>
              <Field label="Target Y (m)"><input type="number" required step="any" value={destination.y} onChange={(e) => setDestination({ ...destination, y: Number(e.target.value) })} /></Field>
              <Field label="Target Z (m)"><input type="number" required step="any" value={destination.z} onChange={(e) => setDestination({ ...destination, z: Number(e.target.value) })} /></Field>
            </div>
          </fieldset>

          <div className="ws-fields mt-8">
            <Field label="Total spending ceiling (USD)">
              <input type="number" required min="0.01" max="1000" step="any" value={spend} onChange={(e) => setSpend(Number(e.target.value))} />
            </Field>
          </div>

          <details className="mt-8">
            <summary>Advanced settings</summary>
            <fieldset disabled={Boolean(publicChoice)}>
              <legend className="text-sm font-medium">Success criteria</legend>
              <p className="mt-1 text-sm text-ink-500">
                Defaults suit a rigid-object pick-and-place. Retries and regrasps are fixed at zero. Control frequency ×
                maximum episode seconds must be a whole number of steps (default 15 × 24 = 360).
              </p>
              <div className="ws-fields mt-4">
                {successRows.map((row) => (
                  <Field key={row.key} label={row.label}>
                    <input
                      type="number"
                      required
                      min={row.min}
                      step={row.step}
                      value={success[row.key]}
                      onChange={(e) => setSuccess({ ...success, [row.key]: Number(e.target.value) } as typeof success)}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
            <div className="ws-fields mt-6">
              {policies.map((policy, index) => [
                <Field key={`id-${index}`} label={`Candidate ${index + 1} ID`}>
                  <input required value={policy.id} onChange={(e) => setPolicies(policies.map((p, i) => i === index ? { ...p, id: e.target.value } : p))} />
                </Field>,
                <Field key={`digest-${index}`} label="Frozen artifact SHA-256">
                  <input required pattern="sha256:[0-9a-f]{64}" placeholder="sha256:…" value={policy.artifact_digest} onChange={(e) => setPolicies(policies.map((p, i) => i === index ? { ...p, artifact_digest: e.target.value } : p))} />
                </Field>,
              ])}
              <Field label="Stage attempt limit"><input type="number" required min="1" max="32" value={attempts} onChange={(e) => setAttempts(Number(e.target.value))} /></Field>
              <Field label="Maximum retries"><input type="number" required min="0" max="3" value={retries} onChange={(e) => setRetries(Number(e.target.value))} /></Field>
              <Field label="Authorization duration (hours)"><input type="number" required min="1" max="168" value={hours} onChange={(e) => setHours(Number(e.target.value))} /></Field>
              <Field label="Permitted provider">
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setAdditionalProviders([]);
                    setTerms(providerTerms[e.target.value]?.digest || "");
                    setConfirmed(false);
                  }}
                >
                  <option value="vast">Vast</option>
                  <option value="runpod">RunPod</option>
                  <option value="openai">OpenAI</option>
                </select>
              </Field>
              <Field label="Accepted provider terms reference" wide>
                <input required value={terms} readOnly />
              </Field>
            </div>
            {Object.entries(providerTerms)
              .filter(([name, evidence]) => name !== provider && evidence.digest === terms)
              .map(([name]) => (
                <label key={name} className="ws-check">
                  <input
                    type="checkbox"
                    checked={additionalProviders.includes(name)}
                    onChange={(event) => {
                      setAdditionalProviders((values) =>
                        event.target.checked
                          ? [...new Set([...values, name])]
                          : values.filter((value) => value !== name),
                      );
                      setConfirmed(false);
                    }}
                  />
                  <span>Also allow {name} under the same terms.</span>
                </label>
              ))}
            {providerTerms[provider] ? (
              <a className="ws-link mt-4" href={providerTerms[provider].url} target="_blank" rel="noreferrer">{providerTerms[provider].label}</a>
            ) : (
              <p className="mt-4 text-sm">Terms aren&apos;t set up for this provider yet.</p>
            )}
          </details>

          <p className="ws-note">
            Rights come from the source&apos;s own record and your confirmation as its owner. Source and publisher
            restrictions still apply.
          </p>
          <label className="ws-check">
            <input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>
              I confirm this task and my rights to private processing by the selected providers, without provider
              training, within these spending, retry, and time limits. Running it also needs my account&apos;s
              commercial authorization.
            </span>
          </label>
        </fieldset>
        {error ? <p role="alert" className="mt-4 text-runway-red">{error}</p> : null}
        <div className="ws-form-actions">
          <button type="submit" className="ws-primary" disabled={busy || (!pendingCommand && (!confirmed || !terms))}>
            {busy ? "Saving…" : pendingCommand ? "Retry same submission" : "Confirm task and submit run"}
          </button>
        </div>
      </form>
      <div aria-live="polite" className="mt-10">
        {intakes.length ? <h3 className="text-lg">Your requests</h3> : null}
        {intakes.map((intake) => (
          <div key={intake.id} className="border-t border-line py-3">
            <p className="font-medium">
              {humanize(String(
                ["revoked", "revocation_pending"].includes(intake.state)
                  ? intake.state
                  : intake.pipeline_status?.status || intake.state,
              ))}
            </p>
            {intake.pipeline_status?.phase ? <p className="text-sm">{intake.pipeline_status.phase}</p> : null}
            {[intake.blocker, ...(intake.pipeline_status?.blockers || [])]
              .filter(Boolean)
              .map((blocker, i) => <p key={i} className="text-sm text-ink-600">{humanize(String(blocker))}</p>)}
            <p className="mt-1 break-all text-xs text-ink-500">
              {intake.submission_id} · {intake.receipt ? "Received for processing" : "Saved; not yet accepted to run"}
            </p>
            {!["revoked", "revocation_pending", "closeout_pending", "completed", "expired"].includes(intake.state) ? (
              <button type="button" className="ws-link mt-2" onClick={() => void revoke(intake.id)}>Stop future runs</button>
            ) : null}
            {["revoked", "revocation_pending"].includes(intake.state) ? (
              <p className="mt-1 text-sm">Stopping prevents new runs. It doesn&apos;t stop one that&apos;s already going.</p>
            ) : null}
            {intake.state === "closeout_pending" ? (
              <p className="mt-1 text-sm">No new runs will start; the current one is still finishing.</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
