import { useState } from "react";
import type { OutreachReviewSummary } from "./OutreachApprovalReview";

type Draft = Record<string, unknown> & { subject: string; body: string; usedFactIds: string[]; outreachContract: unknown };
type RevisionResult = { review: OutreachReviewSummary };

/** Ordinary message editing plus optional source/wording anchor repair. The
 * server preserves research and history and rechecks each save. */
export function CommunicationsDraftEditor({ payload, review, onSave }: {
  payload: Record<string, unknown>; review?: OutreachReviewSummary;
  onSave: (input: { expectedReviewDigest: string; output: Record<string, unknown> }) => Promise<RevisionResult>;
}) {
  const envelope = payload.communications as { job?: { intent?: string }; output?: Draft; brief?: { facts?: { id: string; claim: string }[] } } | undefined;
  const [editing, setEditing] = useState<{ digest: string; output: Draft; contract: string } | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [result, setResult] = useState<OutreachReviewSummary | null>(null);
  const start = () => {
    if (!envelope?.output || !review?.digest) return;
    setEditing({ digest: review.digest, output: structuredClone(envelope.output), contract: JSON.stringify(envelope.output.outreachContract, null, 2) });
    setError(""); setResult(null);
  };
  const update = (field: string, value: unknown) => setEditing(current => current && ({ ...current, output: { ...current.output, [field]: value } }));
  const save = async () => {
    if (!editing) return;
    setPending(true); setError("");
    try {
      const output = { ...editing.output, outreachContract: JSON.parse(editing.contract) };
      const saved = await onSave({ expectedReviewDigest: editing.digest, output });
      setResult(saved.review); setEditing(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save this draft revision."); }
    finally { setPending(false); }
  };
  const facts = envelope?.brief?.facts ?? [];
  const refs = [...new Set([...facts.map(fact => fact.id), ...(editing?.output.usedFactIds ?? [])])];
  let anchors: Record<string, any> | null = null;
  try {
    const parsed = editing ? JSON.parse(editing.contract) : null;
    anchors = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch { /* Preserve an unfinished JSON edit. */ }
  const anchorFields = [
    ["Sender identity", ["senderIdentity"]], ["Bounded offer", ["value", "offer"]],
    ["Offer limits", ["value", "limits"]], ["One learning question", ["question"]],
    ["Recipient choice", ["recipientChoice"]],
  ] as const;
  const updateAnchor = (path: readonly string[], value: string) => {
    if (!editing || !anchors) return;
    const next = structuredClone(anchors);
    let target = next;
    for (const key of path.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
      target = target[key];
    }
    target[path.at(-1)!] = value;
    setEditing({ ...editing, contract: JSON.stringify(next, null, 2) });
  };
  return <div className="w-full space-y-3 border border-runway-line p-3 text-sm">
    {!editing ? <button type="button" className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
      disabled={!envelope?.output || !review?.digest} onClick={start}>Revise draft</button> : <>
      <p>Edit this saved draft, then revalidate it. Saving keeps it pending approval.</p>
      {envelope?.job?.intent === "outreach" ? <p>Saving adds the approved mailing and unsubscribe footer. The previous full message stays in private revision history.</p> : null}
      <label className="block">Draft subject<input className="mt-1 block w-full border border-runway-line bg-transparent p-2"
        value={editing.output.subject} maxLength={1000} disabled={pending} onChange={event => update("subject", event.target.value)} /></label>
      <label className="block">Draft message<textarea className="mt-1 block min-h-48 w-full border border-runway-line bg-transparent p-2"
        value={editing.output.body} maxLength={20000} disabled={pending} onChange={event => update("body", event.target.value)} /></label>
      <fieldset><legend>Facts used in this message</legend>{refs.map(id => <label key={id} className="mt-2 flex items-start gap-2">
        <input type="checkbox" disabled={pending} checked={editing.output.usedFactIds.includes(id)} onChange={event => update("usedFactIds",
          event.target.checked ? [...editing.output.usedFactIds, id] : editing.output.usedFactIds.filter(ref => ref !== id))} />
        <span>{id}: {facts.find(fact => fact.id === id)?.claim ?? "Unknown fact reference — remove it or restore verified research."}</span>
      </label>)}</fieldset>
      <details><summary>Review anchors</summary>
        <p className="my-2">If wording changes, update the matching identity, public detail, offer, limits, question and recipient-choice anchors. Sources must match the saved research.</p>
        {anchors ? anchorFields.map(([label, path]) => <label key={label} className="mt-2 block">{label}<input
          className="mt-1 block w-full border border-runway-line bg-transparent p-2" disabled={pending}
          value={path.reduce<any>((value, key) => value?.[key], anchors) ?? ""} onChange={event => updateAnchor(path, event.target.value)} /></label>) : null}
        <details className="mt-3"><summary>All review anchors (JSON)</summary>
          <label className="block">Draft review anchors (JSON)<textarea className="mt-1 block min-h-48 w-full border border-runway-line bg-transparent p-2 font-mono text-xs"
            value={editing.contract} disabled={pending} onChange={event => setEditing({ ...editing, contract: event.target.value })} /></label>
        </details>
      </details>
      <button type="button" className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" disabled={pending} onClick={() => void save()}>
        {pending ? "Saving revision…" : "Save and revalidate"}</button>
      <button type="button" className="ml-2 runway-cta-ghost min-h-0 px-4 py-2 text-sm" disabled={pending} onClick={() => { setEditing(null); setError(""); }}>Cancel edit</button>
    </>}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <p role="status">{result.hardChecksPassed ? "Revision saved. It is ready for human review." : `Revision saved. Repair these remaining issues: ${result.blockers.join(", ")}.`} Sending remains separately controlled.</p> : null}
  </div>;
}
