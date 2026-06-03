import {
  footerCompanyLinks,
  footerProductLinks,
  footerSupportLinks,
} from "./navigation";
import { BrandLockup } from "./BrandMark";

export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-[#f5f1e8]">
      <div className="mx-auto grid max-w-[88rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.35fr_0.82fr_0.82fr_0.82fr] lg:px-10">
        <div className="max-w-sm space-y-4">
          <a href="/" className="inline-flex text-slate-950" aria-label="Blueprint home">
            <BrandLockup compact />
          </a>
          <p className="text-sm leading-6 text-slate-600">
            Blueprint turns one real facility, one robot task, and one pass bar into Site, Task, Scenario, and Eval Cards before an expensive pilot.
          </p>
          <p className="text-sm leading-6 text-slate-600">
            Public samples show the product shape. Request packets carry provenance, rights, thresholds, and proof gaps without upgrading cards into robot-trial proof.
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
            Contact
          </p>
          {footerCompanyLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Legal
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
          <p>Capture first. Eval cards stay advisory until owner-system proof exists.</p>
        </div>
      </div>
    </footer>
  );
}
