import { TaskThumbnail } from "./TaskThumbnail";
/**
 * Signing up a robot team, for a person.
 *
 * ## What this replaced, and why it was wrong
 *
 * The first version of this panel was an API console with a form around it. A
 * person typed a name and a URL and got back, in order: "Nothing worth running
 * yet", a raw bearer token under "this is the only time we can show it", and
 * two curl calls. Every one of those is an affordance built for an agent and
 * handed to a human:
 *
 * - **A bearer token is not an account.** A person will lose it, and telling
 *   them it is unrecoverable makes losing it their fault. It belongs behind a
 *   disclosure for the teams that want one, not as the headline of a signup.
 * - **An empty library is not an answer.** "No evaluation candidates available
 *   today" is a dead end at the exact moment someone has just told us who they
 *   are. What follows has to be a next step, not a full stop.
 * - **We never asked what the robot was.** The point of onboarding is to
 *   understand the robot. Removing the intake's *gates* was right; removing
 *   every question about the machine was overshoot, and it made the first plan
 *   worse for no gain.
 *
 * ## What it asks now
 *
 * An email, a name, what the robot is, what it is for, and a checkpoint. None
 * of it gates anything — a plan comes back either way — and the two robot
 * questions are one click each and feed the ranking directly. `taskFamily` is
 * stored at `self_reported` and the first real run supersedes it, which is the
 * grade ladder working exactly as designed.
 *
 * The email is what makes this an account rather than a token: it is how we
 * come back to them when a matching site lands, which is the honest answer when
 * the library has nothing for them yet.
 */
import { TaskFacts } from "./TaskFacts";
import type { TaskListingDetails } from "@/types/taskBrowse";
import { useState } from "react";

type Row = {
  sceneId: string;
  siteLabel: string;
  costUsd: number;
  rationale: string;
  thumbnailUrl?: string | null;
  details?: TaskListingDetails | null;
};

type PlanResult = {
  teamId: string;
  agentKey: string;
  checkpointId: string | null;
  rows: Row[];
  totalCostUsd: number;
  email: string;
  taskFamilyLabel: string;
  /**
   * Whether the empty list is our outage rather than our library.
   *
   * These look identical on screen and are opposite things to say. Telling
   * someone we hold no site for their robot, when in fact the catalogue failed
   * to load, blames their machine for our fault.
   */
  planUnavailable: boolean;
};

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; plan: PlanResult }
  | { status: "failed"; message: string };

const EMBODIMENTS = [
  { value: "Fixed arm", label: "Fixed arm" },
  { value: "Humanoid", label: "Humanoid" },
  { value: "Wheeled humanoid", label: "Wheeled humanoid" },
  { value: "Mobile manipulator", label: "Mobile manipulator" },
  { value: "Autonomous mobile robot", label: "Autonomous mobile robot" },
  { value: "Something else", label: "Something else" },
] as const;

const TASK_FAMILIES = [
  { value: "pick_place", label: "Pick and place" },
  { value: "machine_tending", label: "Machine tending" },
  { value: "transport", label: "Transport and movement" },
  { value: "palletizing", label: "Palletizing and depalletizing" },
  { value: "inspection", label: "Inspection and scanning" },
  { value: "other", label: "Something else" },
] as const;

const RUNTIMES = [
  { value: "policy_endpoint", label: "An endpoint we can call" },
  { value: "container_image", label: "A container image" },
  { value: "model_artifact", label: "A model artifact" },
] as const;

function familyLabel(value: string) {
  return TASK_FAMILIES.find((family) => family.value === value)?.label ?? "this kind of work";
}

