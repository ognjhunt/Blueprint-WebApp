import { useRef, useState, type PropsWithChildren } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { COMPANY } from "@/data/company";
import { openCookieSettings } from "@/components/CookieConsent";
import { useOptionalAuth } from "@/contexts/AuthContext";

type WorkspaceUser = { role?: string; roles?: string[]; finishedOnboarding?: boolean };

/** Same destinations as the app header: capturers, unfinished onboarding, everyone else. */
function workspaceFor(user: WorkspaceUser | null | undefined) {
  if (user?.role === "capturer" || user?.roles?.includes("capturer")) return { href: "/capture-app/account", label: "Your workspace" };
  if (user && !user.finishedOnboarding) return { href: "/onboarding", label: "Finish onboarding" };
  return { href: "/app", label: "Your workspace" };
}

export function MinimalSiteLayout({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // A signed-in visitor sees their account, not the signed-out call to action,
  // routed the same way the app header routes each persona.
  const auth = useOptionalAuth();
  const signedIn = Boolean(auth?.currentUser);
  const account = workspaceFor(auth?.userData as WorkspaceUser | null | undefined);
  const primary = signedIn
    ? <a className="ms-button" href={account.href}>{account.label}</a>
    : <a className="ms-button" href="/contact/site-operator">Start a job assessment</a>;
  return (
    <div className="minimal-site">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <header className="ms-header ms-container">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <nav className="ms-desktop-nav" aria-label="Main navigation">
          <a href="/how-it-works">How it works</a>
          <a href="/pricing">Pricing</a>
          <a href="/contact/robot-team">Robot teams</a>
          {primary}
        </nav>
        <button ref={menuButton} className="ms-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="ms-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        {menuOpen && (
          <nav id="ms-mobile-nav" className="ms-mobile-nav" aria-label="Mobile navigation" onClick={() => setMenuOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } }}>
            <a href="/how-it-works">How it works</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact/robot-team">Robot teams</a>
            {primary}
          </nav>
        )}
      </header>
      <main id="main-content">{children}</main>
      <footer className="ms-footer ms-container">
        <div className="ms-footer-brand">
          <a className="ms-brand" href="/" aria-label="Return to homepage"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
          <p className="ms-footer-description">Blueprint connects businesses that need work done with robot teams that can do it.</p>
          <p>© {new Date().getFullYear()} {COMPANY.legalName}</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href={`mailto:${COMPANY.emails.hello}`}>Get in touch <ArrowUpRight size={14} aria-hidden="true" /></a>
          <a href="/about">About</a>{signedIn ? <a href={account.href}>{account.label}</a> : <a href="/sign-in">Sign in</a>}<a href="/privacy">Privacy</a><a href="/terms">Terms</a>
          <button type="button" className="ms-footer-link" onClick={openCookieSettings}>Cookie settings</button>
        </nav>
      </footer>
    </div>
  );
}
