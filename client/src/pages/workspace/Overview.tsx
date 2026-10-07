import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useWorkspace, dateLabel } from "@/lib/workspace";
import {
  Frame,
  ActionLink,
  Empty,
  Tag,
  TargetLine,
  EvaluationTable,
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
                ? `${task.results.filter((result) => result.successRate !== null).length} results · ${new Set(task.results.map((result) => result.teamAlias)).size} teams${task.results.some((result) => result.targetsMet !== null) ? ` · ${task.results.filter((result) => result.targetsMet).length} ${task.results.filter((result) => result.targetsMet).length === 1 ? "meets" : "meet"} recorded targets` : ""}`
                : task.capture?.startsAt
                  ? `Capture ${dateLabel(task.capture.startsAt)}`
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
function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.ceil((Date.parse(date) - now) / 60000);
  return (
    <>
      {minutes <= 0
        ? "Scheduled time has arrived"
        : minutes < 60
          ? `In ${minutes} min`
          : minutes < 1440
            ? `In ${Math.floor(minutes / 60)} hr ${minutes % 60} min`
            : `In ${Math.ceil(minutes / 1440)} days`}
    </>
  );
}
export default function Overview() {
  const query = useWorkspace(),
    site = query.data?.role === "site_operator",
    tasks = (query.data?.tasks || []).filter((task) => !task.archived),
    evaluations = (query.data?.evaluations || []).filter(
      (item) => !item.archived,
    );
  const nextVisit = tasks
    .filter(
      (task) =>
        task.capture?.startsAt &&
        ["scheduled", "confirmed"].includes(task.capture.status) &&
        Date.parse(task.capture.startsAt) > Date.now() - 3600000,
    )
    .sort((a, b) =>
      a.capture!.startsAt!.localeCompare(b.capture!.startsAt!),
    )[0];
  const nextResult = evaluations.find(
    (item) => item.successRate !== null && !item.outcome,
  );
  return (
    <Frame
      query={query}
      active="overview"
      title="Overview"
      action={
        <ActionLink
          href={site ? "/app/tasks/new" : "/app/library"}
          primary
        >
          {site ? "Show us a task" : "Task library"}
        </ActionLink>
      }
    >
      {site ? (
        <>
          {nextVisit ? (
            <section className="ws-next">
              <div>
                <p className="ws-kicker">Up next</p>
                <h2>Capture visit</h2>
                <p>{dateLabel(nextVisit.capture!.startsAt, true)}</p>
                <p className="ws-muted">
                  <Countdown date={nextVisit.capture!.startsAt!} /> ·{" "}
                  {nextVisit.siteName}
                </p>
              </div>
              <ActionLink href={`/app/tasks/${nextVisit.id}?tab=capture`}>
                Manage visit
              </ActionLink>
            </section>
          ) : tasks.some((task) => task.status === "Review results") ? (
            <section className="ws-next">
              <div>
                <p className="ws-kicker">Up next</p>
                <h2>Review team results</h2>
                <p className="ws-muted">
                  Compare each team's evidence with your job targets.
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
          {nextResult && (
            <section className="ws-next">
              <div>
                <p className="ws-kicker">Up next</p>
                <h2>Review your results</h2>
                <p>{nextResult.title} · Evaluation complete</p>
                <p className="ws-muted">
                  Your result is ready. Blueprint shares it with the site and recommends one pilot.
                </p>
              </div>
              <ActionLink href={`/app/evaluations/${nextResult.id}`}>
                View result
              </ActionLink>
            </section>
          )}
          <section>
            <div className="ws-section-title">
              <h2>Active evaluations</h2>
            </div>
            {evaluations.length ? (
              <EvaluationTable evaluations={evaluations} />
            ) : (
              <Empty
                title="Find your next pilot"
                href="/app/library"
                action="Task library"
              >
                Explore site tasks, save your robot and policy, and request an
                evaluation.
              </Empty>
            )}
          </section>
          {evaluations.length > 0 && (
            <section className="ws-next ws-section">
              <div>
                <h2>Ready for another task?</h2>
                <p className="ws-muted">
                  Pick a task and evaluate a saved robot and policy.
                </p>
              </div>
              <ActionLink href="/app/library">Task library</ActionLink>
            </section>
          )}
        </>
      )}
    </Frame>
  );
}
