import { useState } from "react";

export type OutreachReviewSummary = {
  hardChecksPassed: boolean;
  blockers: string[];
  digest: string | null;
  semanticReviewRequired: Record<string, string>;
};
export type OutreachApproval = { digest: string; checks: Record<string, "pass"> };

type HypothesisBrief = { qualification?: { openQuestions?: unknown }; facts?: { id?: unknown; claim?: unknown; sourceUrl?: unknown }[] };

/** An outreach-ready hypothesis draft: its one question and the quotes that prove operator, site and
 * task. Draft only: it can be revised and saved to Gmail Drafts, never approved or sent from here. */
function HypothesisDraftReview({ review, payload, brief }: { review?: OutreachReviewSummary; payload: Record<string, unknown>; brief?: HypothesisBrief }) {
  const questions = brief?.qualification?.openQuestions;
  const historicalQuestion = Array.isArray(questions) && typeof questions[0] === "string" ? questions[0] : "";
  const contract = payload.outreachContract as { version?: unknown; questions?: { question?: unknown }[] } | undefined;
  const launch = contract?.version === "blueprint.outreach.v3";
  const currentQuestion = Array.isArray(contract?.questions) ? contract.questions[0]?.question : undefined;
  const question = launch ? typeof currentQuestion === "string" ? currentQuestion : "" : historicalQuestion;
  const quotes = (Array.isArray(brief?.facts) ? brief!.facts : []).filter(fact => typeof fact?.claim === "string");
  return (
    <div className="w-full space-y-3 border border-runway-line p-3 text-sm">
      <p className="font-medium">Hypothesis · draft only</p>
      <p>The source quotes support this hypothesis; interest and fit remain open. You can revise this draft and save it to Gmail Drafts. It cannot be approved or sent from Blueprint.</p>
      {typeof payload.from === "string" ? <p>From: {payload.from}</p> : null}
      <p>To: {String(payload.to ?? "")}</p>
      <p>Subject: {String(payload.subject ?? "")}</p>
      <p className="whitespace-pre-wrap">{String(payload.body ?? "")}</p>
      <div>
        <p className="font-medium">The one question</p>
        {question ? <p><q>{question}</q></p> : <p role="alert">This draft has no published question and cannot be used.</p>}
      </div>
      {launch && historicalQuestion ? <details>
        <summary>Historical research question · unresolved</summary>
        <p>{historicalQuestion}</p>
      </details> : null}
      <div>
        <p className="font-medium">Proven quotes</p>
        <ul className="list-disc pl-5">
          {quotes.map((fact, index) => (
            <li key={typeof fact.id === "string" ? fact.id : index}>
              <q>{String(fact.claim)}</q>
              {typeof fact.sourceUrl === "string" && /^https?:\/\//.test(fact.sourceUrl)
                ? <> · <a href={fact.sourceUrl} target="_blank" rel="noreferrer noopener">source</a></> : null}
            </li>
          ))}
        </ul>
      </div>
      {review && !review.hardChecksPassed ? <p role="alert">Revise this draft: {review.blockers.join(", ") || "review contract is missing"}.</p> : null}
    </div>
  );
}

/** Human attestation for the existing approval queue, bound to its current digest. An outreach-ready
 * hypothesis (`draftOnly`, or a brief with a qualification block) shows no approve control at all. */
export function OutreachApprovalReview({ review, payload, pending, onApprove, sendingEnabled, draftOnly }: {
  review?: OutreachReviewSummary;
  payload: Record<string, unknown>;
  pending: boolean;
  onApprove: (review: OutreachApproval) => void;
  sendingEnabled?: boolean;
  draftOnly?: boolean;
}) {
  const digest = review?.digest ?? null;
  const [decisions, setDecisions] = useState<{ digest: string | null; checked: string[] }>({ digest, checked: [] });
  const brief = (payload.communications as { brief?: HypothesisBrief } | undefined)?.brief;
  if (draftOnly || brief?.qualification) return <HypothesisDraftReview review={review} payload={payload} brief={brief} />;
  const checked = decisions.digest === digest ? decisions.checked : [];
  const prompts = Object.entries(review?.semanticReviewRequired ?? {});
  const ready = sendingEnabled !== false && review?.hardChecksPassed && digest && prompts.length > 0 && prompts.every(([key]) => checked.includes(key));

  return (
    <div className="w-full space-y-3 border border-runway-line p-3 text-sm">
      <p className="font-medium">Sending review</p>
      <p>These checkboxes approve sending. They are not required to save an already approved revision to Gmail Drafts. Read the exact message and verify its sources before approving each review item.</p>
      {typeof payload.from === "string" ? <p>From: {payload.from}</p> : null}
      <p>To: {String(payload.to ?? "")}</p>
      <p>Subject: {String(payload.subject ?? "")}</p>
      <p className="whitespace-pre-wrap">{String(payload.body ?? "")}</p>
      <details>
        <summary className="cursor-pointer">Source evidence and draft limits</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify({
          evidence: payload.outreachContext, draft: payload.outreachContract,
          communications: payload.communications,
        }, null, 2)}</pre>
      </details>
      {typeof payload.transportBody === "string" ? <details><summary>Full message including footer</summary>
        <pre className="whitespace-pre-wrap break-words">{payload.transportBody}</pre></details> : null}
      {sendingEnabled === false ? <p role="status">Sending is disabled. This saved Blueprint draft is awaiting review and release authorization.</p> : null}
      {!review?.hardChecksPassed ? (
        <p role="alert">Revise this draft before approval: {review?.blockers.join(", ") || "review contract is missing"}.</p>
      ) : prompts.map(([key, prompt]) => (
        <label key={key} className="flex items-start gap-2">
          <input type="checkbox" checked={checked.includes(key)} disabled={pending} onChange={(event) => {
            const next = event.currentTarget.checked ? [...checked, key] : checked.filter((item) => item !== key);
            setDecisions({ digest, checked: next });
          }} />
          <span>{prompt}</span>
        </label>
      ))}
      <button type="button" className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" disabled={!ready || pending}
        onClick={() => {
          if (ready && digest) onApprove({ digest, checks: Object.fromEntries(prompts.map(([key]) => [key, "pass" as const])) });
        }}>
        Approve outreach
      </button>
    </div>
  );
}
