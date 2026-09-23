/**
 * Claim your site — the identity moment of the site-operator funnel.
 *
 * Everything before this page was account-free on purpose: the signed link
 * was the credential for filming, uploading and confirming the brief. But
 * once the scene is real and the site is entering supply, the operator needs
 * authority a forwardable link cannot carry — listing control, pausing,
 * results, and later, money. So this page converts link-custody into
 * account-custody: verify the email the invite was sent to, and the site
 * attaches to their workspace.
 *
 * Deliberately one page, one form: create or sign in, terms if needed, and
 * the claim completes in place. No state to reason about afterwards — if the
 * attach fails, nothing was claimed and the error says so.
 */
import { useEffect, useState, type FormEvent } from "react";
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
import { auth } from "@/lib/firebase";
import { WorkspaceRequestError } from "@/lib/workspace";
import { attachSiteClaim, claimVerificationUrl } from "@/lib/siteClaim";

interface ClaimSummary {
  ok: boolean;
  requestId: string;
  alreadyClaimed: boolean;
  claimEmail: string | null;
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
  return attachSiteClaim(token, user, { email: summary.claimEmail, siteName: summary.site.siteName }, terms);
}

const verificationActionUrl = claimVerificationUrl;

/** Set by the verification email the brief confirmation sends. */
function autoClaimRequested() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auto") === "1";
}

export function ClaimSite() {
  const { token = "" } = useParams();
  const [stage, setStage] = useState<Stage>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setAuthUser(user);
    if (user) setMode("signin");
  }), []);

  async function loadClaim() {
    setStage({ status: "loading" });
    setError(null);
    try {
      const response = await fetch(`/api/site-claim/${encodeURIComponent(token)}`);
      const body = (await response.json().catch(() => ({}))) as ClaimSummary & { error?: string };
      if (!response.ok) {
        setStage({ status: "invalid", message: body?.error || "This claim link is not valid or has expired." });
        return;
      }
      setStage({ status: "ready", summary: body });
      if (body.claimEmail) setEmail(body.claimEmail);
      if (auth.currentUser) setMode("signin");
    } catch {
      setStage({
        status: "load-error",
        message: "We could not check this claim link. Check your connection and try again.",
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
          setStage({ status: "invalid", message: body?.error || "This claim link is not valid or has expired." });
          return;
        }
        setStage({ status: "ready", summary: body });
        if (body.claimEmail) setEmail(body.claimEmail);
        if (auth.currentUser) setMode("signin");
      } catch {
        if (live) {
          setStage({
            status: "load-error",
            message: "We could not check this claim link. Check your connection and try again.",
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

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stage.status !== "ready") return;
    const summary = stage.summary;
    setBusy(true);
    setError(null);
    try {
      const existing = authUser || auth.currentUser;
      const user =
        existing && existing.email?.toLowerCase() === email.trim().toLowerCase()
          ? existing
          : mode === "create"
            ? (await createUserWithEmailAndPassword(getAuth(), email.trim(), password)).user
            : (await signInWithEmailAndPassword(getAuth(), email.trim(), password)).user;
      if (!user.emailVerified) {
        await sendEmailVerification(user, { url: verificationActionUrl(token) });
        setStage({ status: "verify", summary, user });
        return;
      }
      await attachClaim(token, user, summary, terms);
      setStage({ status: "claimed", summary });
    } catch (submitError) {
      const message =
        submitError instanceof WorkspaceRequestError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message.replace("Firebase: ", "")
            : "We could not complete the claim. Please try again.";
      setError(message);
    } finally {
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
      setError(
        verificationError instanceof Error
          ? verificationError.message.replace("Firebase: ", "")
          : "We could not refresh your verification status. Please try again.",
      );
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
      setError(
        verificationError instanceof Error
          ? verificationError.message.replace("Firebase: ", "")
          : "We could not resend the verification email. Please try again.",
      );
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
        <h1>That link has expired.</h1>
        <p className="ms-field-hint">
          {stage.message} Request a fresh one from your workspace, or email hello@tryblueprint.io.
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
          We sent a verification link to {stage.user.email}. Return here after verifying to attach
          this site to your workspace.
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
        <h1>This site is yours.</h1>
        <p className="ms-field-hint">
          {stage.summary.site.siteName || "Your site"} is now in your workspace. You can pause its
          listing at any time — pausing removes it from what robot teams can run against, and your
          footage and rights are unchanged.
        </p>
        <a className="ms-button ms-button-large" href="/app">
          Open your workspace <ArrowRight size={18} aria-hidden="true" />
        </a>
      </Shell>
    );
  }

  const site = stage.summary.site;
  if (stage.summary.alreadyClaimed) {
    return (
      <Shell>
        <Check size={30} aria-hidden="true" />
        <h1>This site is already in a workspace.</h1>
        <p className="ms-field-hint">Open your workspace to review the task, progress, and available results.</p>
        <a className="ms-button ms-button-large" href="/app">
          Open your workspace <ArrowRight size={18} aria-hidden="true" />
        </a>
      </Shell>
    );
  }
  const matchingSignedInUser = Boolean(
    authUser && authUser.email?.toLowerCase() === email.trim().toLowerCase(),
  );
  return (
    <Shell>
      <p className="ms-eyebrow">Claim your site</p>
      <h1>Keep track of {site.siteName || "your site"}.</h1>
      <p className="ms-field-hint">
        {site.taskStatement
          ? `Claim the workspace for “${site.taskStatement}” to follow its progress and review results when they are available.`
          : "Claim the workspace to follow task progress and review results when they are available."}
      </p>
      <p className="ms-field-hint">
        Claiming attaches the site to your account — it is how you see results, control whether the
        site is listed, and pause it anytime.
      </p>

      <form className="ms-form" onSubmit={claim} aria-label="Claim this site">
        <label htmlFor="claim-email">
          <span>Work email</span>
          <span className="ms-field-hint">
            Use {stage.summary.claimEmail ? `(${stage.summary.claimEmail})` : "the address the invite came to"} — the
            site attaches to the email that received this link.
          </span>
          <input
            id="claim-email"
            name="claimEmail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {!matchingSignedInUser && <label htmlFor="claim-password">
          <span>Password</span>
          <span className="ms-field-hint">
            {mode === "create"
              ? "Choose one — six characters or more."
              : "The one your account already uses."}
          </span>
          <input
            id="claim-password"
            name="claimPassword"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>}
        <label htmlFor="claim-terms" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
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
        </label>

        {error && (
          <p className="ms-error" role="alert">
            {error}
          </p>
        )}
        <button className="ms-button ms-button-large" type="submit" disabled={busy}>
          {busy ? "Claiming…" : "Claim this site"}
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
            {mode === "create" ? "Sign in instead" : "Create one"}
          </a>
        </p>
      </form>
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
