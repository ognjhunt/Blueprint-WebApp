import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import { applyForEarlyAccess, EarlyAccessApplicationError } from "@/lib/robotTeamAccess";

export type PartnerRole = "deployment" | "technology";

/** Both partner roles use the existing reviewed, durable application path. */
export function PartnerApplication({ role }: { role: PartnerRole }) {
  const deployment = role === "deployment";
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
    const read = (key: string) => String(data.get(key) ?? "").trim();
    setState("sending");
    setError("");
    try {
      await applyForEarlyAccess({
        partnerRole: role,
        name: read("name"),
        email: read("email"),
        company: read("company"),
        website: read("website") || undefined,
        robot: read("robot"),
        workWanted: read("workWanted"),
        region: read("region") || undefined,
        supportedSystems: read("supportedSystems") || undefined,
        pilotPackage: read("pilotPackage") || undefined,
        acceptedTerms: true,
        optionalUpdates: data.get("optionalUpdates") === "on",
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
      <p>We review each partner before sharing site opportunities or arranging an evaluation. We will contact you when a job and your capabilities fit.</p>
      <p>Applying does not approve access, commit you to a job, or guarantee work. No account or integration is needed now.</p>
      <a className="ms-text-link" href="/partners">Back to partners <ArrowRight size={17} aria-hidden="true" /></a>
    </div>
  );

  return (
    <form className="ms-form ms-partner-form" onSubmit={submit} method="post" aria-label={deployment ? "Deployment partner application" : "Technology provider application"}>
      <fieldset disabled={!interactive || state === "sending"}>
        <legend className="sr-only">Your company and capabilities</legend>
        <div className="ms-form-row">
          <label>Your name<input name="name" autoComplete="name" maxLength={120} required /></label>
          <label>Work email<input name="email" type="email" autoComplete="email" maxLength={320} required /></label>
        </div>
        <label>Company<input name="company" autoComplete="organization" maxLength={160} required /></label>
        <label>{deployment ? "What jobs can you deliver?" : "What work should your system be assessed on?"}
          <textarea name="workWanted" rows={3} maxLength={1200} required placeholder={deployment ? "The recurring work you install or operate systems for, and the limits of a good fit" : "The tasks your system handles and the conditions it needs"} />
        </label>
        <label>{deployment ? "Your delivery capabilities" : "What does your system do?"}
          <textarea name="robot" rows={3} maxLength={1200} required placeholder={deployment ? "Integration, commissioning, training and support your team provides" : "Hardware, policies or model APIs; what exists today and how it is used"} />
        </label>
        <label>{deployment ? "Where can you install and support systems?" : "Where is your system available?"}
          <input name="region" maxLength={300} required={deployment} placeholder={deployment ? "Cities, states or countries you cover" : "Regions or access restrictions, if any (optional)"} />
        </label>
        <details className="ms-partner-more">
          <summary>Equipment, access and other details <span className="ms-optional">(optional)</span></summary>
          <label>{deployment ? "Supported robots and software" : "Supported robot configurations"}
            <textarea name="supportedSystems" rows={3} maxLength={1200} placeholder={deployment ? "Equipment and policies you can supply, integrate and maintain" : "Robots, grippers, cameras and control interfaces you support"} />
          </label>
          <label>{deployment ? "Availability and support arrangements" : "How could we assess your system?"}
            <textarea name="pilotPackage" rows={3} maxLength={1200} placeholder={deployment ? "Typical lead time, installation responsibilities and ongoing support" : "API or hosted access, existing evaluation evidence, or integration work needed. Do not include keys or credentials."} />
          </label>
          <label>Company website<input name="website" type="url" pattern="https?://.+" autoComplete="url" maxLength={300} placeholder="https://example.com" title="Enter a website beginning with https:// or http://" /></label>
        </details>
        <label className="ms-check-row"><input name="optionalUpdates" type="checkbox" />Email me relevant job opportunities and Blueprint updates. Optional; unsubscribe anytime.</label>
      </fieldset>
      <p className="ms-form-note">By applying, you agree to our <a href={TERMS_URL}>Terms of Service</a> and <a href={PRIVACY_URL}>Privacy Policy</a>. Application notices are separate from optional updates.</p>
      {error && <p role="alert">{error} Your entries are still here. You can also <a href="mailto:hello@tryblueprint.io">contact us</a>.</p>}
      <button className="ms-button" disabled={!interactive || state === "sending"}>{state === "sending" ? "Saving…" : deployment ? "Apply as a deployment partner" : "Make your system available"}<ArrowRight size={18} aria-hidden="true" /></button>
      <noscript><p>Enable JavaScript to apply, or email your company, capabilities and the work you would like to pursue to <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p></noscript>
    </form>
  );
}
