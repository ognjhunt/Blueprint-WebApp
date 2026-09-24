/**
 * The brief we drafted, for the operator to correct — and the button that
 * turns their correction into an attestation.
 *
 * ## Why this is the piece that was missing
 *
 * Tier 2 built the whole mechanism: a brief drafted from the operator's
 * evidence, a confirmation that writes their answers as `operator_stated`, and
 * the readiness ladder that follows. It shipped with a server route, the
 * attestation, and tests — and no button. So a site could not confirm, nothing
 * could reach `qualified` through the new path, and the dead end I said I fixed
 * was still a dead end, moved from "impossible in principle" to "impossible
 * because there is nowhere to click". This is the click.
 *
 * ## What the operator sees, and why the basis is shown
 *
 * Each proposed answer carries what it rests on — a description they gave, an
 * observation from the footage, or an assumption we made — and our one-line
 * reasoning. An answer whose basis the operator cannot see is one they cannot
 * meaningfully correct, so the basis is on the page, not hidden behind a
 * verdict. An assumption is never pre-filled as an answer; it is shown as an
 * open question, because confirming our guess back to ourselves would establish
 * nothing.
 *
 * ## "I do not know" is a first-class answer
 *
 * It leaves the gate blank and records the question as outstanding. It never
 * loops, and it never blocks the confirmation — a blank gate holds whatever it
 * holds downstream, but the operator has still done their part.
 *
 * ## The same step saves the site and decides the listing
 *
 * Blueprint builds a scene only for a site saved to an account, so this is
 * where the account comes in: right before we spend money on the site, never
 * on the first form. Password or Google, then one verification click attaches
 * the site. The listing question is asked here too, as a required yes or no,
 * because a card nobody finds is a site no robot team sees.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";

import { gateFields } from "@/data/siteTaskQualification";
import { deploymentPathOptions, pilotConsiderationOptions, type SitePilotIntent } from "@/data/sitePilotIntent";
import { withCsrfHeader } from "@/lib/csrf";
import {
  attachSiteClaim,
  claimVerificationUrl,
  friendlyAuthError,
  setUpSiteWorkspace,
} from "@/lib/siteClaim";
import {
  createPasswordAccount,
  currentAuthUser,
  sendAccountVerification,
  signInPasswordAccount,
  signInWithGoogleAccount,
  watchAuth,
} from "@/lib/accountAuth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import { opportunityLabels, type TaskListingDetails } from "@/types/taskBrowse";

type Basis = "description" | "observation" | "measurement" | "assumption";

export interface ProposedAnswer {
  fieldId: string;
  value: string;
  basis: Basis;
  reading: string;
}

export interface DraftedBrief {
  summary: string;
  captureMode: string;
  proposed: ProposedAnswer[];
  unresolved: string[];
  /** The operator's last confirmed answers, when the brief is being edited. */
  operatorAnswers?: Record<string, string> | null;
  operatorUnknown?: string[] | null;
  successCriteria?: { successDefinition: string | null; successRate: number | null; cycleTimeSeconds: number | null; unknown: boolean } | null;
  pilotIntent?: SitePilotIntent | null;
}

type Screening = { headline: string; detail: string; bookingUrl: string | null };

/** Whether the site is saved to an account yet, from the brief GET (owner link only). */
export interface SiteAccount {
  claimed: boolean;
  email: string | null;
  claimToken: string | null;
}

type AccountOutcome =
  | { status: "none" }
  | { status: "saved" }
  | { status: "verify"; user: User }
  | { status: "failed"; message: string; user: User | null };

const blankListing: TaskListingDetails = {
  title: "", taskFamily: "", siteType: "", region: "", objects: "",
  cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "not_seeking",
};

type Verdict = {
  disposition: string;
  /** Present when our screen has not cleared the site, so no scene is built yet. */
  screening: Screening | null;
  stage: string;
  nextAction: string;
  stillNeeded: string[];
  beforeRecording: string[];
};

type State =
  | { status: "reviewing" }
  | { status: "confirming" }
  | { status: "confirmed"; verdict: Verdict; listed: boolean | "failed" }
  | { status: "failed"; message: string };

/** How each basis reads to the operator. Our word for where the answer came from. */
const BASIS_LABEL: Record<Basis, string> = {
  description: "from what you told us",
  observation: "from your footage",
  measurement: "from a measurement you gave",
  assumption: "our guess — please confirm",
};

