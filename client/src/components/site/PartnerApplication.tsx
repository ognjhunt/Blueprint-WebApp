import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PRIVACY_URL } from "@/lib/legalAcceptance";
import { applyForEarlyAccess, EarlyAccessApplicationError } from "@/lib/robotTeamAccess";
import { companyJobReturnPath } from "@/lib/authReturnPath";
import { COMPANY_CHECK_RULE_SENTENCE } from "@/lib/companyCheck";

/** The saved application, while the automatic check runs (owner direction 2026-11-23). */
export const APPLICATION_SAVED_LINES = "We're checking your company against that rule now. If it meets the rule, you'll get your approval email shortly. "
  + "Otherwise we'll email you our answer within three working days. Once approved, you get an email for each new job.";

/**
 * The one application a deployment company sends to see jobs (on `/partners`; `/contact/robot-team` points here). Four
 * fields: your name, work email, company and company website. Nothing is agreed here; the signed-in agreement before
 * the first job is what counts (`companyTerms.ts`).
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
        website: read("website"),
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
      <p>{APPLICATION_SAVED_LINES}</p>
    </div>
  );

  return (
    <form className="ms-form ms-partner-form" onSubmit={submit} method="post" aria-label="Deployment company application">
      <h2>Apply to see jobs</h2>
      <p>{COMPANY_CHECK_RULE_SENTENCE} Once approved, you get an email for each new job. Nothing is charged today.</p>
      <fieldset disabled={!interactive || state === "sending"}>
        <legend className="sr-only">Your company</legend>
        <div className="ms-form-row">
          <label>Your name<input name="name" autoComplete="name" maxLength={120} required /></label>
          <label>Work email<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
        </div>
        <label>Company<input name="company" autoComplete="organization" maxLength={160} required /></label>
        <label>Company website<input name="website" type="url" pattern="https?://.+" autoComplete="url" maxLength={300} required placeholder="https://example.com" title="Enter a website beginning with https:// or http://" /></label>
      </fieldset>
      {error && <p role="alert">{error} Your entries are still here. You can also <a href="mailto:hello@tryblueprint.io">contact us</a>.</p>}
      <button className="ms-button" disabled={!interactive || state === "sending"}>{state === "sending" ? "Saving…" : "Apply"}<ArrowRight size={18} aria-hidden="true" /></button>
      {/* A notice, not a tick: nothing is agreed on this form (owner, 2026-11-23). */}
      <p className="ms-form-note"><a href={PRIVACY_URL}>Privacy Policy</a></p>
      <noscript><p>Enable JavaScript to apply, or email your name, your company and its website to <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p></noscript>
    </form>
  );
}
