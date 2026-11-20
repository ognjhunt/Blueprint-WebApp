/**
 * Claim your site — the identity moment of the site-operator funnel.
 *
 * The signed private job link can receive footage and corrections before
 * account setup. This page verifies the submitted email and adds workspace
 * access; the server-bound source owner and retained video stay unchanged.
 * Account-only listing and workspace controls still require the verified owner.
 *
 * Deliberately one page, one form: create or sign in, terms if needed, and
 * the claim completes in place. No state to reason about afterwards — if the
 * attach fails, nothing was claimed and the error says so.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { auth, signInWithGoogle } from "@/lib/firebase";
import { workspaceRequest } from "@/lib/workspace";
import type { WorkspaceAccountSetup } from "@/types/workspace";
import { attachSiteClaim, claimVerificationUrl, friendlyAuthError, setUpSiteWorkspace } from "@/lib/siteClaim";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

interface ClaimSummary {
  ok: boolean;
  requestId: string;
  alreadyClaimed: boolean;
  claimEmail: string | null;
  siteTermsAcceptedCurrent: boolean;
  accountDefaults?: { name: string; organization: string | null };
  site: {
    siteName: string | null;
    siteLocation: string | null;
    taskStatement: string | null;
    qualificationState: string | null;
  };
}

type Stage =
  | { status: "loading" }
  | { status: "load-error"; message: string }
  | { status: "invalid"; message: string }
  | { status: "ready"; summary: ClaimSummary }
  | { status: "verify"; summary: ClaimSummary; user: User }
  | { status: "claimed"; summary: ClaimSummary };

function attachClaim(token: string, user: User, summary: ClaimSummary, terms: boolean) {
  // A fresh account gets the workspace setup the claim implies; the site is
  // the organization context, so it seeds the name.
  return attachSiteClaim(token, user, accountContext(summary), terms);
}

function accountContext(summary: ClaimSummary) {
  return { email: summary.claimEmail, siteName: summary.site.siteName,
    name: summary.accountDefaults?.name, organization: summary.accountDefaults?.organization };
}

const verificationActionUrl = claimVerificationUrl;

const LOAD_ERROR_MESSAGE = "Check your connection and try again.";

/**
 * A refused link (4xx) cannot work, whatever the reason; a server failure (5xx) says nothing about the link, so it gets
 * the retry screen instead of "This link doesn't work".
 */
function refusedStage(status: number, error: string | undefined): Stage {
  if (status >= 500) return { status: "load-error", message: error || "Please try again." };
  return { status: "invalid", message: error || "This link has expired or is not valid." };
}

/** Set by the verification email the brief confirmation sends. */
function autoClaimRequested() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auto") === "1";
}

export function ClaimSite() {
  const { token = "" } = useParams();
  // A claim link is an authority boundary. Reset its summary, credentials,
  // consent and pending UI updates before rendering a different link.
  return <ClaimSiteForToken key={token} token={token} />;
}

