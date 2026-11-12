import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

/** Which place a candidate is (the server maps the Pipeline's fixed label to one of these). */
export type PlaceKind = "named_place" | "words_place" | "surface_end" | "farthest_spot" | "site_choice" | "other";
export type TaskDestinationChoiceView = {
  questionDigest: string;
  objectLabel: string;
  guessedCandidateId: string;
  candidates: Array<{ id: string; place: PlaceKind }>;
  /** The private picture through a 15-minute ticket for this job only; null when there is none. */
  pictureUrl: string | null;
};

/** The page's own words for each place: never the Pipeline's text. */
export const PLACE_WORDS: Readonly<Record<PlaceKind, string>> = {
  named_place: "The place your job names",
  words_place: "The place we found from your job's words",
  surface_end: "The other end of the same surface",
  farthest_spot: "The spot on the same surface farthest from where it starts",
  site_choice: "The place you picked",
  other: "Another place on the same surface",
};
export const DESTINATION_SENTENCE = (object: string) => `We will test moving the ${object} from here to here.`;
export const DESTINATION_PICTURE_KEY = "Orange: where it starts. Green: where it goes.";
export const DESTINATION_NO_PICTURE = (object: string, place: string) => `We will test moving the ${object} to ${place.charAt(0).toLowerCase()}${place.slice(1)}.`;
export const DESTINATION_KEEPS_GOING = "Nothing is needed from you: your job keeps going either way.";
export const DESTINATION_THANKS = "Thank you. Your job keeps going.";

/** A plain object word, or "object". The label comes from the job's own reading, so it is checked before it is shown. */
export const objectWord = (label: string) => /^[A-Za-z0-9][A-Za-z0-9 '-]{0,59}$/.test(label.trim()) ? label.trim().toLowerCase() : "object";

export function isDestinationChoice(value: unknown): value is TaskDestinationChoiceView {
  const item = value as Partial<TaskDestinationChoiceView> | null;
  return Boolean(item) && typeof item!.questionDigest === "string" && /^sha256:[a-f0-9]{64}$/.test(item!.questionDigest)
    && typeof item!.objectLabel === "string" && typeof item!.guessedCandidateId === "string"
    && Array.isArray(item!.candidates) && item!.candidates.length >= 2
    && item!.candidates.some(row => row?.id === item!.guessedCandidateId)
    && item!.candidates.every(row => typeof row?.id === "string" && Object.hasOwn(PLACE_WORDS, row.place))
    && (item!.pictureUrl === null || (typeof item!.pictureUrl === "string" && item!.pictureUrl.startsWith("/api/website-destination-pictures/")));
}

/**
 * An optional confirmation of where the job moves the object: the job never waits on it, and no email asks for it.
 * "This is right" needs nothing more; "The place is wrong" opens the other places.
 */
export function TaskDestinationChoice({ token, question, onAnswered }: {
  token: string; question: TaskDestinationChoiceView; onAnswered: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const guess = question.candidates.find(row => row.id === question.guessedCandidateId);
  const others = question.candidates.filter(row => row.id !== question.guessedCandidateId);
  if (!guess) return null;
  const object = objectWord(question.objectLabel);
  async function send(choice: { kind: "confirm_guess" } | { kind: "other_candidate"; candidate_id: string }) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/task-target-choice`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        body: JSON.stringify({ questionDigest: question.questionDigest, choice }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Your answer could not be saved. Try again shortly.");
      setDone(true);
      onAnswered();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer could not be saved. Try again shortly."); }
    finally { setBusy(false); }
  }
  if (done) return <section aria-label="Where the object goes"><p className="ms-field-hint" role="status">{DESTINATION_THANKS}</p></section>;
  return <section aria-label="Where the object goes">
    {question.pictureUrl ? <>
      <p>{DESTINATION_SENTENCE(object)}</p>
      <img src={question.pictureUrl} referrerPolicy="no-referrer" alt={`A frame from your video: the ${object} outlined where it starts, and where it goes in green.`}
        style={{ display: "block", maxWidth: "100%", height: "auto" }} />
      <p className="ms-field-hint">{DESTINATION_PICTURE_KEY}</p>
    </> : <p>{DESTINATION_NO_PICTURE(object, PLACE_WORDS[guess.place])}</p>}
    <p className="ms-field-hint">{DESTINATION_KEEPS_GOING}</p>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <button type="button" className="ms-text-button" disabled={busy} onClick={() => void send({ kind: "confirm_guess" })}>This is right</button>
      <button type="button" className="ms-text-button" aria-expanded={open} aria-controls="task-destination-options"
        onClick={() => setOpen(value => !value)}>The place is wrong</button>
    </div>
    {open && <div id="task-destination-options">
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: "12px 0" }}>
        <legend className="ms-field-hint">Where should it go?</legend>
        {others.map(row => <label key={row.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "6px 0" }}>
          <input type="radio" name="task-destination-choice" value={row.id} checked={selected === row.id}
            onChange={() => setSelected(row.id)} style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
          <span>{PLACE_WORDS[row.place]}</span>
        </label>)}
      </fieldset>
      <button type="button" className="ms-button" disabled={!selected || busy}
        onClick={() => selected && void send({ kind: "other_candidate", candidate_id: selected })}>
        {busy ? "Saving your answer…" : "Use this place"}
      </button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
