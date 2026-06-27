import {
  footerCompanyLinks,
  footerEvidenceLinks,
  footerProductLinks,
} from "./navigation";
import { BrandLockup } from "./BrandMark";

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
    <footer className="bg-[#0d0d0b] text-[#f3efe6]">
      <div className="mx-auto grid max-w-[88rem] gap-12 px-7 pb-10 pt-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-sm space-y-5">
          <a
            href="/"
            className="inline-flex text-[#f3efe6]"
            aria-label="Blueprint home"
          >
            <BrandLockup tone="paper" compact />
          </a>
          <p className="font-editorial text-[1.05rem] leading-7 text-[#f3efe6]/80">
            Blueprint captures real indoor sites and packages them into evaluation
            evidence, so robot teams can rank policies on real-site task packs before
            field time.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <a
              href="mailto:hello@tryblueprint.io"
              className="inline-flex font-semibold text-[#f3efe6]/80 transition hover:text-[#f3efe6]"
            >
              hello@tryblueprint.io
            </a>
            <a
              href="https://www.linkedin.com/company/blueprintsim/"
              className="inline-flex font-semibold text-[#f3efe6]/80 transition hover:text-[#f3efe6]"
            >
              LinkedIn
            </a>
          </div>
        </div>

        {footerColumns.map((column) => (
          <nav key={column.heading} className="space-y-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#f3efe6]/45">
              {column.heading}
            </p>
            <ul className="space-y-3">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.href}`}>
                  <a
                    href={link.href}
                    className="text-sm text-[#f3efe6]/70 transition hover:text-[#f3efe6]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[88rem] flex-col gap-2 px-7 py-5 font-mono text-[0.7rem] text-[#f3efe6]/55 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Blueprint Robotics, Inc.</p>
          <p>Generated &amp; simulated media is review support &mdash; not real-world proof.</p>
        </div>
      </div>
    </footer>
  );
}