function ClaimSiteForToken({ token }: { token: string }) {
  const [stage, setStage] = useState<Stage>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"create" | "signin">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signin" ? "signin" : "create");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);
  const [accountTermsCurrent, setAccountTermsCurrent] = useState(false);
  const pending = useRef(false);
  const createdAccount = useRef<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setAuthUser(user);
    if (user) setMode("signin");
  }), []);

  const claimEmail = stage.status === "ready" ? stage.summary.claimEmail : null;
  const siteTermsAcceptedCurrent = stage.status === "ready" && stage.summary.siteTermsAcceptedCurrent;
  useEffect(() => {
    setAccountTermsCurrent(false);
    if (!authUser?.emailVerified ||
        authUser.email?.toLowerCase() !== claimEmail?.toLowerCase() ||
        siteTermsAcceptedCurrent) return;
    let live = true;
    workspaceRequest<WorkspaceAccountSetup>(authUser, "/setup")
      .then((account) => { if (live) setAccountTermsCurrent(account.termsRequired === false); })
      .catch(() => { /* Keep the checkbox when account acceptance cannot be verified. */ });
    return () => { live = false; };
  }, [authUser, claimEmail, siteTermsAcceptedCurrent]);

  async function loadClaim() {
    setStage({ status: "loading" });
    setError(null);
    try {
      const response = await fetch(`/api/site-claim/${encodeURIComponent(token)}`);
      const body = (await response.json().catch(() => ({}))) as ClaimSummary & { error?: string };
      if (!response.ok) {
        setStage(refusedStage(response.status, body?.error));
        return;
      }
      setStage({ status: "ready", summary: body });
      if (body.claimEmail) setEmail(body.claimEmail);
      if (auth.currentUser) setMode("signin");
    } catch {
      setStage({
        status: "load-error",
        message: LOAD_ERROR_MESSAGE,
      });
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetch(`/api/site-claim/${encodeURIComponent(token)}`);
        const body = (await response.json().catch(() => ({}))) as ClaimSummary & { error?: string };
        if (!live) return;
        if (!response.ok) {
          setStage(refusedStage(response.status, body?.error));
          return;
        }
        setStage({ status: "ready", summary: body });
        if (body.claimEmail) setEmail(body.claimEmail);
        if (auth.currentUser) setMode("signin");
      } catch {
        if (live) {
          setStage({
            status: "load-error",
            message: LOAD_ERROR_MESSAGE,
          });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  // Arriving from the verification email with the verified account signed in:
  // the account and terms were set up at brief confirmation, so the click is
  // the whole step. Anything that fails falls back to the form below.
  useEffect(() => {
    if (stage.status !== "ready" || stage.summary.alreadyClaimed || !autoClaimRequested()) return;
    const user = authUser;
    const claimEmail = stage.summary.claimEmail?.toLowerCase();
    if (!user || !claimEmail || user.email?.toLowerCase() !== claimEmail) return;
    let live = true;
    const summary = stage.summary;
    (async () => {
      try {
        await user.reload();
        if (!user.emailVerified) return;
        await user.getIdToken(true);
        await attachClaim(token, user, summary, false);
        if (live) setStage({ status: "claimed", summary });
      } catch {
        // The form stays available; claiming by hand shows the real error.
      }
    })();
    return () => {
      live = false;
    };
  }, [stage, authUser, token]);

  async function claim(event?: FormEvent<HTMLFormElement>, google = false) {
    event?.preventDefault();
    if (pending.current || busy || stage.status !== "ready") return;
    const summary = stage.summary;
    if (!summary.claimEmail || email.trim().toLowerCase() !== summary.claimEmail.trim().toLowerCase()) {
      setError("Use the email address you submitted with this job."); return;
    }
    if (!(summary.siteTermsAcceptedCurrent || accountTermsCurrent) && !terms) {
      setError("Accept the Terms and Privacy Policy to save this job."); return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const existing = createdAccount.current || authUser || auth.currentUser;
      const user =
        existing && existing.email?.toLowerCase() === email.trim().toLowerCase()
          ? existing
          : google ? await signInWithGoogle()
          : mode === "create"
            ? (await createUserWithEmailAndPassword(getAuth(), email.trim(), password)).user
            : (await signInWithEmailAndPassword(getAuth(), email.trim(), password)).user;
      if (user.email?.toLowerCase() !== summary.claimEmail.toLowerCase()) throw new Error("Use the Google account for the email you submitted with this job.");
      createdAccount.current = user;
      setPassword("");
      if (!user.emailVerified) {
        // Record the workspace and the terms just accepted now, while they are
        // on this page: the claim that follows the verification link runs on
        // its own and has no checkbox to read. A refusal here leaves the form
        // path, which reports the real error.
        if (terms) await setUpSiteWorkspace(user, accountContext(summary), true, token)
          .catch(() => undefined);
        await sendEmailVerification(user, { url: verificationActionUrl(token) });
        setStage({ status: "verify", summary, user });
        return;
      }
      await attachClaim(token, user, summary, terms);
      setStage({ status: "claimed", summary });
    } catch (submitError) {
      setError(friendlyAuthError(submitError, "We could not save this job to your account. Please try again."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function confirmVerification() {
    if (busy || stage.status !== "verify") return;
    setBusy(true);
    setError(null);
    try {
      await stage.user.reload();
      await stage.user.getIdToken(true);
      if (!stage.user.emailVerified) {
        setError("Your email is not verified yet. Open the verification link, then try again.");
        return;
      }
      await attachClaim(token, stage.user, stage.summary, terms);
      setStage({ status: "claimed", summary: stage.summary });
    } catch (verificationError) {
      setError(friendlyAuthError(verificationError, "We could not refresh your verification status. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (busy || stage.status !== "verify") return;
    setBusy(true);
    setError(null);
    try {
      await sendEmailVerification(stage.user, { url: verificationActionUrl(token) });
    } catch (verificationError) {
      setError(friendlyAuthError(verificationError, "We could not resend the verification email. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (stage.status === "loading") {
    return <Shell><p className="ms-field-hint">Loading…</p></Shell>;
  }

  if (stage.status === "invalid") {
    return (
      <Shell>
        <h1>This link doesn't work.</h1>
        <p className="ms-field-hint">
          {stage.message} For a new one, open your job page and choose Job settings › Save to my account, or write to
          hello@tryblueprint.io.
        </p>
      </Shell>
    );
  }

  if (stage.status === "load-error") {
    return (
      <Shell>
        <h1>We couldn’t check this link.</h1>
        <p className="ms-field-hint">{stage.message}</p>
        <button className="ms-button ms-button-large" type="button" onClick={loadClaim}>
          Try again
        </button>
      </Shell>
    );
  }

  if (stage.status === "verify") {
    return (
      <Shell>
        <p className="ms-eyebrow">Verify your email</p>
        <h1>Check your inbox.</h1>
        <p className="ms-field-hint">
          We sent a link to {stage.user.email}. Open it to finish saving this job to your account.
        </p>
        {error && <p className="ms-error" role="alert">{error}</p>}
        <button className="ms-button ms-button-large" type="button" disabled={busy} onClick={confirmVerification}>
          {busy ? "Checking…" : "I’ve verified my email"}
        </button>
        <button className="ms-text-link" type="button" disabled={busy} onClick={resendVerification}>
          Resend verification email
        </button>
      </Shell>
    );
  }

  if (stage.status === "claimed") {
    return (
      <Shell>
        <Check size={30} aria-hidden="true" />
        <h1>Saved to your account.</h1>
        <p className="ms-field-hint">
          {stage.summary.site.siteName || "Your site"} is now in your account. Open it from Your jobs any time.
          You can still withdraw your job or video from its job page.
        </p>
        <a className="ms-button ms-button-large" href="/app">
          Open your jobs <ArrowRight size={18} aria-hidden="true" />
        </a>
      </Shell>
    );
  }

  const site = stage.summary.site;
  if (stage.summary.alreadyClaimed) {
    return (
      <Shell>
        <Check size={30} aria-hidden="true" />
        <h1>This job is already saved to an account.</h1>
        <p className="ms-field-hint">Sign in to open it.</p>
        <a className="ms-button ms-button-large" href="/app">
          Open your jobs <ArrowRight size={18} aria-hidden="true" />
        </a>
      </Shell>
    );
  }
  const matchingSignedInUser = Boolean(
    authUser && authUser.email?.toLowerCase() === email.trim().toLowerCase(),
  );
  const priorAcceptanceApplies = Boolean(
    stage.summary.siteTermsAcceptedCurrent || accountTermsCurrent,
  );
  return (
    <Shell>
      <p className="ms-eyebrow">Your job is saved</p>
      <h1>Keep track of {site.siteName || "your site"}.</h1>
      <p className="ms-field-hint">
        {site.taskStatement
          ? `Save “${site.taskStatement}” to an account so you can open it any time.`
          : "Create an account or sign in so you can open this job any time."}
      </p>

      <form className="ms-form" onSubmit={claim} aria-label="Save this job to your account">
        <label htmlFor="claim-email">
          <span>Email</span>
          <span className="ms-field-hint">The email you used for this job.</span>
          <input
            id="claim-email"
            name="claimEmail"
            type="email"
            required
            autoComplete="email"
            value={email}
            readOnly
          />
        </label>
        {!matchingSignedInUser && <label htmlFor="claim-password">
          <span>Password</span>
          <span className="ms-field-hint">
            {mode === "create"
              ? `Choose one — ${MIN_PASSWORD_LENGTH} characters or more.`
              : "The one your account already uses."}
          </span>
          <input
            id="claim-password"
            name="claimPassword"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>}
        {!priorAcceptanceApplies && <label htmlFor="claim-terms" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
          <input
            id="claim-terms"
            name="claimTerms"
            type="checkbox"
            required
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            style={{ marginTop: "4px" }}
          />
          <span className="ms-field-hint">
            I accept the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </span>
        </label>}

        {error && (
          <p className="ms-error" role="alert">
            {error}
          </p>
        )}
        <button className="ms-button ms-button-large" type="submit" disabled={busy}>
          {busy ? "Saving…" : matchingSignedInUser ? "Save job to my account" : mode === "create" ? "Create account and save job" : "Sign in and save job"}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <p className="ms-form-note">
          {mode === "create" ? "Already have an account?" : "New here?"}{" "}
          <a
            className="ms-text-link"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setMode(mode === "create" ? "signin" : "create");
            }}
          >
            {mode === "create" ? "Sign in instead" : "Create an account"}
          </a>
        </p>
      </form>
      {!matchingSignedInUser && <>
        <div className="auth-divider"><span>or</span></div>
        <button className="auth-google" type="button" disabled={busy} onClick={() => void claim(undefined, true)}>Continue with Google</button>
      </>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  // The same shell as sign-in and sign-up: this is the one account moment in
  // the site funnel, and it should look like the account pages, not like an
  // unstyled bare route.
  return (
    <AuthLayout>
      <div className="ms-inquiry-intro">{children}</div>
    </AuthLayout>
  );
}

export default ClaimSite;
