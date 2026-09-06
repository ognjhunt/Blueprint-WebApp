import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Button, Card } from "@/components/blueprint";
import {
  apiRequest,
  CaptureUploadRequestError,
  type CaptureUploadSession,
} from "@/lib/captureUploads";

export function SceneIntakeForm({
  currentUser,
  sessions,
}: {
  currentUser: User;
  sessions: CaptureUploadSession[];
}) {
  const [source, setSource] = useState("");
  const [task, setTask] = useState({
    subject: "",
    support: "",
    destination: "",
    success:
      "Place the object fully inside the destination, release it, and move the gripper clear.",
  });
  const [policies, setPolicies] = useState([
    { id: "", artifact_digest: "" },
    { id: "", artifact_digest: "" },
  ]);
  const [spend, setSpend] = useState(25);
  const [attempts, setAttempts] = useState(1);
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
          !sessionStorage.getItem(`scene-intake-pending:${currentUser.uid}`)
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
        `scene-intake-pending:${currentUser.uid}`,
      );
      if (retained) {
        const command = JSON.parse(retained);
        setPendingCommand(command);
        setSource(command.source_session_id);
        setTask(
          Object.fromEntries(
            Object.entries(command.task)
              .filter(([key]) =>
                ["subject", "support", "destination", "success"].includes(key),
              )
              .map(([key, value]) => [
                key,
                (value as { description: string }).description,
              ]),
          ) as typeof task,
        );
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
  }, [currentUser]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const command = pendingCommand || {
      submission_id: `scene-${crypto.randomUUID()}`,
      source_session_id: source,
      task: {
        task_id: `task-${source}`,
        strategy: "pick_and_place",
        ...Object.fromEntries(
          Object.entries(task).map(([key, description]) => [
            key,
            { description, authority: "owner_confirmed" },
          ]),
        ),
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
        `scene-intake-pending:${currentUser.uid}`,
        JSON.stringify(command),
      );
      await apiRequest(currentUser, "/api/task-evaluation-scene-intakes", {
        method: "POST",
        body: JSON.stringify(command),
      });
      sessionStorage.removeItem(`scene-intake-pending:${currentUser.uid}`);
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
        sessionStorage.removeItem(`scene-intake-pending:${currentUser.uid}`);
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
        Choose an admitted upload, confirm one pick-and-place task, and bound
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
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Choose a capture or provided scene</option>
              {nativeSources.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.selectable}>
                  {s.label} · App capture ·{" "}
                  {s.validation_status.replace(/_/g, " ")}
                </option>
              ))}
              {sessions
                .filter(
                  (s) =>
                    s.pipeline_handoff?.status === "forwarded" &&
                    !["revoked", "revocation_in_progress"].includes(s.status),
                )
                .map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.scene_id} ·{" "}
                    {s.capture_authority_profile === "provided_scene_mesh"
                      ? "Provided geometry"
                      : "Capture"}
                  </option>
                ))}
            </select>
          </label>
          {Object.entries(task).map(([key, value]) => (
            <label key={key}>
              {
                (
                  {
                    subject: "Object to move",
                    support: "Starting support surface",
                    destination: "Destination",
                    success: "Observable success condition",
                  } as Record<string, string>
                )[key]
              }
              <input
                className={field}
                required
                value={value}
                onChange={(e) => setTask({ ...task, [key]: e.target.value })}
              />
            </label>
          ))}
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
            Maximum paid attempts
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
          </div>
        ))}
      </div>
    </Card>
  );
}
