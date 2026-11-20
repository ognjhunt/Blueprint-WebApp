import type { PropsWithChildren } from "react";
import { COMPANY } from "@/data/company";
import { openCookieSettings } from "@/components/CookieConsent";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { FOR_DEPLOYMENT_COMPANIES } from "@/lib/publicCopy";
import { BROWSE_JOBS_LABEL, BROWSE_JOBS_PATH } from "@/lib/robotTeamAccess";
import { LegalUpdateBanner } from "./LegalVersionNotes";

type WorkspaceUser = { role?: string; roles?: string[]; finishedOnboarding?: boolean };

/** Same destinations as the app header: unfinished onboarding, everyone else (the capturer role is retired). */
function workspaceFor(user: WorkspaceUser | null | undefined) {
  if (user && !user.finishedOnboarding) return { href: "/onboarding", label: "Finish onboarding" };
  return { href: "/app", label: "Your workspace" };
}

export function MinimalSiteLayout({ children, signInHref = "/sign-in", browseCurrent = false }: PropsWithChildren<{ signInHref?: string; browseCurrent?: boolean }>) {
  const auth = useOptionalAuth();
  const signedIn = Boolean(auth?.currentUser);
  const account = workspaceFor(auth?.userData as WorkspaceUser | null | undefined);
  return (
    <div className="minimal-site">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <LegalUpdateBanner />
      <header className="bare-site-head">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <nav className="bare-site-nav" aria-label="Main navigation">
          <a className="bare-site-head-link" href="/how-it-works">How it works</a>
          {signedIn ? <a className="bare-site-head-link" href={BROWSE_JOBS_PATH} aria-current={browseCurrent ? "page" : undefined}>{BROWSE_JOBS_LABEL}</a>
            : <a className="bare-site-head-link" href="/partners">{FOR_DEPLOYMENT_COMPANIES}</a>}
        </nav>
        <nav className="bare-site-account" aria-label="Account">
          {signedIn ? <a className="bare-site-head-link" href={account.href}>{account.label}</a>
            : <a className="bare-site-head-link" href={signInHref}>Sign in</a>}
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="bare-site-foot">
        <nav aria-label="Footer navigation" style={{ display: "contents" }}>
          <a href="/beta">Questions</a>
          <a href="/beta#who-we-are">About</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refunds">Refunds</a>
          <button type="button" onClick={openCookieSettings}>Cookie settings</button>
        </nav>
        <span className="bare-site-copy">© {new Date().getFullYear()} {COMPANY.legalName}</span>
      </footer>
    </div>
  );
}
