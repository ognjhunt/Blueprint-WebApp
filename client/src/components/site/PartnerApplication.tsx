import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import { applyForEarlyAccess, EarlyAccessApplicationError } from "@/lib/robotTeamAccess";
import { companyJobReturnPath } from "@/lib/authReturnPath";

/**
 * The one application a deployment company sends to see jobs (on `/partners`; `/contact/robot-team` points here). It
 * asks only what approval by hand needs: who you are, what jobs you deliver with which robots, and where. Fields the
 * older forms asked (supported systems, pilot terms, a test site) stay on the records that hold them; the server keeps
 * them when a pending company applies again.
 */
export function PartnerApplication() {
  const [interactive, setInteractive] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const savedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => setInteractive(true), []);
  useEffect(() => { if (state === "saved") savedHeading.current?.focus(); }, [state]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const data = new FormData(event.currentTarget);
    const returnToJob = companyJobReturnPath(new URLSearchParams(window.location.search).get("next"));
    const read = (key: string) => String(data.get(key) ?? "").trim();
    setState("sending");
    setError("");
    try {
      await applyForEarlyAccess({
        partnerRole: "deployment",
        name: read("name"),
        email: read("email"),
        company: read("company"),
        website: read("website") || undefined,
        robot: read("robot"),
        workWanted: read("workWanted"),
        region: read("region"),
        acceptedTerms: true,
        optionalUpdates: data.get("optionalUpdates") === "on",
        ...(returnToJob ? { returnToJob } : {}),
      });
      setState("saved");
    } catch (failure) {
      setError(failure instanceof EarlyAccessApplicationError ? failure.message : "We could not confirm that your application was saved. Please try again.");
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }

  if (state === "saved") return (
    <div className="ms-partner-receipt" role="status">
      <h2 ref={savedHeading} tabIndex={-1}>Your application is saved.</h2>
      <p>We'll email you if your company is approved to see jobs. Once approved, you get an email for each new job.</p>
    </div>
  );

  return (
    <form className="ms-form ms-partner-form" onSubmit={submit} method="post" aria-label="Deployment company application">
      <h2>Apply to see jobs</h2>
      <p>We approve each company before it sees jobs. Once approved, you get an email for each new job. Nothing is charged today.</p>
      <fieldset disabled={!interactive || state === "sending"}>
        <legend className="sr-only">Your company</legend>
        <div className="ms-form-row">
          <label>Your name<input name="name" autoComplete="name" maxLength={120} required /></label>
          <label>Work email<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
        </div>
        <label>Company<input name="company" autoComplete="organization" maxLength={160} required /></label>
        <label>What jobs can you deliver?
          <textarea name="workWanted" rows={2} maxLength={1200} required placeholder="For example, packing boxes" />
        </label>
        <label>Which robots do you deploy?
          <textarea name="robot" rows={2} maxLength={1200} required placeholder="Robot models and software" />
        </label>
        <label>Where can you deploy?
          <input name="region" maxLength={300} required placeholder="Cities, states or countries you cover" />
        </label>
        <details>
          <summary>Add your website</summary>
          <label>Company website<input name="website" type="url" pattern="https?://.+" autoComplete="url" maxLength={300} placeholder="https://example.com" title="Enter a website beginning with https:// or http://"
            onInvalid={event => { const details = event.currentTarget.closest("details"); if (details) details.open = true; }} /></label>
        </details>
        {/* Job emails are the service and start on once approved (owner, 2026-11-20); this box is Blueprint updates only. */}
        <label className="ms-check-row"><input name="optionalUpdates" type="checkbox" />Also email me Blueprint updates. Optional; unsubscribe anytime.</label>
      </fieldset>
      <p className="ms-form-note">By applying, you agree to our <a href={TERMS_URL}>Terms of Service</a> and <a href={PRIVACY_URL}>Privacy Policy</a>.</p>
      {error && <p role="alert">{error} Your entries are still here. You can also <a href="mailto:hello@tryblueprint.io">contact us</a>.</p>}
      <button className="ms-button" disabled={!interactive || state === "sending"}>{state === "sending" ? "Saving…" : "Apply"}<ArrowRight size={18} aria-hidden="true" /></button>
      <noscript><p>Enable JavaScript to apply, or email your company, the robots you deploy and the jobs you deliver to <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p></noscript>
    </form>
  );
}
