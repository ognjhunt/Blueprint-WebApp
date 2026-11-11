import type { PropsWithChildren } from "react";
import { COMPANY } from "@/data/company";
import { openCookieSettings } from "@/components/CookieConsent";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { LegalUpdateBanner } from "./LegalVersionNotes";

type WorkspaceUser = { role?: string; roles?: string[]; finishedOnboarding?: boolean };

/** Same destinations as the app header: unfinished onboarding, everyone else (the capturer role is retired). */
function workspaceFor(user: WorkspaceUser | null | undefined) {
  if (user && !user.finishedOnboarding) return { href: "/onboarding", label: "Finish onboarding" };
  return { href: "/app", label: "Your workspace" };
}

export function MinimalSiteLayout({ children }: PropsWithChildren) {
  // Bare bones (2026-11-11): the header is the brand and one quiet link; the page owns its one button. A signed-in
  // visitor sees their account, routed the way the app header routes each persona.
  const auth = useOptionalAuth();
  const signedIn = Boolean(auth?.currentUser);
  const account = workspaceFor(auth?.userData as WorkspaceUser | null | undefined);
  return (
    <div className="minimal-site">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <LegalUpdateBanner />
      <header className="bare-site-head">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <nav aria-label="Account">
          {signedIn ? <a className="bare-site-head-link" href={account.href}>{account.label}</a>
            : <a className="bare-site-head-link" href="/sign-in">Sign in</a>}
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="bare-site-foot">
        <nav aria-label="Footer navigation" style={{ display: "contents" }}>
          <a href="/beta#who-we-are">About</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <button type="button" onClick={openCookieSettings}>Cookie settings</button>
        </nav>
        <span className="bare-site-copy">© {new Date().getFullYear()} {COMPANY.legalName}</span>
      </footer>
    </div>
  );
}
