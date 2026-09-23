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
 * questions are one click each and are stored as self-reported facts rather
 * than facts a past-task run could establish. `taskFamily` is stored at
 * `self_reported` and the first real run supersedes it, which is the grade
 * ladder working exactly as designed.
 *
 * The email is what makes this an account rather than a token: it is how we
 * come back to them when a matching site lands, which is the honest answer when
 * the library has nothing for them yet.
 *
 * ## Paying needs an account
 *
 * The plan is free and needs nothing. Running it does: before the pay button,
 * the team is connected to a verified Blueprint account (`RobotTeamAccountStep`),
 * so we know who we are working with. The key this page holds is only what it
 * uses to plan; an agent's key is issued from that account's settings.
 */
import { TaskFacts } from "./TaskFacts";
import { RobotTeamAccountStep } from "./RobotTeamAccountStep";
import type { TaskListingDetails } from "@/types/taskBrowse";
import { useEffect, useState } from "react";

import { robotGateFields } from "@/data/robotTeamQualification";
import { describePlanBlockers } from "@/lib/robotRunBlockers";
import { minTopupUsd } from "@/lib/evaluationPricing";

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
  planToken: string | null;
  availableBalanceUsd: number;
  fundingNeededUsd: number;
  email: string;
  /** The team name from the form, used to seed a new account's workspace. */
  teamName?: string;
  /** Whether a verified account owns this team. Paying waits on it. */
  accountBound?: boolean;
  /** Why each selected site cannot be paid for yet, as the server reports it. */
  lineBlockers?: Array<{ sceneId: string; blockers: string[] }>;
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

/**
 * What the page keeps across the Stripe redirect.
 *
 * The key is shown once and lives in this panel's state, and a redirect to
 * checkout loses that state. Session storage carries the three things the
 * return trip needs -- the key, signed plan, checkpoint, and idempotency key so
 * a reload cannot buy the plan twice. It remains available for result receipts.
 * Nothing in it can credit a balance: that takes a payment.
 */
type QueueStash = {
  agentKey: string;
  checkpointId: string;
  totalCostUsd: number;
  planToken: string;
  idempotencyKey: string;
  email?: string;
  receipt?: Extract<QueueState, { status: "queued" }>;
  plan?: PlanResult;
  sceneId?: string;
};

type StartedRun = { runId: string; sceneId: string; siteLabel: string; costUsd: number };
type RefusedRun = {
  sceneId: string;
  siteLabel: string;
  costUsd: number;
  refusal: string;
  detail: string;
};

type QueueState =
  | { status: "idle" }
  /** Switching the agent on and opening checkout. */
  | { status: "funding" }
  /** Back from checkout; waiting for the credit, then confirming. */
  | { status: "resuming" }
  | { status: "queued"; started: StartedRun[]; refused: RefusedRun[]; reservedUsd: number }
  | { status: "failed"; message: string };

const QUEUE_STASH_KEY = "bp-plan-queue";
/**
 * The plan waiting on a verification email, so the return trip can connect it.
 *
 * Kept in localStorage, not sessionStorage: mail clients open the verification
 * link in a new tab, and a per-tab copy left that tab with no plan and no key
 * to connect. It expires after a day and is cleared as soon as the team is
 * connected, so the key does not outlive the one trip it exists for.
 */
const ACCOUNT_STASH_KEY = "bp-plan-account";
const ACCOUNT_STASH_TTL_MS = 24 * 60 * 60 * 1000;

type AccountStash = { plan: PlanResult; sceneId?: string; savedAtMs?: number };

function writeAccountStash(stash: { plan: PlanResult; sceneId?: string }) {
  try {
    window.localStorage.setItem(ACCOUNT_STASH_KEY, JSON.stringify({ ...stash, savedAtMs: Date.now() }));
  } catch { /* The original tab still works; its "I've verified" button connects. */ }
}

function clearAccountStash() {
  try { window.localStorage.removeItem(ACCOUNT_STASH_KEY); } catch { /* Nothing to clear. */ }
  try { window.sessionStorage.removeItem(ACCOUNT_STASH_KEY); } catch { /* Nothing to clear. */ }
}

