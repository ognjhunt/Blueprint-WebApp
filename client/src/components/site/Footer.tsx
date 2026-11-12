import { ArrowUpRight } from "lucide-react";


import {
  footerCompanyLinks,
  footerEvidenceLinks,
  footerProductLinks,
} from "./navigation";

type FooterColumn = {
  heading: string;
  links: ReadonlyArray<{ href: string; label: string }>;
};

const footerColumns: FooterColumn[] = [
  { heading: "Product", links: footerProductLinks },
  { heading: "Evidence", links: footerEvidenceLinks },
  { heading: "Company", links: footerCompanyLinks },
];

/**
 * The footer says what Blueprint does in one line and keeps physical responsibility clear.
 */
export function Footer() {
  return (
    <footer className="border-t border-runway-line bg-runway-deep text-runway-text">
      <div className="mx-auto max-w-[92rem] px-5 pb-8 pt-16 sm:px-8 lg:px-10 lg:pt-20">
        <div className="grid gap-14 border-b border-runway-line pb-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-[26rem]">
            <a
              href="/"
              className="text-[1.08rem] font-bold uppercase tracking-[0.16em] text-runway-signal"
              aria-label="Blueprint home"
            >
              Blueprint
            </a>
            <p className="mt-7 text-sm leading-7 text-runway-mute">
              Film a job once. We turn it into a job packet robot deployment companies can judge. With your permission, we share a summary with companies we approve. Your video stays private.
            </p>
            <a
              href="mailto:hello@tryblueprint.io"
              className="mt-5 inline-flex items-center gap-2 text-sm text-runway-mute transition hover:text-runway-signal"
            >
              hello@tryblueprint.io
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-runway-faint">
                {column.heading}
              </p>
              <ul className="mt-5 space-y-1">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <a
                      href={link.href}
                      className="inline-flex min-h-10 items-center text-sm text-runway-mute transition hover:translate-x-0.5 hover:text-runway-text"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="grid gap-3 py-7 font-mono text-[10px] leading-5 text-runway-faint sm:grid-cols-[auto_1fr] sm:items-start">
          <p>&copy; {new Date().getFullYear()} Blueprint Robotics, Inc.</p>
          <p className="sm:text-right">
            We take pick-up-and-put-down jobs best. Nothing here is a test at your site or a safety check.
          </p>
        </div>
      </div>
    </footer>
  );
}
