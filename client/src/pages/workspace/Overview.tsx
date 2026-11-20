import { BROWSE_JOBS_LABEL, BROWSE_JOBS_PATH } from "@/lib/robotTeamAccess";
import { useState } from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace";
import { Frame, ActionLink, Empty, Feedback, Tag } from "@/components/workspace/WorkspaceUI";
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

/**
 * The server lists a site's jobs only once its email is verified, so an unverified site is asked to verify instead of
 * being told to start a job it already sent.
 */
function VerifyToSeeJobs() {
  const currentUser = useOptionalAuth()?.currentUser ?? null;
  const [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function send() {
    if (!currentUser || sending) return;
    setSending(true); setError(""); setNotice("");
    try {
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(currentUser);
      setNotice("Verification email sent. Follow the link, then sign in again.");
    } catch {
      setError("Could not send a verification email. Please try again.");
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="ws-empty">
      <h2>Verify your email to see your jobs</h2>
      <p>Open the verification link we email you, then sign in again.</p>
      <button className="ws-primary" type="button" disabled={sending} onClick={() => void send()}>
        {sending ? "Sending…" : "Send verification email"}
      </button>
      <Feedback error={error} notice={notice} />
    </section>
  );
}

export default function Overview() {
  const query = useWorkspace(),
    currentUser = useOptionalAuth()?.currentUser ?? null,
    site = query.data?.role === "site_operator",
    tasks = (query.data?.tasks || []).filter((task) => !task.archived);
  return (
    <Frame
      query={query}
      active="overview"
      title={site ? "Your jobs" : "Overview"}
      action={
        <ActionLink href={site ? "/contact/site-operator" : BROWSE_JOBS_PATH} primary>
          {site ? "Start a job" : BROWSE_JOBS_LABEL}
        </ActionLink>
      }
    >
      {tasks.length ? (
        <section>
          {!site && (
            <div className="ws-section-title">
              <h2>Jobs you sent</h2>
            </div>
          )}
          <TaskRows tasks={tasks} request={query.request} />
        </section>
      ) : site && currentUser && !currentUser.emailVerified ? (
        <VerifyToSeeJobs />
      ) : site ? (
        <Empty title="No jobs yet" href="/contact/site-operator" action="Start a job">
          Send us a video of the job you want a robot to do. Jobs saved to your account open from here.
        </Empty>
      ) : (
        <Empty title="Jobs from sites" href={BROWSE_JOBS_PATH} action={BROWSE_JOBS_LABEL}>
          See the jobs sites have sent and answer each one.
        </Empty>
      )}
    </Frame>
  );
}