function readAccountStash(): AccountStash | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_STASH_KEY) ?? window.sessionStorage.getItem(ACCOUNT_STASH_KEY);
    if (!raw) return null;
    const stash = JSON.parse(raw) as AccountStash;
    if (stash.savedAtMs && Date.now() - stash.savedAtMs > ACCOUNT_STASH_TTL_MS) {
      clearAccountStash();
      return null;
    }
    return stash;
  } catch {
    return null;
  }
}
/** How long the return trip waits for Stripe's webhook to credit the balance. */
const BALANCE_POLL_ATTEMPTS = 24;
const BALANCE_POLL_INTERVAL_MS = 2500;

type ResultReceipt = {
  runId: string;
  sceneId?: string;
  state?: string;
  dispatch?: { startedAtIso?: string } | null;
  resultStatus?: string;
  result?: { observed?: { episodesRun?: number; episodesSucceeded?: number } } | null;
};

function readQueueStash(): QueueStash | null {
  try {
    const raw = window.sessionStorage.getItem(QUEUE_STASH_KEY);
    return raw ? (JSON.parse(raw) as QueueStash) : null;
  } catch {
    return null;
  }
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

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
  { value: "model_artifact", label: "A model artifact (plan only; paid runs need one of the above)" },
] as const;

function familyLabel(value: string) {
  return TASK_FAMILIES.find((family) => family.value === value)?.label ?? "this kind of work";
}

/**
 * The two physical facts asked here, in the intake's own vocabulary.
 *
 * Matching reads geography as a hard constraint. Hardware maturity is carried
 * into the candidate record for inspection, without pretending that a run on
 * a past task verifies present hardware. The other intake gates -- engineer
 * capacity, timeline, budget -- are pilot questions and are not asked here.
 */
const HARDWARE_FIELD = robotGateFields.find((field) => field.id === "hardwareMaturity");
const GEOGRAPHY_FIELD = robotGateFields.find((field) => field.id === "deploymentGeography");

