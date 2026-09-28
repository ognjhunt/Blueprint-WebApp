import { useRef, useState, type PropsWithChildren } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { COMPANY } from "@/data/company";
import { openCookieSettings } from "@/components/CookieConsent";

export function MinimalSiteLayout({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <div className="minimal-site">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <header className="ms-header ms-container">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <nav className="ms-desktop-nav" aria-label="Main navigation">
          <a href="/how-it-works">How it works</a>
          <a href="/pricing">Pricing</a>
          <a href="/contact/robot-team">Robot teams</a>
          <a className="ms-button" href="/contact/site-operator">Start a task assessment</a>
        </nav>
        <button ref={menuButton} className="ms-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="ms-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        {menuOpen && (
          <nav id="ms-mobile-nav" className="ms-mobile-nav" aria-label="Mobile navigation" onClick={() => setMenuOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } }}>
            <a href="/how-it-works">How it works</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact/robot-team">Robot teams</a>
            <a className="ms-button" href="/contact/site-operator">Start a task assessment</a>
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
          <a href="/about">About</a><a href="/sign-in">Sign in</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>
          <button type="button" className="ms-footer-link" onClick={openCookieSettings}>Cookie settings</button>
        </nav>
      </footer>
    </div>
  );
}
