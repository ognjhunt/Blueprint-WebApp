import {
  footerCompanyLinks,
  footerProductLinks,
  footerSupportLinks,
} from "./navigation";

export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-[#f5f3ef]">
      <div className="mx-auto grid max-w-[88rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.35fr_0.82fr_0.82fr_0.82fr] lg:px-10">
        <div className="max-w-sm space-y-4">
          <a href="/" className="font-editorial text-[2rem] tracking-[-0.05em] text-slate-900">
            Blueprint
          </a>
          <p className="text-sm leading-6 text-slate-600">
            Blueprint turns real-site capture into site-specific products that robot teams can inspect before deployment work gets expensive.
          </p>
          <p className="text-sm leading-6 text-slate-600">
            Robot teams request or review sites. Site operators set access and privacy boundaries. Capturers apply where capture is open.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:hello@tryblueprint.io"
              className="inline-flex text-sm font-semibold text-slate-800 transition hover:text-slate-950"
            >
              hello@tryblueprint.io
            </a>
            <a
              href="https://www.linkedin.com/company/blueprintsim/"
              className="inline-flex text-sm font-semibold text-slate-800 transition hover:text-slate-950"
            >
              LinkedIn
            </a>
          </div>
        </div>

        <nav className="space-y-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Product
          </p>
          {footerProductLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Company
          </p>
          {footerCompanyLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-700">
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

      <div className="border-t border-black/10 bg-white py-4">
        <div className="mx-auto flex max-w-[88rem] flex-col items-start gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>© {new Date().getFullYear()} Blueprint, Inc. All rights reserved.</p>
          <p>Exact sites. Earlier deployment answers.</p>
        </div>
      </div>
    </footer>
  );
}
