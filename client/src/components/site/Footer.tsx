import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

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

export function Footer() {
  return (
    <footer className="bg-kinetic-dark text-white">
      <div className="mx-auto max-w-[94rem] px-5 pb-8 pt-16 sm:px-8 lg:px-10 lg:pt-20">
        <div className="grid gap-14 border-b border-white/12 pb-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-[25rem]">
            <a
              href="/"
              className="text-[1.08rem] font-bold uppercase tracking-[0.16em] text-kinetic-cyan"
              aria-label="Blueprint home"
            >
              Blueprint
            </a>
            <p className="mt-7 text-[clamp(1.4rem,2vw,2rem)] font-medium leading-[1.22] tracking-[-0.035em] text-white/88">
              Do the deployment homework before the robot arrives.
            </p>
            <a
              href="mailto:hello@tryblueprint.io"
              className="mt-7 inline-flex items-center gap-2 text-sm text-white/58 transition hover:text-kinetic-cyan"
            >
              hello@tryblueprint.io
              <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                {column.heading}
              </p>
              <ul className="mt-5 space-y-1">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <a
                      href={link.href}
                      className="inline-flex min-h-10 items-center text-sm text-white/62 transition hover:translate-x-0.5 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="grid gap-3 py-7 font-mono text-[10px] leading-5 text-white/35 sm:grid-cols-[auto_1fr] sm:items-start">
          <p>&copy; {new Date().getFullYear()} Blueprint Robotics, Inc.</p>
          <p className="sm:text-right">
            Blueprint prepares months 0–2. Onsite integration, physical validation, and safety approval remain with the site and robot provider.
          </p>
        </div>
      </div>
    </footer>
  );
}
