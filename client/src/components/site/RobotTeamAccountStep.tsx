/**
 * The account moment on the robot-team plan page.
 *
 * Seeing the plan needs nothing. Paying for it needs a verified Blueprint
 * account, because we need to know who our customers are before money moves.
 * This asks for it at exactly that point: password or Google, then one
 * verification click, and the team the page registered is connected to the
 * account. After that the same account issues the team's agent keys.
 */
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import {
  createPasswordAccount,
  currentAuthUser,
  sendAccountVerification,
  signInPasswordAccount,
  signInWithGoogleAccount,
} from "@/lib/accountAuth";
import { friendlyAuthError } from "@/lib/siteClaim";
import { connectRobotTeam, robotTeamVerificationUrl, setUpRobotTeamWorkspace } from "@/lib/robotTeamAccount";

type Step =
  | { status: "form" }
  | { status: "working" }
  | { status: "verify"; user: User };

export function RobotTeamAccountStep(props: {
  agentKey: string;
  email: string;
  teamName: string;
  /** Called once the team is connected to a verified account. */
  onConnected: () => void;
  /** Called before the page may be left for the verification email. */
  onAwaitingVerification?: () => void;
}) {
  const [step, setStep] = useState<Step>({ status: "form" });
  const [email, setEmail] = useState(props.email);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from the verification email, already signed in: connect without
  // asking again. Anything that fails leaves the form in place.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connect") !== "1") return;
    let live = true;
    void (async () => {
      try {
        const user = await currentAuthUser();
        if (!user) return;
        await user.reload();
        if (!user.emailVerified || !live) return;
        await user.getIdToken(true);
        await connectRobotTeam(user, props.agentKey, { teamName: props.teamName, acceptedTerms: false });
        if (live) props.onConnected();
      } catch {
        // The form below is the fallback.
      }
    })();
    return () => {
      live = false;
    };
    // Runs once for the page load that returned from the email.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish(user: User) {
    if (user.emailVerified) {
      await connectRobotTeam(user, props.agentKey, { teamName: props.teamName, acceptedTerms: terms });
      props.onConnected();
      return;
    }
    await setUpRobotTeamWorkspace(user, { teamName: props.teamName, acceptedTerms: terms });
    props.onAwaitingVerification?.();
    await sendAccountVerification(user, robotTeamVerificationUrl());
    setStep({ status: "verify", user });
  }

  async function start(google: boolean) {
    if (!terms) {
      setError("Accept the Terms and Privacy Policy to create your account.");
      return;
    }
    if (!google && password.length < 6) {
      setError("Choose a password of six characters or more.");
      return;
    }
    setError(null);
    setStep({ status: "working" });
    try {
      const existing = await currentAuthUser();
      const user = existing && !google && existing.email?.toLowerCase() === email.trim().toLowerCase()
        ? existing
        : google
          ? await signInWithGoogleAccount()
          : mode === "create"
            ? await createPasswordAccount(email.trim(), password)
            : await signInPasswordAccount(email.trim(), password);
      await finish(user);
    } catch (startError) {
      setError(friendlyAuthError(startError, "We could not set up your account."));
      setStep({ status: "form" });
    }
  }

  async function checkVerified(user: User) {
    setError(null);
    try {
      await user.reload();
      if (!user.emailVerified) {
        setError("Your email is not verified yet. Open the link we sent, then try again.");
        return;
      }
      await user.getIdToken(true);
      await connectRobotTeam(user, props.agentKey, { teamName: props.teamName, acceptedTerms: terms });
      props.onConnected();
    } catch (verifyError) {
      setError(friendlyAuthError(verifyError, "We could not connect your team."));
    }
  }

  if (step.status === "verify") {
    return (
      <div aria-live="polite" style={{ margin: "16px 0" }}>
        <p style={{ fontWeight: 500 }}>Check your inbox.</p>
        <p className="ms-field-hint">
          We sent a link to {step.user.email}. One click verifies your email and connects your team;
          then you can run this plan.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="ms-button" type="button" onClick={() => void checkVerified(step.user)}>
          I’ve verified my email
        </button>
      </div>
    );
  }

  return (
    <fieldset style={{ border: "1px solid var(--ms-rule)", padding: "14px", margin: "16px 0" }}>
      <legend style={{ padding: "0 6px", fontWeight: 600 }}>Create your account to run these</legend>
      <p className="ms-field-hint" style={{ marginTop: 0 }}>
        The plan is free to look at. Running it needs a Blueprint account, so we know who we are
        working with. Your agent can take it from there with a key from your account settings.
      </p>
      <label htmlFor="team-account-email">
        <span>Work email</span>
        <input
          id="team-account-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label htmlFor="team-account-password">
        <span>{mode === "create" ? "Choose a password" : "Your password"}</span>
        <input
          id="team-account-password"
          type="password"
          minLength={6}
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <p className="ms-form-note">
        <a
          className="ms-text-link"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setMode(mode === "create" ? "signin" : "create");
          }}
        >
          {mode === "create" ? "I already have an account" : "Create a new account instead"}
        </a>
      </p>
      <label className="ms-check-row">
        <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
        <span>
          I accept the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </span>
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        className="ms-button"
        type="button"
        disabled={step.status === "working"}
        onClick={() => void start(false)}
      >
        {step.status === "working" ? "Setting up…" : mode === "create" ? "Create account and continue" : "Sign in and continue"}
      </button>
      <button
        className="ms-button"
        type="button"
        disabled={step.status === "working"}
        onClick={() => void start(true)}
        style={{ marginTop: "8px" }}
      >
        Continue with Google
      </button>
    </fieldset>
  );
}
