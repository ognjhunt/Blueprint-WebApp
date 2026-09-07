import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Button, Card } from "@/components/blueprint";
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
    }>
  >([]);
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
        setError("Provider terms and frozen policy catalog are unavailable."),
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
        "Unable to restore the prior submission. Review your retained run list before submitting again.",
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
        setError("Native source listing is unavailable. Refresh to retry."),
      );
    void refresh().catch(() =>
      setError("Unable to load run status. Refresh to retry."),
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
      task: {
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
            ].includes(reason.code || "")))
      ) {
        setPendingCommand(null);
        setConfirmed(false);
        sessionStorage.removeItem(retryStorageKey);
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Submission failed. Retry retains the same identity and consent.",
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
      setError("Revocation could not be retained. Retry for this same intent.");
    }
  }
  const field = "runway-input mt-1.5";
  return (
    <Card pad="lg">
      <h2 className="font-display text-xl font-semibold text-ink-900">
        Start a Task Evaluation Run
      </h2>
      <p className="my-3 text-body-s text-ink-600">
        Choose a completed 3DGS or mesh result, confirm one pick-and-place task, and bound
        processing. Supplied geometry stays distinct from observed capture.
        Results remain development-only simulation evidence.
      </p>
      <form onSubmit={submit} className="space-y-4">
        {pendingCommand ? (
          <p className="text-body-s">
            Retained consent expires{" "}
            {new Date(
              Number(
                (pendingCommand.execution as { expires_at_epoch: number })
                  .expires_at_epoch,
              ) * 1000,
            ).toLocaleString()}
            . Retrying preserves this expiry.
          </p>
        ) : null}
        <fieldset
          disabled={busy || Boolean(pendingCommand)}
          className="grid gap-4 md:grid-cols-2"
        >
          <label>
            Source
            <select
              className={field}
              required
              value={source}
              onChange={(e) => { setSource(e.target.value); setCollisionSource(""); setCollisionFrameConfirmed(false); }}
            >
              <option value="">Choose a completed 3DGS or mesh</option>
              {nativeSources.filter((s) => ["mesh", "gaussian_splat"].includes(s.kind || "")).map((s) => (
                <option key={s.id} value={s.id} disabled={!s.selectable}>
                  {s.label} · Completed scene ·{" "}
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
          </label>
          {sessions.some((session) => session.session_id === source && session.capture_authority_profile === "provided_scene_splat") ? <>
            <label>Collision mesh in the same frame
              <select className={field} value={collisionSource} onChange={(event) => { setCollisionSource(event.target.value); setCollisionFrameConfirmed(false); }}>
                <option value="">No mesh attached yet</option>
                {sessions.filter((session) => session.capture_authority_profile === "provided_scene_mesh" && session.pipeline_handoff?.status === "forwarded" && !["revoked", "revocation_in_progress"].includes(session.status)).map((session) =>
                  <option key={session.session_id} value={session.session_id}>{session.scene_id} · {session.original_filename}</option>)}
              </select>
            </label>
            {collisionSource ? <label className="flex items-start gap-2 md:col-span-2"><input type="checkbox" required checked={collisionFrameConfirmed} onChange={(event) => setCollisionFrameConfirmed(event.target.checked)} />
              I confirm these exports use the same declared coordinate frame. This does not certify physical scale or collision accuracy.
            </label> : <p className="text-body-s text-ink-500 md:col-span-2">A splat supplies appearance, not contact geometry. Attach the matching mesh when available; missing geometry will be reported before paid work.</p>}
          </> : null}
          <label>
            Object to move
            <input
              className={field}
              required
              value={task.subject}
              onChange={(e) => setTask({ ...task, subject: e.target.value })}
            />
          </label>
          <label>
            Starting support surface
            <input
              className={field}
              required
              value={task.support}
              onChange={(e) => setTask({ ...task, support: e.target.value })}
            />
          </label>
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="font-medium text-ink-800">
              Destination placement
            </legend>
            <p className="text-body-s text-ink-500">
              Where the object must end up. A structured pose is required — a
              description alone cannot be simulated. Orientation defaults to
              identity (level).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                Placement relation
                <select
                  className={field}
                  value={destination.relation}
                  onChange={(e) =>
                    setDestination({
                      ...destination,
                      relation: e.target.value as "on" | "inside",
                    })
                  }
                >
                  <option value="on">On the surface</option>
                  <option value="inside">Inside the container</option>
                </select>
              </label>
              <label>
                Destination surface or container
                <input
                  className={field}
                  required
                  value={destination.visible_label}
                  onChange={(e) =>
                    setDestination({
                      ...destination,
                      visible_label: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Target X (m)
                <input
                  className={field}
                  type="number"
                  required
                  step="any"
                  value={destination.x}
                  onChange={(e) =>
                    setDestination({
                      ...destination,
                      x: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Target Y (m)
                <input
                  className={field}
                  type="number"
                  required
                  step="any"
                  value={destination.y}
                  onChange={(e) =>
                    setDestination({
                      ...destination,
                      y: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Target Z (m)
                <input
                  className={field}
                  type="number"
                  required
                  step="any"
                  value={destination.z}
                  onChange={(e) =>
                    setDestination({
                      ...destination,
                      z: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <p className="text-body-s text-ink-500">
              Coordinates are in the scene&apos;s world frame. The default origin
              (0, 0, 0) is a placeholder — set the real drop point.
            </p>
          </fieldset>
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="font-medium text-ink-800">
              Success criteria
            </legend>
            <p className="text-body-s text-ink-500">
              Structured thresholds the run scores against. Defaults suit a
              rigid-object pick-and-place; adjust only if the task needs it.
              Retries and regrasps are fixed at zero.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  {
                    key: "control_frequency_hz",
                    label: "Control frequency (Hz)",
                    min: "1",
                    step: "1",
                  },
                  {
                    key: "maximum_episode_seconds",
                    label: "Maximum episode seconds",
                    min: "0.01",
                    step: "any",
                  },
                  {
                    key: "minimum_lift_m",
                    label: "Minimum lift (m)",
                    min: "0.001",
                    step: "any",
                  },
                  {
                    key: "pregrasp_clearance_m",
                    label: "Pre-grasp clearance (m)",
                    min: "0.001",
                    step: "any",
                  },
                  {
                    key: "minimum_planar_displacement_m",
                    label: "Minimum planar displacement (m)",
                    min: "0.001",
                    step: "any",
                  },
                  {
                    key: "maximum_final_planar_target_error_m",
                    label: "Maximum final planar target error (m)",
                    min: "0.001",
                    step: "any",
                  },
                ] as const
              ).map((row) => (
                <label key={row.key}>
                  {row.label}
                  <input
                    className={field}
                    type="number"
                    required
                    min={row.min}
                    step={row.step}
                    value={success[row.key]}
                    onChange={(e) =>
                      setSuccess({
                        ...success,
                        [row.key]: Number(e.target.value),
                      } as typeof success)
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-body-s text-ink-500">
              Control frequency × maximum episode seconds must be a whole number
              of steps (default 15 × 24 = 360).
            </p>
          </fieldset>
          {policies.map((policy, index) => (
            <div key={index} className="space-y-2">
              <label>
                Candidate {index + 1} ID
                <input
                  className={field}
                  required
                  value={policy.id}
                  onChange={(e) =>
                    setPolicies(
                      policies.map((p, i) =>
                        i === index ? { ...p, id: e.target.value } : p,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Frozen artifact SHA-256
                <input
                  className={field}
                  required
                  pattern="sha256:[0-9a-f]{64}"
                  placeholder="sha256:…"
                  value={policy.artifact_digest}
                  onChange={(e) =>
                    setPolicies(
                      policies.map((p, i) =>
                        i === index
                          ? { ...p, artifact_digest: e.target.value }
                          : p,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <label>
            Total spending ceiling (USD)
            <input
              className={field}
              type="number"
              required
              min="0.01"
              max="1000"
              step="any"
              value={spend}
              onChange={(e) => setSpend(Number(e.target.value))}
            />
          </label>
          <label>
            Stage attempt limit
            <input
              className={field}
              type="number"
              required
              min="1"
              max="32"
              value={attempts}
              onChange={(e) => setAttempts(Number(e.target.value))}
            />
          </label>
          <label>
            Maximum retries
            <input
              className={field}
              type="number"
              required
              min="0"
              max="3"
              value={retries}
              onChange={(e) => setRetries(Number(e.target.value))}
            />
          </label>
          <label>
            Authorization duration (hours)
            <input
              className={field}
              type="number"
              required
              min="1"
              max="168"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
          <label>
            Permitted provider
            <select
              className={field}
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
          </label>
          {Object.entries(providerTerms)
            .filter(
              ([name, evidence]) =>
                name !== provider && evidence.digest === terms,
            )
            .map(([name]) => (
              <label key={name} className="flex items-start gap-3">
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
                <span>
                  Also permit {name} processing under the same retained terms
                  evidence.
                </span>
              </label>
            ))}
          <p className="text-body-s">
            Rights are bound to the retained source governance and your owner
            attestation. Source and publisher restrictions still apply.
          </p>
          <label>
            Accepted provider terms reference
            <input className={field} required value={terms} readOnly />
            {providerTerms[provider] ? (
              <a
                className="text-body-s underline"
                href={providerTerms[provider].url}
                target="_blank"
                rel="noreferrer"
              >
                {providerTerms[provider].label}
              </a>
            ) : (
              <span className="text-body-s">
                Provider terms evidence is not configured for this provider.
              </span>
            )}
          </label>
          <label className="flex items-start gap-3 md:col-span-2">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I confirm this task and rights to private processing by the
              selected providers, without provider training, within these
              spending, retry, and time limits. Execution also requires my
              account's commercial authorization.
            </span>
          </label>
        </fieldset>
        {error ? (
          <p role="alert" className="text-body-s text-red-700">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="action"
          disabled={busy || (!pendingCommand && (!confirmed || !terms))}
        >
          {busy
            ? "Saving…"
            : pendingCommand
              ? "Retry same submission"
              : "Confirm task and submit run"}
        </Button>
      </form>
      <div aria-live="polite" className="mt-6 space-y-3">
        {intakes.map((intake) => (
          <div key={intake.id} className="border-t border-line pt-3">
            <p className="font-semibold">{intake.submission_id}</p>
            <p>
              {String(
                ["revoked", "revocation_pending"].includes(intake.state)
                  ? intake.state
                  : intake.pipeline_status?.status || intake.state,
              ).replace(/_/g, " ")}
            </p>
            {intake.pipeline_status?.phase ? (
              <p>{intake.pipeline_status.phase}</p>
            ) : null}
            {[intake.blocker, ...(intake.pipeline_status?.blockers || [])]
              .filter(Boolean)
              .map((blocker, i) => (
                <p key={i} className="text-body-s">
                  {String(blocker).replace(/_/g, " ")}
                </p>
              ))}
            <p className="text-body-xs text-ink-500">
              {intake.receipt
                ? "Pipeline intent receipt retained"
                : "Durable intake retained; execution not yet accepted"}
            </p>
            {![
              "revoked",
              "revocation_pending",
              "closeout_pending",
              "completed",
              "expired",
            ].includes(intake.state) ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void revoke(intake.id)}
              >
                Revoke future execution
              </Button>
            ) : null}
            {["revoked", "revocation_pending"].includes(intake.state) ? (
              <p className="text-body-s">
                Revocation stops future admissions. It does not assert teardown
                of an already running resource.
              </p>
            ) : null}
            {intake.state === "closeout_pending" ? (
              <p className="text-body-s">
                Future execution is closed; the existing attempt is still being
                reconciled for a terminal result.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
