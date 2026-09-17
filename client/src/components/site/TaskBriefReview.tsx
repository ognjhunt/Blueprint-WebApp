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
 */

import { useMemo, useState } from "react";

import { gateFields } from "@/data/siteTaskQualification";
import { withCsrfHeader } from "@/lib/csrf";

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
}

type Verdict = {
  disposition: string;
  stage: string;
  nextAction: string;
  stillNeeded: string[];
  beforeRecording: string[];
};

type State =
  | { status: "reviewing" }
  | { status: "confirming" }
  | { status: "confirmed"; verdict: Verdict }
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

export function TaskBriefReview(props: { token: string; brief: DraftedBrief; onConfirmed?: () => void }) {
  const [state, setState] = useState<State>({ status: "reviewing" });
  const [name, setName] = useState("");

  // The operator's corrections, keyed by gate id, and the gates they said they
  // do not know. A correction wins over our reading; an "unknown" clears it.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [unknown, setUnknown] = useState<Set<string>>(new Set());

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

  async function confirm() {
    if (!name.trim()) {
      setState({ status: "failed", message: "Please add your name so we know who confirmed this." });
      return;
    }
    setState({ status: "confirming" });
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(props.token)}/confirm`, {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          confirmedBy: name.trim(),
          answers,
          unknown: [...unknown],
        }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<Verdict> & { error?: string };
      if (!response.ok) {
        setState({ status: "failed", message: body.error || "We could not save that. Please try again." });
        return;
      }
      setState({
        status: "confirmed",
        verdict: {
          disposition: body.disposition ?? "",
          stage: body.stage ?? "",
          nextAction: body.nextAction ?? "",
          stillNeeded: body.stillNeeded ?? [],
          beforeRecording: body.beforeRecording ?? [],
        },
      });
      props.onConfirmed?.();
    } catch {
      setState({ status: "failed", message: "We could not reach Blueprint. Please try again shortly." });
    }
  }

  if (state.status === "confirmed") {
    return (
      <div className="ms-form" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>Thank you — that is confirmed.</h2>
        <p className="ms-field-hint">{state.verdict.nextAction}</p>
        {state.verdict.stillNeeded.length > 0 && (
          <p className="ms-field-hint">
            Still needed before a robot team can evaluate this: {state.verdict.stillNeeded.join(", ")}.
            None of it stops you filming.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="ms-form">
      <h2 style={{ marginTop: 0 }}>Here is what we understood. Fix anything we got wrong.</h2>
      <p className="ms-field-hint" style={{ marginBottom: "20px" }}>
        We read what you sent and drafted this. Confirming it is what lets us act on it — you are
        not filling in a form, you are correcting ours.
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
        onClick={confirm}
        disabled={state.status === "confirming"}
      >
        {state.status === "confirming" ? "Confirming…" : "This is right — confirm it"}
      </button>
    </div>
  );
}
