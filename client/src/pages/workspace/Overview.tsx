import { useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { Frame, ActionLink, Empty, Tag } from "@/components/workspace/WorkspaceUI";
import type { WorkspaceTask } from "@/types/workspace";

/**
 * The account's one list of jobs. Each job opens on its job page, which says
 * where it stands. The emailed link expires; the account mints a fresh one.
 */
export function TaskRows({ tasks, request }: {
  tasks: WorkspaceTask[];
  request: ReturnType<typeof useWorkspace>["request"];
}) {
  const [opening, setOpening] = useState<string | null>(null),
    [error, setError] = useState<{ id: string; message: string } | null>(null);
  async function openJobPage(taskId: string) {
    if (opening) return;
    setOpening(taskId);
    setError(null);
    try {
      const { url } = await request<{ url: string }>(
        `/tasks/${encodeURIComponent(taskId)}/task-link`, "POST", {}, { timeoutMs: 15000 });
      if (typeof url !== "string" || !url.trim()) throw new Error("The job page link was missing. Please try again.");
      window.location.assign(url);
    } catch (failure) {
      setError({ id: taskId, message: failure instanceof Error ? failure.message : "The job page could not be opened. Please try again." });
    } finally {
      setOpening(null);
    }
  }
  return (
    <div>
      {tasks.map((task) => (
        <article className="ws-task-row" key={task.id}>
          <div className="ws-task-copy">
            <h3>{task.title}</h3>
            <p className="ws-muted">
              {task.siteName}
              {task.location ? ` · ${task.location}` : ""}
            </p>
            {task.recordingPermissionWithdrawn ? (
              <p><Tag>Recording permission withdrawn</Tag></p>
            ) : null}
            {error?.id === task.id ? <p role="alert">{error.message}</p> : null}
          </div>
          <button
            className="ws-primary"
            type="button"
            onClick={() => void openJobPage(task.id)}
            disabled={opening !== null}
          >
            {opening === task.id ? "Opening…" : "Open your job page"}
          </button>
        </article>
      ))}
    </div>
  );
}

export default function Overview() {
  const query = useWorkspace(),
    site = query.data?.role === "site_operator",
    tasks = (query.data?.tasks || []).filter((task) => !task.archived);
  return (
    <Frame
      query={query}
      active="overview"
      title={site ? "Your jobs" : "Overview"}
      action={
        <ActionLink href={site ? "/contact/site-operator" : "/contact/robot-team"} primary>
          {site ? "Show us a job" : "Task library"}
        </ActionLink>
      }
    >
      {tasks.length ? (
        <section>
          {!site && (
            <div className="ws-section-title">
              <h2>Sites you own</h2>
            </div>
          )}
          <TaskRows tasks={tasks} request={query.request} />
        </section>
      ) : site ? (
        <Empty title="Start with one job" href="/contact/site-operator" action="Show us a job">
          Send us a video of the job you want a robot to do. Jobs saved to your account open from here.
        </Empty>
      ) : (
        <Empty title="Find site jobs" href="/contact/robot-team" action="Task library">
          Site jobs are in the task library.
        </Empty>
      )}
    </Frame>
  );
}