export function RobotTeamPlanPreview({
  /** Scope the plan to one task the team chose in the library. */
  sceneId,
  /** Where checkout opens. Injected so a test can watch it without leaving jsdom. */
  onCheckout,
}: {
  sceneId?: string;
  onCheckout?: (url: string) => void;
} = {}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [hasCheckpoint, setHasCheckpoint] = useState(true);
  const [queue, setQueue] = useState<QueueState>({ status: "idle" });
  const [results, setResults] = useState<{ status: "idle" | "loading" | "failed"; rows: ResultReceipt[] }>({
    status: "idle",
    rows: [],
  });

  async function confirmPlan(stash: QueueStash, cancelled = false) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${stash.agentKey}`,
    };
    const response = await fetch("/api/agent-team/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        checkpointId: stash.checkpointId,
        confirm: true,
        spendMode: "one_time",
        planToken: stash.planToken,
        idempotencyKey: stash.idempotencyKey,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      started?: StartedRun[];
      refused?: RefusedRun[];
      reservedUsd?: number;
      error?: string;
      code?: string;
    };
    if (cancelled) return;
    if (!response.ok) {
      setQueue({
        status: "failed",
        message:
          response.status === 409 || body.code === "eval_plan_invalid"
            ? "This signed plan has expired or changed. Review a fresh plan before spending."
            : body.error || "We could not confirm the runs. Check your balance and run history before retrying.",
      });
      return;
    }
    const receipt: Extract<QueueState, { status: "queued" }> = {
      status: "queued",
      started: Array.isArray(body.started) ? body.started : [],
      refused: Array.isArray(body.refused) ? body.refused : [],
      reservedUsd: Number(body.reservedUsd || 0),
    };
    try { window.sessionStorage.setItem(QUEUE_STASH_KEY, JSON.stringify({ ...stash, receipt })); } catch { /* Receipt remains in this page. */ }
    setQueue(receipt);
  }

  async function loadResults(agentKey: string) {
    setResults((current) => ({ ...current, status: "loading" }));
    try {
      const response = await fetch("/api/agent-team/results", {
        headers: { Authorization: `Bearer ${agentKey}` },
      });
      const body = (await response.json().catch(() => ({}))) as { runs?: ResultReceipt[]; results?: ResultReceipt[] };
      if (!response.ok) throw new Error("results unavailable");
      setResults({ status: "idle", rows: Array.isArray(body.results) ? body.results : Array.isArray(body.runs) ? body.runs : [] });
    } catch {
      setResults((current) => ({ ...current, status: "failed" }));
    }
  }

  // The return trip from checkout. Stripe sends the payer back here with
  // `funded=1`; the credit itself lands on the webhook, so the page waits for
  // the balance to move before confirming. `funded=0` is a cancelled checkout:
  // the stash is dropped and nothing else happens.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = readQueueStash();
    // Back from the verification email: show the plan again so the account
    // step can connect the team and the person can pay for what they saw.
    const awaiting = new URLSearchParams(window.location.search).get("connect") === "1" ? readAccountStash() : null;
    if (awaiting && (!sceneId || awaiting.sceneId === sceneId)) {
      setState({ status: "done", plan: awaiting.plan });
      return;
    }
    // A checkout/receipt belongs to its selected task, including on return.
    // Preserve another task's saved access without displaying or buying it here.
    if (sceneId && saved && saved.sceneId !== sceneId) return;
    if (saved?.plan) setState({ status: "done", plan: saved.plan });
    if (saved?.receipt?.status === "queued") { setQueue(saved.receipt); return; }
    const funded = new URLSearchParams(window.location.search).get("funded");
    if (funded === "0") {
      if (saved) setQueue({ status: "failed", message: "Checkout was cancelled. Review your saved plan or check your results before continuing." });
      return;
    }
    if (funded !== "1") return;
    const stash = readQueueStash();
    if (!stash) return;

    let cancelled = false;
    setQueue({ status: "resuming" });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${stash.agentKey}`,
    };

    void (async () => {
      let availableUsd = 0;
      for (let attempt = 0; attempt < BALANCE_POLL_ATTEMPTS; attempt += 1) {
        const me = await fetch("/api/agent-team/me", { headers });
        const body = (await me.json().catch(() => ({}))) as {
          balance?: { availableUsd?: number };
        };
        availableUsd = Number(body.balance?.availableUsd || 0);
        if (me.ok && availableUsd >= stash.totalCostUsd) break;
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, BALANCE_POLL_INTERVAL_MS));
      }
      if (cancelled) return;
      if (availableUsd < stash.totalCostUsd) {
        setQueue({
          status: "failed",
          message:
            "The payment has not reached your available balance yet. Check your results or retry this same request shortly.",
        });
        return;
      }

      if (cancelled) return;
      await confirmPlan(stash, cancelled);
    })().catch(() => {
      if (!cancelled) {
        setQueue({
          status: "failed",
          message:
            "We could not reach Blueprint. Check your run history before retrying with the same request.",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Fund the plan and go to checkout.
   *
   * A one-time purchase never enables autonomous spend. Existing balance can
   * confirm immediately; otherwise Stripe adds only the shortfall (subject to
   * its $50 minimum), and the signed plan is confirmed on return.
   */
  async function fundAndQueue(plan: PlanResult) {
    if (queue.status === "funding" || !plan.checkpointId) return;
    setQueue({ status: "funding" });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${plan.agentKey}`,
    };
    try {
      if (!plan.planToken) {
        setQueue({ status: "failed", message: "This plan is missing its signature. Review a fresh plan before spending." });
        return;
      }

      const stash: QueueStash = {
        agentKey: plan.agentKey,
        checkpointId: plan.checkpointId,
        totalCostUsd: plan.totalCostUsd,
        planToken: plan.planToken,
        idempotencyKey: newIdempotencyKey(),
        email: plan.email,
        plan, sceneId,
      };
      window.sessionStorage.setItem(QUEUE_STASH_KEY, JSON.stringify(stash));

      if (plan.fundingNeededUsd <= 0) {
        await confirmPlan(stash);
        return;
      }

      const topupUsd = Math.max(plan.fundingNeededUsd, minTopupUsd);

      const funding = await fetch("/api/agent-team/funding", {
        method: "POST",
        headers,
        body: JSON.stringify({ amountUsd: topupUsd, ...(sceneId ? { returnSceneId: sceneId } : {}) }),
      });
      const body = (await funding.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!funding.ok || !body.checkoutUrl) {
        setQueue({
          status: "failed",
          message: body.error || "Payments are not available right now. Check your balance before retrying.",
        });
        return;
      }

      (onCheckout ?? ((url: string) => window.location.assign(url)))(body.checkoutUrl);
    } catch {
      setQueue({ status: "failed", message: "We could not complete that request. Check your balance and run history before retrying." });
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "working") return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const email = read("planEmail");
    const teamName = read("planTeamName");
    const taskFamily = read("planTaskFamily");
    const reference = read("planReference");
    const hardwareMaturity = read("planHardware");
    const deploymentGeography = read("planGeography");

    if (!email || !teamName) {
      setState({ status: "failed", message: "We need a work email and a team name." });
      return;
    }
    if (!hardwareMaturity || !deploymentGeography) {
      setState({
        status: "failed",
        message: "Tell us where the hardware is today and whether you would deploy in Austin.",
      });
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
          // Structured, so the matcher reads them rather than a person.
          embodiment: read("planEmbodiment") || undefined,
          hardwareMaturity,
          deploymentGeography,
          website: read("planWebsite") || undefined,
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
      let planToken: string | null = null;
      let availableBalanceUsd = 0;
      let fundingNeededUsd = 0;
      let planUnavailable = false;
      let accountBound = false;
      let lineBlockers: Array<{ sceneId: string; blockers: string[] }> = [];
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
          planToken?: string;
          availableBalanceUsd?: number;
          spendableNowUsd?: number;
          fundingNeededUsd?: number;
          accountBound?: boolean;
          lineBlockers?: Array<{ sceneId: string; blockers: string[] }>;
        };
        if (planned.ok) {
          lineBlockers = Array.isArray(plan.lineBlockers) ? plan.lineBlockers : [];
          rows = Array.isArray(plan.selected) ? plan.selected : [];
          totalCostUsd = Number(plan.totalCostUsd || 0);
          planToken = typeof plan.planToken === "string" ? plan.planToken : null;
          availableBalanceUsd = Number(plan.availableBalanceUsd ?? plan.spendableNowUsd ?? 0);
          fundingNeededUsd = Number(plan.fundingNeededUsd ?? totalCostUsd);
          accountBound = plan.accountBound === true;
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
          planToken,
          availableBalanceUsd,
          fundingNeededUsd,
          email,
          teamName,
          accountBound,
          lineBlockers,
          taskFamilyLabel: familyLabel(taskFamily),
          planUnavailable,
        },
      });
    } catch {
      setState({ status: "failed", message: "We could not reach Blueprint. Try again shortly." });
    }
  }

  /** Re-plan with the same key: connecting an account is what makes a plan payable. */
  async function refreshPlan(plan: PlanResult) {
    try {
      const response = await fetch("/api/agent-team/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${plan.agentKey}` },
        body: JSON.stringify({ checkpointId: plan.checkpointId, ...(sceneId ? { sceneId } : {}) }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        selected?: Row[]; totalCostUsd?: number; planToken?: string; availableBalanceUsd?: number;
        fundingNeededUsd?: number; accountBound?: boolean;
        lineBlockers?: Array<{ sceneId: string; blockers: string[] }>;
      };
      if (!response.ok) throw new Error("Plan unavailable");
      setState({
        status: "done",
        plan: {
          ...plan,
          rows: Array.isArray(body.selected) ? body.selected : plan.rows,
          totalCostUsd: Number(body.totalCostUsd ?? plan.totalCostUsd),
          planToken: typeof body.planToken === "string" ? body.planToken : null,
          availableBalanceUsd: Number(body.availableBalanceUsd ?? plan.availableBalanceUsd),
          fundingNeededUsd: Number(body.fundingNeededUsd ?? plan.fundingNeededUsd),
          accountBound: body.accountBound !== false,
          lineBlockers: Array.isArray(body.lineBlockers) ? body.lineBlockers : [],
        },
      });
    } catch {
      setState({ status: "done", plan: { ...plan, accountBound: true, planToken: null } });
    }
  }

  async function reviewSavedPlan() {
    const stash = readQueueStash();
    if (!stash) return;
    try {
      const response = await fetch("/api/agent-team/plan", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${stash.agentKey}` },
        body: JSON.stringify({ checkpointId: stash.checkpointId, ...(stash.sceneId ? { sceneId: stash.sceneId } : {}) }) });
      if (!response.ok) throw new Error("Plan unavailable");
      const body = await response.json();
      const me = await fetch("/api/agent-team/me", { headers: { Authorization: `Bearer ${stash.agentKey}` } })
        .then((reply) => (reply.ok ? reply.json() : null)).catch(() => null) as { accountBound?: boolean } | null;
      const plan: PlanResult = { teamId: body.teamId || stash.plan?.teamId || "", agentKey: stash.agentKey,
        teamName: stash.plan?.teamName, accountBound: Boolean(me?.accountBound),
        checkpointId: stash.checkpointId, rows: Array.isArray(body.selected) ? body.selected : [],
        totalCostUsd: Number(body.totalCostUsd || 0), planToken: body.planToken || null,
        availableBalanceUsd: Number(body.availableBalanceUsd || 0), fundingNeededUsd: Number(body.fundingNeededUsd || 0),
        email: stash.email || "", taskFamilyLabel: stash.plan?.taskFamilyLabel || "this task", planUnavailable: false,
        lineBlockers: Array.isArray(body.lineBlockers) ? body.lineBlockers : [] };
      setState({ status: "done", plan }); setQueue({ status: "idle" });
    } catch { setQueue({ status: "failed", message: "The updated plan could not be loaded. Your saved result access remains available." }); }
  }

  if (queue.status === "failed") {
    return <div className="ms-form">
      <h2>Review your run request</h2><p role="alert">{queue.message}</p>
      <button className="ms-button" type="button" onClick={() => void reviewSavedPlan()}>Review updated plan</button>
      <button className="ms-text-link" type="button" onClick={() => { const stash = readQueueStash(); if (stash) void loadResults(stash.agentKey); }}>Check results</button>
      {results.status === "failed" && <p role="alert">Results could not be loaded. Try again.</p>}
      {results.rows.length > 0 && <ul aria-label="Run results">{results.rows.map(result => <li key={result.runId}>
        {result.result?.observed ? `${result.result.observed.episodesSucceeded || 0} of ${result.result.observed.episodesRun || 0} episodes` : result.dispatch?.startedAtIso ? "Running" : "Queued"}
      </li>)}</ul>}
    </div>;
  }

  if (queue.status === "resuming") {
    return (
      <div className="ms-form" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>Confirming your runs…</h2>
        <p className="ms-field-hint">
          Waiting for the payment to reach your balance, then queueing the runs you approved.
        </p>
      </div>
    );
  }

  if (queue.status === "queued") {
    const count = queue.started.length;
    return (
      <div className="ms-form" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>
          Queued {count} run{count === 1 ? "" : "s"}.
        </h2>
        <p className="ms-field-hint">
          ${queue.reservedUsd} is reserved and settles only for runs that actually happen. Anything
          that does not run is released.
        </p>
        {queue.started.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0" }}>
            {queue.started.map((run) => (
              <li key={run.runId} style={{ borderTop: "1px solid var(--ms-rule)", padding: "10px 0" }}>
                <strong>{run.siteLabel}</strong> <span className="ms-field-hint">${run.costUsd}</span>
              </li>
            ))}
          </ul>
        )}
        {queue.refused.length > 0 && (
          <>
            <p style={{ marginBottom: "6px" }}>Not started:</p>
            <ul style={{ paddingLeft: "20px", margin: "0 0 16px" }}>
              {queue.refused.map((run) => (
                <li key={run.sceneId} className="ms-field-hint">
                  {run.siteLabel}: {run.detail}
                </li>
              ))}
            </ul>
          </>
        )}
        {/* What happens next, stated as it is: the account email hears when a
            result reports, and Settings lists every run and the balance. */}
        <p className="ms-field-hint">
          The runs are queued. We email you when each one reports, and your account's{" "}
          <a href="/settings?tab=agent">Settings → Agent access</a> lists every run and your balance.
        </p>
        <button className="ms-button" type="button" onClick={() => {
          const stash = readQueueStash();
          if (stash) void loadResults(stash.agentKey);
        }} disabled={results.status === "loading"}>
          {results.status === "loading" ? "Checking results…" : "Check results"}
        </button>
        {results.status === "failed" && <p role="alert">Results could not be loaded. Try again.</p>}
        {results.rows.length > 0 && (
          <ul aria-label="Run results">
            {results.rows.map((result) => (
              <li key={result.runId}>
                <strong>{queue.started.find(run => run.runId === result.runId)?.siteLabel || "Evaluation run"}</strong>: {result.result ? "Result received" : result.state === "blocked" ? "Ended without a result" : result.state === "abandoned" ? "Hold released" : result.dispatch?.startedAtIso ? "Running" : "Queued"}
                {result.result?.observed?.episodesRun
                  ? ` — ${result.result.observed.episodesSucceeded || 0} of ${result.result.observed.episodesRun} episodes`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
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

            <p style={{ borderTop: "1px solid var(--ms-rule)", paddingTop: "16px", marginBottom: "12px" }}>
              <strong>${plan.totalCostUsd} to run all of them.</strong> Nothing is charged until you
              confirm this signed plan.
            </p>
            {/* Paying needs a known customer: connect the team to a verified
                account first. The plan above stays free to read either way. */}
            {!plan.accountBound && (
              <RobotTeamAccountStep
                agentKey={plan.agentKey}
                email={plan.email}
                teamName={plan.teamName ?? ""}
                returnSceneId={sceneId}
                onAwaitingVerification={() => writeAccountStash({ plan, sceneId })}
                onConnected={() => {
                  clearAccountStash();
                  void refreshPlan(plan);
                }}
              />
            )}
            {/* The action that replaced "we will be in touch": the same three
                calls an agent makes, with a person holding the card. */}
            <button
              className="ms-button ms-button-large"
              type="button"
              onClick={() => void fundAndQueue(plan)}
              disabled={queue.status === "funding" || !plan.planToken || !plan.accountBound}
            >
              {queue.status === "funding"
                ? "Opening checkout…"
                : plan.fundingNeededUsd > 0
                  ? `Add $${Math.max(plan.fundingNeededUsd, minTopupUsd)} and queue these runs`
                  : "Queue these runs from your balance"}
            </button>
            <p className="ms-field-hint" style={{ marginTop: "10px" }}>
              {plan.fundingNeededUsd > 0
                ? `Your balance covers $${plan.availableBalanceUsd}. Stripe adds $${Math.max(plan.fundingNeededUsd, minTopupUsd)}; any amount above the $${plan.fundingNeededUsd} shortfall remains in your balance.`
                : `Your existing $${plan.availableBalanceUsd} balance covers this one-time plan.`}
              {" "}The signed selection expires after 15 minutes; if it expires, you will review a fresh plan before spending.
            </p>
            {plan.accountBound && !plan.planToken && (
              <div role="status">
                {(describePlanBlockers(plan.lineBlockers).length
                  ? describePlanBlockers(plan.lineBlockers)
                  : ["This site isn't ready for paid runs yet. Nothing is charged, and the plan stays free to read."]
                ).map((sentence) => <p key={sentence}>{sentence}</p>)}
              </div>
            )}

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

        <p className="ms-field-hint" style={{ marginTop: "28px" }}>
          Want your agent to plan and run evaluations on its own? Once your account is set up, issue
          it a key from <a className="ms-text-link" href="/settings?tab=agent">Settings → Agent access</a>.
        </p>
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

      <label htmlFor="plan-website">
        <span>
          Website or spec sheet <span className="ms-optional">(optional)</span>
        </span>
        <span className="ms-field-hint">
          We read published figures into proposals a person checks. Nothing on a page becomes a
          claim about your robot without a run or a reviewer.
        </span>
        <input id="plan-website" name="planWebsite" type="url" maxLength={500} placeholder="https://" />
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

      {HARDWARE_FIELD && (
        <label htmlFor="plan-hardware">
          <span>{HARDWARE_FIELD.question}</span>
          <select id="plan-hardware" name="planHardware" defaultValue="" required>
            <option value="">Select…</option>
            {HARDWARE_FIELD.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {GEOGRAPHY_FIELD && (
        <label htmlFor="plan-geography">
          <span>{GEOGRAPHY_FIELD.question}</span>
          <span className="ms-field-hint">{GEOGRAPHY_FIELD.hint}</span>
          <select id="plan-geography" name="planGeography" defaultValue="" required>
            <option value="">Select…</option>
            {GEOGRAPHY_FIELD.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

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
