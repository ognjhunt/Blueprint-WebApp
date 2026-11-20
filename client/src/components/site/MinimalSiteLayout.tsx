import type { PropsWithChildren } from "react";
import { COMPANY } from "@/data/company";
import { openCookieSettings } from "@/components/CookieConsent";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { LegalUpdateBanner } from "./LegalVersionNotes";
import { ACCOUNT_LINK, footerLinks, primaryNavLinks, SIGN_IN_LABEL } from "./navigation";

export function MinimalSiteLayout({ children, signInHref = "/sign-in", browseCurrent = false }: PropsWithChildren<{ signInHref?: string; browseCurrent?: boolean }>) {
  const auth = useOptionalAuth();
  const signedIn = Boolean(auth?.currentUser);
  const [howItWorks, findJobs] = primaryNavLinks(signedIn);
  return (
    <div className="minimal-site">
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <LegalUpdateBanner />
      <header className="bare-site-head">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
        <nav className="bare-site-nav" aria-label="Main navigation">
          <a className="bare-site-head-link" href={howItWorks.href}>{howItWorks.label}</a>
          <a className="bare-site-head-link" href={findJobs.href} aria-current={signedIn && browseCurrent ? "page" : undefined}>{findJobs.label}</a>
        </nav>
        <nav className="bare-site-account" aria-label="Account">
          {signedIn ? <a className="bare-site-head-link" href={ACCOUNT_LINK.href}>{ACCOUNT_LINK.label}</a>
            : <a className="bare-site-head-link" href={signInHref}>{SIGN_IN_LABEL}</a>}
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="bare-site-foot">
        <nav aria-label="Footer navigation" style={{ display: "contents" }}>
          {footerLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
          <button type="button" onClick={openCookieSettings}>Cookie settings</button>
        </nav>
        <span className="bare-site-copy">© {new Date().getFullYear()} {COMPANY.legalName}</span>
      </footer>
    </div>
  );
}