function fieldQuestion(fieldId: string): string {
  return gateFields.find((field) => field.id === fieldId)?.question ?? fieldId;
}

function fieldOptions(fieldId: string): readonly { value: string; label: string }[] {
  return gateFields.find((field) => field.id === fieldId)?.options ?? [];
}

function optionLabel(fieldId: string, value: string): string {
  return fieldOptions(fieldId).find((option) => option.value === value)?.label ?? value;
}

export function TaskBriefReview(props: {
  token: string;
  brief: DraftedBrief;
  /** Absent or null: the page could not tell, so no account step is shown. */
  account?: SiteAccount | null;
  onConfirmed?: () => void;
}) {
  const [state, setState] = useState<State>({ status: "reviewing" });
  const [name, setName] = useState("");
  const [successDefinition, setSuccessDefinition] = useState(props.brief.successCriteria?.successDefinition ?? "");
  const [successRate, setSuccessRate] = useState(props.brief.successCriteria?.successRate?.toString() ?? "");
  const [cycleTimeSeconds, setCycleTimeSeconds] = useState(props.brief.successCriteria?.cycleTimeSeconds?.toString() ?? "");
  const [successUnknown, setSuccessUnknown] = useState(props.brief.successCriteria?.unknown ?? false);
  const [pilotConsideration, setPilotConsideration] = useState<SitePilotIntent["pilotConsideration"] | "">(props.brief.pilotIntent?.pilotConsideration ?? "");
  const [deploymentPath, setDeploymentPath] = useState<SitePilotIntent["deploymentPath"] | "">(props.brief.pilotIntent?.deploymentPath ?? "");

  // The listing decision. Null until they choose: a yes or no is required, so
  // nobody skips past the card without seeing it.
  const [listChoice, setListChoice] = useState<"list" | "not_now" | null>(null);
  const [listing, setListing] = useState<TaskListingDetails>(blankListing);
  const [listingConsent, setListingConsent] = useState(false);

  // Saving the site to an account. Skipped when it is already claimed.
  const needsAccount = Boolean(props.account && !props.account.claimed && props.account.claimToken);
  const [accountMode, setAccountMode] = useState<"create" | "signin">("create");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [signedIn, setSignedIn] = useState<User | null>(null);
  const [accountOutcome, setAccountOutcome] = useState<AccountOutcome>({ status: "none" });
  const accountUser = useRef<User | null>(null);
  const ownerEmail = props.account?.email?.toLowerCase() ?? null;
  const signedInAsOwner = Boolean(signedIn && ownerEmail && signedIn.email?.toLowerCase() === ownerEmail);

  useEffect(() => {
    if (!needsAccount) return;
    let unsubscribe: (() => void) | undefined;
    let live = true;
    // Loaded on demand: the camera page should not pay for auth until the
    // operator reaches the one step that needs it.
    void watchAuth((user) => setSignedIn(user)).then((stop) => {
      if (live) unsubscribe = stop;
      else stop();
    }).catch(() => undefined);
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [needsAccount]);

  // The operator's corrections, keyed by gate id, and the gates they said they
  // do not know. A correction wins over our reading; an "unknown" clears it.
  // Editing a confirmed brief starts from what the operator said last time.
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...(props.brief.operatorAnswers ?? {}) }));
  const [unknown, setUnknown] = useState<Set<string>>(() => new Set(props.brief.operatorUnknown ?? []));

  // Everything to show as a row: our confirmable proposals, plus the gates we
  // could not settle from the evidence. Sorted so the questions we actually
  // need come before the ones we are only confirming.
  const rows = useMemo(() => {
    const confirmable = props.brief.proposed.filter((answer) => answer.basis !== "assumption");
    const proposedIds = new Set(confirmable.map((answer) => answer.fieldId));
    const openIds = [
      ...props.brief.proposed.filter((answer) => answer.basis === "assumption").map((a) => a.fieldId),
      ...props.brief.unresolved.filter((id) => !proposedIds.has(id)),
    ];
    return {
      confirmable,
      open: [...new Set(openIds)].filter((id) => gateFields.some((field) => field.id === id)),
    };
  }, [props.brief]);

  function setAnswer(fieldId: string, value: string) {
    setUnknown((current) => {
      const next = new Set(current);
      next.delete(fieldId);
      return next;
    });
    setAnswers((current) => ({ ...current, [fieldId]: value }));
  }

  function markUnknown(fieldId: string) {
    setAnswers((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setUnknown((current) => new Set(current).add(fieldId));
  }

  function problem(): string | null {
    if (!name.trim()) return "Please add your name so we know who confirmed this.";
    if (!successUnknown && !successDefinition.trim()) return "Describe a successful cycle, or select I don't know yet.";
    if (!pilotConsideration || !deploymentPath) return "Answer the two pilot and deployment questions, even if you are undecided.";
    if (!listChoice) return "Choose whether to show this task to robot teams.";
    if (listChoice === "list") {
      if (listing.title.trim().length < 8) return "Describe the task for the public card in a few words.";
      if (listing.taskFamily.trim().length < 2) return "Add a task family for the public card.";
      if (!listingConsent) return "Confirm you reviewed the public card before listing it.";
    }
    return null;
  }

  /** The account to save the site to, created or signed in as needed. */
  async function accountFor(google: boolean): Promise<User | null> {
    if (!needsAccount) return null;
    const existing = signedInAsOwner ? await currentAuthUser() : null;
    if (existing) return existing;
    if (!terms) throw new Error("Accept the Terms and Privacy Policy to save the site to your account.");
    let user: User;
    if (google) {
      user = await signInWithGoogleAccount();
    } else {
      if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Choose a password of ${MIN_PASSWORD_LENGTH} characters or more.`);
      user = accountMode === "create"
        ? await createPasswordAccount(ownerEmail!, password)
        : await signInPasswordAccount(ownerEmail!, password);
    }
    if (user.email?.toLowerCase() !== ownerEmail) {
      throw new Error(`Use the account for ${ownerEmail}, the email this task was submitted with.`);
    }
    return user;
  }

  async function confirm(options: { google?: boolean } = {}) {
    const missing = problem();
    if (missing) {
      setState({ status: "failed", message: missing });
      return;
    }
    setState({ status: "confirming" });

    // The account comes first: if it cannot be created, nothing is confirmed
    // and the operator can fix it and try again.
    let user: User | null = null;
    try {
      user = await accountFor(Boolean(options.google));
      accountUser.current = user;
    } catch (accountError) {
      setState({ status: "failed", message: friendlyAuthError(accountError, "We could not save your account.") });
      return;
    }

    let verdict: Verdict;
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(props.token)}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          confirmedBy: name.trim(),
          answers,
          unknown: [...unknown],
          successCriteria: {
            successDefinition: successUnknown ? null : successDefinition.trim(),
            successRate: successUnknown || !successRate ? null : Number(successRate),
            cycleTimeSeconds: successUnknown || !cycleTimeSeconds ? null : Number(cycleTimeSeconds),
            unknown: successUnknown,
          },
          pilotIntent: { pilotConsideration, deploymentPath },
        }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<Verdict> & {
        error?: string;
      };
      if (!response.ok) {
        setState({ status: "failed", message: body.error || "We could not save that. Please try again." });
        return;
      }
      verdict = {
        disposition: body.disposition ?? "",
        screening: body.screening ?? null,
        stage: body.stage ?? "",
        nextAction: body.nextAction ?? "",
        stillNeeded: body.stillNeeded ?? [],
        beforeRecording: body.beforeRecording ?? [],
      };
    } catch {
      setState({ status: "failed", message: "We could not reach Blueprint. Please try again shortly." });
      return;
    }

    // The public card, when they chose one. A failure here does not undo the
    // confirmation; the card can be saved again from the task page.
    let listed: boolean | "failed" = false;
    if (listChoice === "list") {
      try {
        const response = await fetch(`/api/task-listings/owner/${encodeURIComponent(props.token)}`, {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({ enabled: true, details: listing, consent: true }),
        });
        listed = response.ok ? true : "failed";
      } catch {
        listed = "failed";
      }
    }

    setState({ status: "confirmed", verdict, listed });
    props.onConfirmed?.();
    if (user) await saveToAccount(user);
  }

  /** Attach now when verified; otherwise send the one verification click. */
  async function saveToAccount(user: User) {
    const context = { email: ownerEmail, siteName: null };
    try {
      if (user.emailVerified) {
        await attachSiteClaim(props.account!.claimToken!, user, context, terms);
        setAccountOutcome({ status: "saved" });
        return;
      }
      await setUpSiteWorkspace(user, context, terms);
      await sendAccountVerification(user, claimVerificationUrl(props.account!.claimToken!));
      setAccountOutcome({ status: "verify", user });
    } catch (claimError) {
      setAccountOutcome({
        status: "failed",
        user,
        message: friendlyAuthError(claimError, "We could not save the site to your account."),
      });
    }
  }

  async function checkVerified(user: User) {
    try {
      await user.reload();
      if (!user.emailVerified) {
        setAccountOutcome({
          status: "failed",
          user,
          message: "Your email is not verified yet. Open the link we sent, then try again.",
        });
        return;
      }
      await user.getIdToken(true);
      await attachSiteClaim(props.account!.claimToken!, user, { email: ownerEmail, siteName: null }, terms);
      setAccountOutcome({ status: "saved" });
    } catch (claimError) {
      setAccountOutcome({
        status: "failed",
        user,
        message: friendlyAuthError(claimError, "We could not save the site to your account."),
      });
    }
  }

  if (state.status === "confirmed") {
    return (
      <div className="ms-form" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>Thank you — that is confirmed.</h2>
        {state.verdict.screening ? (
          <>
            <p style={{ fontWeight: 500 }}>{state.verdict.screening.headline}</p>
            <p className="ms-field-hint">{state.verdict.screening.detail}</p>
            {state.verdict.screening.bookingUrl && (
              <a className="ms-button" href={state.verdict.screening.bookingUrl} target="_blank" rel="noreferrer">
                Book the call
              </a>
            )}
          </>
        ) : (
          <p className="ms-field-hint">{state.verdict.nextAction}</p>
        )}
        {!state.verdict.screening && state.verdict.stillNeeded.length > 0 && (
          <p className="ms-field-hint">
            Still needed before a robot team can evaluate this: {state.verdict.stillNeeded.join(", ")}.
            None of it stops you filming.
          </p>
        )}
        {state.listed === true && (
          <p className="ms-field-hint">Your task card is in the robot-team library. You can edit or hide it below.</p>
        )}
        {state.listed === "failed" && (
          <p role="alert" className="ms-field-hint">Your task card was not saved. Add it from “Share a task card” below.</p>
        )}
        {accountOutcome.status === "saved" && (
          <p className="ms-field-hint">
            Saved to your account. <a className="ms-text-link" href="/app">Open your workspace</a>
          </p>
        )}
        {accountOutcome.status === "verify" && (
          <div aria-live="polite">
            <p style={{ fontWeight: 500 }}>Check your inbox.</p>
            <p className="ms-field-hint">
              We sent a link to {accountOutcome.user.email}. One click verifies your email and saves
              this site to your account. We start building your scene after that.
            </p>
            <button className="ms-button" type="button" onClick={() => checkVerified(accountOutcome.user)}>
              I’ve verified my email
            </button>
          </div>
        )}
        {accountOutcome.status === "failed" && (
          <div>
            <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>{accountOutcome.message}</p>
            {accountOutcome.user && (
              <button className="ms-button" type="button" onClick={() => checkVerified(accountOutcome.user!)}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const listingField = (key: keyof TaskListingDetails, label: string, maxLength: number, placeholder?: string) => (
    <label key={key} htmlFor={`listing-${key}`}>
      <span>{label}</span>
      <input
        id={`listing-${key}`}
        value={listing[key]}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          setListing({ ...listing, [key]: event.target.value });
          setListingConsent(false);
        }}
      />
    </label>
  );

  // Only say we drafted answers when we did. With brief reading off, every
  // question arrives open, and the honest framing is a short set of questions.
  const drafted = rows.confirmable.length > 0;

  return (
    <div className="ms-form">
      <h2 style={{ marginTop: 0 }}>
        {drafted ? "Here is what we understood. Fix anything we got wrong." : "A few questions about the task"}
      </h2>
      <p className="ms-field-hint" style={{ marginBottom: "20px" }}>
        {drafted
          ? "We read what you sent and drafted this. Confirming it is what lets us act on it — you are not filling in a form, you are correcting ours."
          : "These tell us whether a robot evaluation will hold up at your site. Answer what you know; anything you are not sure about can stay open, and we cover it on a short call."}
      </p>

      <p style={{ fontWeight: 500 }}>{props.brief.summary}</p>

      {/* What we think we know, each with where it came from. The operator can
          override any of it, or say they do not know. */}
      {rows.confirmable.map((answer) => (
        <fieldset key={answer.fieldId} style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "10px 0" }}>
          <legend style={{ padding: "0 6px", fontWeight: 600 }}>
            {fieldQuestion(answer.fieldId)}
          </legend>
          <p style={{ margin: "0 0 8px" }}>
            {unknown.has(answer.fieldId)
              ? "You said you are not sure."
              : optionLabel(answer.fieldId, answers[answer.fieldId] ?? answer.value)}{" "}
            <span className="ms-field-hint">({BASIS_LABEL[answer.basis]})</span>
          </p>
          <p className="ms-field-hint" style={{ marginTop: 0 }}>{answer.reading}</p>
          <label htmlFor={`fix-${answer.fieldId}`} style={{ marginTop: "8px" }}>
            <span className="ms-field-hint">Change it</span>
            <select
              id={`fix-${answer.fieldId}`}
              value={unknown.has(answer.fieldId) ? "" : answers[answer.fieldId] ?? answer.value}
              onChange={(event) =>
                event.target.value === "__unknown"
                  ? markUnknown(answer.fieldId)
                  : setAnswer(answer.fieldId, event.target.value)
              }
            >
              {fieldOptions(answer.fieldId).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="__unknown">I am not sure</option>
            </select>
          </label>
        </fieldset>
      ))}

      {/* What the evidence could not settle. Real questions, and "not sure" is a
          real answer that does not block. */}
      {rows.open.map((fieldId) => (
        <fieldset key={fieldId} style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "10px 0" }}>
          <legend style={{ padding: "0 6px", fontWeight: 600 }}>{fieldQuestion(fieldId)}</legend>
          <p className="ms-field-hint" style={{ marginTop: 0 }}>
            We could not tell from what you sent. If you know, tell us — if not, that is fine.
          </p>
          <select
            aria-label={fieldQuestion(fieldId)}
            value={unknown.has(fieldId) ? "__unknown" : answers[fieldId] ?? ""}
            onChange={(event) =>
              event.target.value === "__unknown" || event.target.value === ""
                ? markUnknown(fieldId)
                : setAnswer(fieldId, event.target.value)
            }
          >
            <option value="">Choose…</option>
            {fieldOptions(fieldId).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="__unknown">I am not sure</option>
          </select>
        </fieldset>
      ))}

      <fieldset style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "18px 0" }}>
        <legend style={{ padding: "0 6px", fontWeight: 600 }}>What counts as success?</legend>
        <p className="ms-field-hint">Confirm the outcome a robot should achieve. These are your targets for the task, not a claim that any robot meets them.</p>
        <label htmlFor="success-definition"><span>Successful cycle</span>
          <input id="success-definition" value={successDefinition} onChange={(event) => setSuccessDefinition(event.target.value)} disabled={successUnknown} maxLength={1000} placeholder="For example, the carton reaches the pallet without damage" />
        </label>
        <label htmlFor="success-rate"><span>Minimum success rate (%)</span>
          <input id="success-rate" type="number" min="0" max="100" step="0.1" value={successRate} onChange={(event) => setSuccessRate(event.target.value)} disabled={successUnknown} placeholder="If known" />
        </label>
        <label htmlFor="cycle-time"><span>Maximum cycle time (seconds)</span>
          <input id="cycle-time" type="number" min="0.01" max="86400" step="0.01" value={cycleTimeSeconds} onChange={(event) => setCycleTimeSeconds(event.target.value)} disabled={successUnknown} placeholder="If known" />
        </label>
        <label htmlFor="success-unknown"><input id="success-unknown" type="checkbox" checked={successUnknown} onChange={(event) => setSuccessUnknown(event.target.checked)} /> I don't know the success criteria yet</label>
      </fieldset>

      <fieldset style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "18px 0" }}>
        <legend style={{ padding: "0 6px", fontWeight: 600 }}>What could follow this evaluation?</legend>
        <p className="ms-field-hint">These answers describe your current plans. A pilot and any deployment would need separate agreement.</p>
        <label htmlFor="pilot-consideration"><span>If the evaluation shows a plausible fit, would you consider a physical pilot here?</span>
          <select id="pilot-consideration" value={pilotConsideration} onChange={(event) => setPilotConsideration(event.target.value as SitePilotIntent["pilotConsideration"])}>
            <option value="">Choose…</option>
            {pilotConsiderationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label htmlFor="deployment-path"><span>If a pilot meets the agreed targets, what could happen next?</span>
          <select id="deployment-path" value={deploymentPath} onChange={(event) => setDeploymentPath(event.target.value as SitePilotIntent["deploymentPath"])}>
            <option value="">Choose…</option>
            {deploymentPathOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "18px 0 10px" }}>
        <legend style={{ padding: "0 6px", fontWeight: 600 }}>Show this task to robot teams?</legend>
        <p className="ms-field-hint" style={{ marginTop: 0 }}>
          A card in the task library is how robot teams find your site. It shows only the text you
          write here. Your name, contact details, footage and scene stay private.
        </p>
        <label className="ms-check-row">
          <input type="radio" name="list-choice" checked={listChoice === "list"} onChange={() => setListChoice("list")} />
          Yes, list it in the task library
        </label>
        <label className="ms-check-row">
          <input type="radio" name="list-choice" checked={listChoice === "not_now"} onChange={() => setListChoice("not_now")} />
          Not now
        </label>
        {listChoice === "list" && (
          <div aria-label="Public task card">
            {listingField("title", "Describe the task without naming your site", 160, "Move sealed cartons from a conveyor onto a pallet")}
            {listingField("taskFamily", "Task family", 60, "Palletizing")}
            {listingField("objects", "Objects (optional)", 160)}
            {listingField("region", "Region (optional)", 80, "US Midwest")}
            <label htmlFor="listing-opportunity">
              <span>Pilot availability</span>
              <select
                id="listing-opportunity"
                value={listing.opportunity}
                onChange={(event) => {
                  setListing({ ...listing, opportunity: event.target.value as TaskListingDetails["opportunity"] });
                  setListingConsent(false);
                }}
              >
                {Object.entries(opportunityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="ms-check-row">
              <input type="checkbox" checked={listingConsent} onChange={(event) => setListingConsent(event.target.checked)} />
              I reviewed this text for identifying details and am authorized to make it public. I can hide the card at any time.
            </label>
          </div>
        )}
      </fieldset>

      {needsAccount && (
        <fieldset style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "10px 0" }}>
          <legend style={{ padding: "0 6px", fontWeight: 600 }}>Save this site to your account</legend>
          {signedInAsOwner ? (
            <p className="ms-field-hint" style={{ marginTop: 0 }}>Saving to your account as {signedIn?.email}.</p>
          ) : (
            <>
              <p className="ms-field-hint" style={{ marginTop: 0 }}>
                We build your scene once the site is saved to an account. Your account is where you
                follow the task, see results, and hide it from robot teams at any time. Use{" "}
                {ownerEmail}, the email you sent this task from.
              </p>
              <label htmlFor="account-password">
                <span>{accountMode === "create" ? "Choose a password" : "Your password"}</span>
                <input
                  id="account-password"
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete={accountMode === "create" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p className="ms-form-note">
                <a
                  className="ms-text-link"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setAccountMode(accountMode === "create" ? "signin" : "create");
                  }}
                >
                  {accountMode === "create" ? "I already have an account" : "Create a new account instead"}
                </a>
              </p>
              <label className="ms-check-row">
                <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
                <span>
                  I accept the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
                </span>
              </label>
            </>
          )}
        </fieldset>
      )}

      <label htmlFor="confirm-name">
        <span>Your name</span>
        <span className="ms-field-hint">So we know who confirmed the brief. This is the attestation.</span>
        <input id="confirm-name" type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} />
      </label>

      {state.status === "failed" && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>{state.message}</p>
      )}

      <button
        className="ms-button ms-button-large"
        type="button"
        onClick={() => confirm()}
        disabled={state.status === "confirming"}
      >
        {state.status === "confirming"
          ? "Confirming…"
          : needsAccount && !signedInAsOwner
            ? "This is right — confirm and save"
            : "This is right — confirm it"}
      </button>
      {needsAccount && !signedInAsOwner && (
        <button
          className="ms-button"
          type="button"
          onClick={() => confirm({ google: true })}
          disabled={state.status === "confirming"}
          style={{ marginTop: "8px" }}
        >
          Confirm and save with Google
        </button>
      )}
    </div>
  );
}
