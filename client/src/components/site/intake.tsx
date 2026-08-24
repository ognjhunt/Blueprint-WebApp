/**
 * Shared intake controls.
 *
 * Both intakes — `/site-task` and `/robot-intake` — ask gated enum questions,
 * show a live verdict, and disclose their expensive tier only once the gates
 * pass. That shape is deliberate and identical on both sides, so it lives here
 * rather than being written twice and drifting.
 *
 * The one thing worth stating: `VerdictPanel` renders whatever
 * `triageGateAnswers` decided and nothing else. It has no opinion of its own,
 * and it is never the source of a decision — the server recomputes every
 * verdict on the submitted payload regardless of what a viewer saw here.
 */
import type { ReactNode } from "react";
import { Check, CircleAlert, Info } from "lucide-react";

import type { TriageDisposition, TriageResult } from "@/lib/gateTriage";

const controlClass =
  "mt-3 w-full rounded-sm border border-runway-line bg-runway-black px-3 py-2.5 text-[14px] text-runway-text outline-none transition placeholder:text-runway-faint focus:border-runway-signal";

/** A labelled select. Never rendered as a bare native control. */
export function Choice({
  id,
  question,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  question: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14.5px] font-medium leading-6 text-runway-text">
        {question}
      </label>
      {hint ? <p className="mt-1.5 text-[12.5px] leading-5 text-runway-faint">{hint}</p> : null}
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={controlClass}
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  textarea = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14.5px] font-medium leading-6 text-runway-text">
        {label}
      </label>
      {hint ? <p className="mt-1.5 text-[12.5px] leading-5 text-runway-faint">{hint}</p> : null}
      {textarea ? (
        <textarea
          id={id}
          rows={5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      )}
    </div>
  );
}

const dispositionTone: Record<TriageDisposition, string> = {
  qualified: "border-runway-green/40 text-runway-green",
  needs_conversation: "border-runway-amber/40 text-runway-amber",
  not_now: "border-runway-line text-runway-faint",
};

export const dispositionLabel: Record<TriageDisposition, string> = {
  qualified: "Clears the screen",
  needs_conversation: "Needs a short call",
  not_now: "Not yet",
};

/**
 * The live verdict, mirroring what the server will decide.
 *
 * Showing this before submission is the point: a blocked respondent learns
 * which answer blocked them and what would flip it, rather than waiting three
 * days for a form to email them a no. It is more useful to them and cheaper for
 * us than a call.
 */
export function VerdictPanel({
  result,
  totalGates,
  headline,
  qualifiedNote,
  footnote,
}: {
  result: TriageResult;
  totalGates: number;
  headline: string;
  /** Shown only when the gates clear. */
  qualifiedNote: string;
  /** Shown under the panel when blocked — why sending it anyway is still useful. */
  footnote?: ReactNode;
}) {
  const blocked = result.disposition === "not_now";

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="border border-runway-line bg-runway-panel p-6">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${dispositionTone[result.disposition]}`}
        >
          {dispositionLabel[result.disposition]}
        </span>

        {result.incomplete && !blocked ? (
          <p className="mt-5 text-[13px] leading-6 text-runway-mute">
            {totalGates - result.unanswered.length} of {totalGates} answered.
          </p>
        ) : (
          <p className="mt-5 text-[13.5px] leading-6 text-runway-text">{headline}</p>
        )}

        {result.blockers.length > 0 ? (
          <ul className="mt-5 space-y-4 border-t border-runway-line pt-5">
            {result.blockers.map((blocker) => (
              <li key={blocker.fieldId} className="flex items-start gap-3">
                <CircleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-runway-faint"
                  aria-hidden="true"
                />
                <span className="text-[12.5px] leading-6 text-runway-mute">
                  <strong className="font-medium text-runway-text">{blocker.answer}.</strong>{" "}
                  {blocker.detail}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {result.openQuestions.length > 0 ? (
          <ul className="mt-5 space-y-4 border-t border-runway-line pt-5">
            {result.openQuestions.map((question) => (
              <li key={question.fieldId} className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-runway-amber" aria-hidden="true" />
                <span className="text-[12.5px] leading-6 text-runway-mute">{question.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {result.disposition === "qualified" ? (
          <div className="mt-5 flex items-start gap-3 border-t border-runway-line pt-5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-runway-green" aria-hidden="true" />
            <span className="text-[12.5px] leading-6 text-runway-mute">{qualifiedNote}</span>
          </div>
        ) : null}
      </div>

      {blocked && footnote ? (
        <p className="mt-5 text-[12.5px] leading-6 text-runway-faint">{footnote}</p>
      ) : null}
    </aside>
  );
}
