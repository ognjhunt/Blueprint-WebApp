import {
  footerCompanyLinks,
  footerProductLinks,
  footerSupportLinks,
} from "./navigation";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-stone-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]">
        <div className="max-w-sm space-y-4">
          <a href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Blueprint
          </a>
          <p className="text-sm leading-6 text-slate-500">
            Site-specific world models, buyer-facing proof, and hosted evaluation grounded in real
            capture.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:hello@tryblueprint.io"
              className="inline-flex text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              hello@tryblueprint.io
            </a>
            <a
              href="https://www.linkedin.com/company/blueprintsim/"
              className="inline-flex text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              LinkedIn
            </a>
          </div>
        </div>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Product
          </p>
          {footerProductLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Company
          </p>
          {footerCompanyLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Support
          </p>
          {footerSupportLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Blueprint, Inc. All rights reserved.</p>
          <p>Exact sites. Earlier deployment answers.</p>
        </div>
      </div>
    </footer>
  );
}
