import { useEffect, useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";

type Choice = { provider_terms_reference: string; accepted_by: string; choice_digest: string };
type Terms = { digest: string; label: string; url: string };

/** Optional owner-only choice, recorded before this capture receives a scene grant. */
export function AnthropicAuthoringChoice({ token }: { token: string }) {
  const [terms, setTerms] = useState<Terms | null>(null);
  const [available, setAvailable] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/site-task-brief/${encodeURIComponent(token)}/authoring-provider`)
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setTerms(data.terms ?? null);
        setAvailable(data.available === true);
        setChoice(data.accepted ?? null);
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [token]);

  if (!terms || (!available && !choice)) return null;
  if (choice) return <p className="ms-field-hint">Claude Opus 5.5 authoring was selected for this capture by {choice.accepted_by}.</p>;

  async function save() {
    if (!terms || !name.trim() || !agreed) return;
    setState("saving");
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/authoring-provider`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ authoring_provider: "anthropic", accepted: true,
          accepted_by: name.trim(), provider_terms_reference: terms.digest }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.accepted) throw new Error("choice_not_recorded");
      setChoice(data.accepted);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return <details className="ms-task-interest">
    <summary>Choose Claude Opus 5.5 for scene authoring</summary>
    <p>For this capture, Blueprint can send video-derived images and task evidence to Anthropic
      for CAD and Blender authoring. This choice applies only to this capture. Blueprint funds
      the same fixed $25 development test.</p>
    <p><a href={terms.url} target="_blank" rel="noopener noreferrer">Review {terms.label}</a></p>
    <label>Your name <input value={name} onChange={event => setName(event.target.value)} maxLength={200} /></label>
    <label><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
      I authorize Anthropic processing for this capture under the linked terms.</label>
    <button type="button" className="ms-button" disabled={!name.trim() || !agreed || state === "saving"} onClick={save}>
      {state === "saving" ? "Saving…" : "Select Claude for this capture"}
    </button>
    {state === "failed" && <p role="alert">The choice was not recorded. Please try again before scene preparation starts.</p>}
  </details>;
}
