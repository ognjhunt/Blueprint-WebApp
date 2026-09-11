import type { PropsWithChildren } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * Chrome for the account surfaces — sign in, password reset, signup.
 *
 * These routes render on the bare shell (no marketing nav), so they carry
 * their own header rather than inheriting `MinimalSiteLayout`. The header is
 * deliberately thinner than the marketing one: a wordmark home link and the
 * single opposite action, because a form screen with a full nav invites people
 * to leave it. Everything else — ivory ground, DM Sans, the footer — is the
 * same `minimal-site` surface the public pages use, so signing in does not
 * feel like arriving at a different company.
 */
export function MinimalAccountLayout({
  children,
  action,
}: PropsWithChildren<{ action?: { href: string; label: string } }>) {
  return (
    <div className="minimal-site paper-theme">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <header className="ms-header ms-container">
        <a className="ms-brand" href="/" aria-label="Blueprint home">
          <span className="ms-brand-mark" aria-hidden="true" />
          Blueprint
        </a>
        {action ? (
          <nav className="ms-desktop-nav" aria-label="Account navigation">
            <a href={action.href}>{action.label}</a>
          </nav>
        ) : null}
      </header>
      <main id="main-content">{children}</main>
      <footer className="ms-footer ms-container">
        <p>© {new Date().getFullYear()} Blueprint Robotics, Inc.</p>
        <nav aria-label="Footer navigation">
          <a href="mailto:hello@tryblueprint.io">
            Get in touch <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  );
}
