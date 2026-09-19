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
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { WorkspaceRequestError, workspaceRequest } from "@/lib/workspace";

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
  | { status: "invalid"; message: string }
  | { status: "ready"; summary: ClaimSummary }
  | { status: "claimed"; summary: ClaimSummary };

async function attachClaim(token: string, user: import("firebase/auth").User, summary: ClaimSummary, terms: boolean) {
  try {
    return await workspaceRequest(user, "/claim", "POST", { token });
  } catch (error) {
    if (
      error instanceof WorkspaceRequestError &&
      error.code === "workspace_setup_required"
    ) {
      // A fresh account: finish the workspace setup the claim implies, then
      // attach. The site is the organization context, so it seeds the name.
      const name = summary.claimEmail?.split("@")[0] || "Site operator";
      await workspaceRequest(user, "/setup", "POST", {
        name,
        organization: summary.site.siteName || "My site",
        workspaceType: "site_operator",
        acceptedTerms: terms,
      });
      return workspaceRequest(user, "/claim", "POST", { token });
    }
    throw error;
  }
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

  useEffect(() => {
    let live = true;
    (async () => {
      const response = await fetch(`/api/site-claim/${encodeURIComponent(token)}`).catch(() => null);
      const body = (await response?.json().catch(() => ({}))) as ClaimSummary & { error?: string };
      if (!live) return;
      if (!response?.ok) {
        setStage({ status: "invalid", message: body?.error || "This claim link is not valid or has expired." });
        return;
      }
      setStage({ status: "ready", summary: body });
      if (body.claimEmail) setEmail(body.claimEmail);
      // Already signed in with the right address? One click finishes it.
      const user = auth.currentUser;
      if (user) setMode("signin");
    })();
    return () => {
      live = false;
    };
  }, [token]);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stage.status !== "ready") return;
    const summary = stage.summary;
    setBusy(true);
    setError(null);
    try {
      const existing = auth.currentUser;
      const user =
        existing && existing.email?.toLowerCase() === email.trim().toLowerCase()
          ? existing
          : mode === "create"
            ? (await createUserWithEmailAndPassword(getAuth(), email.trim(), password)).user
            : (await signInWithEmailAndPassword(getAuth(), email.trim(), password)).user;
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
  return (
    <Shell>
      <p className="ms-eyebrow">Claim your site</p>
      <h1>{site.siteName || "Your site"} is ready.</h1>
      <p className="ms-field-hint">
        {site.taskStatement
          ? `The scene built from your walkthrough of “${site.taskStatement}” is ready, and robot teams can now evaluate against it.`
          : "The scene built from your walkthrough is ready, and robot teams can now evaluate against it."}
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
        <label htmlFor="claim-password">
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
        </label>
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
  return (
    <section className="ms-inquiry ms-container">
      <div className="ms-inquiry-intro">{children}</div>
    </section>
  );
}

export default ClaimSite;
