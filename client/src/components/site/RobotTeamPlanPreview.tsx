/**
 * What we would run this checkpoint against, in the browser, before anything.
 *
 * ## The asymmetry this closes
 *
 * A team's agent could already do this: register, hand over a checkpoint, and
 * get back every site we hold, ranked by what a run there would teach, priced,
 * with a reason per row. Three calls, no credential, no questions, seconds.
 *
 * A person arriving at the same page got four qualifying questions, nine spec
 * answers, two prose fields, "Send application", and a wait — plus a paragraph
 * telling them to go and write the requests themselves. The bot had strictly
 * better access than the customer, which was never a decision anybody made. It
 * is what happens when the API is built first and the page is not revisited.
 *
 * So this is the same three calls with a form around them. Nothing new on the
 * server; the capability was already there and only the browser could not reach
 * it.
 *
 * ## It spends nothing and promises nothing
 *
 * `/plan` commits no money and takes no reservation, which is the whole reason
 * it can be handed to an anonymous visitor. A registration grants a zero
 * balance with autonomous spend off, so the worst an abusive caller gets is a
 * ranked list of site types they could already read about on the pricing page.
 *
 * ## The key is shown once because we cannot show it again
 *
 * Registration returns the plaintext agent key exactly once — we store a
 * SHA-256. A page that quietly threw it away would leave someone holding a plan
 * they could not act on without registering a second team.
 */
import { useState } from "react";

type Row = {
  sceneId: string;
  siteLabel: string;
  costUsd: number;
  rationale: string;
};

type PlanResult = {
  teamId: string;
  agentKey: string;
  checkpointId: string;
  rows: Row[];
  summary: string;
  totalCostUsd: number;
};

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; plan: PlanResult }
  | { status: "failed"; message: string };

const RUNTIMES = [
  { value: "policy_endpoint", label: "An endpoint we can call" },
  { value: "container_image", label: "A container image" },
  { value: "model_artifact", label: "A model artifact" },
] as const;

export function RobotTeamPlanPreview() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "working") return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const teamName = read("planTeamName");
    const reference = read("planReference");

    if (!teamName || !reference) {
      setState({ status: "failed", message: "A team name and something we can run." });
      return;
    }

    setState({ status: "working" });

    try {
      // One call: the team and its first checkpoint together, so a plan is two
      // round trips rather than three.
      const registered = await fetch("/api/agent-team/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName,
          checkpoint: { label: read("planLabel") || "v1", runtime: read("planRuntime"), reference },
        }),
      });
      const account = (await registered.json().catch(() => ({}))) as {
        teamId?: string;
        agentKey?: string;
        checkpoint?: { checkpointId?: string; detail?: string };
        error?: string;
      };

      if (!registered.ok || !account.agentKey || !account.checkpoint?.checkpointId) {
        setState({
          status: "failed",
          message:
            account.checkpoint?.detail
            || account.error
            || "We could not set that up. Check the reference and try again.",
        });
        return;
      }

      const planned = await fetch("/api/agent-team/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.agentKey}`,
        },
        body: JSON.stringify({ checkpointId: account.checkpoint.checkpointId }),
      });
      const plan = (await planned.json().catch(() => ({}))) as {
        selected?: Row[];
        summary?: string;
        totalCostUsd?: number;
        error?: string;
      };

      if (!planned.ok) {
        setState({
          status: "failed",
          message: plan.error || "Your team is set up, but the site catalogue did not answer.",
        });
        return;
      }

      setState({
        status: "done",
        plan: {
          teamId: String(account.teamId || ""),
          agentKey: account.agentKey,
          checkpointId: account.checkpoint.checkpointId,
          rows: Array.isArray(plan.selected) ? plan.selected : [],
          summary: String(plan.summary || ""),
          totalCostUsd: Number(plan.totalCostUsd || 0),
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
        <h2 style={{ marginTop: 0 }}>
          {plan.rows.length
            ? `${plan.rows.length} site${plan.rows.length === 1 ? "" : "s"} worth running against`
            : "Nothing worth running yet"}
        </h2>
        <p className="ms-field-hint">{plan.summary}</p>

        {plan.rows.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "20px 0" }}>
            {plan.rows.map((row) => (
              <li
                key={row.sceneId}
                style={{
                  borderTop: "1px solid var(--ms-rule)",
                  padding: "14px 0",
                }}
              >
                <strong>{row.siteLabel}</strong>{" "}
                <span className="ms-field-hint">${row.costUsd}</span>
                {/* The reason, not just the ranking. A team should be able to
                    read why a row is where it is and disagree with it. */}
                <p style={{ margin: "6px 0 0", color: "var(--ms-muted)" }}>{row.rationale}</p>
              </li>
            ))}
          </ul>
        )}

        <p style={{ borderTop: "1px solid var(--ms-rule)", paddingTop: "16px" }}>
          <strong>Your key. This is the only time we can show it.</strong>
        </p>
        <code style={{ display: "block", wordBreak: "break-all", marginBottom: "8px" }}>
          {plan.agentKey}
        </code>
        <p className="ms-field-hint">
          Nothing has been charged and nothing is reserved. Your agent continues from here with{" "}
          <code>POST /api/agent-team/funding</code> and <code>POST /api/agent-team/runs</code>, or
          use the form below if you would rather talk to someone first.
        </p>
      </div>
    );
  }

  return (
    <form className="ms-form" onSubmit={submit} aria-label="See which sites to evaluate against">
      <h2 style={{ marginTop: 0 }}>See which sites to run against</h2>
      <p className="ms-field-hint" style={{ marginBottom: "20px" }}>
        Free, immediate, and nothing is charged. You need a checkpoint we can run — not a
        description of one.
      </p>

      <label htmlFor="plan-team-name">
        <span>Team name</span>
        <input id="plan-team-name" name="planTeamName" type="text" required maxLength={120} />
      </label>

      <label htmlFor="plan-runtime">
        <span>What can we run?</span>
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
        <input id="plan-reference" name="planReference" type="text" required maxLength={2000} />
      </label>

      <label htmlFor="plan-label">
        <span>Call it something (optional)</span>
        <input id="plan-label" name="planLabel" type="text" maxLength={120} placeholder="v1" />
      </label>

      {state.status === "failed" && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>
          {state.message}
        </p>
      )}

      <button className="ms-button ms-button-large" type="submit" disabled={state.status === "working"}>
        {state.status === "working" ? "Working…" : "See my plan"}
      </button>
    </form>
  );
}
