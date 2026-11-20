import { COMPANY } from "@/data/company";
import { openCookieSettings } from "@/components/CookieConsent";
import { footerLinks } from "./navigation";

/**
 * The Runway footer (staff operations pages, and a moment on a redirect): the same links as the public pages' footer
 * (`MinimalSiteLayout`), from the same model (`navigation.ts`), launch copy 2026-11-20.
 */
export function Footer() {
  return (
    <footer className="border-t border-runway-line bg-runway-deep text-runway-text">
      <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-sm sm:px-8 lg:px-10">
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-10 items-center text-runway-mute transition hover:text-runway-text"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={openCookieSettings}
            className="inline-flex min-h-10 items-center text-runway-mute transition hover:text-runway-text"
          >
            Cookie settings
          </button>
        </nav>
        <p className="font-mono text-[10px] leading-5 text-runway-faint">
          &copy; {new Date().getFullYear()} {COMPANY.legalName}
        </p>
      </div>
    </footer>
  );
}
