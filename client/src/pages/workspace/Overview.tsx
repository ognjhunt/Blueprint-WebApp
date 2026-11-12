import { useState } from "react";
import { Link } from "wouter";
import { useWorkspace } from "@/lib/workspace";
import {
  Frame,
  ActionLink,
  Empty,
  Tag,
  TargetLine,
} from "@/components/workspace/WorkspaceUI";
import type { WorkspaceTask } from "@/types/workspace";
/** The task's own image when we have one, else the shared illustration. */
function TaskArt({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  const real = Boolean(src) && !failed;
  return (
    <figure className="ws-task-art">
      <img src={real ? src! : "/images/site-led/auth/packing.webp"} alt="" onError={() => setFailed(true)} />
      {!real && <figcaption>Illustration</figcaption>}
    </figure>
  );
}
export function TaskRows({ tasks }: { tasks: WorkspaceTask[] }) {
  return (
    <div>
      {tasks.map((task) => (
        <article className="ws-task-row" key={task.id}>
          <TaskArt src={task.thumbnailUrl ?? null} />
          <div className="ws-task-copy">
            <h3>{task.title}</h3>
            <p className="ws-muted">
              {task.siteName}
              {task.location ? ` · ${task.location}` : ""}
            </p>
            <p>
              <Tag
                tone={
                  task.status === "Review results" || task.published
                    ? "green"
                    : "neutral"
                }
              >
                {task.status}
              </Tag>
            </p>
            <p>
              {task.results.length
                ? `${task.results.filter((result) => result.successRate !== null).length} results · ${new Set(task.results.map((result) => result.teamAlias)).size} submitters${task.results.some((result) => result.targetsMet !== null) ? ` · ${task.results.filter((result) => result.targetsMet).length} ${task.results.filter((result) => result.targetsMet).length === 1 ? "meets" : "meet"} recorded targets` : ""}`
                : "Capture and evaluation planning"}
            </p>
            <p className="ws-note">
              <TargetLine terms={task.terms} />
            </p>
          </div>
          <ActionLink href={`/app/tasks/${encodeURIComponent(task.id)}`}>
            {task.status === "Review results" ? "Review results" : "View task"}
          </ActionLink>
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
      title="Overview"
      action={
        <ActionLink
          href={site ? "/app/tasks/new" : "/contact/robot-team"}
          primary
        >
          {site ? "Show us a task" : "Task library"}
        </ActionLink>
      }
    >
      {site ? (
        <>
          {tasks.some((task) => task.status === "Review results") ? (
            <section className="ws-next">
              <div>
                <p className="ws-kicker">Up next</p>
                <h2>Review evaluation results</h2>
                <p className="ws-muted">
                  Compare each candidate's evidence with your job targets.
                </p>
              </div>
              <ActionLink
                href={`/app/tasks/${tasks.find((task) => task.status === "Review results")!.id}`}
              >
                Review results
              </ActionLink>
            </section>
          ) : null}
          <section>
            <div className="ws-section-title">
              <h2>Your tasks</h2>
              {tasks.length > 0 && (
                <Link href="/app/tasks" className="ws-link">
                  View all
                </Link>
              )}
            </div>
            {tasks.length ? (
              <TaskRows tasks={tasks.slice(0, 4)} />
            ) : (
              <Empty
                title="Start with one task"
                href="/app/tasks/new"
                action="Show us a task"
              >
                Tell us about the work, the site, and what success looks like.
                Your capture and evaluations will stay together here.
              </Empty>
            )}
          </section>
        </>
      ) : (
        <>
          {tasks.length > 0 && (
            <section>
              <div className="ws-section-title">
                <h2>Sites you own</h2>
                <Link href="/app/tasks" className="ws-link">View all</Link>
              </div>
              <TaskRows tasks={tasks.slice(0, 4)} />
            </section>
          )}
          {tasks.length === 0 && (
            <Empty
              title="Find site jobs"
              href="/contact/robot-team"
              action="Task library"
            >
              Site jobs are in the task library.
            </Empty>
          )}
        </>
      )}
    </Frame>
  );
}