export function RobotTeamPlanPreview({ sceneId }: { sceneId?: string }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [hasCheckpoint, setHasCheckpoint] = useState(true);
  const [showKey, setShowKey] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "working") return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const email = read("planEmail");
    const teamName = read("planTeamName");
    const taskFamily = read("planTaskFamily");
    const reference = read("planReference");

    if (!email || !teamName) {
      setState({ status: "failed", message: "We need a work email and a team name." });
      return;
    }
    if (hasCheckpoint && !reference) {
      setState({
        status: "failed",
        message: "Point us at something we can run, or tell us you do not have one yet.",
      });
      return;
    }

    setState({ status: "working" });

    try {
      const registered = await fetch("/api/agent-team/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName,
          contactEmail: email,
          taskFamily,
          capabilityDescription: `${read("planEmbodiment")} — ${familyLabel(taskFamily)}`,
          ...(hasCheckpoint
            ? {
                checkpoint: {
                  label: read("planLabel") || "v1",
                  runtime: read("planRuntime"),
                  reference,
                },
              }
            : {}),
        }),
      });
      const account = (await registered.json().catch(() => ({}))) as {
        teamId?: string;
        agentKey?: string;
        checkpoint?: { checkpointId?: string; detail?: string };
        error?: string;
      };

      if (!registered.ok || !account.agentKey) {
        setState({
          status: "failed",
          message:
            account.checkpoint?.detail
            || account.error
            || "We could not set that up. Check the details and try again.",
        });
        return;
      }

      // No checkpoint means nothing to rank yet, and that is a real state
      // rather than a failure: they are registered, we know what they build,
      // and we can tell them when something fits.
      let rows: Row[] = [];
      let totalCostUsd = 0;
      let planUnavailable = false;
      const checkpointId = account.checkpoint?.checkpointId ?? null;

      if (checkpointId) {
        const planned = await fetch("/api/agent-team/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${account.agentKey}`,
          },
          body: JSON.stringify({ checkpointId, ...(sceneId ? { sceneId } : {}) }),
        });
        const plan = (await planned.json().catch(() => ({}))) as {
          selected?: Row[];
          totalCostUsd?: number;
        };
        if (planned.ok) {
          rows = Array.isArray(plan.selected) ? plan.selected : [];
          totalCostUsd = Number(plan.totalCostUsd || 0);
        } else {
          planUnavailable = true;
        }
      }

      setState({
        status: "done",
        plan: {
          teamId: String(account.teamId || ""),
          agentKey: account.agentKey,
          checkpointId,
          rows,
          totalCostUsd,
          email,
          taskFamilyLabel: familyLabel(taskFamily),
          planUnavailable,
        },
      });
    } catch {
      setState({ status: "failed", message: "We could not reach Blueprint. Try again shortly." });
    }
  }

  if (state.status === "done") {
    const { plan } = state;
    return (
      <div className="ms-form" aria-live="polite">
        {plan.rows.length > 0 ? (
          <>
            <h2 style={{ marginTop: 0 }}>
              {plan.rows.length} site{plan.rows.length === 1 ? "" : "s"} we would run this against
            </h2>
            <p className="ms-field-hint">
              Ranked by what each run would tell you that you do not already know. Nothing is
              charged and nothing is reserved until you start one.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "20px 0" }}>
              {plan.rows.map((row) => (
                <li key={row.sceneId} style={{ borderTop: "1px solid var(--ms-rule)", padding: "14px 0" }}>
                  <div className="ms-task-heading"><div><strong>{row.siteLabel}</strong>{" "}
                  <span className="ms-field-hint">${row.costUsd}</span>
                  </div><TaskThumbnail src={row.thumbnailUrl} title={row.siteLabel} taskFamily={row.details?.taskFamily ?? ""} /></div>
                  {row.details && <TaskFacts details={row.details} />}
                  {/* The reason, not just the ranking: a team should be able to
                      read why a row is where it is and disagree with it. */}
                  <p style={{ margin: "6px 0 0", color: "var(--ms-muted)" }}>{row.rationale}</p>
                </li>
              ))}
            </ul>

            <p style={{ borderTop: "1px solid var(--ms-rule)", paddingTop: "16px", marginBottom: 0 }}>
              <strong>${plan.totalCostUsd} to run all of them.</strong> We have your details at{" "}
              {plan.email} and will be in touch to start them. Nothing is charged until you say so.
            </p>
          </>
        ) : (
          <>
            {/*
              * The state the first version dead-ended on. An empty library is
              * our problem, not theirs, and the honest answer names what
              * happens next rather than stopping at "nothing available".
              */}
            <h2 style={{ marginTop: 0 }}>
              {plan.planUnavailable
                ? "You are in. We could not load the site list just now."
                : "You are in. We do not have a match yet."}
            </h2>
            <p style={{ color: "var(--ms-muted)" }}>
              {plan.planUnavailable
                ? `That is a fault on our side rather than anything about your robot, and your
                   registration is safe. Try again in a few minutes and the list will be here.`
                : plan.checkpointId
                ? `We hold no site with ${plan.taskFamilyLabel.toLowerCase()} work that is ready to
                   run against today. That is a gap in our library rather than anything about your
                   robot.`
                : `You are registered without a checkpoint, so there is nothing to rank yet. Send
                   us an endpoint, a container image or a model artifact whenever you have one.`}
            </p>
            <p><a className="ms-text-link" href="/sites">Browse live and past tasks →</a></p>
            <p style={{ color: "var(--ms-muted)" }}>
              We have your details at {plan.email} and will come back to you when a site lands
              that fits — with the price and the reason, the same as you would have seen here.
            </p>
          </>
        )}

        <details style={{ marginTop: "28px" }}>
          <summary style={{ cursor: "pointer" }}>API access for your agent</summary>
          <p className="ms-field-hint" style={{ marginTop: "12px" }}>
            Your team key. Store it somewhere safe — we keep only a hash, so we cannot show it
            again. Lost it?{" "}
            <code>POST /api/agent-team/keys/reissue</code> with your contact email and a new key
            is emailed to that address.
          </p>
          <button
            type="button"
            className="ms-text-link"
            onClick={() => setShowKey(true)}
            style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          >
            {showKey ? "Key shown below" : "Reveal key"}
          </button>
          {showKey && (
            <code style={{ display: "block", wordBreak: "break-all", marginTop: "10px" }}>
              {plan.agentKey}
            </code>
          )}
        </details>
      </div>
    );
  }

  return (
    <form className="ms-form" onSubmit={submit} aria-label="Tell us about your robot">
      <h2 style={{ marginTop: 0 }}>Connect your robot setup</h2>
      <p className="ms-field-hint" style={{ marginBottom: "20px" }}>
        Add a setup to check compatibility and get a priced plan. Nothing runs or is charged here.
      </p>

      <label htmlFor="plan-email">
        <span>Work email</span>
        <input id="plan-email" name="planEmail" type="email" required maxLength={320} />
      </label>

      <label htmlFor="plan-team-name">
        <span>Team or company</span>
        <input id="plan-team-name" name="planTeamName" type="text" required maxLength={120} />
      </label>

      <label htmlFor="plan-embodiment">
        <span>What is it?</span>
        <select id="plan-embodiment" name="planEmbodiment" defaultValue="Fixed arm">
          {EMBODIMENTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="plan-task-family">
        <span>What does it do?</span>
        <span className="ms-field-hint">
          The coarsest filter there is, and the first run replaces it with what we measure.
        </span>
        <select id="plan-task-family" name="planTaskFamily" defaultValue="pick_place">
          {TASK_FAMILIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="plan-has-checkpoint" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
        <input
          id="plan-has-checkpoint"
          name="planHasCheckpoint"
          type="checkbox"
          checked={hasCheckpoint}
          onChange={(event) => setHasCheckpoint(event.target.checked)}
          style={{ width: "auto", minHeight: 0 }}
        />
        <span>I have a checkpoint you can run</span>
      </label>

      {hasCheckpoint ? (
        <>
          <label htmlFor="plan-runtime">
            <span>How would we run it?</span>
            <select id="plan-runtime" name="planRuntime" defaultValue="policy_endpoint">
              {RUNTIMES.map((runtime) => (
                <option key={runtime.value} value={runtime.value}>
                  {runtime.label}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="plan-reference">
            <span>Where is it?</span>
            <span className="ms-field-hint">
              A URL, an image reference, or an artifact location. We do not run it now — this only
              decides what to rank.
            </span>
            <input id="plan-reference" name="planReference" type="text" maxLength={2000} />
          </label>


        </>
      ) : (
        <p className="ms-field-hint">
          That is fine. We will register you and tell you when a site lands that fits what you
          build — send a checkpoint whenever you have one.
        </p>
      )}

      {state.status === "failed" && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>
          {state.message}
        </p>
      )}

      <button className="ms-button ms-button-large" type="submit" disabled={state.status === "working"}>
        {state.status === "working" ? "Working…" : "See what we would run"}
      </button>
    </form>
  );
}
