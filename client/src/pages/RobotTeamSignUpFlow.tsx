import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { signInWithCustomToken, sendEmailVerification, type User } from "firebase/auth";
import { Helmet } from "@/lib/helmet";
import { SEO } from "@/components/SEO";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { workspaceRequest } from "@/lib/workspace";
import { invitationRequest, type AccountInvitation } from "@/lib/accountInvitation";
import { friendlyAuthError } from "@/lib/siteClaim";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalAcceptance";
import { authReturnPath } from "@/lib/authReturnPath";

/**
 * Public URLs collect interest; only a current server-approved invitation shows the setup. The invitation reached this
 * address, so "Create account" signs it in with no password (owner, 2026-11-23); Google still works.
 */
export default function RobotTeamSignUpFlow() {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("invitation") || "");
  const [invitation, setInvitation] = useState<AccountInvitation | null>(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const account = useRef<User | null>(null);
  const pending = useRef(false);
  const googleReady = useRef(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    invitationRequest<AccountInvitation>("inspect", token).then(data => {
      if (!active) return;
      setInvitation(data); setName(data.name); setOrganization(data.organization);
      void import("@/lib/firebase").catch(() => undefined);
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);

  async function finish(user: User) {
    if (!invitation || user.email?.trim().toLowerCase() !== invitation.email) throw new Error("Sign in with the email address on your Blueprint invitation.");
    account.current = user;
    await workspaceRequest(user, "/setup", "POST", { name: name.trim(), organization: organization.trim(), workspaceType: invitation.workspaceType, acceptedTerms: true });
    const returnTo = authReturnPath(invitation.returnTo) ?? "/contact/robot-team";
    if (!user.emailVerified) await sendEmailVerification(user, { url: new URL(returnTo, window.location.origin).toString() });
    window.location.assign(returnTo);
  }
  async function submit(google: boolean) {
    if (pending.current || !invitation) return;
    setError("");
    if (!terms || !name.trim() || !organization.trim()) { setError("Enter your name and company, and agree to the Terms and Privacy Policy."); return; }
    pending.current = true; setBusy(true);
    try {
      const firebase = await import("@/lib/firebase");
      if (google) {
        if (!googleReady.current) { await invitationRequest("redeem", token, { mode: "google", acceptedTerms: true }); googleReady.current = true; }
        await finish(await firebase.signInWithGoogle());
      } else {
        let user = account.current;
        if (!user) {
          // An address that already has an account signs in on the sign-in page (password, Google or an emailed link).
          const data = await invitationRequest<{ customToken: string }>("redeem", token, { mode: "link", acceptedTerms: true });
          user = (await signInWithCustomToken(firebase.auth, data.customToken)).user;
          account.current = user;
        }
        await finish(user);
      }
    } catch (failure: any) {
      setError(failure.code === "auth/popup-blocked" && googleReady.current
        ? "Your invitation is ready. Click Continue with Google again to open sign-in."
        : friendlyAuthError(failure, "We could not finish account setup. Please try again."));
    } finally { pending.current = false; setBusy(false); }
  }
  return <>
    <Helmet><meta name="referrer" content="no-referrer" /></Helmet>
    <SEO noIndex title={`${invitation ? "Create your account" : "Access by invitation"} | Blueprint`} description="Accounts for deployment companies Blueprint has approved." canonical="/signup/business" />
    <AuthLayout>
      <h1>{checking ? "Checking your invitation" : invitation ? "Create your account" : "Access by invitation"}</h1>
      {!invitation ? <>
        {!checking && <p className="auth-description">Deployment companies apply first. Once we approve your company, we email you a link to create your account.</p>}
        {!checking && <div className="auth-form">
          <a className="auth-primary" href="/jobs#partner-application">Apply to see jobs <ArrowRight size={18} aria-hidden="true" /></a>
          <a className="auth-google" href="/contact/site-operator">Start a job</a>
        </div>}
        {!checking && <p className="auth-description">Already approved? Open the invitation link we emailed you, or <a href="/contact/robot-team#approved-team">get a new invitation link</a>.</p>}
      </> : <>
        <p className="auth-description">Your company is approved. Use the email address on your invitation.</p>
        <form className="auth-form auth-simple-signup" onSubmit={event => { event.preventDefault(); void submit(false); }} aria-busy={busy}>
          <div><label htmlFor="email">Work email</label><input id="email" type="email" value={invitation.email} readOnly autoComplete="email" /></div>
          {/* The name and company come from the application; asked only when the invitation lacks them. */}
          {!invitation.name && <div><label htmlFor="contactName">Your name</label><input id="contactName" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={160} disabled={busy} /></div>}
          {!invitation.organization && <div><label htmlFor="organizationName">Company</label><input id="organizationName" value={organization} onChange={e => setOrganization(e.target.value)} autoComplete="organization" maxLength={160} disabled={busy} /></div>}
          <p className="auth-signup-note">You get an email for each new job. You can turn these off in Settings.</p>
          <label className="auth-signup-consent"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} disabled={busy} /><span>I agree to the <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms</a> and <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> and am authorized to create this company’s account.</span></label>
          <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Saving…" : account.current ? "Finish setup" : "Create account"}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <button className="auth-google" type="button" disabled={busy} onClick={() => void submit(true)}>Continue with Google</button>
      </>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <p className="auth-account-link">Already have an account? <a href={`/sign-in?next=${encodeURIComponent(authReturnPath(invitation?.returnTo ?? null) ?? "/contact/robot-team")}`}>Sign in</a></p>
    </AuthLayout>
  </>;
}
