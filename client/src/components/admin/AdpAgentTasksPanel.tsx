import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { useAuth } from "@/contexts/AuthContext";

const text = z.string();
const rowsSchema = z.object({ tasks: z.array(z.object({
  engineering_handoff: z.object({ handoff_id: text, state: text, issue_id: text.nullable(),
    engineering_complete: z.literal(false) }).nullish(),
  admission: z.object({ task_id: text, run_id: text, title: text, runtime: text, source_commit: text,
    enabled: z.boolean(), expires_at: z.number().finite() }),
  run: z.object({ status: text, cancel_requested: z.boolean(), cleanup_requested: z.boolean(),
    reconciliation_error: text.nullish(),
    output: z.object({ disposition: text, summary: text, next_actions: z.array(text), uncertainty: z.array(text), evidence_references: z.array(text),
      kind: z.enum(["episode_interpretation", "visual_investigation"]).optional(),
      findings: z.array(text).optional(),
      events: z.array(z.object({ time_seconds: z.number().finite(), description: text })).optional(),
      interpretation_receipt_digest: text.nullable().optional(),
    }).nullish(),
    artifacts: z.object({ agent_execution: z.object({ cleanup_state: text, state: text, updated_at: z.number() }).optional() }).optional(),
  }).nullable(),
})) });
type TaskRow = z.infer<typeof rowsSchema>["tasks"][number];

export default function AdpAgentTasksPanel() {
  const { currentUser } = useAuth();
  const client = useQueryClient();
  const key = ["adp-agent-tasks", currentUser?.uid];
  const tasks = useQuery<{ tasks: TaskRow[] }>({
    queryKey: key,
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const response = await fetch("/api/admin/agent/adp/tasks", {
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser)),
      });
      if (!response.ok) throw new Error("Task records are unavailable. Verified execution access is required.");
      const parsed = rowsSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Task records returned an invalid response.");
      return parsed.data;
    },
    retry: false,
    refetchInterval: 5000,
  });
  const action = useMutation({
    mutationFn: async ({ taskId, operation }: { taskId: string; operation: "start" | "cancel" | "cleanup" }) => {
      const response = await fetch(`/api/admin/agent/adp/tasks/${encodeURIComponent(taskId)}/${operation}`, {
        method: "POST", headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser,
          { "content-type": "application/json" })), body: "{}",
      });
      if (!response.ok) throw new Error("This task does not allow that action in its current state.");
      return response.json();
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });

  return (
    <section className="runway-panel p-5" aria-labelledby="adp-agent-tasks-title">
      <h2 id="adp-agent-tasks-title" className="font-display text-lg font-semibold text-runway-text">Task Evaluation tasks</h2>
      <p className="mt-1 text-sm text-runway-mute">Follow admitted investigations and their recorded evidence.</p>
      {tasks.isLoading ? <p className="mt-4 text-sm" role="status">Loading tasks…</p> : null}
      {tasks.error ? <p className="mt-4 text-sm text-runway-red" role="alert">{tasks.error.message}</p> : null}
      {action.error ? <p className="mt-4 text-sm text-runway-red" role="alert">{action.error.message}</p> : null}
      {tasks.data?.tasks.length === 0 ? <p className="mt-4 text-sm text-runway-mute">No admitted tasks are available.</p> : null}
      <div className="mt-4 divide-y divide-runway-line">
        {tasks.data?.tasks.map(({ admission, run, engineering_handoff }) => {
          const done = run && ["completed", "failed", "cancelled"].includes(run.status);
          const cleanup = run?.artifacts?.agent_execution?.cleanup_state;
          const expired = admission.expires_at <= Date.now() / 1000;
          return (
            <article key={admission.task_id} className="py-4 first:pt-0" aria-label={admission.title}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-runway-text">{admission.title}</h3>
                  <p className="mt-1 break-all text-xs text-runway-faint">{admission.run_id} · {admission.runtime}</p>
                  <p className="mt-1 text-sm text-runway-body" role="status">
                    {run?.status || (expired ? "Admission expired" : "Admitted")}
                    {run?.cancel_requested && !done ? " · Cancellation requested" : ""}
                    {run?.cleanup_requested && cleanup !== "deleted" ? " · Session cleanup requested" : ""}
                    {cleanup === "deleted" ? " · Session cleanup confirmed" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!run && admission.enabled && !expired ? <button className="runway-button-secondary" disabled={action.isPending}
                    onClick={() => action.mutate({ taskId: admission.task_id, operation: "start" })}>Start investigation</button> : null}
                  {run && !done ? <button className="runway-button-secondary" disabled={action.isPending || run.cancel_requested}
                    onClick={() => action.mutate({ taskId: admission.task_id, operation: "cancel" })}>Cancel task</button> : null}
                  {done && cleanup !== "deleted" ? <button className="runway-button-secondary" disabled={action.isPending || run?.cleanup_requested}
                    onClick={() => action.mutate({ taskId: admission.task_id, operation: "cleanup" })}>Clean up session</button> : null}
                </div>
              </div>
              {run?.reconciliation_error ? <p className="mt-3 text-sm text-runway-mute">Waiting for a verified worker update. The recorded task is retained.</p> : null}
              {engineering_handoff ? <div className="mt-3 text-sm text-runway-body">
                <p>Engineering follow-up: {engineering_handoff.state.replaceAll("_", " ")}</p>
                {engineering_handoff.issue_id ? <p className="break-all text-xs">Paperclip issue: {engineering_handoff.issue_id}</p> : null}
                <p className="text-xs text-runway-mute">A reviewed release is still required before the original workflow can resume.</p>
              </div> : null}
              {run?.output ? <div className="mt-3 space-y-2 text-sm text-runway-body">
                <p className="whitespace-pre-wrap">{run.output.summary}</p>
                {run.output.findings?.length ? <ul className="list-disc space-y-1 pl-5">{run.output.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul> : null}
                {run.output.kind === "episode_interpretation" ? <>
                  <p className="text-xs text-runway-mute">Interpretation: {run.output.disposition.replaceAll("_", " ")}</p>
                  <ol className="space-y-1">{run.output.events?.map((event, i) => <li key={i}>
                    <span className="font-mono text-xs text-runway-faint">{event.time_seconds.toFixed(2)}s</span> {event.description}
                  </li>)}</ol>
                </> : null}
                {run.output.next_actions.length ? <ul className="list-disc space-y-1 pl-5">{run.output.next_actions.map((text, i) => <li key={i}>{text}</li>)}</ul> : null}
                {run.output.uncertainty.length ? <p className="text-runway-mute">Uncertainty: {run.output.uncertainty.join(" ")}</p> : null}
                <details><summary className="cursor-pointer text-runway-mute">Evidence references</summary>
                  <ul className="mt-2 space-y-1 break-all font-mono text-xs">{run.output.evidence_references.map((text, i) => <li key={i}>{text}</li>)}</ul>
                  <p className="mt-2 break-all text-xs">Source release: {admission.source_commit}</p>
                </details>
                <p className="text-xs text-runway-faint">{run.output.kind === "episode_interpretation"
                  ? "This interpretation does not change the original task score or policy decision."
                  : run.output.kind === "visual_investigation" ? "These findings do not grant acceptance. The independent final review remains required."
                  : "This is an operational diagnosis. Execution, scoring, billing, resource release and delivery keep their own receipts."}</p>
              </div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
