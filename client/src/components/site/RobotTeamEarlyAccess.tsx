/**
 * What a robot team sees before it is in early access.
 *
 * Blueprint opens to robot teams a few at a time, so the library is shown to
 * approved teams only. Every
 * other visitor gets the one thing they can do next: apply, wait for a person
 * to read it, or verify the email that was approved.
 */
import { useEffect, useState } from "react";

import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import { currentAuthUser, sendAccountVerification } from "@/lib/accountAuth";
import {
  applyForEarlyAccess,
  EarlyAccessApplicationError,
  type LibraryAccess,
} from "@/lib/robotTeamAccess";

const SIGN_UP_URL = "/signup/business?buyerType=robot_team";

function ApplicationForm({ email }: { email: string | null }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "approved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    setState("sending");
    setError(null);
    try {
      const status = await applyForEarlyAccess({
        name: read("name"),
        email: email ?? read("email"),
        company: read("company"),
        robot: read("robot"),
        workWanted: read("workWanted"),
        testSite: read("testSite") || undefined,
        acceptedTerms: true,
      });
      setState(status === "approved" ? "approved" : "sent");
    } catch (failure) {
      setError(failure instanceof EarlyAccessApplicationError ? failure.message : "The application could not be sent. Try again.");
      setState("error");
    }
  }

  if (state === "approved") {
    return (
      <div className="ms-task-empty" role="status">
        <h2>You are approved.</h2>
        <p>We emailed you how to create your account. Sign up with that email address, verify it, and the site jobs will show here.</p>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div className="ms-task-empty" role="status">
        <h2>Application received.</h2>
        <p>A person reads every application. We will email you with the next step.</p>
      </div>
    );
  }

  return (
    <form className="ms-form" method="post" onSubmit={submit} aria-label="Early access application">
      <label>Your name<input disabled={!interactive} name="name" autoComplete="name" maxLength={120} required /></label>
      {email && <p className="ms-field-hint">Applying as {email}.</p>}
      {!email && <label>Work email<input disabled={!interactive} name="email" type="email" autoComplete="email" maxLength={320} required /></label>}
      <label>Company<input disabled={!interactive} name="company" autoComplete="organization" maxLength={160} required /></label>
      <label>What does your robot do?
        <textarea disabled={!interactive} name="robot" rows={3} maxLength={1200} required
          placeholder="Embodiment, gripper, the policy or policies you run, and how you would connect them" />
      </label>
      <label>What work do you want to test it on?
        <textarea disabled={!interactive} name="workWanted" rows={3} maxLength={1200} required placeholder="e.g. Tote picking in a warehouse, bin to conveyor" />
      </label>
      <label>A site or customer you would want to test at <span className="ms-field-hint">(optional)</span>
        <input disabled={!interactive} name="testSite" placeholder="e.g. the warehouse you are piloting with" maxLength={300} />
      </label>
      <p className="ms-field-hint">
        By applying, you agree to our <a href={TERMS_URL}>Terms of Service</a> and <a href={PRIVACY_URL}>Privacy Policy</a>.
      </p>
      {error && <p role="alert">{error} You can also <a href="mailto:hello@tryblueprint.io">email us your company, robot and the work you want to pursue</a>.</p>}
      <button className="ms-button" disabled={!interactive || state === "sending"}>{state === "sending" ? "Sending…" : "Apply for early access"}</button>
      <noscript><p>Enable JavaScript to apply here, or email your company, robot and the work you want to pursue to <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p></noscript>
    </form>
  );
}

export function RobotTeamEarlyAccess({ access, email }: { access: LibraryAccess | null; email: string | null }) {
  const status = access?.status ?? "none";
  const [verification, setVerification] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resendVerification() {
    setVerification("sending");
    try {
      const user = await currentAuthUser();
      if (!user || !email || user.email?.toLowerCase() !== email.toLowerCase()) throw new Error("account_changed");
      await sendAccountVerification(user, `${window.location.origin}/sites`);
      setVerification("sent");
    } catch {
      setVerification("error");
    }
  }

  if (status === "approved" && access && !access.emailVerified) {
    return (
      <div className="ms-task-empty">
        <h2>You are approved. Verify your email to see jobs.</h2>
        <p>Open the verification email we sent{email ? ` to ${email}` : ""}, then come back to this page.</p>
        <button className="ms-button" type="button" disabled={verification === "sending"} onClick={() => void resendVerification()}>
          {verification === "sending" ? "Sending…" : "Resend verification email"}
        </button>
        {verification === "sent" && <p role="status">Verification email sent. Check your inbox, then reload this page.</p>}
        {verification === "error" && <p role="alert">We could not resend the email. Try again from Settings.</p>}
      </div>
    );
  }

  if (status === "applied") {
    return (
      <div className="ms-task-empty">
        <h2>Your application is in review.</h2>
        <p>A person reads every application. We will email{email ? ` ${email}` : " you"} with the next step.</p>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="ms-task-empty">
        <h2>Thanks for applying.</h2>
        <p>We cannot offer access yet. We will email you if that changes, and you can reach us at <a href="mailto:hello@tryblueprint.io">hello@tryblueprint.io</a>.</p>
      </div>
    );
  }

  return (
    <section aria-label="Early access" className="ms-early-access">
      <div className="ms-task-empty">
        <h2>Apply for early access.</h2>
        <p>
          No policy upload or integration needed.
        </p>
      </div>
      <ApplicationForm email={email} />
      {!access?.signedIn && (
        <p className="ms-field-hint">
          Already approved? <a href={SIGN_UP_URL}>Create your account</a> with the approved email, or <a href="/sign-in">sign in</a>.
        </p>
      )}
    </section>
  );
}
