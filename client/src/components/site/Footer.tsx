import {
  footerExploreLinks,
  footerReferenceLinks,
  footerUtilityLinks,
} from "./navigation";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.8fr]">
        <div className="max-w-sm space-y-3">
          <a href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Blueprint
          </a>
          <p className="text-sm leading-6 text-slate-500">
            Blueprint helps robot teams test on one exact customer site before travel. Start with
            the public listing, buy the site package, or request a hosted evaluation on the same
            site.
          </p>
          <a
            href="mailto:hello@tryblueprint.io"
            className="inline-flex text-sm font-semibold text-slate-700 transition hover:text-slate-950"
          >
            hello@tryblueprint.io
          </a>
        </div>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Explore
          </p>
          {footerExploreLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Reference
          </p>
          {footerReferenceLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Utility
          </p>
          {footerUtilityLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Blueprint, Inc. All rights reserved.</p>
          <p>Exact sites. Clear buying paths. Fewer surprises before deployment.</p>
        </div>
      </div>
    </footer>
  );
}
