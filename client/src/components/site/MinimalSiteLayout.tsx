import { useRef, useState, type PropsWithChildren } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

export function MinimalSiteLayout({ children }: PropsWithChildren) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <div className="minimal-site paper-theme">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <header className="ms-header ms-container">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <nav className="ms-desktop-nav" aria-label="Main navigation">
          <a href="/how-it-works">How it works</a>
          <a href="/contact/robot-team">Robot teams</a>
          <a className="ms-button" href="/contact/site-operator">Discuss your site</a>
        </nav>
        <button ref={menuButton} className="ms-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="ms-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        {menuOpen && (
          <nav id="ms-mobile-nav" className="ms-mobile-nav" aria-label="Mobile navigation" onClick={() => setMenuOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } }}>
            <a href="/how-it-works">How it works</a>
            <a href="/contact/robot-team">Robot teams</a>
            <a className="ms-button" href="/contact/site-operator">Discuss your site</a>
          </nav>
        )}
      </header>
      <main id="main-content">{children}</main>
      <footer className="ms-footer ms-container">
        <p>© {new Date().getFullYear()} Blueprint Robotics, Inc.</p>
        <nav aria-label="Footer navigation">
          <a href="mailto:hello@tryblueprint.io">Get in touch <ArrowUpRight size={14} aria-hidden="true" /></a>
          <a href="/sign-in">Sign in</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  );
}
