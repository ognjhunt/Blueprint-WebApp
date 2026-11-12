import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

/** Which place a candidate is (the server maps the Pipeline's fixed label to one of these); not shown as words. */
export type PlaceKind = "named_place" | "words_place" | "surface_end" | "farthest_spot" | "site_choice" | "other";
export type TaskDestinationChoiceView = {
  questionDigest: string;
  objectLabel: string;
  guessedCandidateId: string;
  /** In the order the Pipeline draws them on the picture, lettered A, B, C, D. */
  candidates: Array<{ id: string; place: PlaceKind }>;
  /** The private picture through a 15-minute ticket for this job only. Without one the question is not shown. */
  pictureUrl: string | null;
};

/**
 * The page's own words, except the object's name as read from the video (`objectWord`). The places are named by the
 * letter the picture draws beside each, in the list's order.
 */
export const placeName = (index: number) => `Place ${String.fromCharCode(65 + index)}`;
export const OUR_GUESS = " (our guess)";
export const DESTINATION_SENTENCE = (object: string) => `We will test moving the ${object} from here to here.`;
// The Pipeline draws A (the guess) in green and B to D in blue, each with its letter; the start in orange.
export const DESTINATION_PICTURE_KEY = "Orange: where it starts. Each letter marks a place the object could go. A, in green, is our guess.";
/** Beside results tested before the site picked another place. Nothing else changes, and no new test is promised. */
export const DESTINATION_CORRECTED_AFTER_RESULTS = "These results were tested with the place you have since corrected.";
export const DESTINATION_KEEPS_GOING = "Nothing is needed from you: your job keeps going either way.";
export const DESTINATION_ANSWERED = "We have your answer about where the object goes.";

/**
 * The object's name as read from the video (the Pipeline's `semantic_label`), shown only when it is letters, digits
 * and spaces; else "object".
 */
export const objectWord = (label: string) => /^[A-Za-z0-9][A-Za-z0-9 ]{0,59}$/.test(label.trim()) ? label.trim().toLowerCase() : "object";

export function isDestinationChoice(value: unknown): value is TaskDestinationChoiceView {
  const item = value as Partial<TaskDestinationChoiceView> | null;
  return Boolean(item) && typeof item!.questionDigest === "string" && /^sha256:[a-f0-9]{64}$/.test(item!.questionDigest)
    && typeof item!.objectLabel === "string" && typeof item!.guessedCandidateId === "string"
    && Array.isArray(item!.candidates) && item!.candidates.length >= 2 && item!.candidates.length <= 4
    && item!.candidates.some(row => row?.id === item!.guessedCandidateId)
    && item!.candidates.every(row => typeof row?.id === "string" && typeof row.place === "string")
    // The question cannot be answered blind: only with its picture, from the ticketed route.
    && typeof item!.pictureUrl === "string" && item!.pictureUrl.startsWith("/api/website-destination-pictures/");
}

/**
 * An optional confirmation of where the job moves the object: the job never waits on it, and no email asks for it.
 * Shown only once its picture has loaded; "This is right" needs nothing more; "The place is wrong" opens the others.
 */
export function TaskDestinationChoice({ token, question, onAnswered }: {
  token: string; question: TaskDestinationChoiceView; onAnswered: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const guessIndex = question.candidates.findIndex(row => row.id === question.guessedCandidateId);
  if (guessIndex < 0 || !question.pictureUrl || failed) return null;
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
  if (done) return <section aria-label="Where the object goes"><p className="ms-field-hint" role="status">{DESTINATION_ANSWERED}</p></section>;
  return <section aria-label="Where the object goes" hidden={!loaded}>
    <p>{DESTINATION_SENTENCE(object)}</p>
    <img src={question.pictureUrl} referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
      alt={`A frame from your video: the ${object} outlined where it starts, and the places it could go, each with its letter.`}
      style={{ display: "block", maxWidth: "100%", height: "auto" }} />
    <p className="ms-field-hint">{DESTINATION_PICTURE_KEY}</p>
    <p className="ms-field-hint">{`We will use ${placeName(guessIndex)}. ${DESTINATION_KEEPS_GOING}`}</p>
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <button type="button" className="ms-text-button" disabled={busy} onClick={() => void send({ kind: "confirm_guess" })}>This is right</button>
      <button type="button" className="ms-text-button" aria-expanded={open} aria-controls="task-destination-options"
        onClick={() => setOpen(value => !value)}>The place is wrong</button>
    </div>
    {open && <div id="task-destination-options">
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: "12px 0" }}>
        <legend className="ms-field-hint">Where should it go?</legend>
        {question.candidates.map((row, index) => row.id === question.guessedCandidateId ? null
          : <label key={row.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: "6px 0" }}>
            <input type="radio" name="task-destination-choice" value={row.id} checked={selected === row.id}
              onChange={() => setSelected(row.id)} style={{ width: "auto", minHeight: 0, marginTop: "4px" }} />
            <span>{placeName(index)}</span>
          </label>)}
      </fieldset>
      <p className="ms-field-hint">{`${placeName(guessIndex)}${OUR_GUESS} is the one we use now.`}</p>
      <button type="button" className="ms-button" disabled={!selected || busy}
        onClick={() => selected && void send({ kind: "other_candidate", candidate_id: selected })}>
        {busy ? "Saving your answer…" : "Use this place"}
      </button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

/** Once the site has answered about the place: only that, nothing else changes. */
export function TaskDestinationAnswered() {
  return <section aria-label="Where the object goes"><p className="ms-field-hint" role="status">{DESTINATION_ANSWERED}</p></section>;
}
