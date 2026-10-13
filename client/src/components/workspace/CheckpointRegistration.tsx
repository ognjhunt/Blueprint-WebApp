import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { workspaceRequest } from "@/lib/workspace";
import { Feedback, Field, Tag } from "@/components/workspace/WorkspaceUI";
import type { RobotSetup } from "@/types/workspace";

export type WorkspaceCheckpointRuntime =
  | "policy_endpoint" | "customer_hosted" | "container_image" | "controller_adapter";

export type WorkspaceCheckpoint = {
  checkpointId: string;
  teamId: string;
  label: string;
  runtime: string;
  reference: string;
  status: string;
  unrunnableReason: string | null;
  createdAtIso: string;
};

type CheckpointList = {
  teams: { teamId: string; name: string }[];
  checkpoints: WorkspaceCheckpoint[];
};

const RUNTIME_LABELS: Record<WorkspaceCheckpointRuntime, string> = {
  policy_endpoint: "Policy endpoint (we call your HTTPS API)",
  customer_hosted: "Customer-hosted endpoint (you host; we send approved observations)",
  container_image: "Container image (digest-pinned)",
  controller_adapter: "Controller adapter image (digest-pinned)",
};

/** Which runtimes can execute a setup, by how the setup is delivered. */
export function runtimesForDelivery(delivery: RobotSetup["delivery"]): WorkspaceCheckpointRuntime[] {
  if (delivery === "endpoint") return ["policy_endpoint", "customer_hosted"];
  if (delivery === "container") return ["container_image", "controller_adapter"];
  return [];
}

/**
 * Register a policy checkpoint for a saved setup, from the signed-in workspace.
 * The checkpoint takes the setup's own reference, which is what Blueprint's
 * free-evaluation admission matches against.
 */
export function CheckpointRegistration({ setups }: { setups: RobotSetup[] }) {
  const { currentUser, loading } = useAuth();
  const client = useQueryClient();
  const queryKey = ["workspace-checkpoints", currentUser?.uid];
  const list = useQuery({
    queryKey,
    enabled: Boolean(currentUser && !loading),
    queryFn: () => workspaceRequest<CheckpointList>(currentUser, "/checkpoints"),
  });
  const [setupId, setSetupId] = useState(setups[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const setup = setups.find((item) => item.id === setupId) ?? setups[0];
  const runtimes = setup ? runtimesForDelivery(setup.delivery) : [];
  const checkpoints = list.data?.checkpoints ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !setup) return;
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await workspaceRequest<{ created: boolean; message?: string; checkpoint: WorkspaceCheckpoint }>(
        currentUser, "/checkpoints", "POST", {
          setupId: setup.id,
          label: String(values.get("label") || "").trim(),
          runtime: String(values.get("runtime") || ""),
        });
      setNotice(result.message || (result.created ? "Checkpoint registered." : "This checkpoint is already registered."));
      await client.invalidateQueries({ queryKey });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The checkpoint was not registered. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="ws-section" aria-labelledby="checkpoint-registration-heading">
      <div className="ws-section-title">
        <h2 id="checkpoint-registration-heading">Policy checkpoints</h2>
      </div>
      <p className="ws-muted">
        Register the checkpoint Blueprint runs for a saved setup. It uses the setup's reference exactly, so a
        free evaluation of that setup can be admitted.
      </p>
      {list.error ? <div className="ws-alert" role="alert">{(list.error as Error).message}</div> : null}
      {checkpoints.length ? (
        <div className="ws-table-wrap ws-section">
          <table className="ws-table">
            <caption className="sr-only">Registered checkpoints</caption>
            <thead>
              <tr><th scope="col">Checkpoint</th><th scope="col">Runtime</th><th scope="col">Reference</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {checkpoints.map((checkpoint) => (
                <tr key={checkpoint.checkpointId}>
                  <td><strong>{checkpoint.label}</strong><small>{checkpoint.checkpointId}</small></td>
                  <td><Tag>{checkpoint.runtime}</Tag></td>
                  <td style={{ maxWidth: 360, overflowWrap: "anywhere" }}>{checkpoint.reference}</td>
                  <td>
                    <Tag tone={checkpoint.status === "runnable" ? "green" : checkpoint.status === "unrunnable" ? "red" : "neutral"}>
                      {checkpoint.status}
                    </Tag>
                    {checkpoint.unrunnableReason ? <small>{checkpoint.unrunnableReason}</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : list.isSuccess ? (
        <p className="ws-muted">No checkpoints registered yet.</p>
      ) : null}
      {!setups.length ? (
        <p className="ws-note">Save a setup first; a checkpoint is registered against a saved setup's reference.</p>
      ) : (
        <form method="post" className="ws-form ws-section" onSubmit={submit} aria-labelledby="checkpoint-form-heading">
          <h3 id="checkpoint-form-heading">Register policy checkpoint</h3>
          <div className="ws-fields">
            <Field label="Setup">
              <select name="setupId" value={setup?.id ?? ""} onChange={(event) => setSetupId(event.target.value)}>
                {setups.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.policyName} {item.version}</option>
                ))}
              </select>
            </Field>
            <Field label="Checkpoint name">
              <input name="label" required maxLength={120}
                defaultValue={setup ? `${setup.policyName} ${setup.version}` : ""} key={setup?.id} />
            </Field>
            <Field label="How Blueprint runs it" wide
              hint={runtimes.length ? undefined : "Downloadable checkpoints need an uploaded model artifact. Save the setup as a hosted endpoint or a digest-pinned container to register it here."}>
              <select name="runtime" required disabled={!runtimes.length} key={setup?.id}>
                {runtimes.map((runtime) => <option key={runtime} value={runtime}>{RUNTIME_LABELS[runtime]}</option>)}
              </select>
            </Field>
            <Field label="Reference (from the setup)" wide>
              <input value={setup?.reference ?? ""} readOnly />
            </Field>
          </div>
          <Feedback error={error} notice={notice} />
          <div className="ws-form-actions">
            <button className="ws-primary" disabled={pending || !runtimes.length}>
              {pending ? "Registering…" : "Register checkpoint"}
            </button>
          </div>
          <p className="ws-note">
            Registering does not start an evaluation or authorize compute. Blueprint admits each free evaluation.
          </p>
        </form>
      )}
    </section>
  );
}
